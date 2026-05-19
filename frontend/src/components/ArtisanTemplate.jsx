import { useEffect, useState } from "react";
import * as Lucide from "lucide-react";
import { Phone, Mail, MapPin, Send, Check, Star } from "lucide-react";
import { resolveImg } from "@/lib/api";
import { DEFAULT_THEME, ensureGoogleFontsLoaded } from "@/components/ThemePicker";
import { DEFAULT_SECTION_ORDER } from "@/components/SectionsReorder";

const HERO_BY_JOB = {
  'paysagiste': 'https://images.unsplash.com/photo-1557429287-b2e26467fc2b?q=80&w=1200', // jardin
  'plâtrier': 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=1200', // plâtrerie
  'carreleur': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200',
  'menuisier': 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?q=80&w=1200',
  'plombier': 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?q=80&w=1200',
  'électricien': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200',
  'peintre': 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?q=80&w=1200'
};

const Icon = ({ name, className }) => {
  const pascal = (name || "").split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const Cmp = Lucide[pascal] || Lucide.Sparkles;
  return <Cmp className={className} />;
};

/**
 * ArtisanTemplate: the actual generated artisan website.
 * - Renders content from the AI-generated structure.
 * - Optional onSubmitLead callback for the contact form (in builder preview mode, can be no-op).
 * - editable: when true, allows inline editing of certain text fields (used in Builder).
 * - Uses site.theme (colors + fonts) and site.section_order to customize rendering.
 */
