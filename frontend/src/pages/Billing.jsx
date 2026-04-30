import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Crown } from "lucide-react";

export default function Billing() {
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null); // package id

  useEffect(() => {
    api.get("/billing/me")
      .then((r) => setInfo(r.data))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const checkout = async (packageId) => {
    setPaying(packageId);
    try {
      const r = await api.post("/billing/checkout", {
        package_id: packageId,
        origin_url: window.location.origin,
      });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Impossible de lancer le paiement");
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#F95A2C]" />
      </div>
    );
  }

  const isPro = info?.plan === "pro";
  const proUntil = info?.pro_until ? new Date(info.pro_until) : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="billing-page">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[#F95A2C]" data-testid="billing-back">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">/ billing</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// abonnement</div>
        <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3">
          {isPro ? <>Vous êtes <span className="italic font-serif-instrument font-normal text-[#F95A2C]">Pro.</span></> : <>Passez à <span className="italic font-serif-instrument font-normal text-[#F95A2C]">Pro</span>.</>}
        </h1>
        <p className="text-[#52525B] mb-10">
          {isPro
            ? `Votre accès Pro est actif jusqu'au ${proUntil?.toLocaleDateString("fr-FR")}.`
            : "Sites illimités, images IA, domaine personnalisé, support prioritaire."}
        </p>

        {isPro && (
          <div className="bg-[#09090B] text-white p-6 mb-10 flex items-center gap-4" data-testid="pro-active-banner">
            <Crown className="w-6 h-6 text-[#F95A2C]" />
            <div className="flex-1">
              <div className="font-display font-bold text-lg">Plan Pro actif</div>
              <div className="text-sm text-[#A1A1AA]">Expire le {proUntil?.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* FREE */}
          <div className="border border-black/10 bg-white p-10">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">free</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">0€<span className="text-base font-normal text-[#71717A]"> /mois</span></div>
            <p className="text-sm text-[#52525B] mb-8">Pour découvrir.</p>
            <ul className="space-y-3 mb-10 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> 1 site généré</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Sous-domaine artisanweb.app</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> SEO local</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Capture de leads</li>
            </ul>
            <Button variant="outline" disabled className="w-full rounded-none h-12 border-black/20" data-testid="plan-free-current">
              {isPro ? "—" : "Plan actuel"}
            </Button>
          </div>

          {/* PRO MONTHLY */}
          <div className="border border-black bg-[#09090B] text-white p-10 relative">
            <div className="absolute -top-3 left-10 bg-[#F95A2C] text-white text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-3 py-1">recommandé</div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-2">pro · mensuel</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">19€<span className="text-base font-normal text-[#A1A1AA]"> /mois</span></div>
            <p className="text-sm text-[#A1A1AA] mb-8">+30 jours de Pro à chaque paiement.</p>
            <ul className="space-y-3 mb-10 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Sites illimités</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Domaine personnalisé</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Régénération images IA</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Notifications email leads</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> Support prioritaire</li>
            </ul>
            <Button onClick={() => checkout("pro_monthly")} disabled={!!paying} data-testid="plan-pro-monthly" className="w-full rounded-none h-12 bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white">
              {paying === "pro_monthly" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirection...</> : <>{isPro ? "Renouveler / Prolonger" : "Passer à Pro"} <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </div>
        </div>

        {/* YEARLY upsell */}
        <div className="mt-4 border border-black/10 bg-white p-8 grid md:grid-cols-12 gap-6 items-center" data-testid="yearly-upsell">
          <div className="md:col-span-7">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">// économie -17%</div>
            <h3 className="font-display font-bold text-2xl tracking-tight mb-1">Pro Annuel · 190€</h3>
            <p className="text-sm text-[#52525B]">12 mois de Pro pour le prix de 10. La meilleure offre.</p>
          </div>
          <div className="md:col-span-5 md:flex md:justify-end">
            <Button onClick={() => checkout("pro_yearly")} disabled={!!paying} data-testid="plan-pro-yearly" className="w-full md:w-auto rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white">
              {paying === "pro_yearly" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirection...</> : <><Sparkles className="w-4 h-4 mr-2" /> Prendre l'annuel</>}
            </Button>
          </div>
        </div>

        <p className="mt-10 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] text-center">
          paiement sécurisé via stripe · résiliation à tout moment
        </p>
      </main>
    </div>
  );
}
