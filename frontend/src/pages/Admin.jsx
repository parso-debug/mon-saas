import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, Globe, Inbox, Crown, TrendingUp, Loader2, CheckCircle2 } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error("Accès admin requis");
      nav("/dashboard");
      return;
    }
    Promise.all([api.get("/admin/stats"), api.get("/admin/users")])
      .then(([s, u]) => { setStats(s.data); setUsers(u.data); })
      .catch((e) => toast.error(e?.response?.data?.detail || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [user, nav]);

  if (!user?.is_admin) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#F95A2C]" />
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, sublabel, accent }) => (
    <div className={`border border-black/10 p-6 ${accent ? "bg-[#09090B] text-white" : "bg-white"}`} data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`font-mono-grotesk text-[10px] uppercase tracking-[0.2em] ${accent ? "text-[#A1A1AA]" : "text-[#71717A]"}`}>// {label}</div>
        <Icon className={`w-4 h-4 ${accent ? "text-[#F95A2C]" : "text-[#09090B]"}`} />
      </div>
      <div className="font-display font-bold text-4xl tracking-tight">{value}</div>
      {sublabel && <div className={`text-xs mt-1 ${accent ? "text-[#A1A1AA]" : "text-[#71717A]"}`}>{sublabel}</div>}
    </div>
  );

  const totalRevenue = (stats?.revenue_by_currency || []).reduce((acc, r) => acc + (r.total || 0), 0);
  const currency = stats?.revenue_by_currency?.[0]?._id?.toUpperCase() || "EUR";

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="admin-page">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[#F95A2C]" data-testid="admin-back">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">/ admin console</span>
          </div>
          <div className="flex items-center gap-2 bg-[#09090B] text-white px-3 py-1.5">
            <Shield className="w-3.5 h-3.5 text-[#F95A2C]" />
            <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em]">admin · {user.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        <div className="mb-10">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// vue d'ensemble</div>
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight">
            Administration <span className="italic font-serif-instrument font-normal text-[#F95A2C]">artisanweb</span>
          </h1>
        </div>

        {/* Stats grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={Users} label="utilisateurs" value={stats?.users || 0} sublabel={`${stats?.pro_users || 0} en plan Pro`} />
          <StatCard icon={Globe} label="sites créés" value={stats?.sites || 0} sublabel={`${stats?.published_sites || 0} publiés`} />
          <StatCard icon={Inbox} label="leads collectés" value={stats?.leads || 0} sublabel="formulaires de contact" />
          <StatCard icon={TrendingUp} label="revenu encaissé" value={`${totalRevenue.toFixed(0)}€`} sublabel={`${stats?.paid_transactions || 0} transactions ${currency}`} accent />
        </div>

        {/* Users table */}
        <section className="bg-white border border-black/10">
          <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// utilisateurs</div>
              <h2 className="font-display font-bold text-2xl tracking-tight">Comptes ({users.length})</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-users-table">
              <thead>
                <tr className="border-b border-black/10 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Nom</th>
                  <th className="text-left px-6 py-3">Plan</th>
                  <th className="text-left px-6 py-3">Sites</th>
                  <th className="text-left px-6 py-3">Inscrit le</th>
                  <th className="text-left px-6 py-3">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isPro = u.pro_until && new Date(u.pro_until) > new Date();
                  return (
                    <tr key={u.id} className="border-b border-black/5 hover:bg-[#FAFAFA]" data-testid={`admin-user-${u.id}`}>
                      <td className="px-6 py-3 font-mono-grotesk text-xs">{u.email}</td>
                      <td className="px-6 py-3">{u.full_name}</td>
                      <td className="px-6 py-3">
                        {isPro ? (
                          <span className="inline-flex items-center gap-1 bg-[#09090B] text-white px-2 py-0.5 text-[10px] font-mono-grotesk uppercase tracking-[0.15em]">
                            <Crown className="w-3 h-3 text-[#F95A2C]" /> pro
                          </span>
                        ) : (
                          <span className="text-[#71717A] font-mono-grotesk text-[10px] uppercase tracking-[0.15em]">free</span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-display font-bold">{u.sites_count}</td>
                      <td className="px-6 py-3 text-[#71717A] text-xs">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-6 py-3">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 bg-[#F95A2C] text-white px-2 py-0.5 text-[10px] font-mono-grotesk uppercase tracking-[0.15em]">
                            <Shield className="w-3 h-3" /> admin
                          </span>
                        ) : (
                          <span className="text-[#71717A] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 bg-white border border-black/10 p-6 flex items-start gap-4">
          <CheckCircle2 className="w-5 h-5 text-[#F95A2C] mt-0.5 shrink-0" />
          <div>
            <div className="font-display font-bold mb-1">À venir dans la console admin</div>
            <p className="text-sm text-[#52525B]">Édition no-code de la landing page (hero, pricing, témoignages), gestion des plans, modération des sites publiés, export CSV des leads. Vos retours nous aideront à prioriser.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
