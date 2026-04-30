import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const nav = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | paid | failed | timeout
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!sessionId) { setStatus("failed"); return; }
    let attempts = 0;
    const max = 10;
    const tick = async () => {
      attempts++;
      try {
        const r = await api.get(`/billing/status/${sessionId}`);
        setData(r.data);
        if (r.data.payment_status === "paid") {
          setStatus("paid");
          return;
        }
        if (r.data.status === "expired" || r.data.status === "complete" && r.data.payment_status === "unpaid") {
          setStatus("failed");
          return;
        }
        if (attempts >= max) { setStatus("timeout"); return; }
        setTimeout(tick, 2000);
      } catch (e) {
        if (attempts >= max) { setStatus("failed"); return; }
        setTimeout(tick, 2000);
      }
    };
    tick();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6" data-testid="billing-success-page">
      <div className="max-w-lg w-full bg-white border border-black/10 p-10 text-center">
        {status === "checking" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-[#F95A2C] mx-auto mb-6" />
            <h1 className="font-display font-bold text-3xl tracking-tight mb-2">Vérification du paiement…</h1>
            <p className="text-[#52525B]">Quelques secondes le temps que Stripe confirme.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <div className="w-16 h-16 bg-[#F95A2C] mx-auto mb-6 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// payment confirmed</div>
            <h1 className="font-display font-bold text-3xl tracking-tight mb-2">Bienvenue sur Pro 🎉</h1>
            <p className="text-[#52525B] mb-2">{data?.amount} {data?.currency?.toUpperCase()} · {data?.package_id}</p>
            <p className="text-[#52525B] mb-8">Votre accès est activé. Vous pouvez maintenant créer des sites sans limite.</p>
            <Button onClick={() => nav("/dashboard")} data-testid="success-to-dashboard" className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white">
              Aller au dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}
        {(status === "failed" || status === "timeout") && (
          <>
            <h1 className="font-display font-bold text-3xl tracking-tight mb-2">Paiement non confirmé</h1>
            <p className="text-[#52525B] mb-8">{status === "timeout" ? "Le statut tarde à arriver. Vérifiez votre email Stripe ou réessayez." : "La transaction n'a pas abouti."}</p>
            <Link to="/billing">
              <Button className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="failed-back-billing">
                Retour à la facturation
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
