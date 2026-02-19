import { fetchProductByEan, fetchProductByQr } from "../../services/productsApi";
import { fetchBinByQr } from "../../services/warehousesApi";
import { parseScanValue } from "../../utils/scannerUtils";

export async function resolveProductFromScan(scanInput: string) {
  const parsed = parseScanValue(scanInput);
  if (parsed.type === "ean") {
    return fetchProductByEan(parsed.value);
  }
  if (parsed.type === "product_qr") {
    return fetchProductByQr(parsed.normalized);
  }
  return fetchProductByQr(parsed.normalized);
}

export async function resolveBinFromScan(scanInput: string) {
  const parsed = parseScanValue(scanInput);
  if (parsed.type !== "bin_qr") {
    throw new Error("invalid_bin_scan");
  }
  return fetchBinByQr(parsed.normalized);
}
