import { useEffect, useState } from "react";
import api from "@/lib/api";
import { resolveImg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, X, Trash2, Star, Mail } from "lucide-react";

const Stars = ({ rating = 5 }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-[#F95A2C] text-[#F95A2C]" : "fill-black/10 text-black/10"}`} />
    ))}
  </div>
);

export default function ReviewsModeration() {
  const [filter, setFilter] = useState("pending");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/reviews", { params: { status_filter: filter } });
      setReviews(r.data);
    } catch (e) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const act = async (id, action) => {
    setActing(id);
    try {
      if (action === "delete") {
        if (!window.confirm("Supprimer définitivement cet avis ?")) { setActing(null); return; }
        await api.delete(`/admin/reviews/${id}`);
        toast.success("Supprimé");
      } else {
        await api.post(`/admin/reviews/${id}/${action}`);
        toast.success(action === "approve" ? "Avis approuvé" : "Avis rejeté");
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    } finally {
      setActing(null);
    }
  };

  const counts = {
    pending: reviews.filter(r => r.status === "pending").length,
    approved: reviews.filter(r => r.status === "approved").length,
    rejected: reviews.filter(r => r.status === "rejected").length,
  };

  return (
    <div className="space-y-4" data-testid="reviews-moderation">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: "pending", label: "En attente" },
          { id: "approved", label: "Approuvés" },
          { id: "rejected", label: "Rejetés" },
          { id: "all", label: "Tous" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`mod-filter-${f.id}`}
            className={`px-4 py-2 text-xs font-mono-grotesk uppercase tracking-[0.15em] border transition-colors ${filter === f.id ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white border-black/20 hover:border-[#F95A2C]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[#F95A2C]" /></div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-black/10 p-16 text-center">
          <div className="font-display font-bold text-xl mb-1">Aucun avis</div>
          <p className="text-sm text-[#52525B]">{filter === "pending" ? "Pas de modération en attente. 👌" : "Rien à afficher."}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {reviews.map((r) => (
            <article key={r.id} className="bg-white border border-black/10 p-5" data-testid={`mod-review-${r.id}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {r.avatar_url ? (
                    <img src={resolveImg(r.avatar_url)} alt={r.author} className="w-10 h-10 object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-[#FAFAFA] border border-black/10 flex items-center justify-center font-display font-bold">{r.author?.[0] || "?"}</div>
                  )}
                  <div>
                    <div className="font-display font-bold text-sm">{r.author}</div>
                    <div className="text-xs text-[#71717A]">{r.profession} · {r.city}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Stars rating={r.rating} />
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-1">
                    {new Date(r.submitted_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              </div>
              <p className="font-serif-instrument italic text-base leading-snug text-[#09090B] mb-4">« {r.quote} »</p>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-black/5">
                <a href={`mailto:${r.email}`} className="text-xs text-[#71717A] hover:text-[#F95A2C] flex items-center gap-1.5 font-mono-grotesk truncate">
                  <Mail className="w-3 h-3 shrink-0" /> {r.email}
                </a>
                <div className="flex gap-1.5 shrink-0">
                  {r.status !== "approved" && (
                    <Button size="sm" disabled={acting === r.id} onClick={() => act(r.id, "approve")} className="rounded-none h-8 px-3 bg-[#F95A2C] hover:bg-[#09090B] text-white" data-testid={`approve-${r.id}`}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Approuver
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button size="sm" disabled={acting === r.id} onClick={() => act(r.id, "reject")} variant="outline" className="rounded-none h-8 px-3 border-black/20 hover:bg-[#09090B] hover:text-white" data-testid={`reject-${r.id}`}>
                      <X className="w-3.5 h-3.5 mr-1" /> Rejeter
                    </Button>
                  )}
                  <Button size="sm" disabled={acting === r.id} onClick={() => act(r.id, "delete")} variant="outline" className="rounded-none h-8 px-2 border-black/20 hover:bg-red-600 hover:text-white hover:border-red-600" data-testid={`delete-${r.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-mono-grotesk uppercase tracking-[0.15em]">
                <span className={`px-2 py-0.5 ${r.status === "approved" ? "bg-[#F95A2C] text-white" : r.status === "rejected" ? "bg-black/10" : "bg-amber-100 text-amber-900"}`}>
                  {r.status === "approved" ? "publié" : r.status === "rejected" ? "rejeté" : "en attente"}
                </span>
                {r.moderated_by && <span className="text-[#71717A]">par {r.moderated_by}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
