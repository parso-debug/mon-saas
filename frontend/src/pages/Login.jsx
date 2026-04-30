import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenue !");
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Échec de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#FAFAFA]" data-testid="login-page">
      <div className="flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-12" data-testid="login-logo">
            <div className="w-8 h-8 bg-[#09090B] flex items-center justify-center">
              <span className="text-[#F95A2C] font-mono-grotesk font-bold">A</span>
            </div>
            <span className="font-display font-bold tracking-tight">artisanweb</span>
          </Link>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// authentification</div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-tight mb-2">Bon retour.</h1>
          <p className="text-[#52525B] mb-8">Connectez-vous pour accéder à vos sites.</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Email</Label>
              <Input id="email" data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]" placeholder="vous@exemple.fr" />
            </div>
            <div>
              <Label htmlFor="password" className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Mot de passe</Label>
              <Input id="password" data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12 rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-[#F95A2C]" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-12 rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white">
              {loading ? "Connexion..." : <>Se connecter <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </form>
          <p className="mt-6 text-sm text-[#52525B]">
            Pas de compte ? <Link to="/signup" className="text-[#F95A2C] underline underline-offset-4" data-testid="login-to-signup">Créez-en un gratuitement</Link>
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center justify-center bg-[#09090B] text-white p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, #F95A2C 0%, transparent 50%)' }} />
        <div className="relative max-w-md">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-3">// pourquoi artisanweb</div>
          <h2 className="font-display font-bold text-4xl tracking-tight leading-tight mb-6">
            Le site web, ce n'est pas votre métier.<br/>
            <span className="italic font-serif-instrument font-normal text-[#F95A2C]">C'est le nôtre.</span>
          </h2>
          <p className="text-[#A1A1AA] leading-relaxed">Plus de 1 200 artisans ont créé leur site avec artisanweb. Devis, contacts, visibilité locale — tout est inclus.</p>
        </div>
      </div>
    </div>
  );
}
