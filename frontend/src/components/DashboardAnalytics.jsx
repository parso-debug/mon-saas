import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { TrendingUp, ShoppingBag, Globe, AlertTriangle, Users, Sparkles } from "lucide-react";

function fmt(cents, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function KPI({ icon: Icon, label, value, sub, accent = false, testId }) {
  return (
    <div data-testid={testId} className={`p-5 border ${accent ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white border-black/10"}`}>
      <div className={`flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] ${accent ? "text-[#F95A2C]" : "text-[#71717A]"}`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`font-display font-bold text-3xl tracking-tight mt-2 ${accent ? "text-white" : "text-[#09090B]"}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 font-manrope ${accent ? "text-[#A1A1AA]" : "text-[#52525B]"}`}>{sub}</div>}
    </div>
  );
}

function BarChart({ series, testId }) {
  const max = Math.max(1, ...series.map((s) => s.total_cents));
  return (
    <div className="bg-white border border-black/10 p-5" data-testid={testId}>
      <div className="flex items-center justify-between mb-5">
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// chiffre d'affaires · 6 derniers mois</div>
        <div className="flex items-center gap-3 text-xs font-manrope text-[#52525B]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#1F3D2D]" /> Boutique</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#F95A2C]" /> Domaines</span>
        </div>
      </div>
      <div className="flex items-end gap-3 h-40">
        {series.map((s, i) => {
          const shop = s.shop_cents;
          const dom = s.domain_cents;
          const shopH = (shop / max) * 100;
          const domH = (dom / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1" data-testid={`bar-${s.month}`}>
              <div className="flex items-end gap-0.5 w-full justify-center h-full">
                {shop > 0 && <div className="w-3 bg-[#1F3D2D]" style={{ height: `${Math.max(2, shopH)}%` }} title={`Boutique ${fmt(shop)}`} />}
                {dom > 0 && <div className="w-3 bg-[#F95A2C]" style={{ height: `${Math.max(2, domH)}%` }} title={`Domaines ${fmt(dom)}`} />}
                {shop === 0 && dom === 0 && <div className="w-3 bg-black/5" style={{ height: "2%" }} />}
              </div>
              <div className="font-mono-grotesk text-[9px] uppercase tracking-[0.15em] text-[#71717A]">{s.month.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/analytics/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return null;

  const orders = data.orders || {};
  const domains = data.domains || {};
  const leads = data.leads || {};
  const expiring = domains.expiring_soon || [];
  const topProducts = orders.top_products || [];

  // Hide widget entirely if the user has no activity yet
  const isEmpty =
    !data.sites_count && !data.shops_count && !(orders.total_count || 0) && !(domains.active_count || 0) && !(leads.total || 0);
  if (isEmpty) return null;

  return (
    <section className="mb-12" data-testid="dashboard-analytics">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// analytics</div>
          <h2 className="font-display font-bold text-2xl tracking-tight">Votre activité en un coup d'œil</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <KPI
          icon={TrendingUp} label="ca total" accent
          value={fmt((orders.total_cents || 0) + (domains.total_cents || 0))}
          sub={`${fmt((orders.last_30d_cents || 0) + (domains.last_30d_cents || 0))} sur 30 jours`}
          testId="kpi-total-revenue"
        />
        <KPI
          icon={ShoppingBag} label="commandes"
          value={orders.total_count || 0}
          sub={orders.total_count ? `panier moyen ${fmt(orders.avg_basket_cents)}` : "aucune commande"}
          testId="kpi-orders"
        />
        <KPI
          icon={Users} label="leads reçus"
          value={leads.total || 0}
          sub={`${leads.last_30d || 0} sur 30 jours`}
          testId="kpi-leads"
        />
        <KPI
          icon={Globe} label="domaines actifs"
          value={domains.active_count || 0}
          sub={fmt(domains.total_cents || 0) + " / an"}
          testId="kpi-domains"
        />
      </div>

      <BarChart series={data.monthly_series || []} testId="revenue-chart" />

      {/* Expiring domains alert */}
      {expiring.length > 0 && (
        <div className="mt-4 bg-[#F95A2C]/5 border border-[#F95A2C] p-4 md:p-5" data-testid="expiring-domains-alert">
          <div className="flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#F95A2C] mb-2">
            <AlertTriangle className="w-3.5 h-3.5" /> renouvellements à venir
          </div>
          <h3 className="font-display font-bold text-lg tracking-tight mb-3">
            {expiring.length} domaine{expiring.length > 1 ? "s" : ""} expire{expiring.length > 1 ? "nt" : ""} dans moins de 30 jours
          </h3>
          <div className="space-y-1.5">
            {expiring.slice(0, 5).map((d) => (
              <div key={d.id} data-testid={`expiring-${d.domain_name}`} className="flex items-center justify-between text-sm font-manrope border-t border-[#F95A2C]/20 pt-1.5">
                <span className="font-medium">{d.domain_name}</span>
                <span className="text-[#C84B31]">dans {d.days_left} jour{d.days_left > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
          <Link to="/domains" className="inline-block mt-4 text-sm text-[#F95A2C] hover:underline font-manrope" data-testid="go-renew-domains">Renouveler →</Link>
        </div>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="mt-4 bg-white border border-black/10 p-5" data-testid="top-products">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// top produits</div>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.product_id} data-testid={`top-product-${i}`} className="flex items-center gap-3 text-sm font-manrope">
                <span className="font-mono-grotesk text-[10px] text-[#71717A] w-5">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <span className="text-[#71717A]">× {p.units}</span>
                <span className="font-semibold tabular-nums">{fmt(p.revenue_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
