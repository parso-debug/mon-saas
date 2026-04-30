import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

const Field = ({ label, children }) => (
  <div>
    <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">{label}</label>
    {children}
  </div>
);

const Section = ({ title, code, children }) => (
  <section className="bg-white border border-black/10 p-6 md:p-8" data-testid={`content-section-${code}`}>
    <div className="flex items-baseline gap-3 mb-6 pb-4 border-b border-black/10">
      <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// {code}</div>
      <h3 className="font-display font-bold text-xl tracking-tight">{title}</h3>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

/**
 * ContentEditor: structured editor for the AI-generated content.
 * Edits site.content in-place via setSite (controlled).
 */
export default function ContentEditor({ site, setSite }) {
  const c = site.content || {};

  const updateContent = (key, value) => {
    setSite((s) => ({ ...s, content: { ...s.content, [key]: value } }));
  };

  const updateArrayItem = (key, idx, field, value) => {
    const arr = [...(c[key] || [])];
    arr[idx] = { ...arr[idx], [field]: value };
    updateContent(key, arr);
  };

  const addArrayItem = (key, template) => {
    updateContent(key, [...(c[key] || []), template]);
  };

  const removeArrayItem = (key, idx) => {
    const arr = [...(c[key] || [])];
    arr.splice(idx, 1);
    updateContent(key, arr);
  };

  const updateStringArray = (key, idx, value) => {
    const arr = [...(c[key] || [])];
    arr[idx] = value;
    updateContent(key, arr);
  };

  return (
    <div className="space-y-4">
      <Section title="Tagline & Hero" code="hero">
        <Field label="Tagline (sur-titre)">
          <Input data-testid="edit-tagline" value={c.tagline || ""} onChange={(e) => updateContent("tagline", e.target.value)} className="h-11 rounded-none border-black/20" />
        </Field>
        <Field label="Titre principal (hero)">
          <Textarea data-testid="edit-hero-title" rows={2} value={c.hero_title || ""} onChange={(e) => updateContent("hero_title", e.target.value)} className="rounded-none border-black/20" />
        </Field>
        <Field label="Sous-titre">
          <Textarea data-testid="edit-hero-subtitle" rows={3} value={c.hero_subtitle || ""} onChange={(e) => updateContent("hero_subtitle", e.target.value)} className="rounded-none border-black/20" />
        </Field>
        <Field label="Texte du bouton (CTA)">
          <Input data-testid="edit-hero-cta" value={c.hero_cta || ""} onChange={(e) => updateContent("hero_cta", e.target.value)} className="h-11 rounded-none border-black/20" />
        </Field>
      </Section>

      <Section title="Arguments principaux (3)" code="value_props">
        {(c.value_props || []).map((vp, i) => (
          <div key={i} className="grid md:grid-cols-12 gap-3 items-start" data-testid={`edit-vp-${i}`}>
            <div className="md:col-span-3">
              <Field label={`Argument ${i + 1} — Titre`}>
                <Input value={vp.title || ""} onChange={(e) => updateArrayItem("value_props", i, "title", e.target.value)} className="h-11 rounded-none border-black/20" />
              </Field>
            </div>
            <div className="md:col-span-7">
              <Field label="Description">
                <Input value={vp.description || ""} onChange={(e) => updateArrayItem("value_props", i, "description", e.target.value)} className="h-11 rounded-none border-black/20" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Icône (lucide)">
                <Input value={vp.icon || ""} onChange={(e) => updateArrayItem("value_props", i, "icon", e.target.value)} className="h-11 rounded-none border-black/20 font-mono-grotesk text-xs" placeholder="shield-check" />
              </Field>
            </div>
          </div>
        ))}
        <p className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Icônes disponibles : shield-check, clock, award, star, heart, hammer, wrench, home, phone, users, check-circle, zap, sparkles</p>
      </Section>

      <Section title="Services" code="services">
        {(c.services || []).map((s, i) => (
          <div key={i} className="border border-black/10 p-4 relative" data-testid={`edit-service-${i}`}>
            <button onClick={() => removeArrayItem("services", i)} className="absolute top-3 right-3 text-[#71717A] hover:text-red-600" data-testid={`remove-service-${i}`}>
              <X className="w-4 h-4" />
            </button>
            <Field label={`Service ${i + 1} — Nom`}>
              <Input value={s.name || ""} onChange={(e) => updateArrayItem("services", i, "name", e.target.value)} className="h-11 rounded-none border-black/20" />
            </Field>
            <div className="mt-3">
              <Field label="Description">
                <Textarea rows={3} value={s.description || ""} onChange={(e) => updateArrayItem("services", i, "description", e.target.value)} className="rounded-none border-black/20" />
              </Field>
            </div>
          </div>
        ))}
        <Button onClick={() => addArrayItem("services", { name: "Nouveau service", description: "Description du service..." })} variant="outline" className="rounded-none border-black/20 hover:bg-black hover:text-white" data-testid="add-service">
          <Plus className="w-4 h-4 mr-2" /> Ajouter un service
        </Button>
      </Section>

      <Section title="À propos" code="about">
        <Field label="Titre de la section">
          <Input data-testid="edit-about-title" value={c.about_title || ""} onChange={(e) => updateContent("about_title", e.target.value)} className="h-11 rounded-none border-black/20" />
        </Field>
        <Field label="Texte de présentation">
          <Textarea data-testid="edit-about-text" rows={5} value={c.about_text || ""} onChange={(e) => updateContent("about_text", e.target.value)} className="rounded-none border-black/20" />
        </Field>
      </Section>

      <Section title="Pourquoi nous choisir (4 arguments)" code="why_us">
        {(c.why_us || []).map((w, i) => (
          <div key={i} className="flex gap-2 items-center" data-testid={`edit-why-${i}`}>
            <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] w-8 shrink-0">0{i + 1}</span>
            <Input value={w} onChange={(e) => updateStringArray("why_us", i, e.target.value)} className="h-11 rounded-none border-black/20 flex-1" />
            <button onClick={() => removeArrayItem("why_us", i)} className="text-[#71717A] hover:text-red-600 shrink-0" data-testid={`remove-why-${i}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <Button onClick={() => updateContent("why_us", [...(c.why_us || []), "Nouvel argument"])} variant="outline" className="rounded-none border-black/20 hover:bg-black hover:text-white" data-testid="add-why">
          <Plus className="w-4 h-4 mr-2" /> Ajouter un argument
        </Button>
      </Section>

      <Section title="Contact" code="contact">
        <Field label="Phrase d'introduction">
          <Textarea data-testid="edit-contact-intro" rows={2} value={c.contact_intro || ""} onChange={(e) => updateContent("contact_intro", e.target.value)} className="rounded-none border-black/20" />
        </Field>
      </Section>

      <Section title="SEO" code="seo">
        <Field label="Title HTML (50-60 caractères)">
          <Input data-testid="edit-seo-title" value={c.seo_title || ""} onChange={(e) => updateContent("seo_title", e.target.value)} className="h-11 rounded-none border-black/20" />
          <div className="mt-1 font-mono-grotesk text-[10px] text-[#71717A]">{(c.seo_title || "").length} caractères</div>
        </Field>
        <Field label="Meta description (140-160 caractères)">
          <Textarea data-testid="edit-seo-description" rows={3} value={c.seo_description || ""} onChange={(e) => updateContent("seo_description", e.target.value)} className="rounded-none border-black/20" />
          <div className="mt-1 font-mono-grotesk text-[10px] text-[#71717A]">{(c.seo_description || "").length} caractères</div>
        </Field>
        <Field label="Mots-clés (séparés par virgule)">
          <Input data-testid="edit-seo-keywords" value={(c.seo_keywords || []).join(", ")} onChange={(e) => updateContent("seo_keywords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="h-11 rounded-none border-black/20" />
        </Field>
      </Section>
    </div>
  );
}
