import { fetchProductByEan, fetchProductByQr } from "../../services/productsApi";
import { fetchBinByQr } from "../../services/warehousesApi";
import type { BinLocation, Product } from "../../types";
import { parseScanValue } from "../../utils/scannerUtils";

export async function resolveProductFromScan(scanInput: string, productCandidates: Product[]): Promise<Product> {
  const parsed = parseScanValue(scanInput);

  if (parsed.type === "ean") {
    return fetchProductByEan(parsed.value);
  }

  if (parsed.type === "product_qr") {
    try {
      return await fetchProductByQr(parsed.normalized);
    } catch {
      const byNumber = productCandidates.find(
        (item) => item.product_number === parsed.value || item.product_number === parsed.normalized
      );
      if (byNumber) {
        return byNumber;
      }
    }
  }

  try {
    return await fetchProductByQr(parsed.normalized);
  } catch {
    const byNumber = productCandidates.find((item) => item.product_number === parsed.normalized);
    if (!byNumber) {
      throw new Error("Produkt konnte aus dem Scan nicht aufgelöst werden");
    }
    return byNumber;
  }
}

export async function resolveBinFromScan(scanInput: string, binCandidates: BinLocation[]): Promise<BinLocation> {
  const parsed = parseScanValue(scanInput);

  if (parsed.type === "bin_qr") {
    return fetchBinByQr(parsed.normalized);
  }

  try {
    return await fetchBinByQr(parsed.normalized);
  } catch {
    const byCode = binCandidates.find((bin) => bin.code === parsed.normalized);
    if (!byCode) {
      throw new Error("Lagerplatz konnte aus dem Scan nicht aufgelöst werden");
    }
    return byCode;
  }
}
