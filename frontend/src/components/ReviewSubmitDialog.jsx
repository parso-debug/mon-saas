import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Loader2, CheckCircle2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ReviewSubmitDialog({ trigger }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ author: "", profession: "", city: "", email: "", quote: "", rating: 5 });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.quote.trim().length < 20) { toast.error("Votre avis doit faire au moins 20 caractères"); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/reviews`, form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm({ author: "", profession: "", city: "", email: "", quote: "", rating: 5 });
    setSubmitted(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(reset, 200); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="open-review-dialog" size="lg" className="rounded-none h-14 px-8 bg-[#F95A2C] hover:bg-[#09090B] text-white">
            <MessageSquarePlus className="w-4 h-4 mr-2" /> Laisser mon avis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-none border border-black/10 p-0">
        {submitted ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 bg-[#F95A2C] mx-auto mb-5 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <DialogTitle className="font-display font-bold text-2xl tracking-tight mb-2">Merci pour votre avis 🎉</DialogTitle>
            <p className="text-sm text-[#52525B] mb-6">Il sera publié sur la page après modération (généralement sous 24h).</p>
            <Button onClick={() => setOpen(false)} className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="review-success-close">Fermer</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-8" data-testid="review-form">
            <DialogHeader className="mb-6">
              <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">// votre avis</div>
              <DialogTitle className="font-display font-bold text-2xl tracking-tight">Partagez votre expérience</DialogTitle>
              <p className="text-sm text-[#52525B]">Aidez d'autres artisans à se décider. Votre avis sera modéré avant publication.</p>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Votre note</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => set("rating", n)} data-testid={`rating-${n}`} className="p-1">
                      <Star className={`w-7 h-7 transition-colors ${n <= form.rating ? "fill-[#F95A2C] text-[#F95A2C]" : "fill-black/5 text-black/20 hover:text-[#F95A2C]"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Prénom & initiale *</label>
                  <Input data-testid="rev-author" required value={form.author} onChange={(e) => set("author", e.target.value)} className="h-11 rounded-none border-black/20" placeholder="Marc D." />
                </div>
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Email *</label>
                  <Input data-testid="rev-email" required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="h-11 rounded-none border-black/20" placeholder="vous@exemple.fr" />
                </div>
              </div>
              <p className="text-xs text-[#71717A]">Votre email reste privé, il ne sera jamais affiché publiquement.</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Métier *</label>
                  <Input data-testid="rev-profession" required value={form.profession} onChange={(e) => set("profession", e.target.value)} className="h-11 rounded-none border-black/20" placeholder="Plombier, Maçon..." />
                </div>
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Ville *</label>
                  <Input data-testid="rev-city" required value={form.city} onChange={(e) => set("city", e.target.value)} className="h-11 rounded-none border-black/20" placeholder="Toulouse" />
                </div>
              </div>
              <div>
                <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Votre avis * <span className="text-[#71717A] normal-case tracking-normal">({form.quote.length}/600)</span></label>
                <Textarea data-testid="rev-quote" required rows={4} value={form.quote} onChange={(e) => set("quote", e.target.value.slice(0, 600))} className="rounded-none border-black/20" placeholder="Décrivez votre expérience en quelques mots... (min. 20 caractères)" />
              </div>
              <Button type="submit" disabled={busy} data-testid="rev-submit" className="w-full h-12 rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publier mon avis"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
