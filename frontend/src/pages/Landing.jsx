import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Wand2, Globe, MessageSquare, Check, Zap, Shield } from "lucide-react";

const Nav = () => (
  <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-2 backdrop-blur-xl bg-white/70 border border-black/10 rounded-full flex items-center gap-2 shadow-sm" data-testid="landing-nav">
    <Link to="/" className="flex items-center gap-2 px-3" data-testid="logo-link">
      <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
        <span className="text-[#F95A2C] font-mono-grotesk font-bold text-sm">A</span>
      </div>
      <span className="font-display font-bold text-sm tracking-tight">artisanweb</span>
    </Link>
    <div className="hidden md:flex items-center gap-1 px-2">
      <a href="#how" className="text-xs font-medium px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors">Comment ça marche</a>
      <a href="#features" className="text-xs font-medium px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors">Fonctionnalités</a>
      <a href="#pricing" className="text-xs font-medium px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors">Tarifs</a>
    </div>
    <div className="flex items-center gap-1.5 ml-1">
      <Link to="/login"><Button variant="ghost" size="sm" className="text-xs rounded-full" data-testid="nav-login">Se connecter</Button></Link>
      <Link to="/signup"><Button size="sm" className="text-xs rounded-full bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="nav-signup">Commencer</Button></Link>
    </div>
  </nav>
);

