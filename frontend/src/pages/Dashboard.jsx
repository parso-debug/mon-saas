import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { resolveImg } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, MessageSquare, LogOut, Globe, Loader2, Crown, Sparkles, Store, ShoppingBag, Lock } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [sites, setSites] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState(null);
  const [creatingShop, setCreatingShop] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, sh, b] = await Promise.all([
        api.get("/sites"),
        api.get("/shops").catch(() => ({ data: [] })),
        api.get("/billing/me"),
      ]);
      setSites(r.data);
      setShops(sh.data || []);
      setBilling(b.data);
    } catch (e) {
      toast.error("Impossible de charger vos projets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    try {
      await api.delete(`/sites/${id}`);
      toast.success("Site supprimé");
      load();
    } catch (e) {
      toast.error("Erreur de suppression");
    }
  };

  const onDeleteShop = async (id) => {
    try {
      await api.delete(`/shops/${id}`);
      toast.success("Boutique supprimée");
      load();
    } catch (e) {
      toast.error("Erreur");
    }
  };

  const createShop = async () => {
    const name = window.prompt("Nom de la boutique ?", "Ma boutique");
    if (!name) return;
    const city = window.prompt("Ville (optionnel) ?", "") || "";
    setCreatingShop(true);
    try {
      const r = await api.post("/shops", { name, city });
      toast.success("Boutique créée");
      nav(`/shop-builder/${r.data.id}`);
    } catch (e) {
      const detail = e?.response?.data?.detail || "Erreur";
      if (e?.response?.status === 402) {
        toast.error(detail);
        setTimeout(() => nav("/billing"), 1500);
      } else {
        toast.error(detail);
      }
    } finally {
      setCreatingShop(false);
    }
  };

  const publicUrl = (slug) => `${window.location.origin}/site/${slug}`;

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="dashboard-page">
      {/* Top bar */}
      <header className="border-b border-black/10 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="dashboard-logo">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
              <span className="text-[#F95A2C] font-mono-grotesk font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold text-sm tracking-tight">artisanweb</span>
            <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] ml-2 hidden sm:inline">/ console</span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.is_admin && (
              <Link to="/admin" data-testid="admin-link">
                <Button variant="outline" size="sm" className="rounded-none border-[#F95A2C] text-[#F95A2C] hover:bg-[#F95A2C] hover:text-white">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> Admin
                </Button>
              </Link>
            )}
            <span className="text-sm text-[#52525B] hidden sm:block">{user?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={() => { logout(); nav("/"); }} data-testid="dashboard-logout" className="rounded-none">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        {/* Plan banner */}
        {billing && (
          billing.plan === "pro" ? (
            <div className="mb-8 bg-[#09090B] text-white px-5 py-3 flex items-center gap-3" data-testid="plan-banner-pro">
              <Crown className="w-4 h-4 text-[#F95A2C]" />
              <div className="text-sm flex-1">
                <span className="font-display font-bold mr-2">Plan Pro actif</span>
                <span className="text-[#A1A1AA] text-xs">jusqu'au {new Date(billing.pro_until).toLocaleDateString("fr-FR")}</span>
              </div>
              <Link to="/billing" className="text-xs underline underline-offset-4 hover:text-[#F95A2C]">Gérer</Link>
            </div>
          ) : (
            <div className="mb-8 bg-white border border-black/10 px-5 py-4 flex flex-wrap items-center gap-3" data-testid="plan-banner-free">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// plan free</div>
              <div className="text-sm flex-1">
                <span className="font-display font-bold mr-1">{sites.length}/{billing.site_limit} site{billing.site_limit > 1 ? "s" : ""}</span>
                <span className="text-[#52525B]">— passez à Pro pour des sites illimités, le domaine custom et les images IA.</span>
              </div>
              <Link to="/billing">
                <Button size="sm" className="rounded-none bg-[#F95A2C] hover:bg-[#09090B] text-white" data-testid="upgrade-pro-btn">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> Passer à Pro
                </Button>
              </Link>
            </div>
          )
        )}

        <div className="grid md:grid-cols-12 gap-8 items-end mb-12">
          <div className="md:col-span-8">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// vos sites</div>
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight">
              Bonjour {user?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-[#52525B] mt-2">Gérez les sites internet générés pour vos activités.</p>
          </div>
          <div className="md:col-span-4 md:flex md:justify-end">
            <Button onClick={() => nav("/onboarding")} data-testid="create-site-btn" className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white">
              <Plus className="w-4 h-4 mr-2" /> Créer un nouveau site
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#71717A]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
          </div>
        ) : sites.length === 0 ? (
          <div className="border border-black/10 bg-white p-16 text-center" data-testid="empty-sites">
            <div className="w-16 h-16 bg-[#FAFAFA] border border-black/10 mx-auto mb-6 flex items-center justify-center">
              <Globe className="w-7 h-7 text-[#F95A2C]" />
            </div>
            <h2 className="font-display font-bold text-2xl tracking-tight mb-2">Aucun site pour le moment.</h2>
            <p className="text-[#52525B] mb-8">Créez votre premier site en moins de 5 minutes.</p>
            <Button onClick={() => nav("/onboarding")} data-testid="empty-create-btn" className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white">
              <Plus className="w-4 h-4 mr-2" /> Créer mon premier site
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((s) => (
              <div key={s.id} className="border border-black/10 bg-white overflow-hidden group" data-testid={`site-card-${s.id}`}>
                <div className="aspect-video bg-[#FAFAFA] relative overflow-hidden border-b border-black/10">
                  {s.hero_image_url ? (
                    <img src={resolveImg(s.hero_image_url)} alt={s.business_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#71717A]">
                      <Globe className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] bg-white/90 backdrop-blur px-2 py-1">
                    {s.status === "published" ? <span className="text-[#F95A2C]">● live</span> : <span className="text-[#71717A]">● draft</span>}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg tracking-tight truncate">{s.business_name}</h3>
                  <p className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-1">{s.business_type} · {s.city}</p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => nav(`/builder/${s.id}`)} data-testid={`open-builder-${s.id}`} className="rounded-none border-black/20 hover:bg-[#09090B] hover:text-white">
                      Éditer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(publicUrl(s.slug), "_blank")} data-testid={`view-public-${s.id}`} className="rounded-none border-black/20 hover:bg-[#09090B] hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid={`delete-${s.id}`} className="rounded-none border-black/20 hover:bg-red-600 hover:text-white hover:border-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce site ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est définitive. Tous les leads associés seront aussi supprimés.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(s.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Shops Section --- */}
        <div className="mt-16 grid md:grid-cols-12 gap-8 items-end mb-8">
          <div className="md:col-span-8">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// vos boutiques e-commerce</div>
            <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tight">Boutique en ligne</h2>
            <p className="text-[#52525B] mt-2">Vendez vos produits en ligne — catalogue, panier, paiement Stripe, livraison configurable. <b>Plan Pro requis.</b></p>
          </div>
          <div className="md:col-span-4 md:flex md:justify-end">
            <Button onClick={createShop} disabled={creatingShop} data-testid="create-shop-btn" className="rounded-none h-12 px-6 bg-[#1F3D2D] hover:bg-[#F95A2C] text-white">
              {billing && billing.plan !== "pro" ? <Lock className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {creatingShop ? "Création..." : "Créer une boutique"}
            </Button>
          </div>
        </div>

        {shops.length === 0 ? (
          <div className="border border-black/10 bg-white p-12 text-center" data-testid="empty-shops">
            <div className="w-14 h-14 bg-[#FAFAFA] border border-black/10 mx-auto mb-5 flex items-center justify-center">
              <Store className="w-6 h-6 text-[#1F3D2D]" />
            </div>
            <h3 className="font-display font-bold text-xl tracking-tight mb-1">Aucune boutique</h3>
            <p className="text-[#52525B] text-sm mb-5">{billing && billing.plan !== "pro" ? "Passez à Pro pour lancer votre e-commerce." : "Lancez votre catalogue en ligne en quelques minutes."}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((s) => (
              <div key={s.id} data-testid={`shop-card-${s.id}`} className="border border-black/10 bg-white overflow-hidden group">
                <div className="aspect-video bg-[#1F3D2D] relative overflow-hidden border-b border-black/10 flex items-center justify-center">
                  {s.logo_url ? (
                    <img src={resolveImg(s.logo_url)} alt={s.name} className="w-20 h-20 object-contain" />
                  ) : (
                    <Store className="w-12 h-12 text-[#FDFBF7]/80" />
                  )}
                  <div className="absolute top-3 left-3 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] bg-white/90 backdrop-blur px-2 py-1">
                    {s.status === "published" ? <span className="text-[#F95A2C]">● live</span> : <span className="text-[#71717A]">● draft</span>}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-lg tracking-tight truncate">{s.name}</h3>
                  <p className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-1"><ShoppingBag className="w-3 h-3 inline mr-1" /> boutique · {s.city || "—"}</p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => nav(`/shop-builder/${s.id}`)} data-testid={`open-shop-${s.id}`} className="rounded-none border-black/20 hover:bg-[#09090B] hover:text-white">Gérer</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(`${window.location.origin}/shop/${s.slug}`, "_blank")} data-testid={`view-shop-${s.id}`} className="rounded-none border-black/20 hover:bg-[#09090B] hover:text-white"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" data-testid={`delete-shop-${s.id}`} className="rounded-none border-black/20 hover:bg-red-600 hover:text-white hover:border-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette boutique ?</AlertDialogTitle>
                          <AlertDialogDescription>Tous les produits et commandes liés seront également supprimés. Action définitive.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteShop(s.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
