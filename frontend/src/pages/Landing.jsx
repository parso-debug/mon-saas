import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as Lucide from "lucide-react";
import { ArrowRight, Sparkles, Wand2, Globe, MessageSquare, Check, Zap, Shield, ShoppingBag, CreditCard, Truck, Store, Package } from "lucide-react";
import { fetchAppSettings } from "@/lib/settings";
import { resolveImg } from "@/lib/api";

const Icon = ({ name, className }) => {
  const pascal = (name || "").split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const Cmp = Lucide[pascal] || Lucide.Sparkles;
  return <Cmp className={className} />;
};

const Nav = ({ s }) => (
  <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-2 backdrop-blur-xl bg-white/70 border border-black/10 rounded-full flex items-center gap-2 shadow-sm" data-testid="landing-nav">
    <Link to="/" className="flex items-center gap-2 px-3" data-testid="logo-link">
      <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
        <span className="text-[#F95A2C] font-mono-grotesk font-bold text-sm">{s.brand?.logo_letter || "A"}</span>
      </div>
      <span className="font-display font-bold text-sm tracking-tight">{s.brand?.name || "artisanweb"}</span>
    </Link>
    <div className="hidden md:flex items-center gap-1 px-2">
      {(s.navbar?.items || []).map((it, i) => (
        <a key={i} href={it.href} className="text-xs font-medium px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors">{it.label}</a>
      ))}
      <a href="#shop" className="text-xs font-medium px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors text-[#1F3D2D]" data-testid="nav-shop">Boutique</a>
    </div>
    <div className="flex items-center gap-1.5 ml-1">
      <Link to="/login"><Button variant="ghost" size="sm" className="text-xs rounded-full" data-testid="nav-login">{s.navbar?.cta_login || "Se connecter"}</Button></Link>
      <Link to="/signup"><Button size="sm" className="text-xs rounded-full bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="nav-signup">{s.navbar?.cta_signup || "Commencer"}</Button></Link>
    </div>
  </nav>
);

