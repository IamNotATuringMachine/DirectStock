import { useEffect } from "react";

import type { BinLocation, Product, Warehouse, WarehouseZone } from "../../../types";

type UseGoodsReceiptDefaultsParams = {
  selectedWarehouseId: number | null;
  setSelectedWarehouseId: (warehouseId: number | null) => void;
  warehouses: Warehouse[] | undefined;
  selectedZoneId: number | null;
  setSelectedZoneId: (zoneId: number | null) => void;
  zones: WarehouseZone[] | undefined;
  selectedBinId: string;
  setSelectedBinId: (binId: string) => void;
  bins: BinLocation[] | undefined;
  selectedProductId: string;
  setSelectedProductId: (productId: string) => void;
  products: Product[] | undefined;
};

export function useGoodsReceiptDefaults({
  selectedWarehouseId,
  setSelectedWarehouseId,
  warehouses,
  selectedZoneId,
  setSelectedZoneId,
  zones,
  selectedBinId,
  setSelectedBinId,
  bins,
  selectedProductId,
  setSelectedProductId,
  products,
}: UseGoodsReceiptDefaultsParams) {
  useEffect(() => {
    if (!selectedWarehouseId && warehouses && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [selectedWarehouseId, setSelectedWarehouseId, warehouses]);

  useEffect(() => {
    if (!selectedZoneId && zones && zones.length > 0) {
      setSelectedZoneId(zones[0].id);
    }
  }, [selectedZoneId, setSelectedZoneId, zones]);

  useEffect(() => {
    if (!selectedBinId && bins && bins.length > 0) {
      setSelectedBinId(String(bins[0].id));
    }
  }, [selectedBinId, setSelectedBinId, bins]);

  useEffect(() => {
    if (!selectedProductId && products && products.length > 0) {
      setSelectedProductId(String(products[0].id));
    }
  }, [selectedProductId, setSelectedProductId, products]);
}
