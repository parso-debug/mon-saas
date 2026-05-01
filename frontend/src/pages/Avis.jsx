import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Star, MessageSquarePlus } from "lucide-react";
import { fetchAppSettings } from "@/lib/settings";
import { resolveImg } from "@/lib/api";
import ReviewSubmitDialog from "@/components/ReviewSubmitDialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Stars = ({ rating = 5 }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} étoiles sur 5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-[#F95A2C] text-[#F95A2C]" : "fill-black/10 text-black/10"}`} />
    ))}
  </div>
);

const parseFRDate = (s) => {
  if (!s) return 0;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
};

export default function Avis() {
  const [s, setS] = useState(null);
  const [userReviews, setUserReviews] = useState([]);
  const [filter, setFilter] = useState("all"); // all | 5 | 4 | recent
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAppSettings().then(setS).catch(() => setS({}));
    axios.get(`${API}/public/reviews`).then((r) => setUserReviews(r.data || [])).catch(() => setUserReviews([]));
    document.title = "Avis clients · artisanweb";
  }, []);

  const list = useMemo(() => {
    if (!s) return [];
    const curated = (s.testimonials && s.testimonials.length > 0)
      ? s.testimonials
      : (s.testimonial && s.testimonial.author ? [s.testimonial] : []);
    const arr = [...curated, ...userReviews];
    let out = arr;
    if (filter === "5") out = out.filter((t) => (t.rating || 5) === 5);
    if (filter === "4") out = out.filter((t) => (t.rating || 5) >= 4);
    out = [...out].sort((a, b) => parseFRDate(b.date) - parseFRDate(a.date));
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((t) =>
        (t.author || "").toLowerCase().includes(q) ||
        (t.role || "").toLowerCase().includes(q) ||
        (t.quote || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [s, userReviews, filter, search]);

  const stats = useMemo(() => {
    const arr = [...(s?.testimonials || []), ...userReviews];
    const total = arr.length;
    if (total === 0) return { total: 0, avg: 0 };
    const sum = arr.reduce((a, t) => a + (t.rating || 5), 0);
    return { total, avg: (sum / total) };
  }, [s, userReviews]);

  if (!s) return <div className="min-h-screen bg-[#FAFAFA]" />;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#09090B]" data-testid="avis-page">
      {/* Top nav */}
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium hover:text-[#F95A2C]" data-testid="avis-back">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-display font-bold tracking-tight">{s.brand?.name || "artisanweb"}</span>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="avis-signup-cta">
              Créer mon site
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto pt-16 md:pt-24 pb-12">
        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// avis vérifiés</div>
            <h1 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-[0.95]">
              Ce qu'en disent<br />
              <span className="italic font-serif-instrument font-normal text-[#F95A2C]">nos artisans.</span>
            </h1>
            <p className="mt-6 text-lg text-[#52525B] max-w-2xl">
              Plombiers, électriciens, maçons, paysagistes, couvreurs... Plus de {stats.total > 0 ? Math.max(stats.total * 240, 1200) : 1200} artisans utilisent artisanweb pour générer leur site et capter de nouveaux clients.
            </p>
          </div>
          <div className="md:col-span-4 grid grid-cols-2 gap-3">
            <div className="border border-black/10 bg-white p-5">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-1">// note moyenne</div>
              <div className="font-display font-bold text-4xl">{stats.avg.toFixed(1)}<span className="text-base text-[#71717A]">/5</span></div>
              <Stars rating={Math.round(stats.avg)} />
            </div>
            <div className="border border-black bg-[#09090B] text-white p-5">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-1">// avis</div>
              <div className="font-display font-bold text-4xl">{stats.total}</div>
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA]">artisans</div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto pb-8">
        <div className="border-y border-black/10 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: "all", label: "Tous" },
              { id: "5", label: "★★★★★" },
              { id: "4", label: "4 ★ et +" },
              { id: "recent", label: "Plus récents" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                data-testid={`filter-${f.id}`}
                className={`px-4 py-2 text-xs font-mono-grotesk uppercase tracking-[0.15em] border transition-colors ${filter === f.id ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white border-black/20 hover:border-[#F95A2C]"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-1 md:flex-initial">
            <input
              type="search"
              placeholder="Rechercher par métier, ville, nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-black/20 px-4 py-2 text-sm w-full md:w-72 focus:outline-none focus:border-[#F95A2C]"
              data-testid="avis-search"
            />
            <ReviewSubmitDialog
              trigger={
                <Button size="sm" className="rounded-none h-10 px-4 bg-[#F95A2C] hover:bg-[#09090B] text-white whitespace-nowrap" data-testid="leave-review-cta-top">
                  <MessageSquarePlus className="w-3.5 h-3.5 mr-2" /> Laisser mon avis
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* Reviews grid */}
      <section className="px-6 md:px-12 max-w-7xl mx-auto pb-24">
        {list.length === 0 ? (
          <div className="border border-black/10 bg-white p-16 text-center">
            <p className="font-display font-bold text-xl mb-2">Aucun avis ne correspond.</p>
            <p className="text-sm text-[#52525B]">Essayez un autre filtre ou recherche.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {list.map((t, i) => (
              <article key={i} className="border border-black/10 bg-white p-8 flex flex-col" data-testid={`avis-card-${i}`}>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    {t.avatar_url ? (
                      <img src={resolveImg(t.avatar_url)} alt={t.author} className="w-12 h-12 object-cover grayscale" />
                    ) : (
                      <div className="w-12 h-12 bg-[#FAFAFA] border border-black/10 flex items-center justify-center font-display font-bold text-lg">{(t.author || "?")[0]}</div>
                    )}
                    <div>
                      <div className="font-display font-bold">{t.author}</div>
                      <div className="text-xs text-[#71717A]">{t.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Stars rating={t.rating || 5} />
                    {t.date && <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-1">{t.date}</div>}
                  </div>
                </div>
                <p className="font-serif-instrument italic text-xl md:text-2xl leading-snug text-[#09090B] flex-1">« {t.quote} »</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* CTA bottom */}
      <section className="bg-[#09090B] text-white px-6 md:px-12 py-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-8">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">// rejoignez-les</div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              Votre avis sera<br /><span className="italic font-serif-instrument font-normal text-[#F95A2C]">le prochain.</span>
            </h2>
          </div>
          <div className="md:col-span-4 flex flex-col gap-3 md:items-end">
            <Link to="/signup" className="block">
              <Button size="lg" className="bg-[#F95A2C] hover:bg-white hover:text-[#09090B] text-white rounded-none h-14 px-8 text-base w-full" data-testid="avis-bottom-cta">
                Créer mon site gratuitement <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <ReviewSubmitDialog
              trigger={
                <Button size="lg" variant="outline" className="rounded-none h-14 px-8 border-white text-white hover:bg-white hover:text-[#09090B] w-full" data-testid="avis-bottom-leave-cta">
                  <MessageSquarePlus className="w-4 h-4 mr-2" /> Déjà client ? Laissez votre avis
                </Button>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
