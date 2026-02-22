import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAbcClassification, recomputeAbcClassification } from "../../services/abcApi";
import { fetchPurchaseEmailSettings, updatePurchaseEmailSettings } from "../../services/purchaseEmailSettingsApi";
import {
  convertPurchaseRecommendation,
  dismissPurchaseRecommendation,
  fetchPurchaseRecommendations,
  generatePurchaseRecommendations,
} from "../../services/purchaseRecommendationsApi";
import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  fetchPurchaseOrderCommunications,
  fetchPurchaseOrderItems,
  fetchPurchaseOrders,
  sendPurchaseOrderEmail,
  syncPurchaseOrderMailbox,
  updatePurchaseOrderStatus,
  updatePurchaseOrderSupplierConfirmation,
} from "../../services/purchasingApi";
import { fetchAllProducts } from "../../services/productsApi";
import {
  fetchSupplierPurchaseEmailTemplate,
  fetchSuppliers,
  updateSupplierPurchaseEmailTemplate,
} from "../../services/suppliersApi";
import { useAuthStore } from "../../stores/authStore";
import type {
  PurchaseEmailSettingsUpdatePayload,
  PurchaseOrder,
  SupplierPurchaseEmailTemplate,
} from "../../types";
import { PurchasingView } from "./PurchasingView";
import { transitionTargets, type PurchasingTab } from "./model";

