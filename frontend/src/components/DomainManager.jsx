import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, ShieldCheck, Globe, Check, X, Loader2, ShoppingCart, Sparkles, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";

function StateBadge({ status }) {
  if (status === "active")
    return <span data-testid="domain-state-active" className="inline-flex items-center gap-1.5 bg-[#1F3D2D] text-white text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-2 py-1 rounded"><Check className="w-3 h-3" /> actif</span>;
  if (status === "pending" || status === "paid")
    return <span data-testid="domain-state-pending" className="inline-flex items-center gap-1.5 bg-[#F95A2C]/20 text-[#F95A2C] text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-2 py-1 rounded"><Loader2 className="w-3 h-3 animate-spin" /> en cours</span>;
  if (status === "error")
    return <span data-testid="domain-state-error" className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-700 text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-2 py-1 rounded"><X className="w-3 h-3" /> erreur</span>;
  return null;
}

export default function DomainManager({ businessType, city, projectId, projectKind = "site" }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // {result, suggestions}
  const [myDomains, setMyDomains] = useState([]);
  const [purchasing, setPurchasing] = useState(null); // fqdn being purchased
  const nav = useNavigate();
  const searchTimer = useRef(null);

  const loadMyDomains = async () => {
    try {
      const r = await api.get("/domains");
      setMyDomains(r.data);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { loadMyDomains(); }, []);

  // Auto-trigger renewal from email deep-link ?renew=<id>
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const renewId = p.get("renew");
    if (!renewId) return;
    (async () => {
      try {
        const r = await api.post(`/domains/${renewId}/renew`, { origin_url: window.location.origin });
        window.location.href = r.data.url;
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Lien de renouvellement invalide");
      }
    })();
  }, []);

  const runSearch = async (name) => {
    if (!name || name.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ name });
      if (businessType) params.set("business_type", businessType);
      if (city) params.set("city", city);
      const r = await api.get(`/domains/search?${params}`);
      setResults(r.data);
    } catch (e) {
      toast.error("Recherche indisponible");
    } finally {
      setLoading(false);
    }
  };

  // Debounced search on query change
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults(null); return; }
    searchTimer.current = setTimeout(() => runSearch(query.trim()), 400);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [query, businessType, city]);

  const buy = async (domain) => {
    setPurchasing(domain);
    try {
      const r = await api.post("/domains/purchase", {
        domain,
        project_id: projectId || undefined,
        project_kind: projectKind,
        origin_url: window.location.origin,
      });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Impossible de lancer le paiement");
      setPurchasing(null);
    }
  };

  const fmt = (cents) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

  return (
    <div data-testid="domain-manager" className="space-y-6">
      {/* Search bar */}
      <div className="bg-white border border-black/10 p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-[#09090B] text-[#F95A2C] flex items-center justify-center"><Globe className="w-4 h-4" /></div>
          <div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// votre propre nom de domaine</div>
            <h3 className="font-display font-bold text-lg tracking-tight">Trouvez et achetez en 30 secondes</h3>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <Input
            data-testid="domain-search-input"
            placeholder="Tapez un nom (ex: monentreprise ou monentreprise.fr)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]"
          />
          {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] animate-spin" data-testid="domain-search-loading" />}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#71717A] font-manrope">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1F3D2D]" /> SSL automatique</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#F95A2C]" /> DNS configuré pour vous</span>
          <span className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-[#71717A]" /> Paiement sécurisé Stripe</span>
        </div>
      </div>

      {/* Exact result */}
      {results?.result && (
        <DomainCard
          item={results.result}
          exact
          onBuy={buy}
          purchasing={purchasing}
          fmt={fmt}
        />
      )}

      {/* Suggestions */}
      {results?.suggestions?.length > 0 && (
        <div>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// suggestions</div>
          <div className="grid md:grid-cols-2 gap-3" data-testid="domain-suggestions">
            {results.suggestions.map((s) => (
              <DomainCard key={s.domain} item={s} onBuy={buy} purchasing={purchasing} fmt={fmt} />
            ))}
          </div>
        </div>
      )}

      {/* My purchased domains */}
      {myDomains.length > 0 && (
        <div data-testid="my-domains">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// vos domaines</div>
          <div className="space-y-2">
            {myDomains.map((d) => (
              <MyDomainRow key={d.id} d={d} fmt={fmt} onReload={loadMyDomains} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DomainCard({ item, onBuy, purchasing, fmt, exact = false }) {  const isBusy = purchasing === item.domain;
  return (
    <div
      data-testid={`domain-card-${item.domain}`}
      className={`p-4 flex items-center gap-3 border ${exact ? "bg-white border-black" : "bg-white border-black/10 hover:border-black/30"} transition-colors`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-display font-bold truncate">{item.domain}</div>
          {exact && <span className="font-mono-grotesk text-[9px] uppercase tracking-[0.2em] bg-[#09090B] text-white px-1.5 py-0.5">exact</span>}
        </div>
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-0.5">
          .{item.tld} · {fmt(item.total_cents)} / an
        </div>
      </div>
      {item.available ? (
        <Button
          size="sm"
          onClick={() => onBuy(item.domain)}
          disabled={isBusy || !!purchasing}
          data-testid={`buy-${item.domain}`}
          className="rounded-none bg-[#F95A2C] hover:bg-[#09090B] text-white h-9 px-4 shrink-0"
        >
          {isBusy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Redirection</> : <>Acheter & connecter <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></>}
        </Button>
      ) : (
        <span data-testid={`unavailable-${item.domain}`} className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-red-600 flex items-center gap-1 shrink-0"><X className="w-3 h-3" /> pris</span>
      )}
    </div>
  );
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

function MyDomainRow({ d, fmt, onReload }) {
  const [renewing, setRenewing] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const days = daysUntil(d.expiry_date);
  const isExpiringSoon = d.status === "active" && days !== null && days <= 30;

  const renew = async () => {
    setRenewing(true);
    try {
      const r = await api.post(`/domains/${d.id}/renew`, { origin_url: window.location.origin });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Renouvellement indisponible");
      setRenewing(false);
    }
  };

  const toggleAutoRenew = async () => {
    setTogglingAuto(true);
    try {
      await api.put(`/domains/${d.id}/auto-renew`, { auto_renew: !d.auto_renew });
      toast.success(!d.auto_renew ? "Renouvellement auto activé" : "Renouvellement auto désactivé");
      onReload?.();
    } catch (e) {
      toast.error("Erreur");
    } finally {
      setTogglingAuto(false);
    }
  };

  return (
    <div data-testid={`my-domain-${d.domain_name}`} className={`bg-white border ${isExpiringSoon ? "border-[#F95A2C]" : "border-black/10"} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-8 h-8 bg-[#FAFAFA] border border-black/10 flex items-center justify-center shrink-0"><Globe className="w-3.5 h-3.5 text-[#71717A]" /></div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm truncate">{d.domain_name}</div>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-0.5">
            {d.provider} · {fmt(d.amount_cents)} / an
            {d.expiry_date && <> · expire le {new Date(d.expiry_date).toLocaleDateString("fr-FR")}</>}
          </div>
        </div>
        <StateBadge status={d.status} />
        {d.status === "active" && (
          <a href={`https://${d.domain_name}`} target="_blank" rel="noreferrer" className="text-xs text-[#F95A2C] hover:underline font-manrope">Ouvrir ↗</a>
        )}
      </div>
      {d.status === "active" && (
        <div className={`mt-3 flex flex-wrap items-center gap-3 pt-3 border-t border-black/5`}>
          {isExpiringSoon && (
            <div className="flex items-center gap-1.5 text-xs font-manrope text-[#F95A2C]" data-testid={`expiring-badge-${d.domain_name}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {days <= 0 ? "Expire aujourd'hui !" : `Expire dans ${days} jour${days > 1 ? "s" : ""}`}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={renew}
            disabled={renewing}
            data-testid={`renew-${d.domain_name}`}
            className={`rounded-none h-8 text-xs ${isExpiringSoon ? "border-[#F95A2C] text-[#F95A2C] hover:bg-[#F95A2C] hover:text-white" : "border-black/20"}`}
          >
            {renewing ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Redirection</> : <><RefreshCw className="w-3 h-3 mr-1.5" /> Renouveler ({fmt(d.amount_cents)})</>}
          </Button>
          <label className="flex items-center gap-2 text-xs font-manrope cursor-pointer ml-auto" data-testid={`auto-renew-toggle-${d.domain_name}`}>
            <input
              type="checkbox"
              checked={!!d.auto_renew}
              onChange={toggleAutoRenew}
              disabled={togglingAuto}
              className="accent-[#F95A2C]"
              data-testid={`auto-renew-checkbox-${d.domain_name}`}
            />
            <span className="text-[#52525B]">Renouvellement auto</span>
          </label>
        </div>
      )}
    </div>
  );
}
