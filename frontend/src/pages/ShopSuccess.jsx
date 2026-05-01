import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, Loader2, Clock } from "lucide-react";
import { clearCart, fmtPrice } from "@/lib/shopCart";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ShopSuccess() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("polling");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    let attempts = 0;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await axios.get(`${API}/public/shops/${slug}/orders/status/${sessionId}`);
        if (cancelled) return;
        setOrder(r.data);
        if (r.data.payment_status === "paid") {
          clearCart(slug);
          setStatus("paid");
          return;
        }
        attempts += 1;
        if (attempts > 10) { setStatus("pending"); return; }
        setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, slug]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center px-4" data-testid="shop-success">
      <div className="bg-white border border-[#E5E1D8] rounded-lg p-10 max-w-xl w-full text-center">
        {status === "polling" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#1F3D2D]" />
            <h1 className="font-serif-instrument text-3xl mt-5">Confirmation du paiement...</h1>
            <p className="text-[#6B7280] mt-2 font-manrope">Merci de patienter quelques secondes.</p>
          </>
        )}
        {status === "paid" && order && (
          <>
            <CheckCircle2 className="w-14 h-14 mx-auto text-[#1F3D2D]" />
            <h1 className="font-serif-instrument text-3xl mt-5">Merci pour votre commande !</h1>
            <p className="text-[#6B7280] mt-2 font-manrope">
              Un email de confirmation a été envoyé à <b>{order.customer_email}</b>.
            </p>
            <div className="mt-6 bg-[#F3F1EC] rounded-md p-5 text-left font-manrope text-sm">
              <div className="flex justify-between mb-2"><span className="text-[#6B7280]">Commande</span><span className="font-mono-grotesk">#{order.order_id?.slice(0, 8)}</span></div>
              <div className="flex justify-between mb-2"><span className="text-[#6B7280]">Montant payé</span><span className="font-semibold" data-testid="paid-total">{fmtPrice(order.total_cents, order.currency)}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Livraison</span><span>{order.shipping_method_name}</span></div>
            </div>
            <Link to={`/shop/${slug}`} className="inline-block mt-6 text-[#C84B31] underline font-manrope">Revenir à la boutique</Link>
          </>
        )}
        {status === "pending" && (
          <>
            <Clock className="w-12 h-12 mx-auto text-[#C84B31]" />
            <h1 className="font-serif-instrument text-3xl mt-5">Paiement en cours de traitement</h1>
            <p className="text-[#6B7280] mt-2 font-manrope">Vous recevrez un email dès que votre commande sera confirmée.</p>
            <Link to={`/shop/${slug}`} className="inline-block mt-6 text-[#C84B31] underline font-manrope">Retour à la boutique</Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-serif-instrument text-3xl mt-5">Une erreur est survenue</h1>
            <Link to={`/shop/${slug}`} className="inline-block mt-6 text-[#C84B31] underline font-manrope">Retour à la boutique</Link>
          </>
        )}
      </div>
    </div>
  );
}
