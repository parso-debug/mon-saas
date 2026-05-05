import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DomainAutoRenewSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const domainId = params.get("domain_id");
  const [state, setState] = useState("polling");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!sessionId || !domainId) { setState("error"); return; }
    let tries = 0;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await api.get(`/domains/${domainId}/auto-renew/status/${sessionId}`);
        if (cancelled) return;
        setInfo(r.data);
        if (r.data.auto_renew) { setState("ok"); return; }
        tries += 1;
        if (tries > 10) { setState("pending"); return; }
        setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled) setState("error");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, domainId]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4" data-testid="auto-renew-success">
      <div className="bg-white border border-black/10 p-10 max-w-md w-full text-center">
        {state === "polling" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#F95A2C]" />
            <h1 className="font-display font-bold text-2xl tracking-tight mt-4">Activation en cours...</h1>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-[#1F3D2D]" />
            <h1 className="font-display font-bold text-2xl tracking-tight mt-4">Renouvellement auto activé</h1>
            <p className="text-[#52525B] mt-2 font-manrope text-sm">Votre domaine sera désormais renouvelé automatiquement chaque année via Stripe. Vous recevrez une facture par email avant chaque prélèvement. Annulable à tout moment.</p>
            <div className="mt-4 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">
              sub · {info?.subscription_id ? info.subscription_id.slice(0, 20) + "..." : "—"}
            </div>
            <Link to="/domains" className="inline-block mt-6">
              <Button className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="auto-renew-back">
                <RefreshCw className="w-4 h-4 mr-2" /> Retour à mes domaines
              </Button>
            </Link>
          </>
        )}
        {(state === "pending" || state === "error") && (
          <>
            <h1 className="font-display font-bold text-2xl tracking-tight">{state === "pending" ? "Activation en attente" : "Une erreur est survenue"}</h1>
            <p className="text-[#52525B] mt-2 font-manrope text-sm">{state === "pending" ? "Votre abonnement sera activé dès que Stripe confirmera le paiement." : "Si vous avez été débité, contactez le support — aucun abonnement actif n'a été créé."}</p>
            <Link to="/domains" className="inline-block mt-6 text-[#F95A2C] underline">Retour</Link>
          </>
        )}
      </div>
    </div>
  );
}