export default function PurchasingPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<PurchasingTab>("orders");

  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [productId, setProductId] = useState<string>("");
  const [orderedQuantity, setOrderedQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const [confirmationDeliveryDate, setConfirmationDeliveryDate] = useState("");
  const [confirmationNote, setConfirmationNote] = useState("");
  const [mailboxSyncSummary, setMailboxSyncSummary] = useState<string | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);
  const [purchaseEmailSettingsFeedback, setPurchaseEmailSettingsFeedback] = useState<string | null>(null);
  const [supplierTemplateDraft, setSupplierTemplateDraft] = useState<SupplierPurchaseEmailTemplate | null>(null);
  const [setupSupplierId, setSetupSupplierId] = useState<string>("");

  const canEditSupplierTemplate = Boolean(user?.permissions?.includes("module.suppliers.write"));

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchasing"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200, isActive: true }),
    enabled: tab === "orders" || tab === "recommendations" || tab === "setup",
  });

  const productsQuery = useQuery({
    queryKey: ["products", "purchasing-picker"],
    queryFn: () => fetchAllProducts(),
    enabled: tab === "orders",
  });

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => fetchPurchaseOrders(),
    enabled: tab === "orders",
  });

  const orderItemsQuery = useQuery({
    queryKey: ["purchase-order-items", selectedOrderId],
    queryFn: () => fetchPurchaseOrderItems(selectedOrderId as number),
    enabled: tab === "orders" && selectedOrderId !== null,
  });

  const communicationsQuery = useQuery({
    queryKey: ["purchase-order-communications", selectedOrderId],
    queryFn: () => fetchPurchaseOrderCommunications(selectedOrderId as number),
    enabled: tab === "orders" && selectedOrderId !== null,
  });

  const abcQuery = useQuery({
    queryKey: ["abc-classification"],
    queryFn: () => fetchAbcClassification(),
    enabled: tab === "abc",
  });

  const recommendationsQuery = useQuery({
    queryKey: ["purchase-recommendations"],
    queryFn: () => fetchPurchaseRecommendations({ status: "open" }),
    enabled: tab === "recommendations",
  });

  const purchaseEmailSettingsQuery = useQuery({
    queryKey: ["purchase-email-settings"],
    queryFn: fetchPurchaseEmailSettings,
    enabled: tab === "setup",
  });

  const selectedOrder = useMemo(
    () => ordersQuery.data?.find((order) => order.id === selectedOrderId) ?? null,
    [ordersQuery.data, selectedOrderId]
  );

  const selectedSupplierId = selectedOrder?.supplier_id ?? null;
  const setupSupplierIdNumber = setupSupplierId ? Number(setupSupplierId) : null;
  const activeTemplateSupplierId = tab === "setup" ? setupSupplierIdNumber : selectedSupplierId;

  const selectedSupplierName = useMemo(() => {
    if (!selectedSupplierId) {
      return null;
    }
    return suppliersQuery.data?.items.find((supplier) => supplier.id === selectedSupplierId)?.company_name ?? null;
  }, [selectedSupplierId, suppliersQuery.data]);

  const supplierTemplateQuery = useQuery({
    queryKey: ["supplier-purchase-template", activeTemplateSupplierId],
    queryFn: () => fetchSupplierPurchaseEmailTemplate(activeTemplateSupplierId as number),
    enabled: (tab === "orders" || tab === "setup") && activeTemplateSupplierId !== null,
  });

  useEffect(() => {
    if (selectedOrder) {
      setConfirmationDeliveryDate(selectedOrder.supplier_delivery_date ?? "");
      setConfirmationNote(selectedOrder.supplier_last_reply_note ?? "");
    } else {
      setConfirmationDeliveryDate("");
      setConfirmationNote("");
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (supplierTemplateQuery.data) {
      setSupplierTemplateDraft(supplierTemplateQuery.data);
      setTemplateFeedback(null);
    } else if (activeTemplateSupplierId === null) {
      setSupplierTemplateDraft(null);
      setTemplateFeedback(null);
    }
  }, [supplierTemplateQuery.data, activeTemplateSupplierId]);

  useEffect(() => {
    if (tab !== "setup") {
      return;
    }
    if (setupSupplierId) {
      return;
    }
    const fallbackSupplierId = selectedSupplierId ?? suppliersQuery.data?.items[0]?.id ?? null;
    if (fallbackSupplierId) {
      setSetupSupplierId(String(fallbackSupplierId));
    }
  }, [tab, setupSupplierId, selectedSupplierId, suppliersQuery.data]);

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async (order) => {
      setNotes("");
      setSupplierId("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setSelectedOrderId(order.id);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof createPurchaseOrderItem>[1];
    }) => createPurchaseOrderItem(orderId, payload),
    onSuccess: async () => {
      setOrderedQuantity("1");
      setUnitPrice("");
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, nextStatus }: { orderId: number; nextStatus: PurchaseOrder["status"] }) =>
      updatePurchaseOrderStatus(orderId, nextStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-items", selectedOrderId] });
    },
  });

  const sendOrderEmailMutation = useMutation({
    mutationFn: (orderId: number) => sendPurchaseOrderEmail(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-communications", selectedOrderId] });
    },
  });

  const syncMailboxMutation = useMutation({
    mutationFn: syncPurchaseOrderMailbox,
    onSuccess: async (result) => {
      setMailboxSyncSummary(
        `Sync: verarbeitet ${result.processed}, zugeordnet ${result.matched}, übersprungen ${result.skipped}`
      );
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-communications"] });
    },
  });

  const supplierConfirmationMutation = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: number;
      payload: Parameters<typeof updatePurchaseOrderSupplierConfirmation>[1];
    }) => updatePurchaseOrderSupplierConfirmation(orderId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-order-communications", selectedOrderId] });
    },
  });

  const saveSupplierTemplateMutation = useMutation({
    mutationFn: ({ supplierId: templateSupplierId, payload }: { supplierId: number; payload: SupplierPurchaseEmailTemplate }) =>
      updateSupplierPurchaseEmailTemplate(templateSupplierId, {
        salutation: payload.salutation,
        subject_template: payload.subject_template,
        body_template: payload.body_template,
        signature: payload.signature,
      }),
    onSuccess: async (saved) => {
      setSupplierTemplateDraft(saved);
      setTemplateFeedback("Template gespeichert");
      await queryClient.invalidateQueries({ queryKey: ["supplier-purchase-template", saved.supplier_id] });
      await queryClient.invalidateQueries({ queryKey: ["suppliers", "purchasing"] });
    },
    onError: () => {
      setTemplateFeedback("Template konnte nicht gespeichert werden");
    },
  });

  const savePurchaseEmailSettingsMutation = useMutation({
    mutationFn: (payload: PurchaseEmailSettingsUpdatePayload) => updatePurchaseEmailSettings(payload),
    onSuccess: async () => {
      setPurchaseEmailSettingsFeedback("SMTP/IMAP Konfiguration gespeichert");
      await queryClient.invalidateQueries({ queryKey: ["purchase-email-settings"] });
    },
    onError: () => {
      setPurchaseEmailSettingsFeedback("SMTP/IMAP Konfiguration konnte nicht gespeichert werden");
    },
  });

  const recomputeAbcMutation = useMutation({
    mutationFn: () => recomputeAbcClassification(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["abc-classification"] });
    },
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: () => generatePurchaseRecommendations(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const convertRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => convertPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
      ]);
    },
  });

  const dismissRecommendationMutation = useMutation({
    mutationFn: (recommendationId: number) => dismissPurchaseRecommendation(recommendationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-recommendations"] });
    },
  });

  const allowedTransitions = selectedOrder ? transitionTargets[selectedOrder.status] : [];

  const onCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    await createOrderMutation.mutateAsync({
      supplier_id: supplierId ? Number(supplierId) : null,
      notes: notes.trim() || undefined,
    });
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrderId || !productId) {
      return;
    }

    await createItemMutation.mutateAsync({
      orderId: selectedOrderId,
      payload: {
        product_id: Number(productId),
        ordered_quantity: orderedQuantity,
        unit: "piece",
        unit_price: unitPrice.trim() ? unitPrice.trim() : null,
      },
    });
  };

  const onTemplateFieldChange = (
    field: keyof Omit<SupplierPurchaseEmailTemplate, "supplier_id">,
    value: string
  ) => {
    setSupplierTemplateDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        [field]: value,
      };
    });
    setTemplateFeedback(null);
  };

  return (
    <PurchasingView
      tab={tab}
      onTabChange={setTab}
      ordersSidebarProps={{
        supplierId,
        onSupplierIdChange: setSupplierId,
        notes,
        onNotesChange: setNotes,
        onCreateOrder: (event) => void onCreateOrder(event),
        createOrderPending: createOrderMutation.isPending,
        suppliers: suppliersQuery.data?.items ?? [],
        orders: ordersQuery.data ?? [],
        selectedOrderId,
        onSelectOrder: setSelectedOrderId,
        ordersLoading: ordersQuery.isLoading,
      }}
      orderDetailsProps={{
        selectedOrder,
        selectedSupplierName,
        allowedTransitions,
        onStatusTransition: (orderId, nextStatus) => {
          void statusMutation.mutateAsync({ orderId, nextStatus });
        },
        statusMutationPending: statusMutation.isPending,
        onAddItem: (event) => void onAddItem(event),
        productId,
        onProductIdChange: setProductId,
        products: productsQuery.data?.items ?? [],
        orderedQuantity,
        onOrderedQuantityChange: setOrderedQuantity,
        unitPrice,
        onUnitPriceChange: setUnitPrice,
        createItemPending: createItemMutation.isPending,
        orderItems: orderItemsQuery.data ?? [],
        orderItemsLoading: orderItemsQuery.isLoading,
        onSendOrderEmail: (orderId) => {
          void sendOrderEmailMutation.mutateAsync(orderId);
        },
        sendOrderEmailPending: sendOrderEmailMutation.isPending,
        onSyncMailbox: () => {
          void syncMailboxMutation.mutateAsync();
        },
        syncMailboxPending: syncMailboxMutation.isPending,
        mailboxSyncSummary,
        onConfirmSupplierReply: (orderId, payload) => {
          void supplierConfirmationMutation.mutateAsync({ orderId, payload });
        },
        confirmSupplierReplyPending: supplierConfirmationMutation.isPending,
        confirmationDeliveryDate,
        onConfirmationDeliveryDateChange: setConfirmationDeliveryDate,
        confirmationNote,
        onConfirmationNoteChange: setConfirmationNote,
        communications: communicationsQuery.data?.items ?? [],
        communicationsLoading: communicationsQuery.isLoading,
        supplierTemplate: supplierTemplateDraft,
        supplierTemplateLoading: supplierTemplateQuery.isLoading,
        canEditSupplierTemplate,
        onTemplateFieldChange,
        onSaveSupplierTemplate: () => {
          if (!activeTemplateSupplierId || !supplierTemplateDraft) {
            return;
          }
          void saveSupplierTemplateMutation.mutateAsync({
            supplierId: activeTemplateSupplierId,
            payload: supplierTemplateDraft,
          });
        },
        saveSupplierTemplatePending: saveSupplierTemplateMutation.isPending,
        templateFeedback,
      }}
      abcTabProps={{
        items: abcQuery.data?.items ?? [],
        loading: abcQuery.isLoading,
        recomputePending: recomputeAbcMutation.isPending,
        onRecompute: () => {
          void recomputeAbcMutation.mutateAsync();
        },
      }}
      recommendationsTabProps={{
        items: recommendationsQuery.data?.items ?? [],
        loading: recommendationsQuery.isLoading,
        generatePending: generateRecommendationsMutation.isPending,
        convertPending: convertRecommendationMutation.isPending,
        dismissPending: dismissRecommendationMutation.isPending,
        onGenerate: () => {
          void generateRecommendationsMutation.mutateAsync();
        },
        onConvert: (recommendationId) => {
          void convertRecommendationMutation.mutateAsync(recommendationId);
        },
        onDismiss: (recommendationId) => {
          void dismissRecommendationMutation.mutateAsync(recommendationId);
        },
      }}
      setupTabProps={{
        suppliers: suppliersQuery.data?.items ?? [],
        selectedSupplierId: setupSupplierId,
        onSelectedSupplierIdChange: (value) => {
          setSetupSupplierId(value);
          setTemplateFeedback(null);
        },
        supplierTemplate: supplierTemplateDraft,
        supplierTemplateLoading: supplierTemplateQuery.isLoading,
        canEditSupplierTemplate,
        onTemplateFieldChange,
        onSaveSupplierTemplate: () => {
          if (!activeTemplateSupplierId || !supplierTemplateDraft) {
            return;
          }
          void saveSupplierTemplateMutation.mutateAsync({
            supplierId: activeTemplateSupplierId,
            payload: supplierTemplateDraft,
          });
        },
        saveSupplierTemplatePending: saveSupplierTemplateMutation.isPending,
        templateFeedback,
        purchaseEmailSettings: purchaseEmailSettingsQuery.data ?? null,
        purchaseEmailSettingsLoading: purchaseEmailSettingsQuery.isLoading,
        onSavePurchaseEmailSettings: (payload) => {
          setPurchaseEmailSettingsFeedback(null);
          void savePurchaseEmailSettingsMutation.mutateAsync(payload);
        },
        savePurchaseEmailSettingsPending: savePurchaseEmailSettingsMutation.isPending,
        purchaseEmailSettingsFeedback,
      }}
    />
  );
}
