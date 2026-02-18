import { useState } from "react";

import type { ProductFormState, ProductTab, WarehouseSettingFormState } from "../model";
import { emptyProductForm } from "../model";

export function useProductFormState() {
  const [activeTab, setActiveTab] = useState<ProductTab>("master");
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());
  const [warehouseFormById, setWarehouseFormById] = useState<Record<number, WarehouseSettingFormState>>({});

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierProductNumber, setSupplierProductNumber] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierLeadTimeDays, setSupplierLeadTimeDays] = useState("");
  const [supplierMinOrderQuantity, setSupplierMinOrderQuantity] = useState("");
  const [supplierPreferred, setSupplierPreferred] = useState(false);

  const [basePriceNet, setBasePriceNet] = useState("");
  const [basePriceVatRate, setBasePriceVatRate] = useState("19");
  const [basePriceError, setBasePriceError] = useState<string | null>(null);

  const [defaultBinId, setDefaultBinId] = useState<number | null>(null);
  const [defaultBinWarehouseId, setDefaultBinWarehouseId] = useState<number | null>(null);
  const [defaultBinZoneId, setDefaultBinZoneId] = useState<number | null>(null);

  return {
    activeTab,
    setActiveTab,
    productForm,
    setProductForm,
    warehouseFormById,
    setWarehouseFormById,
    selectedSupplierId,
    setSelectedSupplierId,
    supplierProductNumber,
    setSupplierProductNumber,
    supplierPrice,
    setSupplierPrice,
    supplierLeadTimeDays,
    setSupplierLeadTimeDays,
    supplierMinOrderQuantity,
    setSupplierMinOrderQuantity,
    supplierPreferred,
    setSupplierPreferred,
    basePriceNet,
    setBasePriceNet,
    basePriceVatRate,
    setBasePriceVatRate,
    basePriceError,
    setBasePriceError,
    defaultBinId,
    setDefaultBinId,
    defaultBinWarehouseId,
    setDefaultBinWarehouseId,
    defaultBinZoneId,
    setDefaultBinZoneId,
  };
}
