import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Check } from "lucide-react";
import { resolveImg } from "@/lib/api";
import { addToCart, fmtPrice } from "@/lib/shopCart";
import { CartButton, CartDrawer } from "./PublicShop";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicProduct() {
  const { slug, productSlug } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState({});
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/public/shops/${slug}`),
      axios.get(`${API}/public/shops/${slug}/products/${productSlug}`),
    ]).then(([sRes, pRes]) => {
      setShop(sRes.data.shop);
      setProduct(pRes.data);
    }).catch(() => toast.error("Produit introuvable"))
      .finally(() => setLoading(false));
  }, [slug, productSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#6B7280]">Chargement...</div>;
  if (!product || !shop) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[#6B7280]">
      <div className="font-serif-instrument text-2xl">Produit introuvable</div>
      <Link to={`/shop/${slug}`} className="text-[#C84B31] underline">Retour à la boutique</Link>
    </div>
  );

  const theme = shop.theme || {};
  const themeCss = `
    .pshop .bg-\\[\\#1F3D2D\\]{background-color:${theme.primary_color||"#1F3D2D"}!important}
    .pshop .hover\\:bg-\\[\\#1F3D2D\\]:hover{background-color:${theme.primary_color||"#1F3D2D"}!important}
    .pshop .text-\\[\\#1F3D2D\\]{color:${theme.primary_color||"#1F3D2D"}!important}
    .pshop .bg-\\[\\#C84B31\\]{background-color:${theme.accent_color||"#C84B31"}!important}
    .pshop .hover\\:bg-\\[\\#C84B31\\]:hover{background-color:${theme.accent_color||"#C84B31"}!important}
    .pshop .text-\\[\\#C84B31\\]{color:${theme.accent_color||"#C84B31"}!important}
    .pshop .font-serif-instrument{font-family:'${theme.font_heading||"Instrument Serif"}',serif!important}
    .pshop .font-manrope{font-family:'${theme.font_body||"Manrope"}',sans-serif!important}
  `;

  const variants = product.variants || [];
  const variantsComplete = variants.every((g) => selectedVariant[g.name]);
  const inStock = (product.stock || 0) > 0;
  const currency = shop.currency || "EUR";

  const handleAdd = () => {
    if (variants.length > 0 && !variantsComplete) {
      toast.error("Veuillez sélectionner toutes les options");
      return;
    }
    addToCart(slug, product, variants.length ? selectedVariant : null, qty);
    toast.success("Ajouté au panier");
    setCartOpen(true);
  };

  return (
    <div className="pshop min-h-screen bg-[#FDFBF7]" data-testid="public-product">
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <header className="border-b border-[#E5E1D8] bg-[#FDFBF7] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to={`/shop/${slug}`} className="flex items-center gap-2 font-manrope text-sm hover:text-[#C84B31]">
            <ArrowLeft className="w-4 h-4" /> {shop.name}
          </Link>
          <CartButton slug={slug} onClick={() => setCartOpen(true)} />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square bg-[#F3F1EC] overflow-hidden rounded-md border border-[#E5E1D8]">
            {(product.images || [])[imgIdx] ? (
              <img src={resolveImg(product.images[imgIdx])} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6B7280]">Aucune image</div>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((im, i) => (
                <button key={i} type="button" onClick={() => setImgIdx(i)} data-testid={`thumb-${i}`} className={`w-16 h-16 border-2 rounded overflow-hidden shrink-0 ${i === imgIdx ? "border-[#C84B31]" : "border-[#E5E1D8]"}`}>
                  <img src={resolveImg(im)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-3">— {product.category || "Produit"}</div>
          <h1 className="font-serif-instrument text-4xl md:text-5xl text-[#111827] leading-tight">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-manrope text-2xl font-semibold text-[#1F3D2D]">{fmtPrice(product.price_cents, currency)}</span>
            {product.compare_at_cents > product.price_cents && (
              <span className="font-manrope text-sm text-[#6B7280] line-through">{fmtPrice(product.compare_at_cents, currency)}</span>
            )}
          </div>
          {product.description && <p className="mt-6 font-manrope text-[#374151] leading-relaxed whitespace-pre-line">{product.description}</p>}

          {variants.length > 0 && (
            <div className="mt-8 space-y-5">
              {variants.map((g) => (
                <div key={g.name} data-testid={`variant-group-${g.name}`}>
                  <div className="font-manrope text-sm font-medium mb-2">{g.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((opt) => {
                      const active = selectedVariant[g.name] === opt;
                      return (
                        <button key={opt} type="button" data-testid={`variant-${g.name}-${opt}`}
                          onClick={() => setSelectedVariant({ ...selectedVariant, [g.name]: opt })}
                          className={`px-4 py-2 border rounded-md font-manrope text-sm transition-colors ${active ? "bg-[#1F3D2D] text-white border-[#1F3D2D]" : "border-[#E5E1D8] hover:border-[#1F3D2D]"}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-[#E5E1D8] rounded-md">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} data-testid="product-qty-dec" className="px-3 py-2 hover:bg-[#F3F1EC]">−</button>
              <span data-testid="product-qty" className="px-4 py-2 font-manrope text-sm min-w-[2.5rem] text-center">{qty}</span>
              <button type="button" onClick={() => setQty(qty + 1)} data-testid="product-qty-inc" className="px-3 py-2 hover:bg-[#F3F1EC]">+</button>
            </div>
            <button type="button" onClick={handleAdd} disabled={!inStock} data-testid="add-to-cart" className="flex-1 bg-[#1F3D2D] hover:bg-[#C84B31] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-manrope font-medium flex items-center justify-center gap-2 transition-colors">
              {inStock ? <><ShoppingCart className="w-4 h-4" /> Ajouter au panier</> : "Rupture de stock"}
            </button>
          </div>

          <div className="mt-8 text-xs font-manrope text-[#6B7280] space-y-1">
            <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#1F3D2D]" /> Paiement sécurisé via Stripe</div>
            <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#1F3D2D]" /> Retrait en boutique ou livraison</div>
            <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#1F3D2D]" /> TVA incluse</div>
          </div>
        </div>
      </section>

      <CartDrawer slug={slug} shop={shop} open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
