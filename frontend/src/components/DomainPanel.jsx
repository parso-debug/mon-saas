import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, Loader2, AlertCircle, ShieldCheck, Globe, Sparkles, Trash2, X } from "lucide-react";

const slugifyClient = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const CopyBtn = ({ value, testid }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); toast.success("Copié"); }}
      className="text-[#71717A] hover:text-[#F95A2C] transition-colors"
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default function DomainPanel({ site, setSite, onSaved }) {
  // --- Slug section ---
  const [slugDraft, setSlugDraft] = useState(site.slug || "");
  const [slugCheck, setSlugCheck] = useState({ status: "idle" }); // idle | checking | available | unavailable
  const [savingSlug, setSavingSlug] = useState(false);

  useEffect(() => {
    setSlugDraft(site.slug || "");
  }, [site.slug]);

  useEffect(() => {
    if (!slugDraft || slugDraft === site.slug) { setSlugCheck({ status: "idle" }); return; }
    setSlugCheck({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const r = await api.post("/sites/check-slug", { slug: slugDraft });
        setSlugCheck(r.data.available ? { status: "available", normalized: r.data.normalized } : { status: "unavailable", reason: r.data.reason });
      } catch (e) {
        setSlugCheck({ status: "unavailable", reason: e?.response?.data?.detail || "Erreur" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slugDraft, site.slug]);

  const saveSlug = async () => {
    if (slugCheck.status !== "available") return;
    setSavingSlug(true);
    try {
      const r = await api.put(`/sites/${site.id}`, { slug: slugDraft });
      setSite(r.data);
      toast.success("URL mise à jour !");
      onSaved && onSaved(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    } finally {
      setSavingSlug(false);
    }
  };

  // --- Custom domain section ---
  const [domainInput, setDomainInput] = useState(site.custom_domain || "");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [instructions, setInstructions] = useState(null); // populated from connect response
  const [billing, setBilling] = useState(null);

  useEffect(() => {
    api.get("/billing/me").then((r) => setBilling(r.data)).catch(() => {});
  }, []);

  const isPro = billing?.plan === "pro";
  const hasDomain = !!site.custom_domain;
  const isVerified = !!site.domain_verified;

  // Reuse stored token to rebuild instructions if site already has a connected domain
  useEffect(() => {
    if (hasDomain && site.domain_token) {
      setInstructions({
        txt_record: { type: "TXT", name: `_artisanweb-verify.${site.custom_domain}`, value: site.domain_token, purpose: "Vérification de propriété (obligatoire)" },
        a_record: { type: "A", name: "@", value: "76.76.21.21", purpose: "Pointer le domaine racine vers nos serveurs" },
        cname_record: { type: "CNAME", name: "www", value: "sites.artisanweb.app", purpose: "Pointer le sous-domaine www" },
      });
    } else if (!hasDomain) {
      setInstructions(null);
      setVerifyResult(null);
    }
  }, [site.custom_domain, site.domain_token, hasDomain]);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await api.post(`/sites/${site.id}/domain/connect`, { domain: domainInput });
      setInstructions(r.data.instructions);
      setSite((s) => ({ ...s, custom_domain: r.data.domain, domain_token: r.data.instructions.txt_record.value, domain_verified: false }));
      toast.success("Domaine connecté ! Suivez les instructions DNS.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    } finally {
      setConnecting(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await api.post(`/sites/${site.id}/domain/verify`);
      setVerifyResult(r.data);
      if (r.data.verified) {
        setSite((s) => ({ ...s, domain_verified: true }));
        toast.success("Domaine vérifié 🎉");
      } else {
        toast.error("Pas encore vérifié — voir le détail ci-dessous.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    } finally {
      setVerifying(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Déconnecter ce domaine ? Le site restera accessible via votre URL artisanweb.")) return;
    try {
      await api.delete(`/sites/${site.id}/domain`);
      setSite((s) => { const ns = { ...s }; delete ns.custom_domain; delete ns.domain_token; delete ns.domain_verified; return ns; });
      setDomainInput("");
      setInstructions(null);
      setVerifyResult(null);
      toast.success("Domaine déconnecté");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  };

  const slugUrl = `${window.location.origin}/site/${site.slug}`;
  const customUrl = site.custom_domain ? `https://${site.custom_domain}` : null;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-4">
      <div>
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// url & domaine</div>
        <h2 className="font-display font-bold text-3xl tracking-tight">URL & Domaine</h2>
        <p className="text-[#52525B] mt-1 text-sm">Personnalisez l'adresse web de votre site.</p>
      </div>

      {/* SLUG SECTION */}
      <section className="bg-white border border-black/10 p-6 md:p-8" data-testid="slug-section">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-1">// 01 — URL artisanweb</div>
            <h3 className="font-display font-bold text-xl tracking-tight">Personnalisez votre URL</h3>
            <p className="text-sm text-[#52525B] mt-1">Disponible pour tous, même en plan Free.</p>
          </div>
          <Badge className="bg-[#F95A2C] hover:bg-[#F95A2C] text-white rounded-none font-mono-grotesk text-[10px] uppercase tracking-[0.15em]">FREE</Badge>
        </div>

        <div className="mt-5">
          <div className="flex items-stretch border border-black/20 focus-within:border-[#F95A2C] transition-colors">
            <span className="bg-[#FAFAFA] border-r border-black/10 px-4 py-3 font-mono-grotesk text-sm text-[#71717A] flex items-center whitespace-nowrap">
              {window.location.origin.replace(/^https?:\/\//, "")}/site/
            </span>
            <Input
              data-testid="slug-input"
              value={slugDraft}
              onChange={(e) => setSlugDraft(slugifyClient(e.target.value))}
              className="flex-1 h-auto rounded-none border-0 focus-visible:ring-0 focus-visible:border-0 font-mono-grotesk"
              placeholder="ma-super-entreprise"
              maxLength={60}
            />
            <span className="px-3 flex items-center">
              {slugCheck.status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-[#71717A]" />}
              {slugCheck.status === "available" && <Check className="w-4 h-4 text-[#F95A2C]" />}
              {slugCheck.status === "unavailable" && <X className="w-4 h-4 text-red-600" />}
            </span>
          </div>
          <div className="mt-2 min-h-[20px] text-xs">
            {slugCheck.status === "available" && <span className="text-[#F95A2C] font-mono-grotesk uppercase tracking-[0.15em]">disponible ✓</span>}
            {slugCheck.status === "unavailable" && <span className="text-red-600">{slugCheck.reason}</span>}
            {slugCheck.status === "idle" && slugDraft === site.slug && <span className="text-[#71717A] font-mono-grotesk uppercase tracking-[0.15em]">URL actuelle</span>}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="font-mono-grotesk text-xs bg-[#FAFAFA] border border-black/10 px-3 py-2 truncate flex items-center gap-2 flex-1 min-w-0">
            <Globe className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
            <span className="truncate">{slugUrl}</span>
            <CopyBtn value={slugUrl} testid="copy-slug-url" />
          </div>
          <Button
            data-testid="save-slug-btn"
            onClick={saveSlug}
            disabled={slugCheck.status !== "available" || savingSlug}
            className="rounded-none h-10 px-5 bg-[#09090B] hover:bg-[#F95A2C] text-white"
          >
            {savingSlug ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer l'URL"}
          </Button>
        </div>
      </section>

      {/* CUSTOM DOMAIN SECTION */}
      <section className="bg-white border border-black/10 p-6 md:p-8" data-testid="custom-domain-section">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-1">// 02 — domaine personnalisé</div>
            <h3 className="font-display font-bold text-xl tracking-tight">Connectez votre propre domaine</h3>
            <p className="text-sm text-[#52525B] mt-1">Utilisez l'adresse de votre entreprise (ex: votre-entreprise.fr).</p>
          </div>
          <Badge className="bg-[#09090B] hover:bg-[#09090B] text-white rounded-none font-mono-grotesk text-[10px] uppercase tracking-[0.15em] flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> PRO
          </Badge>
        </div>

        {!isPro && (
          <div className="mt-5 bg-[#FAFAFA] border border-black/10 p-5 flex items-start gap-4" data-testid="domain-pro-gate">
            <div className="w-10 h-10 bg-[#09090B] text-[#F95A2C] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold text-base mb-1">Réservé au plan Pro</div>
              <p className="text-sm text-[#52525B] mb-3">Connectez un nom de domaine personnalisé (ex: votre-entreprise.fr) pour donner un visage encore plus professionnel à votre site.</p>
              <Link to="/billing">
                <Button size="sm" className="rounded-none bg-[#F95A2C] hover:bg-[#09090B] text-white" data-testid="domain-upgrade-btn">
                  Passer à Pro · 19€/mois
                </Button>
              </Link>
            </div>
          </div>
        )}

        {isPro && !hasDomain && (
          <div className="mt-5">
            <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Votre nom de domaine</label>
            <div className="flex gap-2">
              <Input
                data-testid="domain-input"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="votre-entreprise.fr"
                className="h-12 rounded-none border-black/20 font-mono-grotesk"
              />
              <Button
                data-testid="domain-connect-btn"
                onClick={connect}
                disabled={!domainInput || connecting}
                className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connecter"}
              </Button>
            </div>
            <p className="text-xs text-[#71717A] mt-2 font-mono-grotesk">vous devez déjà posséder ce domaine chez un registrar (OVH, Gandi, IONOS...)</p>
          </div>
        )}

        {isPro && hasDomain && (
          <div className="mt-5 space-y-5">
            {/* Status header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA] border border-black/10 p-4" data-testid="domain-status">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 flex items-center justify-center ${isVerified ? "bg-[#F95A2C] text-white" : "bg-[#FAFAFA] border border-black/20 text-[#71717A]"}`}>
                  {isVerified ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-display font-bold">{site.custom_domain}</div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-0.5">
                    {isVerified ? "● vérifié" : "● en attente de vérification DNS"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {!isVerified && (
                  <Button onClick={verify} disabled={verifying} size="sm" data-testid="domain-verify-btn" className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white">
                    {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-2" />}
                    {verifying ? "" : "Vérifier maintenant"}
                  </Button>
                )}
                {isVerified && customUrl && (
                  <Button onClick={() => window.open(customUrl, "_blank")} size="sm" variant="outline" className="rounded-none border-black/20" data-testid="domain-visit-btn">
                    Ouvrir
                  </Button>
                )}
                <Button onClick={disconnect} size="sm" variant="outline" data-testid="domain-disconnect-btn" className="rounded-none border-black/20 hover:bg-red-600 hover:text-white hover:border-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* DNS instructions */}
            {instructions && !isVerified && (
              <div className="border border-black/10 p-5">
                <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// configuration dns requise</div>
                <p className="text-sm text-[#52525B] mb-5">Connectez-vous chez votre registrar et ajoutez ces 3 enregistrements DNS :</p>

                {[
                  { key: "txt", rec: instructions.txt_record, mandatory: true },
                  { key: "a", rec: instructions.a_record, mandatory: false },
                  { key: "cname", rec: instructions.cname_record, mandatory: false },
                ].map(({ key, rec, mandatory }) => rec && (
                  <div key={key} className="border border-black/10 mb-2 last:mb-0" data-testid={`dns-row-${key}`}>
                    <div className="bg-[#FAFAFA] px-4 py-2 border-b border-black/10 flex items-center justify-between">
                      <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">{rec.purpose}</span>
                      {mandatory && <Badge className="bg-[#F95A2C] hover:bg-[#F95A2C] text-white rounded-none text-[9px] uppercase tracking-[0.15em] font-mono-grotesk">obligatoire</Badge>}
                    </div>
                    <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center font-mono-grotesk text-xs">
                      <div className="col-span-2">
                        <div className="text-[#71717A] uppercase text-[9px] tracking-[0.15em]">Type</div>
                        <div className="text-[#09090B] font-bold mt-0.5">{rec.type}</div>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="text-[#71717A] uppercase text-[9px] tracking-[0.15em]">Hôte / Nom</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#09090B] truncate" data-testid={`dns-${key}-name`}>{rec.name}</span>
                          <CopyBtn value={rec.name} testid={`copy-dns-${key}-name`} />
                        </div>
                      </div>
                      <div className="col-span-7 min-w-0">
                        <div className="text-[#71717A] uppercase text-[9px] tracking-[0.15em]">Valeur</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#09090B] truncate" data-testid={`dns-${key}-value`}>{rec.value}</span>
                          <CopyBtn value={rec.value} testid={`copy-dns-${key}-value`} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <p className="text-xs text-[#71717A] mt-4 font-mono-grotesk">
                  ⏱ propagation dns · jusqu'à 48h · cliquez sur "vérifier maintenant" une fois le dns configuré
                </p>
              </div>
            )}

            {/* Verify result */}
            {verifyResult && !verifyResult.verified && (
              <div className="border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="domain-verify-result">
                <div className="font-display font-bold text-amber-900 mb-1">Vérification non aboutie</div>
                <p className="text-amber-800">{verifyResult.hint}</p>
                {verifyResult.checked_records?.length > 0 && (
                  <div className="mt-2 font-mono-grotesk text-xs text-amber-900">
                    <span className="opacity-60">records trouvés :</span> {verifyResult.checked_records.map((r, i) => <code key={i} className="bg-white px-1 ml-1 break-all">{r}</code>)}
                  </div>
                )}
              </div>
            )}

            {isVerified && customUrl && (
              <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm" data-testid="domain-verified-success">
                <div className="font-display font-bold text-emerald-900 mb-1">Domaine vérifié 🎉</div>
                <p className="text-emerald-800">Votre site est désormais accessible à <code className="bg-white px-1 break-all">{customUrl}</code>.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
