import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ShoppingBag, Crown, Sparkles, Check, Lock } from "lucide-react";

export default function OnboardingShop() {
  const nav = useNavigate();
  const [billing, setBilling] = useState(null);
  const [form, setForm] = useState({ name: "", city: "", description: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/billing/me").then((r) => setBilling(r.data)).catch(() => {});
  }, []);

  const isPro = billing?.plan === "pro";

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nom de la boutique requis"); return; }
    setLoading(true);
    try {
      const r = await api.post("/shops", { name: form.name, city: form.city || undefined, description: form.description || undefined });
      toast.success("Boutique créée !");
      nav(`/shop-builder/${r.data.id}`);
    } catch (e) {
      const detail = e?.response?.data?.detail || "Erreur lors de la création";
      if (e?.response?.status === 402) {
        toast.error(detail);
        setTimeout(() => nav("/billing"), 1200);
      } else {
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="onboarding-shop-page">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
              <span className="text-[#F95A2C] font-mono-grotesk font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold tracking-tight">artisanweb</span>
          </Link>
          <Link to="/dashboard" className="text-sm text-[#52525B] hover:text-[#F95A2C]">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16 grid md:grid-cols-12 gap-10">
        {/* LEFT: Form or Upsell */}
        <div className="md:col-span-7">
          <div className="inline-flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#1F3D2D] border border-[#1F3D2D]/20 px-3 py-1.5 rounded-full mb-6">
            <ShoppingBag className="w-3 h-3" /> nouvelle boutique en ligne
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-[1.05]">Votre boutique<br/><span className="font-serif-instrument italic font-normal text-[#C84B31]">en 5 minutes.</span></h1>
          <p className="text-[#52525B] mt-4 max-w-lg">Catalogue, variantes, panier, paiement Stripe, livraison, gestion des commandes — tout est déjà câblé. Il ne vous reste qu'à ajouter vos produits.</p>

          {billing === null ? (
            <div className="mt-8 text-sm text-[#71717A]">Chargement…</div>
          ) : !isPro ? (
            <div className="mt-10 bg-[#09090B] text-white rounded-md p-8 relative overflow-hidden" data-testid="shop-pro-upsell">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#F95A2C]/20 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <Crown className="w-8 h-8 text-[#F95A2C]" />
              <h2 className="font-display font-bold text-2xl tracking-tight mt-4">Pro requis pour lancer une boutique</h2>
              <p className="text-[#A1A1AA] text-sm mt-2 max-w-md">La boutique en ligne avec paiement Stripe, gestion des commandes et catalogue illimité est incluse dans le plan <b className="text-white">Pro à 19 €/mois</b>. Passez Pro maintenant — annulable à tout moment.</p>
              <ul className="mt-5 space-y-2 text-sm text-[#A1A1AA]">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> Boutiques illimitées</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> Sites artisans illimités</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> Domaine personnalisé</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> Images IA (hero + logo)</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/billing">
                  <Button className="bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white rounded-none h-12 px-6" data-testid="upgrade-to-pro-btn">
                    <Sparkles className="w-4 h-4 mr-2" /> Passer à Pro — 19 €/mois
                  </Button>
                </Link>
                <Link to="/shop/la-boutique-de-demo" target="_blank">
                  <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white rounded-none h-12 px-6" data-testid="see-shop-demo">
                    Voir la démo →
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={create} className="mt-10 space-y-5 bg-white border border-black/10 p-8" data-testid="shop-create-form">
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Nom de la boutique *</Label>
                <Input required data-testid="shop-create-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ma Jolie Boutique" className="mt-2 h-12 rounded-none border-black/20" />
              </div>
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Ville</Label>
                <Input data-testid="shop-create-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Paris" className="mt-2 h-12 rounded-none border-black/20" />
              </div>
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Description (une phrase qui vous décrit)</Label>
                <textarea data-testid="shop-create-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Artisanat local, pièces uniques, édition limitée…" className="mt-2 w-full border border-black/20 p-3 font-sans text-sm" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-none bg-[#1F3D2D] hover:bg-[#C84B31] text-white" data-testid="shop-create-submit">
                {loading ? "Création..." : <>Créer ma boutique <ArrowRight className="ml-2 w-4 h-4" /></>}
              </Button>
              <p className="text-xs text-[#71717A] text-center">Vous pourrez tout personnaliser ensuite (produits, tarifs, livraison, couleurs…).</p>
            </form>
          )}
        </div>

        {/* RIGHT: Preview mock */}
        <div className="md:col-span-5">
          <div className="bg-[#1F3D2D] text-white rounded-md p-6 sticky top-6">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#C84B31] mb-3">— aperçu boutique</div>
            <div className="bg-[#FDFBF7] rounded-md p-4 text-[#111827]">
              <div className="flex items-center justify-between mb-3">
                <div className="font-serif-instrument italic text-base">{form.name || "Votre Boutique"}</div>
                <div className="bg-[#1F3D2D] text-white text-[10px] px-2 py-0.5 rounded">Panier</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="border border-[#E5E1D8] rounded">
                    <div className="aspect-square bg-[#F3F1EC] rounded-t" style={{ background: ["linear-gradient(135deg,#F3F1EC,#D4C9B8)", "linear-gradient(135deg,#E5E1D8,#C0B8A6)", "linear-gradient(135deg,#1F3D2D,#2F5D42)", "linear-gradient(135deg,#C84B31,#E86E4F)"][i] }} />
                    <div className="p-1.5">
                      <div className="font-manrope text-[10px] font-medium truncate">Produit {i + 1}</div>
                      <div className="font-manrope text-[10px] text-[#1F3D2D] font-semibold">{10 + i * 5} €</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#FDFBF7]/80 font-manrope">
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> Variantes (Taille, Couleur…)</div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> Stock + rupture automatique</div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> Panier + paiement Stripe</div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> Email client + propriétaire à chaque commande</div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> Livraison : retrait + 2 tarifs par défaut</div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#C84B31] shrink-0 mt-0.5" /> TVA 20% incluse configurable</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
