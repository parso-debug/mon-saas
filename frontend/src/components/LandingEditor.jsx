import { useEffect, useState, useRef } from "react";
import api, { resolveImg } from "@/lib/api";
import { clearAppSettingsCache } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Save, Upload, Plus, X, RotateCcw, Loader2, ExternalLink } from "lucide-react";

const Field = ({ label, hint, children, testid }) => (
  <div data-testid={testid}>
    <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">{label}</label>
    {children}
    {hint && <div className="font-mono-grotesk text-[10px] text-[#71717A] mt-1">{hint}</div>}
  </div>
);

const ImagePicker = ({ value, onChange, kind = "landing", testid }) => {
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5_000_000) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const r = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(r.data.url);
      toast.success("Image uploadée");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur upload");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="flex gap-2">
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="URL ou upload" className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs flex-1" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy} variant="outline" className="rounded-none border-black/20 hover:bg-black hover:text-white">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
      </div>
      {value && (
        <div className="border border-black/10 p-2 inline-block max-w-[200px]">
          <img src={resolveImg(value)} alt="aperçu" className="max-h-24 max-w-full object-contain" />
        </div>
      )}
    </div>
  );
};

const StringList = ({ value = [], onChange, placeholder, testid }) => {
  const list = value || [];
  return (
    <div className="space-y-2" data-testid={testid}>
      {list.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input value={v} onChange={(e) => { const a = [...list]; a[i] = e.target.value; onChange(a); }} className="h-10 rounded-none border-black/20 flex-1" placeholder={placeholder} />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-[#71717A] hover:text-red-600 px-2"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <Button onClick={() => onChange([...list, ""])} variant="outline" size="sm" className="rounded-none border-black/20"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter</Button>
    </div>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <div className="text-left">
    <div className="font-display font-bold text-base tracking-tight">{title}</div>
    {subtitle && <div className="text-xs text-[#71717A] mt-0.5">{subtitle}</div>}
  </div>
);

export default function LandingEditor() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.get("/app-settings").then((r) => setS(r.data)).catch(() => toast.error("Erreur chargement")).finally(() => setLoading(false));
  }, []);

  const set = (path, value) => {
    setS((prev) => {
      const ns = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let cur = ns;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return ns;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/app-settings", s);
      clearAppSettingsCache();
      toast.success("Landing mise à jour ✓");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Réinitialiser la landing aux valeurs par défaut ?")) return;
    setResetting(true);
    try {
      const r = await api.post("/admin/app-settings/reset");
      setS(r.data);
      clearAppSettingsCache();
      toast.success("Landing réinitialisée");
    } catch (e) {
      toast.error("Erreur");
    } finally {
      setResetting(false);
    }
  };

  if (loading || !s) return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[#F95A2C]" /></div>;

  const hero = s.hero || {};
  const navbar = s.navbar || {};
  const how = s.how_it_works || {};
  const feat = s.features || {};
  const featMain = feat.main || {};
  const test = s.testimonial || {};
  const pricing = s.pricing || {};
  const free = pricing.free || {};
  const pro = pricing.pro || {};
  const footerCta = s.footer_cta || {};
  const footer = s.footer || {};

  return (
    <div className="space-y-4" data-testid="landing-editor">
      {/* Sticky bar */}
      <div className="sticky top-16 z-20 bg-[#FAFAFA] -mx-6 px-6 py-3 border-b border-black/10 flex items-center justify-between gap-3">
        <div className="text-sm text-[#52525B]">Modifications appliquées en direct sur <a href="/" target="_blank" rel="noreferrer" className="text-[#F95A2C] underline underline-offset-4 inline-flex items-center gap-1">la landing <ExternalLink className="w-3 h-3" /></a></div>
        <div className="flex gap-2">
          <Button onClick={reset} disabled={resetting} variant="outline" size="sm" className="rounded-none border-black/20" data-testid="reset-landing">
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-2" />}{resetting ? "" : "Reset"}
          </Button>
          <Button onClick={save} disabled={saving} size="sm" className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="save-landing">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Save className="w-3.5 h-3.5 mr-2" />}{saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["hero"]} className="space-y-3">
        {/* BRAND */}
        <AccordionItem value="brand" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline">
            <SectionHeader title="Marque" subtitle="Nom & lettre du logo" />
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <Field label="Nom de la marque"><Input value={s.brand?.name || ""} onChange={(e) => set("brand.name", e.target.value)} className="h-11 rounded-none border-black/20" data-testid="brand-name" /></Field>
            <Field label="Lettre du logo"><Input value={s.brand?.logo_letter || ""} onChange={(e) => set("brand.logo_letter", e.target.value.slice(0, 1))} className="h-11 w-20 rounded-none border-black/20 text-center font-display text-xl" data-testid="brand-logo-letter" /></Field>
          </AccordionContent>
        </AccordionItem>

        {/* NAVBAR */}
        <AccordionItem value="navbar" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Navigation" subtitle={`${navbar.items?.length || 0} liens`} /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            {(navbar.items || []).map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`nav-item-${i}`}>
                <div className="col-span-5">
                  <Field label={`Lien ${i + 1} — Texte`}>
                    <Input value={it.label || ""} onChange={(e) => { const arr = [...navbar.items]; arr[i] = { ...arr[i], label: e.target.value }; set("navbar.items", arr); }} className="h-11 rounded-none border-black/20" />
                  </Field>
                </div>
                <div className="col-span-6">
                  <Field label="URL ou ancre">
                    <Input value={it.href || ""} onChange={(e) => { const arr = [...navbar.items]; arr[i] = { ...arr[i], href: e.target.value }; set("navbar.items", arr); }} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" placeholder="#how" />
                  </Field>
                </div>
                <button onClick={() => set("navbar.items", navbar.items.filter((_, j) => j !== i))} className="col-span-1 h-11 text-[#71717A] hover:text-red-600 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <Button onClick={() => set("navbar.items", [...(navbar.items || []), { label: "Nouveau lien", href: "#" }])} variant="outline" size="sm" className="rounded-none border-black/20" data-testid="add-nav-item"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter un lien</Button>
            <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-black/5">
              <Field label="Texte bouton 'Se connecter'"><Input value={navbar.cta_login || ""} onChange={(e) => set("navbar.cta_login", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Texte bouton 'Commencer'"><Input value={navbar.cta_signup || ""} onChange={(e) => set("navbar.cta_signup", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* HERO */}
        <AccordionItem value="hero" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Hero" subtitle="Section principale en haut de la landing" /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <Field label="Badge (au-dessus du titre)"><Input value={hero.badge || ""} onChange={(e) => set("hero.badge", e.target.value)} className="h-11 rounded-none border-black/20" data-testid="hero-badge" /></Field>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Titre · ligne 1"><Input value={hero.title_line_1 || ""} onChange={(e) => set("hero.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne 2"><Input value={hero.title_line_2 || ""} onChange={(e) => set("hero.title_line_2", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne italique (orange)"><Input value={hero.title_italic || ""} onChange={(e) => set("hero.title_italic", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <Field label="Sous-titre"><Textarea rows={3} value={hero.subtitle || ""} onChange={(e) => set("hero.subtitle", e.target.value)} className="rounded-none border-black/20" data-testid="hero-subtitle" /></Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Bouton principal (CTA)"><Input value={hero.cta_primary || ""} onChange={(e) => set("hero.cta_primary", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Bouton secondaire"><Input value={hero.cta_secondary || ""} onChange={(e) => set("hero.cta_secondary", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <Field label="Bénéfices listés sous les boutons"><StringList value={hero.trust_chips} onChange={(v) => set("hero.trust_chips", v)} placeholder="Ex: Sans carte bancaire" testid="hero-trust-chips" /></Field>
            <div className="pt-3 border-t border-black/5 space-y-3">
              <div className="font-display font-bold text-sm">Aperçu (carte de droite)</div>
              <Field label="Image"><ImagePicker value={hero.preview_img} onChange={(v) => set("hero.preview_img", v)} kind="hero" testid="hero-preview-img" /></Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nom entreprise · ligne 1"><Input value={hero.preview_business_line_1 || ""} onChange={(e) => set("hero.preview_business_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
                <Field label="Nom entreprise · ligne 2"><Input value={hero.preview_business_line_2 || ""} onChange={(e) => set("hero.preview_business_line_2", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              </div>
              <Field label="Métadonnées (ex: Toulouse · Depuis 1998)"><Input value={hero.preview_meta || ""} onChange={(e) => set("hero.preview_meta", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="3 stats">
                <div className="space-y-2">
                  {(hero.preview_stats || []).map((st, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Input value={st.label || ""} onChange={(e) => { const arr = [...hero.preview_stats]; arr[i] = { ...arr[i], label: e.target.value }; set("hero.preview_stats", arr); }} className="col-span-7 h-10 rounded-none border-black/20" placeholder="Label" />
                      <Input value={st.value || ""} onChange={(e) => { const arr = [...hero.preview_stats]; arr[i] = { ...arr[i], value: e.target.value }; set("hero.preview_stats", arr); }} className="col-span-4 h-10 rounded-none border-black/20" placeholder="Valeur" />
                      <button onClick={() => set("hero.preview_stats", hero.preview_stats.filter((_, j) => j !== i))} className="col-span-1 text-[#71717A] hover:text-red-600 flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <Button onClick={() => set("hero.preview_stats", [...(hero.preview_stats || []), { label: "Label", value: "—" }])} variant="outline" size="sm" className="rounded-none border-black/20"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter</Button>
                </div>
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* MARQUEE */}
        <AccordionItem value="marquee" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Bandeau métiers (marquee)" subtitle="Liste des métiers défilants" /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <StringList value={s.marquee_trades} onChange={(v) => set("marquee_trades", v)} placeholder="ex: plombier" testid="marquee-trades" />
          </AccordionContent>
        </AccordionItem>

        {/* HOW IT WORKS */}
        <AccordionItem value="how" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Comment ça marche" subtitle={`${how.steps?.length || 0} étapes`} /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Kicker"><Input value={how.kicker || ""} onChange={(e) => set("how_it_works.kicker", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne 1"><Input value={how.title_line_1 || ""} onChange={(e) => set("how_it_works.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne italique"><Input value={how.title_italic || ""} onChange={(e) => set("how_it_works.title_italic", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <Field label="Sous-titre"><Textarea rows={2} value={how.subtitle || ""} onChange={(e) => set("how_it_works.subtitle", e.target.value)} className="rounded-none border-black/20" /></Field>
            <div className="space-y-3">
              {(how.steps || []).map((st, i) => (
                <div key={i} className="border border-black/10 p-4 relative" data-testid={`how-step-${i}`}>
                  <button onClick={() => set("how_it_works.steps", how.steps.filter((_, j) => j !== i))} className="absolute top-3 right-3 text-[#71717A] hover:text-red-600"><X className="w-4 h-4" /></button>
                  <div className="grid md:grid-cols-12 gap-3">
                    <div className="md:col-span-2"><Field label="N°"><Input value={st.n || ""} onChange={(e) => { const a = [...how.steps]; a[i] = { ...a[i], n: e.target.value }; set("how_it_works.steps", a); }} className="h-11 rounded-none border-black/20" /></Field></div>
                    <div className="md:col-span-7"><Field label="Titre"><Input value={st.title || ""} onChange={(e) => { const a = [...how.steps]; a[i] = { ...a[i], title: e.target.value }; set("how_it_works.steps", a); }} className="h-11 rounded-none border-black/20" /></Field></div>
                    <div className="md:col-span-3"><Field label="Icône (lucide)"><Input value={st.icon || ""} onChange={(e) => { const a = [...how.steps]; a[i] = { ...a[i], icon: e.target.value }; set("how_it_works.steps", a); }} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field></div>
                  </div>
                  <div className="mt-3"><Field label="Description"><Textarea rows={2} value={st.description || ""} onChange={(e) => { const a = [...how.steps]; a[i] = { ...a[i], description: e.target.value }; set("how_it_works.steps", a); }} className="rounded-none border-black/20" /></Field></div>
                </div>
              ))}
              <Button onClick={() => set("how_it_works.steps", [...(how.steps || []), { n: String((how.steps?.length || 0) + 1).padStart(2, "0"), title: "Étape", description: "...", icon: "sparkles" }])} variant="outline" size="sm" className="rounded-none border-black/20"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une étape</Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* FEATURES */}
        <AccordionItem value="features" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Fonctionnalités" subtitle="1 mise en avant + 4 cartes" /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Kicker section"><Input value={feat.kicker || ""} onChange={(e) => set("features.kicker", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne 1"><Input value={feat.title_line_1 || ""} onChange={(e) => set("features.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne italique"><Input value={feat.title_italic || ""} onChange={(e) => set("features.title_italic", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <div className="border border-black/10 bg-[#FAFAFA] p-4 space-y-3">
              <div className="font-display font-bold text-sm">Carte principale (sombre)</div>
              <div className="grid md:grid-cols-3 gap-3">
                <Field label="Icône"><Input value={featMain.icon || ""} onChange={(e) => set("features.main.icon", e.target.value)} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field>
                <Field label="Kicker"><Input value={featMain.kicker || ""} onChange={(e) => set("features.main.kicker", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Titre · ligne 1"><Input value={featMain.title_line_1 || ""} onChange={(e) => set("features.main.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
                <Field label="Titre · ligne 2"><Input value={featMain.title_line_2 || ""} onChange={(e) => set("features.main.title_line_2", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              </div>
              <Field label="Description"><Textarea rows={3} value={featMain.description || ""} onChange={(e) => set("features.main.description", e.target.value)} className="rounded-none border-black/20" /></Field>
            </div>
            <div className="space-y-3">
              <div className="font-display font-bold text-sm">Cartes latérales</div>
              {(feat.items || []).map((it, i) => (
                <div key={i} className="border border-black/10 p-4 relative" data-testid={`feat-item-${i}`}>
                  <button onClick={() => set("features.items", feat.items.filter((_, j) => j !== i))} className="absolute top-3 right-3 text-[#71717A] hover:text-red-600"><X className="w-4 h-4" /></button>
                  <div className="grid md:grid-cols-12 gap-3">
                    <div className="md:col-span-2"><Field label="Icône"><Input value={it.icon || ""} onChange={(e) => { const a = [...feat.items]; a[i] = { ...a[i], icon: e.target.value }; set("features.items", a); }} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field></div>
                    <div className="md:col-span-6"><Field label="Titre"><Input value={it.title || ""} onChange={(e) => { const a = [...feat.items]; a[i] = { ...a[i], title: e.target.value }; set("features.items", a); }} className="h-11 rounded-none border-black/20" /></Field></div>
                    <div className="md:col-span-4">
                      <Field label="Style">
                        <select value={it.color || "default"} onChange={(e) => { const a = [...feat.items]; a[i] = { ...a[i], color: e.target.value }; set("features.items", a); }} className="h-11 w-full rounded-none border border-black/20 px-3 bg-white text-sm">
                          <option value="default">Blanc</option>
                          <option value="accent">Orange (accent)</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                  <div className="mt-3"><Field label="Description"><Textarea rows={2} value={it.description || ""} onChange={(e) => { const a = [...feat.items]; a[i] = { ...a[i], description: e.target.value }; set("features.items", a); }} className="rounded-none border-black/20" /></Field></div>
                </div>
              ))}
              <Button onClick={() => set("features.items", [...(feat.items || []), { icon: "zap", title: "Nouvelle carte", description: "...", color: "default" }])} variant="outline" size="sm" className="rounded-none border-black/20"><Plus className="w-3.5 h-3.5 mr-2" /> Ajouter une carte</Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* TESTIMONIAL */}
        <AccordionItem value="testimonial" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Témoignage client" subtitle={test.author} /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <Field label="Kicker"><Input value={test.kicker || ""} onChange={(e) => set("testimonial.kicker", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            <Field label="Citation (sans guillemets)"><Textarea rows={3} value={test.quote || ""} onChange={(e) => set("testimonial.quote", e.target.value)} className="rounded-none border-black/20" data-testid="testimonial-quote" /></Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Auteur"><Input value={test.author || ""} onChange={(e) => set("testimonial.author", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Rôle (ex: Maçon · Toulouse)"><Input value={test.role || ""} onChange={(e) => set("testimonial.role", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <Field label="Photo"><ImagePicker value={test.avatar_url} onChange={(v) => set("testimonial.avatar_url", v)} kind="testimonial" testid="testimonial-avatar" /></Field>
          </AccordionContent>
        </AccordionItem>

        {/* PRICING */}
        <AccordionItem value="pricing" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Tarifs" subtitle="Plans Free & Pro affichés sur la landing" /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Kicker"><Input value={pricing.kicker || ""} onChange={(e) => set("pricing.kicker", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · ligne 1"><Input value={pricing.title_line_1 || ""} onChange={(e) => set("pricing.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              <Field label="Titre · italique"><Input value={pricing.title_italic || ""} onChange={(e) => set("pricing.title_italic", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* FREE */}
              <div className="border border-black/10 p-4 space-y-3">
                <div className="font-display font-bold text-sm">Plan Free</div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Label"><Input value={free.label || ""} onChange={(e) => set("pricing.free.label", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                  <Field label="Prix"><Input value={free.price || ""} onChange={(e) => set("pricing.free.price", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                  <Field label="Période"><Input value={free.period || ""} onChange={(e) => set("pricing.free.period", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                </div>
                <Field label="Tagline"><Input value={free.tagline || ""} onChange={(e) => set("pricing.free.tagline", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                <Field label="Avantages (un par ligne)"><StringList value={free.features} onChange={(v) => set("pricing.free.features", v)} placeholder="Ex: 1 site généré" /></Field>
                <Field label="Texte du bouton"><Input value={free.cta || ""} onChange={(e) => set("pricing.free.cta", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
              </div>
              {/* PRO */}
              <div className="border border-black bg-[#FAFAFA] p-4 space-y-3">
                <div className="font-display font-bold text-sm">Plan Pro</div>
                <div className="grid grid-cols-4 gap-2">
                  <Field label="Label"><Input value={pro.label || ""} onChange={(e) => set("pricing.pro.label", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                  <Field label="Prix"><Input value={pro.price || ""} onChange={(e) => set("pricing.pro.price", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                  <Field label="Période"><Input value={pro.period || ""} onChange={(e) => set("pricing.pro.period", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                  <Field label="Badge"><Input value={pro.badge || ""} onChange={(e) => set("pricing.pro.badge", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                </div>
                <Field label="Tagline"><Input value={pro.tagline || ""} onChange={(e) => set("pricing.pro.tagline", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
                <Field label="Avantages"><StringList value={pro.features} onChange={(v) => set("pricing.pro.features", v)} placeholder="Ex: Sites illimités" /></Field>
                <Field label="Texte du bouton"><Input value={pro.cta || ""} onChange={(e) => set("pricing.pro.cta", e.target.value)} className="h-10 rounded-none border-black/20" /></Field>
              </div>
            </div>
            <p className="text-xs text-[#71717A]">⚠️ Modifier le prix affiché ici n'a pas d'impact sur le montant facturé par Stripe (configuré côté backend dans <code>PACKAGES</code>).</p>
          </AccordionContent>
        </AccordionItem>

        {/* FOOTER */}
        <AccordionItem value="footer" className="bg-white border border-black/10">
          <AccordionTrigger className="px-6 hover:no-underline"><SectionHeader title="Footer & CTA final" subtitle="Bas de page" /></AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4">
            <div className="border border-black/10 p-4 space-y-3 bg-[#FAFAFA]">
              <div className="font-display font-bold text-sm">CTA final (sombre)</div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Titre · ligne 1"><Input value={footerCta.title_line_1 || ""} onChange={(e) => set("footer_cta.title_line_1", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
                <Field label="Titre · italique"><Input value={footerCta.title_italic || ""} onChange={(e) => set("footer_cta.title_italic", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
              </div>
              <Field label="Texte du bouton"><Input value={footerCta.button_label || ""} onChange={(e) => set("footer_cta.button_label", e.target.value)} className="h-11 rounded-none border-black/20" /></Field>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Copyright"><Input value={footer.copyright || ""} onChange={(e) => set("footer.copyright", e.target.value)} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field>
              <Field label="Version"><Input value={footer.version || ""} onChange={(e) => set("footer.version", e.target.value)} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field>
              <Field label="Status"><Input value={footer.status || ""} onChange={(e) => set("footer.status", e.target.value)} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" /></Field>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
