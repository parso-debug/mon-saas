import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { readCart, cartSubtotalCents, fmtPrice, clearCart } from "@/lib/shopCart";
import { resolveImg } from "@/lib/api";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ShopCheckout() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [shop, setShop] = useState(null);
  const [items] = useState(readCart(slug));
  const [form, setForm] = useState({ name: "", email: "", phone: "", shipping_address: "" });
  const [shippingId, setShippingId] = useState("pickup");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/shops/${slug}`)
      .then((r) => { setShop(r.data.shop); if ((r.data.shop.shipping_rates || [])[0]) setShippingId(r.data.shop.shipping_rates[0].id); })
      .catch(() => toast.error("Boutique introuvable"));
  }, [slug]);

  const subtotal = useMemo(() => cartSubtotalCents(slug), [slug]);
  const shipping = useMemo(() => {
    const rate = (shop?.shipping_rates || []).find((r) => r.id === shippingId);
    return rate?.amount_cents || 0;
  }, [shop, shippingId]);
  const currency = shop?.currency || "EUR";
  const taxRate = shop?.tax_rate ?? 0.20;
  const taxIncluded = shop?.tax_included ?? true;
  const base = subtotal + shipping;
  const tax = taxIncluded ? Math.round(base - base / (1 + taxRate)) : Math.round(base * taxRate);
  const total = taxIncluded ? base : base + tax;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[#6B7280] bg-[#FDFBF7]">
        <div className="font-serif-instrument text-2xl">Votre panier est vide</div>
        <Link to={`/shop/${slug}`} className="text-[#C84B31] underline">Retourner à la boutique</Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((it) => ({ product_id: it.product_id, qty: it.qty, variant: it.variant || undefined })),
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone || undefined,
        shipping_method_id: shippingId,
        shipping_address: form.shipping_address || undefined,
        origin_url: window.location.origin,
      };
      const r = await axios.post(`${API}/public/shops/${slug}/checkout`, payload);
      // Keep cart around — will clear on /success
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Paiement indisponible");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]" data-testid="shop-checkout">
      <header className="border-b border-[#E5E1D8] bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center">
          <Link to={`/shop/${slug}`} className="flex items-center gap-2 font-manrope text-sm hover:text-[#C84B31]">
            <ArrowLeft className="w-4 h-4" /> Retour à la boutique
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid md:grid-cols-5 gap-10">
        <form onSubmit={submit} className="md:col-span-3 space-y-6">
          <div>
            <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-2">— Coordonnées</div>
            <h1 className="font-serif-instrument text-3xl md:text-4xl text-[#111827]">Paiement sécurisé</h1>
          </div>

          <div className="bg-white border border-[#E5E1D8] rounded-lg p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-manrope text-[#6B7280] block mb-1.5">Nom complet *</label>
                <input required data-testid="checkout-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
              </div>
              <div>
                <label className="text-xs font-manrope text-[#6B7280] block mb-1.5">Téléphone</label>
                <input data-testid="checkout-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-manrope text-[#6B7280] block mb-1.5">Email *</label>
              <input required type="email" data-testid="checkout-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
            </div>
            <div>
              <label className="text-xs font-manrope text-[#6B7280] block mb-1.5">Adresse de livraison</label>
              <textarea rows={3} data-testid="checkout-address" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} className="w-full border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" placeholder="Rue, code postal, ville..." />
            </div>
          </div>

          <div className="bg-white border border-[#E5E1D8] rounded-lg p-6">
            <div className="font-manrope text-sm font-medium mb-3">Mode de livraison</div>
            <div className="space-y-2">
              {(shop?.shipping_rates || []).map((r) => (
                <label key={r.id} data-testid={`shipping-${r.id}`} className={`flex items-center justify-between border rounded-md px-4 py-3 cursor-pointer transition-colors ${shippingId === r.id ? "border-[#1F3D2D] bg-[#F3F1EC]" : "border-[#E5E1D8] hover:border-[#1F3D2D]"}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="ship" value={r.id} checked={shippingId === r.id} onChange={() => setShippingId(r.id)} className="accent-[#1F3D2D]" />
                    <span className="font-manrope text-sm">{r.name}</span>
                  </span>
                  <span className="font-manrope text-sm font-medium">{r.amount_cents === 0 ? "Gratuit" : fmtPrice(r.amount_cents, currency)}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting} data-testid="pay-button" className="w-full bg-[#1F3D2D] hover:bg-[#C84B31] text-white px-6 py-4 rounded-md font-manrope font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirection...</> : `Payer ${fmtPrice(total, currency)}`}
          </button>
          <p className="text-xs text-[#6B7280] font-manrope text-center">Paiement sécurisé via Stripe. Aucune donnée bancaire ne transite par ce site.</p>
        </form>

        <aside className="md:col-span-2">
          <div className="bg-white border border-[#E5E1D8] rounded-lg p-6 sticky top-6">
            <div className="font-serif-instrument italic text-xl mb-4">Votre commande</div>
            <ul className="divide-y divide-[#E5E1D8] mb-4">
              {items.map((it, i) => (
                <li key={i} data-testid={`summary-item-${i}`} className="flex gap-3 py-3">
                  <div className="w-14 h-14 bg-[#E5E1D8] overflow-hidden rounded shrink-0">
                    {it.image && <img src={resolveImg(it.image)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-manrope text-sm font-medium truncate">{it.name}</div>
                    {it.variant && <div className="text-xs text-[#6B7280]">{Object.entries(it.variant).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>}
                    <div className="text-xs text-[#6B7280]">× {it.qty}</div>
                  </div>
                  <div className="font-manrope text-sm">{fmtPrice(it.price_cents * it.qty, currency)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1 font-manrope text-sm border-t border-[#E5E1D8] pt-3">
              <div className="flex justify-between text-[#6B7280]"><span>Sous-total</span><span>{fmtPrice(subtotal, currency)}</span></div>
              <div className="flex justify-between text-[#6B7280]"><span>Livraison</span><span>{shipping === 0 ? "Gratuit" : fmtPrice(shipping, currency)}</span></div>
              <div className="flex justify-between text-[#6B7280] text-xs"><span>dont TVA ({Math.round(taxRate * 100)}%)</span><span>{fmtPrice(tax, currency)}</span></div>
              <div className="flex justify-between font-semibold text-base border-t border-[#E5E1D8] pt-2 mt-2"><span>Total</span><span data-testid="order-total">{fmtPrice(total, currency)}</span></div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