export default function ArtisanTemplate({ site, onSubmitLead, editable = false, onEdit }) {
  const c = site.content || {};
  const [lead, setLead] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const STYLE_PRESETS = {
    moderne: { primary_color: '#1F3D2D', accent_color: '#C84B31', font_heading: 'Instrument Serif', font_body: 'Manrope' },
    premium: { primary_color: '#0A0A0A', accent_color: '#C9A86A', font_heading: 'Playfair Display', font_body: 'Inter' },
    minimaliste: { primary_color: '#111827', accent_color: '#6B7280', font_heading: 'Inter', font_body: 'Inter' }
  };

  const theme = { ...DEFAULT_THEME, ...(STYLE_PRESETS[(site.style || '').toLowerCase()] || {}), ...(site.theme || {}) };
  const sectionOrder = (site.section_order && site.section_order.length ? site.section_order : DEFAULT_SECTION_ORDER);

  useEffect(() => { ensureGoogleFontsLoaded(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSubmitLead) return;
    setSending(true);
    try {
      await onSubmitLead(lead);
      setSent(true);
      setLead({ name: "", email: "", phone: "", message: "" });
    } finally {
      setSending(false);
    }
  };

  const Editable = ({ value, field, as: As = "span", className = "" }) => {
    if (!editable) return <As className={className}>{value}</As>;
    return (
      <As
        className={`${className} outline-none focus:bg-[#FEF3C7] focus:ring-2 focus:ring-[#C84B31]/40 px-1 -mx-1 transition-colors`}
        contentEditable suppressContentEditableWarning
        onBlur={(e) => onEdit && onEdit(field, e.currentTarget.textContent)}
      >
        {value}
      </As>
    );
  };

  const jobKey = (site.business_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const HERO_BY_JOB = {
    'paysagiste': 'https://images.unsplash.com/photo-1557429287-b2e26467fc2b?q=80&w=1200',
    'platrier': 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=1200',
    'carreleur': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200',
    'menuisier': 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?q=80&w=1200',
    'plombier': 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?q=80&w=1200',
    'electricien': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200',
    'peintre': 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?q=80&w=1200'
  };

  const SERVICES_BY_JOB = {
    'paysagiste': [
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200',
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=1200'
    ],
    'platrier': [
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=1200',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200'
    ],
    'carreleur': [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200'
    ],
    'menuisier': [
      'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?q=80&w=1200',
      'https://images.unsplash.com/photo-1601562236203-261b587f57f5?q=80&w=1200'
    ],
    'plombier': [
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?q=80&w=1200',
      'https://images.unsplash.com/photo-1631643553547-5e6c9d7f2e06?q=80&w=1200'
    ],
    'electricien': [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200',
      'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=1200'
    ],
    'peintre': [
      'https://images.unsplash.com/photo-1562259949-e8e7689d7828?q=80&w=1200',
      'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?q=80&w=1200'
    ]
  };

  const heroImage = resolveImg(site.hero_image_url) || HERO_BY_JOB[jobKey] || "https://images.pexels.com/photos/7492582/pexels-photo-7492582.jpeg";
  const service1Img = SERVICES_BY_JOB[jobKey]?.[0] || "https://images.pexels.com/photos/4756489/pexels-photo-4756489.jpeg";
  const service2Img = SERVICES_BY_JOB[jobKey]?.[1] || "https://images.unsplash.com/photo-1769736436759-1c43688ef899?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBob21lJTIwcmVub3ZhdGlvbiUyMGludGVyaW9yfGVufDB8fHx8MTc3NzUwNzY5MXww&ixlib=rb-4.1.0&q=85";

  // ---------- Sections (rendered conditionally based on sectionOrder) ----------

  const renderHero = () => (
    <section key="hero" data-testid="section-hero" className="relative">
      <div className="grid md:grid-cols-2 min-h-[600px]">
        <div className="px-6 md:px-12 lg:px-20 py-16 md:py-24 flex flex-col justify-center bg-[#FDFBF7]">
          <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-6">— {c.tagline}</div>
          <h1 className="font-serif-instrument text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-[#111827]">
            <Editable value={c.hero_title} field="content.hero_title" />
          </h1>
          <p className="mt-8 font-manrope text-lg text-[#374151] leading-relaxed max-w-xl">
            <Editable value={c.hero_subtitle} field="content.hero_subtitle" />
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#contact" className="bg-[#1F3D2D] hover:bg-[#C84B31] text-white px-8 py-3.5 rounded-md font-manrope font-medium transition-colors">
              <Editable value={c.hero_cta} field="content.hero_cta" />
            </a>
            <a href={`tel:${site.phone}`} className="border border-[#1F3D2D] text-[#1F3D2D] hover:bg-[#1F3D2D] hover:text-white px-8 py-3.5 rounded-md font-manrope font-medium transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" /> {site.phone}
            </a>
          </div>
          <div className="mt-12 flex items-center gap-4 text-xs font-manrope text-[#6B7280]">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-[#C84B31] text-[#C84B31]" />)}
            </div>
            <span>Artisan local · Devis gratuit · Garantie décennale</span>
          </div>
        </div>
        <div className="relative min-h-[400px] md:min-h-full bg-[#E5E1D8]">
          <img src={heroImage} alt={`${site.business_name} - ${site.business_type} à ${site.city}`} loading="eager" fetchpriority="high" decoding="async" width="1200" height="800" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 bg-[#FDFBF7]/95 backdrop-blur p-5 rounded-md border border-[#E5E1D8] max-w-sm">
            <div className="font-manrope text-[10px] uppercase tracking-[0.2em] text-[#6B7280] mb-1">Notre engagement</div>
            <div className="font-serif-instrument italic text-xl text-[#111827] leading-tight">« {c.why_us?.[0] || "Travail soigné, délais respectés."} »</div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderValueProps = () => (
    <section key="value_props" data-testid="section-value-props" className="bg-[#F3F1EC] py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-3 gap-8">
        {(c.value_props || []).map((vp, i) => (
          <div key={i} className="text-center md:text-left" data-testid={`vp-${i}`}>
            <div className="w-12 h-12 bg-[#1F3D2D] text-white rounded-md flex items-center justify-center mx-auto md:mx-0 mb-5">
              <Icon name={vp.icon} className="w-5 h-5" />
            </div>
            <h3 className="font-serif-instrument text-2xl text-[#111827] mb-2">{vp.title}</h3>
            <p className="font-manrope text-[#6B7280] leading-relaxed">{vp.description}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const renderServices = () => (
    <section key="services" id="services" data-testid="section-services" className="py-20 md:py-28 bg-[#FDFBF7]">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid md:grid-cols-2 gap-8 mb-16 items-end">
          <div>
            <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-4">— Nos prestations</div>
            <h2 className="font-serif-instrument text-4xl md:text-5xl text-[#111827] leading-tight">
              Le savoir-faire <span className="italic">à votre service.</span>
            </h2>
          </div>
          <p className="font-manrope text-[#6B7280] text-lg leading-relaxed">
            Chaque chantier est unique. Nous prenons le temps de comprendre votre besoin et vous proposons une solution sur-mesure.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {(c.services || []).map((s, i) => (
            <article key={i} className="bg-[#F3F1EC] rounded-lg overflow-hidden group hover:shadow-md transition-shadow" data-testid={`service-${i}`}>
              <div className="aspect-[16/10] overflow-hidden bg-[#E5E1D8]">
                <img src={i % 2 === 0 ? service1Img : service2Img} alt={s.name} loading="lazy" decoding="async" width="800" height="500" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-7">
                <div className="font-manrope text-[10px] uppercase tracking-[0.2em] text-[#C84B31] mb-2">Service / 0{i + 1}</div>
                <h3 className="font-serif-instrument text-2xl md:text-3xl text-[#111827] mb-3">{s.name}</h3>
                <p className="font-manrope text-[#374151] leading-relaxed">{s.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );

  const renderAbout = () => (
    <section key="about" id="about" data-testid="section-about" className="py-20 md:py-28 bg-[#1F3D2D] text-[#FDFBF7]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-5">
          <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#C84B31] mb-4">— À propos</div>
          <h2 className="font-serif-instrument text-4xl md:text-5xl leading-tight">
            {c.about_title}
          </h2>
        </div>
        <div className="md:col-span-7">
          <p className="font-manrope text-lg leading-relaxed text-[#FDFBF7]/90">
            <Editable value={c.about_text} field="content.about_text" />
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {(c.why_us || []).map((w, i) => (
              <li key={i} className="font-manrope text-sm flex items-start gap-2">
                <Check className="w-4 h-4 text-[#C84B31] shrink-0 mt-0.5" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );

  const renderContact = () => (
    <section key="contact" id="contact" data-testid="section-contact" className="py-20 md:py-28 bg-[#FDFBF7]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="font-manrope text-[11px] uppercase tracking-[0.25em] text-[#1F3D2D] mb-4">— Contact</div>
          <h2 className="font-serif-instrument text-4xl md:text-5xl text-[#111827] leading-tight mb-6">
            Discutons de <span className="italic">votre projet.</span>
          </h2>
          <p className="font-manrope text-[#6B7280] mb-10">{c.contact_intro}</p>
          <ul className="space-y-4 font-manrope text-[#1F2937]">
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#F3F1EC] rounded-md flex items-center justify-center"><Phone className="w-4 h-4 text-[#1F3D2D]" /></div>
              <a href={`tel:${site.phone}`} className="hover:text-[#C84B31]">{site.phone}</a>
            </li>
            {site.email && (
              <li className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F3F1EC] rounded-md flex items-center justify-center"><Mail className="w-4 h-4 text-[#1F3D2D]" /></div>
                <a href={`mailto:${site.email}`} className="hover:text-[#C84B31]">{site.email}</a>
              </li>
            )}
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#F3F1EC] rounded-md flex items-center justify-center"><MapPin className="w-4 h-4 text-[#1F3D2D]" /></div>
              <span>{site.city} et alentours</span>
            </li>
          </ul>

          {site.show_map && (
            <div className="mt-6 rounded-lg overflow-hidden border border-[#E5E1D8] aspect-video" data-testid="google-map">
              <iframe
                title="Carte"
                src={`https://www.google.com/maps?q=${encodeURIComponent(site.map_address || `${site.business_name} ${site.city}`)}&output=embed`}
                width="100%" height="100%" style={{ border: 0 }} loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          )}
        </div>
        <div className="md:col-span-7">
          <form onSubmit={handleSubmit} className="bg-[#F3F1EC] p-8 md:p-10 rounded-lg space-y-5" data-testid="contact-form">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-[#1F3D2D] text-white rounded-full mx-auto mb-4 flex items-center justify-center"><Check className="w-6 h-6" /></div>
                <h3 className="font-serif-instrument text-2xl mb-2">Message envoyé</h3>
                <p className="font-manrope text-[#6B7280]">Nous vous recontactons rapidement.</p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-manrope text-xs text-[#6B7280] block mb-1.5">Nom complet *</label>
                    <input required value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} data-testid="lead-name" className="w-full bg-white border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
                  </div>
                  <div>
                    <label className="font-manrope text-xs text-[#6B7280] block mb-1.5">Téléphone</label>
                    <input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} data-testid="lead-phone" className="w-full bg-white border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
                  </div>
                </div>
                <div>
                  <label className="font-manrope text-xs text-[#6B7280] block mb-1.5">Email *</label>
                  <input required type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} data-testid="lead-email" className="w-full bg-white border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" />
                </div>
                <div>
                  <label className="font-manrope text-xs text-[#6B7280] block mb-1.5">Votre projet *</label>
                  <textarea required rows={5} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} data-testid="lead-message" className="w-full bg-white border border-[#E5E1D8] rounded-md px-4 py-3 font-manrope focus:outline-none focus:border-[#1F3D2D]" placeholder="Décrivez votre besoin en quelques mots..." />
                </div>
                <button type="submit" disabled={sending || !onSubmitLead} data-testid="lead-submit" className="w-full bg-[#1F3D2D] hover:bg-[#C84B31] text-white px-6 py-3.5 rounded-md font-manrope font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {sending ? "Envoi..." : <>Envoyer ma demande <Send className="w-4 h-4" /></>}
                </button>
                {!onSubmitLead && <p className="text-center text-xs text-[#6B7280] font-manrope">Aperçu — formulaire désactivé</p>}
              </>
            )}
          </form>
        </div>
      </div>
    </section>
  );

  const SECTIONS = {
    hero: renderHero,
    value_props: renderValueProps,
    services: renderServices,
    about: renderAbout,
    contact: renderContact,
  };

  // Theme overrides via injected CSS targeting the existing arbitrary Tailwind classes.
  const themeCss = `
    .artisan-site .bg-\\[\\#1F3D2D\\] { background-color: ${theme.primary_color} !important; }
    .artisan-site .hover\\:bg-\\[\\#1F3D2D\\]:hover { background-color: ${theme.primary_color} !important; }
    .artisan-site .text-\\[\\#1F3D2D\\] { color: ${theme.primary_color} !important; }
    .artisan-site .hover\\:text-\\[\\#1F3D2D\\]:hover { color: ${theme.primary_color} !important; }
    .artisan-site .border-\\[\\#1F3D2D\\] { border-color: ${theme.primary_color} !important; }
    .artisan-site .focus\\:border-\\[\\#1F3D2D\\]:focus { border-color: ${theme.primary_color} !important; }
    .artisan-site .bg-\\[\\#C84B31\\] { background-color: ${theme.accent_color} !important; }
    .artisan-site .hover\\:bg-\\[\\#C84B31\\]:hover { background-color: ${theme.accent_color} !important; }
    .artisan-site .text-\\[\\#C84B31\\] { color: ${theme.accent_color} !important; }
    .artisan-site .hover\\:text-\\[\\#C84B31\\]:hover { color: ${theme.accent_color} !important; }
    .artisan-site .fill-\\[\\#C84B31\\] { fill: ${theme.accent_color} !important; }
    .artisan-site .ring-\\[\\#C84B31\\]\\/40 { --tw-ring-color: ${theme.accent_color}66 !important; }
    .artisan-site .font-serif-instrument { font-family: '${theme.font_heading}', 'Instrument Serif', serif !important; }
    .artisan-site .font-manrope { font-family: '${theme.font_body}', 'Manrope', sans-serif !important; }
  `;

  return (
    <div className="artisan-site min-h-screen" data-testid="artisan-template">
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

      {/* Top bar (fixed, not reorderable) */}
      <header className="border-b border-[#E5E1D8] bg-[#FDFBF7] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {site.logo_url ? (
              <img src={resolveImg(site.logo_url)} alt={`${site.business_name} logo`} className="w-11 h-11 object-contain bg-white rounded-md border border-[#E5E1D8]" />
            ) : (
              <div className="w-9 h-9 bg-[#1F3D2D] flex items-center justify-center">
                <span className="text-[#FDFBF7] font-serif-instrument italic text-lg">{site.business_name?.charAt(0) || "A"}</span>
              </div>
            )}
            <div>
              <div className="font-serif-instrument italic text-lg leading-none">{site.business_name}</div>
              <div className="font-manrope text-[10px] uppercase tracking-[0.2em] text-[#6B7280] mt-0.5">{site.business_type} · {site.city}</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-manrope text-sm text-[#1F2937]">
            <a href="#services" className="hover:text-[#C84B31] transition-colors">Services</a>
            <a href="#about" className="hover:text-[#C84B31] transition-colors">À propos</a>
            <a href="#contact" className="hover:text-[#C84B31] transition-colors">Contact</a>
            <a href={`tel:${site.phone}`} className="bg-[#1F3D2D] text-white px-4 py-2 rounded-md hover:bg-[#C84B31] transition-colors flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> {site.phone}
            </a>
          </nav>
          <a href={`tel:${site.phone}`} className="md:hidden bg-[#1F3D2D] text-white px-3 py-2 rounded-md font-manrope text-sm flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" /> Appeler
          </a>
        </div>
      </header>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FDFBF7] border-t border-[#E5E1D8] p-3 z-40 flex gap-2">
        <a href={`tel:${site.phone}`} className="flex-1 bg-[#1F3D2D] text-white text-center py-3 rounded-md font-manrope font-medium">Appeler</a>
        <a href="#contact" className="flex-1 border border-[#1F3D2D] text-[#1F3D2D] text-center py-3 rounded-md font-manrope font-medium">Devis</a>
      </div>

      {sectionOrder.map((key) => (SECTIONS[key] ? SECTIONS[key]() : null))}

      {/* Footer (fixed, not reorderable) */}
      <footer className="bg-[#111827] text-[#FDFBF7] py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-3 gap-8">
          <div>
            <div className="font-serif-instrument italic text-2xl mb-2">{site.business_name}</div>
            <div className="font-manrope text-sm text-[#9CA3AF]">{c.tagline}</div>
          </div>
          <div className="font-manrope text-sm text-[#9CA3AF]">
            <div className="text-white mb-2">Contact</div>
            <div>{site.phone}</div>
            {site.email && <div>{site.email}</div>}
            <div>{site.city}</div>
          </div>
          <div className="font-manrope text-sm text-[#9CA3AF] md:text-right">
            <div className="text-white mb-2">{site.business_type} à {site.city}</div>
            <div>© 2026 {site.business_name}</div>
            <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#6B7280]">site généré avec artisanweb</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
