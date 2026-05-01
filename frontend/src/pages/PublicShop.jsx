import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ShoppingCart, Store, Phone, Mail, MapPin, Plus, Minus, X, ArrowRight } from "lucide-react";
import { resolveImg } from "@/lib/api";
import { readCart, addToCart, updateQty, removeItem, cartCount, cartSubtotalCents, fmtPrice } from "@/lib/shopCart";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function CartButton({ slug, onClick }) {
  const [count, setCount] = useState(cartCount(slug));
  useEffect(() => {
    const h = (e) => { if (!e.detail || e.detail.slug === slug) setCount(cartCount(slug)); };
    window.addEventListener("shopCartUpdate", h);
    return () => window.removeEventListener("shopCartUpdate", h);
  }, [slug]);
  return (
    <button type="button" onClick={onClick} data-testid="open-cart" className="relative bg-[#1F3D2D] text-white px-4 py-2 rounded-md hover:bg-[#C84B31] transition-colors flex items-center gap-2">
      <ShoppingCart className="w-4 h-4" /> Panier
      {count > 0 && <span data-testid="cart-count" className="absolute -top-1.5 -right-1.5 bg-[#C84B31] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{count}</span>}
    </button>
  );
}

function CartDrawer({ slug, shop, open, onClose }) {
  const nav = useNavigate();
  const [items, setItems] = useState(readCart(slug));
  useEffect(() => {
    const refresh = () => setItems(readCart(slug));
    window.addEventListener("shopCartUpdate", refresh);
    return () => window.removeEventListener("shopCartUpdate", refresh);
  }, [slug]);
  if (!open) return null;
  const subtotal = cartSubtotalCents(slug);
  const currency = shop?.currency || "EUR";
  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="cart-drawer">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative bg-[#FDFBF7] w-full max-w-md h-full overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E1D8]">
          <div className="font-serif-instrument italic text-xl">Votre panier</div>
          <button onClick={onClose} data-testid="close-cart" className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F1EC] rounded"><X className="w-4 h-4" /></button>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280] font-manrope">Votre panier est vide.</div>
        ) : (
          <>
            <ul className="divide-y divide-[#E5E1D8]">
              {items.map((it, i) => (
                <li key={i} data-testid={`cart-item-${i}`} className="flex gap-3 p-5">
                  <div className="w-16 h-16 bg-[#E5E1D8] overflow-hidden rounded-md shrink-0">
                    {it.image && <img src={resolveImg(it.image)} alt={it.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-manrope font-medium truncate">{it.name}</div>
                    {it.variant && <div className="text-xs text-[#6B7280]">{Object.entries(it.variant).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>}
                    <div className="mt-2 flex items-center gap-2">
                      <button aria-label="-" onClick={() => updateQty(slug, i, it.qty - 1)} data-testid={`qty-dec-${i}`} className="w-7 h-7 border border-[#E5E1D8] rounded hover:bg-[#F3F1EC]"><Minus className="w-3 h-3 mx-auto" /></button>
                      <span className="font-manrope text-sm w-6 text-center">{it.qty}</span>
                      <button aria-label="+" onClick={() => updateQty(slug, i, it.qty + 1)} data-testid={`qty-inc-${i}`} className="w-7 h-7 border border-[#E5E1D8] rounded hover:bg-[#F3F1EC]"><Plus className="w-3 h-3 mx-auto" /></button>
                      <button aria-label="remove" onClick={() => removeItem(slug, i)} data-testid={`qty-remove-${i}`} className="ml-auto text-xs text-[#6B7280] hover:text-[#C84B31]">Retirer</button>
                    </div>
                  </div>
                  <div className="font-manrope font-medium">{fmtPrice(it.price_cents * it.qty, currency)}</div>
                </li>
              ))}
            </ul>
            <div className="p-5 border-t border-[#E5E1D8] sticky bottom-0 bg-[#FDFBF7]">
              <div className="flex items-center justify-between mb-3 font-manrope">
                <span className="text-[#6B7280]">Sous-total</span>
                <span className="font-semibold">{fmtPrice(subtotal, currency)}</span>
              </div>
              <button data-testid="go-to-checkout" onClick={() => { onClose(); nav(`/shop/${slug}/checkout`); }} className="w-full bg-[#1F3D2D] hover:bg-[#C84B31] text-white px-5 py-3 rounded-md font-manrope font-medium flex items-center justify-center gap-2 transition-colors">
                Passer au paiement <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default function PublicShop() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/shops/${slug}`)
      .then((r) => setData(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#6B7280]">Chargement...</div>;
  if (notFound || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[#6B7280]">
      <Store className="w-10 h-10" />
      <div className="font-serif-instrument text-2xl">Boutique introuvable</div>
      <Link to="/" className="text-[#C84B31] underline">Retour à l'accueil</Link>
    </div>
  );

  const { shop, products } = data;
  const theme = shop.theme || {};
  const currency = shop.currency || "EUR";

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

  return (
    <div className="pshop min-h-screen bg-[#FDFBF7]" data-testid="public-shop">
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <header className="border-b border-[#E5E1D8] bg-[#FDFBF7] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url ? (
              <img src={resolveImg(shop.logo_url)} alt={shop.name} className="w-11 h-11 object-contain bg-white rounded-md border border-[#E5E1D8]" />
            ) : (
              <div className="w-9 h-9 bg-[#1F3D2D] flex items-center justify-center">
                <span className="text-[#FDFBF7] font-serif-instrument italic text-lg">{shop.name?.charAt(0)}</span>
              </div>
            )}
            <div>
              <div className="font-serif-instrument italic text-lg leading-none">{shop.name}</div>
              {shop.city && <div className="font-manrope text-[10px] uppercase tracking-[0.2em] text-[#6B7280] mt-0.5">Boutique · {shop.city}</div>}
            </div>
          </div>
          <CartButton slug={slug} onClick={() => setCartOpen(true)} />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-4">— Catalogue</div>
        <h1 className="font-serif-instrument text-4xl md:text-5xl text-[#111827] leading-tight mb-3">{shop.name}</h1>
        {shop.description && <p className="font-manrope text-[#6B7280] text-lg max-w-2xl">{shop.description}</p>}
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-20">
        {products.length === 0 ? (
          <div className="text-center py-20 text-[#6B7280] font-manrope" data-testid="empty-catalog">Aucun produit pour le moment.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <article key={p.id} data-testid={`product-${p.id}`} className="group cursor-pointer" onClick={() => nav(`/shop/${slug}/product/${p.slug}`)}>
                <div className="aspect-square bg-[#F3F1EC] overflow-hidden rounded-md mb-3 border border-[#E5E1D8]">
                  {(p.images || [])[0] ? (
                    <img src={resolveImg(p.images[0])} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#6B7280]"><Store className="w-10 h-10" /></div>
                  )}
                </div>
                <h3 className="font-serif-instrument text-xl text-[#111827] group-hover:text-[#C84B31] transition-colors">{p.name}</h3>
                <div className="font-manrope text-[#1F3D2D] font-medium mt-1">{fmtPrice(p.price_cents, currency)}</div>
                {p.stock <= 0 && <div className="text-[10px] uppercase tracking-[0.2em] text-[#C84B31] mt-1">Rupture</div>}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="bg-[#111827] text-[#FDFBF7] py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-3 gap-8 font-manrope text-sm">
          <div>
            <div className="font-serif-instrument italic text-2xl mb-2">{shop.name}</div>
            {shop.description && <div className="text-[#9CA3AF]">{shop.description}</div>}
          </div>
          <div className="text-[#9CA3AF]">
            <div className="text-white mb-2">Contact</div>
            {shop.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {shop.phone}</div>}
            {shop.contact_email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {shop.contact_email}</div>}
            {shop.city && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {shop.city}</div>}
          </div>
          <div className="text-[#9CA3AF] md:text-right">
            <div>© 2026 {shop.name}</div>
            <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#6B7280]">boutique générée avec artisanweb</div>
          </div>
        </div>
      </footer>

      <CartDrawer slug={slug} shop={shop} open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

export { CartButton, CartDrawer };
