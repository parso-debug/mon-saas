import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.full_name);
      toast.success("Bienvenue sur artisanweb !");
      nav("/onboarding");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Échec de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#FAFAFA]" data-testid="signup-page">
      <div className="flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-12" data-testid="signup-logo">
            <div className="w-8 h-8 bg-[#09090B] flex items-center justify-center">
              <span className="text-[#F95A2C] font-mono-grotesk font-bold">A</span>
            </div>
            <span className="font-display font-bold tracking-tight">artisanweb</span>
          </Link>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// nouveau compte</div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-tight mb-2">Créons votre compte.</h1>
          <p className="text-[#52525B] mb-8">Gratuit, sans carte bancaire.</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Nom complet</Label>
              <Input data-testid="signup-name" required value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} className="mt-2 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]" placeholder="Marc Dupont" />
            </div>
            <div>
              <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Email</Label>
              <Input data-testid="signup-email" type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="mt-2 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]" placeholder="vous@exemple.fr" />
            </div>
            <div>
              <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Mot de passe</Label>
              <Input data-testid="signup-password" type="password" required value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className="mt-2 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]" placeholder="Min. 6 caractères" />
            </div>
            <Button type="submit" disabled={loading} data-testid="signup-submit" className="w-full h-12 rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white">
              {loading ? "Création..." : <>Créer mon compte <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </form>
          <p className="mt-6 text-sm text-[#52525B]">
            Déjà un compte ? <Link to="/login" className="text-[#F95A2C] underline underline-offset-4" data-testid="signup-to-login">Connectez-vous</Link>
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center justify-center bg-[#09090B] text-white p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #F95A2C 0%, transparent 50%)' }} />
        <div className="relative max-w-md">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">// next step</div>
          <h2 className="font-display font-bold text-4xl tracking-tight leading-tight mb-6">
            Dans 5 minutes,<br/>
            <span className="italic font-serif-instrument font-normal text-[#F95A2C]">votre site est en ligne.</span>
          </h2>
          <ul className="space-y-3 text-[#A1A1AA]">
            <li>· Pas besoin de compétences techniques</li>
            <li>· Génération IA en français</li>
            <li>· SEO local optimisé</li>
            <li>· Capture de leads incluse</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