export default function Landing() {
  const [s, setS] = useState(null);
  useEffect(() => {
    fetchAppSettings().then(setS).catch(() => setS({}));
  }, []);

  if (!s) return <div className="min-h-screen bg-[#FAFAFA]" />;

  const hero = s.hero || {};
  const features = s.features || {};
  const featMain = features.main || {};
  const pricing = s.pricing || {};
  const free = pricing.free || {};
  const pro = pricing.pro || {};
  const testimonial = s.testimonial || {};
  const how = s.how_it_works || {};
  const footerCta = s.footer_cta || {};
  const footer = s.footer || {};
  const trades = s.marquee_trades || [];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] overflow-hidden" data-testid="landing-page">
      <Nav s={s} />

      {/* HERO */}
      <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            {hero.badge && (
              <div className="inline-flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] border border-black/10 px-3 py-1.5 rounded-full mb-8" data-testid="hero-badge">
                <span className="w-1.5 h-1.5 bg-[#F95A2C] rounded-full animate-pulse" />
                {hero.badge}
              </div>
            )}
            <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-[88px] leading-[0.95] tracking-tight">
              {hero.title_line_1}<br />
              {hero.title_line_2}<br />
              <span className="italic font-serif-instrument font-normal text-[#F95A2C]">{hero.title_italic}</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-[#52525B] max-w-xl leading-relaxed">{hero.subtitle}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-[#09090B] hover:bg-[#F95A2C] text-white rounded-none h-14 px-8 text-base font-medium hover:-translate-y-0.5 transition-transform" data-testid="hero-cta-primary">
                  {hero.cta_primary} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="ghost" className="rounded-none h-14 px-8 text-base hover:bg-black/5" data-testid="hero-cta-secondary">{hero.cta_secondary}</Button>
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs font-mono-grotesk uppercase tracking-wider text-[#71717A] flex-wrap">
              {(hero.trust_chips || []).map((c, i) => (
                <span key={i} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> {c}</span>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 relative">
            <div className="relative bg-white border border-black/10 p-6">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// preview.live</div>
              <div className="aspect-[3/4] bg-[#FAFAFA] border border-black/10 relative overflow-hidden">
                {hero.preview_img && <img src={resolveImg(hero.preview_img)} alt="Aperçu site artisan généré" className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="font-serif-instrument italic text-2xl leading-tight">{hero.preview_business_line_1}<br />{hero.preview_business_line_2}</div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-wider mt-1 opacity-80">{hero.preview_meta}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {(hero.preview_stats || []).map((st, i) => (
                  <div key={i} className="border border-black/10 p-2 text-center">
                    <div className="font-display font-bold text-lg">{st.value}</div>
                    <div className="font-mono-grotesk text-[8px] uppercase tracking-wider text-[#71717A]">{st.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      {trades.length > 0 && (
        <section className="border-y border-black/10 bg-[#09090B] text-white py-6 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...trades, ...trades, ...trades].map((t, i) => (
              <span key={i} className="font-display font-bold text-3xl md:text-5xl uppercase mx-8 tracking-tight">
                {t} <span className="text-[#F95A2C]">●</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-4">
            {how.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// {how.kicker}</div>}
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              {how.title_line_1} <span className="italic font-serif-instrument font-normal">{how.title_italic}</span>
            </h2>
          </div>
          <div className="md:col-span-7 md:col-start-6 flex items-end">
            <p className="text-lg text-[#52525B]">{how.subtitle}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-black/10 border border-black/10">
          {(how.steps || []).map((step) => (
            <div key={step.n} className="bg-white p-8 md:p-10" data-testid={`step-${step.n}`}>
              <div className="flex items-start justify-between mb-12">
                <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">step / {step.n}</div>
                <div className="w-10 h-10 bg-[#09090B] text-[#F95A2C] flex items-center justify-center"><Icon name={step.icon} className="w-5 h-5" /></div>
              </div>
              <h3 className="font-display font-bold text-2xl tracking-tight mb-3">{step.title}</h3>
              <p className="text-[#52525B] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-6">
            {features.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// {features.kicker}</div>}
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              {features.title_line_1}<br />
              <span className="italic font-serif-instrument font-normal">{features.title_italic}</span>
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-6 gap-4">
          <div className="md:col-span-4 md:row-span-2 border border-black/10 bg-[#09090B] text-white p-10 relative overflow-hidden min-h-[360px]">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #F95A2C 0%, transparent 50%)' }} />
            <div className="relative">
              <Icon name={featMain.icon || "sparkles"} className="w-6 h-6 text-[#F95A2C] mb-12" />
              {featMain.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">// {featMain.kicker}</div>}
              <h3 className="font-display font-bold text-3xl md:text-4xl tracking-tight leading-tight mb-4">
                {featMain.title_line_1}<br />{featMain.title_line_2}
              </h3>
              <p className="text-[#A1A1AA] text-base md:text-lg max-w-md leading-relaxed">{featMain.description}</p>
            </div>
          </div>
          {(features.items || []).map((it, i) => {
            const isAccent = it.color === "accent";
            const cls = isAccent ? "bg-[#F95A2C] text-white" : "bg-white";
            const span = i === 0 || i === 1 ? "md:col-span-2" : "md:col-span-3";
            return (
              <div key={i} className={`${span} border border-black/10 ${cls} p-8`} data-testid={`feature-${i}`}>
                <Icon name={it.icon || "zap"} className={`w-5 h-5 mb-8 ${isAccent ? "" : "text-[#F95A2C]"}`} />
                <h4 className="font-display font-bold text-xl tracking-tight mb-2">{it.title}</h4>
                <p className={`text-sm ${isAccent ? "text-white/85" : "text-[#52525B]"}`}>{it.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        {(() => {
          const list = (s.testimonials && s.testimonials.length > 0) ? s.testimonials : (testimonial && testimonial.author ? [testimonial] : []);
          const ts = s.testimonials_section || {};
          const showCount = Math.max(1, Math.min(ts.show_count || 1, list.length));
          const featured = list.slice(0, showCount);
          if (featured.length === 0) return null;
          return (
            <>
              {(ts.title_line_1 || ts.title_italic) && (
                <div className="grid md:grid-cols-12 gap-8 mb-12 items-end">
                  <div className="md:col-span-7">
                    {ts.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// {ts.kicker}</div>}
                    <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
                      {ts.title_line_1} <span className="italic font-serif-instrument font-normal">{ts.title_italic}</span>
                    </h2>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {featured.map((t, i) => (
                  <div key={i} className="border border-black/10 bg-white p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center" data-testid={`testimonial-card-${i}`}>
                    <div className="md:col-span-3">
                      {t.avatar_url && <img src={resolveImg(t.avatar_url)} alt={t.author} className="w-full aspect-square object-cover grayscale" />}
                    </div>
                    <div className="md:col-span-9">
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        {t.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">// {t.kicker}</div>}
                        {t.rating && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <svg key={j} className={`w-3.5 h-3.5 ${j < t.rating ? "fill-[#F95A2C] text-[#F95A2C]" : "fill-black/10 text-black/10"}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            ))}
                          </div>
                        )}
                        {t.date && <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">{t.date}</span>}
                      </div>
                      <p className="font-serif-instrument text-3xl md:text-4xl leading-tight italic mb-6">« {t.quote} »</p>
                      <div className="flex items-center gap-3">
                        <div className="font-display font-bold">{t.author}</div>
                        <div className="w-1 h-1 bg-black rounded-full" />
                        <div className="text-sm text-[#71717A]">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {list.length > showCount && (
                <div className="mt-8 flex justify-center">
                  <Link to="/avis">
                    <Button size="lg" variant="outline" className="rounded-none h-14 px-8 border-black hover:bg-black hover:text-white" data-testid="see-all-reviews-cta">
                      {ts.cta_label || "Voir tous les avis"} ({list.length}) <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* E-COMMERCE CTA — Shopify-light boutique */}
      <section id="shop" className="relative py-24 md:py-32 px-6 md:px-12 bg-[#1F3D2D] text-[#FDFBF7] overflow-hidden" data-testid="shop-cta-section">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0.5px, transparent 0.5px), radial-gradient(circle at 75% 70%, rgba(255,255,255,0.3) 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#C84B31] border border-[#C84B31]/30 px-3 py-1.5 rounded-full mb-8">
              <ShoppingBag className="w-3 h-3" /> Nouveau · boutique en ligne
            </div>
            <h2 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[0.95]">
              Commerçant ?<br />
              <span className="font-serif-instrument italic font-normal text-[#C84B31]">Votre boutique</span><br />
              ouverte 24/7.
            </h2>
            <p className="mt-8 font-manrope text-lg md:text-xl text-[#FDFBF7]/80 max-w-xl leading-relaxed">
              Catalogue, variantes (taille/couleur), stock, panier, paiement Stripe, livraison configurable, gestion des commandes. <b className="text-white">Une vraie boutique e-commerce</b> — générée automatiquement et prête à vendre en quelques minutes.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-6 text-sm font-manrope">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-[#C84B31]/15 text-[#C84B31] flex items-center justify-center shrink-0"><Package className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-white">Catalogue illimité</div>
                  <div className="text-[#FDFBF7]/60 text-xs mt-1">Photos, variantes, stock, catégories.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-[#C84B31]/15 text-[#C84B31] flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-white">Paiement Stripe</div>
                  <div className="text-[#FDFBF7]/60 text-xs mt-1">CB, Apple Pay, Google Pay. TVA incluse.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-[#C84B31]/15 text-[#C84B31] flex items-center justify-center shrink-0"><Truck className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-white">Livraison sur-mesure</div>
                  <div className="text-[#FDFBF7]/60 text-xs mt-1">Retrait boutique + tarifs fixes.</div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/signup?intent=shop">
                <Button size="lg" className="bg-[#C84B31] hover:bg-[#FDFBF7] hover:text-[#1F3D2D] text-white rounded-none h-14 px-8 text-base font-medium transition-colors" data-testid="shop-cta-primary">
                  Créer votre boutique en ligne <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/shop/la-boutique-de-demo" target="_blank">
                <Button size="lg" variant="outline" className="rounded-none h-14 px-8 text-base bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white hover:border-white" data-testid="shop-cta-demo">
                  Voir la démo <Store className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative">
              {/* Mock product grid preview */}
              <div className="bg-[#FDFBF7] rounded-md p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-serif-instrument italic text-xl text-[#111827]">Ma Boutique</div>
                    <div className="font-manrope text-[9px] uppercase tracking-[0.2em] text-[#6B7280]">boutique · paris</div>
                  </div>
                  <div className="bg-[#1F3D2D] text-white text-xs font-manrope px-3 py-1.5 rounded-md flex items-center gap-1.5"><ShoppingBag className="w-3 h-3" /> 2</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { n: "Bougie Forêt", p: "18 €", bg: "linear-gradient(135deg,#F3F1EC,#D4C9B8)" },
                    { n: "Mug Artisanal", p: "22 €", bg: "linear-gradient(135deg,#E5E1D8,#C0B8A6)" },
                    { n: "T-shirt Bio", p: "34,90 €", bg: "linear-gradient(135deg,#1F3D2D,#2F5D42)" },
                    { n: "Carnet A5", p: "12 €", bg: "linear-gradient(135deg,#C84B31,#E86E4F)" },
                  ].map((it, i) => (
                    <div key={i} className="border border-[#E5E1D8] rounded">
                      <div className="aspect-square rounded-t" style={{ background: it.bg }} />
                      <div className="p-2">
                        <div className="font-manrope text-xs font-medium text-[#111827] truncate">{it.n}</div>
                        <div className="font-manrope text-xs text-[#1F3D2D] font-semibold mt-0.5">{it.p}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full bg-[#1F3D2D] text-white font-manrope text-sm py-2.5 rounded-md flex items-center justify-center gap-2" disabled>
                  Passer au paiement <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Floating order card */}
              <div className="absolute -bottom-6 -left-4 bg-[#FDFBF7] border border-[#E5E1D8] rounded-md p-4 shadow-xl hidden md:flex items-center gap-3 max-w-[260px]">
                <div className="w-10 h-10 rounded-full bg-[#1F3D2D] text-white flex items-center justify-center shrink-0"><Check className="w-5 h-5" /></div>
                <div>
                  <div className="font-manrope text-xs font-semibold text-[#111827]">Commande #A3F2</div>
                  <div className="font-manrope text-[11px] text-[#6B7280]">89,90 € · Camille B. · payée</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-6">
            {pricing.kicker && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// {pricing.kicker}</div>}
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              {pricing.title_line_1}<br /><span className="italic font-serif-instrument font-normal">{pricing.title_italic}</span>
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-black/10 bg-white p-10">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">{free.label}</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">{free.price}<span className="text-base font-normal text-[#71717A]"> {free.period}</span></div>
            <p className="text-sm text-[#52525B] mb-8">{free.tagline}</p>
            <ul className="space-y-3 mb-10 text-sm">
              {(free.features || []).map((x, i) => <li key={i} className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> {x}</li>)}
            </ul>
            <Link to="/signup">
              <Button variant="outline" className="w-full rounded-none h-12 border-black hover:bg-black hover:text-white" data-testid="pricing-free-cta">{free.cta}</Button>
            </Link>
          </div>
          <div className="border border-black bg-[#09090B] text-white p-10 relative">
            {pro.badge && <div className="absolute -top-3 left-10 bg-[#F95A2C] text-white text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-3 py-1">{pro.badge}</div>}
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-2">{pro.label}</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">{pro.price}<span className="text-base font-normal text-[#A1A1AA]"> {pro.period}</span></div>
            <p className="text-sm text-[#A1A1AA] mb-8">{pro.tagline}</p>
            <ul className="space-y-3 mb-10 text-sm">
              {(pro.features || []).map((x, i) => <li key={i} className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> {x}</li>)}
            </ul>
            <Link to="/signup">
              <Button className="w-full rounded-none h-12 bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white" data-testid="pricing-pro-cta">{pro.cta}</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="py-24 md:py-32 px-6 md:px-12 bg-[#09090B] text-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <h2 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-[0.95]">
              {footerCta.title_line_1}<br /><span className="text-[#F95A2C] italic font-serif-instrument font-normal">{footerCta.title_italic}</span>
            </h2>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <Link to="/signup">
              <Button size="lg" className="bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white rounded-none h-14 px-8 text-base" data-testid="footer-cta">
                {footerCta.button_label} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-4 text-xs font-mono-grotesk uppercase tracking-[0.2em] text-[#71717A]">
          <div>{footer.copyright}</div>
          <div className="flex gap-6">
            <span>{footer.version}</span>
            <span>{footer.status}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
