import { useProductDetail } from "./product-detail/useProductDetail";
import { ProductDetailView } from "./product-detail/ProductDetailView";

export default function ProductDetailPage() {
  const productDetailData = useProductDetail();

  return <ProductDetailView {...productDetailData} />;
}