const trades = ["plombier", "électricien", "maçon", "peintre", "menuisier", "chauffagiste", "couvreur", "carreleur", "paysagiste", "serrurier", "plâtrier"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] overflow-hidden" data-testid="landing-page">
      <Nav />

      {/* HERO */}
      <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] border border-black/10 px-3 py-1.5 rounded-full mb-8" data-testid="hero-badge">
              <span className="w-1.5 h-1.5 bg-[#F95A2C] rounded-full animate-pulse" />
              Nouveau · Génération IA en moins de 60 secondes
            </div>
            <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-[88px] leading-[0.95] tracking-tight">
              Le site internet<br />
              de votre métier,<br />
              <span className="italic font-serif-instrument font-normal text-[#F95A2C]">généré en 5 minutes.</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-[#52525B] max-w-xl leading-relaxed">
              Décrivez votre activité d'artisan. Notre IA rédige le texte, optimise le SEO local et conçoit un site moderne — prêt à publier.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-[#09090B] hover:bg-[#F95A2C] text-white rounded-none h-14 px-8 text-base font-medium hover:-translate-y-0.5 transition-transform" data-testid="hero-cta-primary">
                  Créer mon site gratuitement
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="ghost" className="rounded-none h-14 px-8 text-base hover:bg-black/5" data-testid="hero-cta-secondary">
                  Voir comment ça marche
                </Button>
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs font-mono-grotesk uppercase tracking-wider text-[#71717A]">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> Sans carte bancaire</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> SEO local inclus</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#F95A2C]" /> 100% personnalisable</span>
            </div>
          </div>

          <div className="md:col-span-4 relative">
            <div className="relative bg-white border border-black/10 p-6">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// preview.live</div>
              <div className="aspect-[3/4] bg-[#FAFAFA] border border-black/10 relative overflow-hidden">
                <img src="https://images.pexels.com/photos/4756489/pexels-photo-4756489.jpeg" alt="Aperçu site artisan généré" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="font-serif-instrument italic text-2xl leading-tight">Maçonnerie<br/>Dupont & Fils</div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-wider mt-1 opacity-80">Toulouse · Depuis 1998</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="border border-black/10 p-2 text-center"><div className="font-display font-bold text-lg">52s</div><div className="font-mono-grotesk text-[8px] uppercase tracking-wider text-[#71717A]">Temps gen.</div></div>
                <div className="border border-black/10 p-2 text-center"><div className="font-display font-bold text-lg">4</div><div className="font-mono-grotesk text-[8px] uppercase tracking-wider text-[#71717A]">Pages</div></div>
                <div className="border border-black/10 p-2 text-center"><div className="font-display font-bold text-lg">96</div><div className="font-mono-grotesk text-[8px] uppercase tracking-wider text-[#71717A]">SEO score</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-black/10 bg-[#09090B] text-white py-6 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...trades, ...trades, ...trades].map((t, i) => (
            <span key={i} className="font-display font-bold text-3xl md:text-5xl uppercase mx-8 tracking-tight">
              {t} <span className="text-[#F95A2C]">●</span>
            </span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-4">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// 03 étapes</div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              De l'idée au site <span className="italic font-serif-instrument font-normal">en ligne.</span>
            </h2>
          </div>
          <div className="md:col-span-7 md:col-start-6 flex items-end">
            <p className="text-lg text-[#52525B]">
              Pas de code. Pas de template à choisir. Pas d'agence. Vous remplissez un formulaire, notre IA fait le reste.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-black/10 border border-black/10">
          {[
            { n: "01", t: "Décrivez votre activité", d: "Nom, métier, services, ville, téléphone. 8 champs simples, c'est tout.", icon: <MessageSquare className="w-5 h-5" /> },
            { n: "02", t: "L'IA crée tout pour vous", d: "Textes SEO, structure, images d'ambiance, arguments commerciaux. En moins d'une minute.", icon: <Wand2 className="w-5 h-5" /> },
            { n: "03", t: "Publiez & captez des clients", d: "URL partageable, formulaire de contact intégré, leads centralisés dans votre tableau de bord.", icon: <Globe className="w-5 h-5" /> },
          ].map((s) => (
            <div key={s.n} className="bg-white p-8 md:p-10" data-testid={`step-${s.n}`}>
              <div className="flex items-start justify-between mb-12">
                <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">step / {s.n}</div>
                <div className="w-10 h-10 bg-[#09090B] text-[#F95A2C] flex items-center justify-center">{s.icon}</div>
              </div>
              <h3 className="font-display font-bold text-2xl tracking-tight mb-3">{s.t}</h3>
              <p className="text-[#52525B] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-6">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// stack complète</div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              Tout ce qu'il vous faut.<br/>
              <span className="italic font-serif-instrument font-normal">Rien de plus.</span>
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-6 gap-4">
          <div className="md:col-span-4 md:row-span-2 border border-black/10 bg-[#09090B] text-white p-10 relative overflow-hidden min-h-[360px]">
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'radial-gradient(circle at 20% 80%, #F95A2C 0%, transparent 50%)'
            }} />
            <div className="relative">
              <Sparkles className="w-6 h-6 text-[#F95A2C] mb-12" />
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">// 01.feature</div>
              <h3 className="font-display font-bold text-3xl md:text-4xl tracking-tight leading-tight mb-4">
                Génération IA spécialisée<br/>artisans français.
              </h3>
              <p className="text-[#A1A1AA] text-base md:text-lg max-w-md leading-relaxed">
                Claude Sonnet 4.5 entraîné sur des milliers de sites pro français. Textes naturels, SEO local, ton chaleureux et direct. Pas de bullshit corporate.
              </p>
            </div>
          </div>
          <div className="md:col-span-2 border border-black/10 bg-white p-8" data-testid="feature-seo">
            <Zap className="w-5 h-5 text-[#F95A2C] mb-8" />
            <h4 className="font-display font-bold text-xl tracking-tight mb-2">SEO local intégré</h4>
            <p className="text-sm text-[#52525B]">Mots-clés ville+métier, balises optimisées, structure rich-snippets ready.</p>
          </div>
          <div className="md:col-span-2 border border-black/10 bg-[#F95A2C] text-white p-8">
            <MessageSquare className="w-5 h-5 mb-8" />
            <h4 className="font-display font-bold text-xl tracking-tight mb-2">CRM léger inclus</h4>
            <p className="text-sm text-white/85">Formulaire de contact, leads stockés et notifiés. Zéro outil externe.</p>
          </div>
          <div className="md:col-span-3 border border-black/10 bg-white p-8">
            <Shield className="w-5 h-5 text-[#F95A2C] mb-8" />
            <h4 className="font-display font-bold text-xl tracking-tight mb-2">Hébergement & domaine</h4>
            <p className="text-sm text-[#52525B]">URL partageable instantanément. Connectez votre nom de domaine en 2 clics (à venir).</p>
          </div>
          <div className="md:col-span-3 border border-black/10 bg-white p-8">
            <Globe className="w-5 h-5 text-[#F95A2C] mb-8" />
            <h4 className="font-display font-bold text-xl tracking-tight mb-2">Mobile-first</h4>
            <p className="text-sm text-[#52525B]">90% de vos visiteurs viennent du mobile. Tous les sites générés sont optimisés en priorité mobile.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="border border-black/10 bg-white p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-3">
            <img src="https://images.pexels.com/photos/4981775/pexels-photo-4981775.jpeg" alt="Témoignage Marc D., maçon" className="w-full aspect-square object-cover grayscale" />
          </div>
          <div className="md:col-span-9">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-4">// testimonial / 01</div>
            <p className="font-serif-instrument text-3xl md:text-4xl leading-tight italic mb-6">
              « En 5 minutes j'avais un site plus pro que ce que m'avait fait une agence à 2 400€. Trois devis demandés la première semaine. »
            </p>
            <div className="flex items-center gap-3">
              <div className="font-display font-bold">Marc D.</div>
              <div className="w-1 h-1 bg-black rounded-full" />
              <div className="text-sm text-[#71717A]">Maçon · Toulouse</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-6">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// pricing</div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              Simple.<br/><span className="italic font-serif-instrument font-normal">Sans surprise.</span>
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-black/10 bg-white p-10">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">free</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">0€<span className="text-base font-normal text-[#71717A]"> /mois</span></div>
            <p className="text-sm text-[#52525B] mb-8">Pour tester en 5 min.</p>
            <ul className="space-y-3 mb-10 text-sm">
              {["1 site généré", "Sous-domaine artisanweb.app", "SEO local de base", "Capture de leads"].map(x => (
                <li key={x} className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> {x}</li>
              ))}
            </ul>
            <Link to="/signup">
              <Button variant="outline" className="w-full rounded-none h-12 border-black hover:bg-black hover:text-white" data-testid="pricing-free-cta">Démarrer gratuitement</Button>
            </Link>
          </div>
          <div className="border border-black bg-[#09090B] text-white p-10 relative">
            <div className="absolute -top-3 left-10 bg-[#F95A2C] text-white text-[10px] font-mono-grotesk uppercase tracking-[0.2em] px-3 py-1">recommandé</div>
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-2">pro</div>
            <div className="font-display font-bold text-5xl tracking-tight mb-1">19€<span className="text-base font-normal text-[#A1A1AA]"> /mois</span></div>
            <p className="text-sm text-[#A1A1AA] mb-8">Pour les artisans sérieux.</p>
            <ul className="space-y-3 mb-10 text-sm">
              {["Sites illimités", "Domaine personnalisé", "SEO boost & images IA", "Notifications email leads", "Support prioritaire"].map(x => (
                <li key={x} className="flex items-center gap-2"><Check className="w-4 h-4 text-[#F95A2C]" /> {x}</li>
              ))}
            </ul>
            <Link to="/signup">
              <Button className="w-full rounded-none h-12 bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white" data-testid="pricing-pro-cta">Passer au Pro</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="py-24 md:py-32 px-6 md:px-12 bg-[#09090B] text-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <h2 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-[0.95]">
              Votre site,<br/><span className="text-[#F95A2C] italic font-serif-instrument font-normal">avant le café.</span>
            </h2>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <Link to="/signup">
              <Button size="lg" className="bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white rounded-none h-14 px-8 text-base" data-testid="footer-cta">
                Commencer gratuitement
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-4 text-xs font-mono-grotesk uppercase tracking-[0.2em] text-[#71717A]">
          <div>© 2026 artisanweb · made in france</div>
          <div className="flex gap-6">
            <span>v 1.0.0</span>
            <span>status · operational</span>
          </div>
        </div>
      </section>
    </div>
  );
}
