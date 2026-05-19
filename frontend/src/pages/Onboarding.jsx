import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, X, Plus } from "lucide-react";
import { toast } from "sonner";

const STYLES = [
  { id: "moderne", label: "Moderne", desc: "Lignes épurées, contraste élevé" },
  { id: "premium", label: "Premium", desc: "Élégant, sérieux, haut de gamme" },
  { id: "minimaliste", label: "Minimaliste", desc: "Simple, rapide, efficace" },
];

const TRADES = [
  "Plomberie", "Électricité", "Maçonnerie", "Peinture", "Menuiserie",
  "Chauffage", "Couverture", "Carrelage", "Paysagiste", "Serrurerie",
  "Plâtrerie", "Rénovation", "Climatisation", "Jardinage", "Nettoyage",
];

const SERVICES_BY_TRADE = {
  "Plomberie": ["Dépannage fuite", "Installation sanitaire", "Chauffe-eau", "Débouchage canalisation", "Rénovation salle de bain"],
  "Électricité": ["Dépannage électrique", "Tableau électrique", "Installation luminaires", "Prises et interrupteurs", "Mise aux normes"],
  "Maçonnerie": ["Construction murs", "Ouverture mur porteur", "Dalle béton", "Ravalement façade", "Terrasse maçonnée"],
  "Peinture": ["Peinture intérieure", "Peinture extérieure", "Enduits décoratifs", "Papier peint", "Rénovation boiseries"],
  "Menuiserie": ["Pose fenêtres", "Portes sur mesure", "Parquet", "Escalier bois", "Aménagement placard"],
  "Chauffage": ["Chaudière gaz", "Pompe à chaleur", "Radiateurs", "Entretien chaudière", "Plancher chauffant"],
  "Couverture": ["Réfection toiture", "Tuiles et ardoises", "Étanchéité", "Zinguerie", "Isolation combles"],
  "Carrelage": ["Carrelage sol", "Faïence murale", "Carrelage extérieur", "Chape", "Pierre naturelle"],
  "Paysagiste": ["Entretien de jardin", "Taille de haies", "Création de massifs", "Tonte de pelouse", "Élagage"],
  "Serrurerie": ["Ouverture de porte", "Changement serrure", "Blindage porte", "Volets roulants", "Dépannage 24/7"],
  "Plâtrerie": ["Pose de placo", "Cloisons", "Faux plafonds", "Isolation phonique", "Enduits"],
  "Rénovation": ["Rénovation complète", "Cuisine", "Salle de bain", "Aménagement intérieur", "Peinture et sols"],
  "Climatisation": ["Installation clim", "Entretien clim", "Pompe à chaleur air-air", "Dépannage", "Désembuage"],
  "Jardinage": ["Tonte", "Désherbage", "Taille arbustes", "Entretien massifs", "Ramassage feuilles"],
  "Nettoyage": ["Nettoyage fin de chantier", "Vitres", "Bureaux", "Copropriétés", "Dégraissage"]
};

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    business_name: "",
    business_type: "",
    services: [],
    city: "",
    phone: "",
    email: "",
    description: "",
    style: "moderne",
    generate_image: true,
  });
  const [serviceInput, setServiceInput] = useState("");

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const addService = () => {
    const v = serviceInput.trim();
    if (!v) return;
    if (data.services.includes(v)) { setServiceInput(""); return; }
    set("services", [...data.services, v]);
    setServiceInput("");
  };
  const removeService = (s) => set("services", data.services.filter(x => x !== s));

  const nextDisabled = () => {
    if (step === 1) return !data.business_name || !data.business_type;
    if (step === 2) return data.services.length === 0;
    if (step === 3) return !data.city || !data.phone;
    return false;
  };

  const submit = () => {
    if (!data.business_name || !data.business_type || data.services.length === 0 || !data.city || !data.phone) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }
    sessionStorage.setItem("aw_pending", JSON.stringify(data));
    nav("/generating");
  };

  const total = 4;

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="onboarding-page">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => nav("/dashboard")} className="flex items-center gap-2" data-testid="back-to-dashboard">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
              <span className="text-[#F95A2C] font-mono-grotesk font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold text-sm tracking-tight">artisanweb</span>
          </button>
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">step {step} / {total}</div>
        </div>
        <div className="h-1 bg-black/5">
          <div className="h-full bg-[#F95A2C] transition-all" style={{ width: `${(step / total) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        {step === 1 && (
          <section data-testid="step-1">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// 01 — votre activité</div>
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3">
              Parlez-nous de votre <span className="italic font-serif-instrument font-normal">entreprise.</span>
            </h1>
            <p className="text-[#52525B] mb-10">Ces infos serviront de base à toute la rédaction du site.</p>
            <div className="space-y-6">
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Nom de l'entreprise</Label>
                <Input data-testid="ob-business-name" value={data.business_name} onChange={(e) => set("business_name", e.target.value)} className="mt-2 h-14 rounded-none border-black/20 text-lg" placeholder="Ex: Dupont & Fils" />
              </div>
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Métier / Activité</Label>
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {TRADES.map((t) => (
                    <button key={t} type="button" onClick={() => {
                      set("business_type", t);
                      if (data.services.length === 0) {
                        const preset = SERVICES_BY_TRADE[t] || [];
                        if (preset.length) set("services", preset);
                      }
                    }} data-testid={`trade-${t}`}
                      className={`px-3 py-1.5 text-xs border transition-colors ${data.business_type === t ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white border-black/20 hover:border-[#F95A2C]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <Input data-testid="ob-business-type" value={data.business_type} onChange={(e) => set("business_type", e.target.value)} className="h-12 rounded-none border-black/20" placeholder="Ou tapez le vôtre..." />
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section data-testid="step-2">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// 02 — vos services</div>
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3">
              Que <span className="italic font-serif-instrument font-normal">proposez-vous</span> ?
            </h1>
            <p className="text-[#52525B] mb-10">Listez 3 à 6 services principaux. Ils auront chacun leur section.</p>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input data-testid="ob-service-input" value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())} className="h-12 rounded-none border-black/20 flex-1" placeholder="Ex: Rénovation de salle de bain" />
                <Button type="button" onClick={addService} data-testid="ob-add-service" className="h-12 rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.services.map((s) => (
                  <span key={s} className="inline-flex items-center gap-2 bg-white border border-black/20 px-3 py-1.5 text-sm" data-testid={`service-tag-${s}`}>
                    {s}
                    <button onClick={() => removeService(s)} className="text-[#71717A] hover:text-[#F95A2C]"><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
                {data.services.length === 0 && <span className="text-sm text-[#71717A]">Aucun service ajouté pour le moment.</span>}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section data-testid="step-3">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// 03 — coordonnées</div>
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3">
              Où vous <span className="italic font-serif-instrument font-normal">trouver</span> ?
            </h1>
            <p className="text-[#52525B] mb-10">Indispensable pour le SEO local et que vos clients vous contactent.</p>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Ville</Label>
                  <Input data-testid="ob-city" value={data.city} onChange={(e) => set("city", e.target.value)} className="mt-2 h-12 rounded-none border-black/20" placeholder="Toulouse" />
                </div>
                <div>
                  <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Téléphone</Label>
                  <Input data-testid="ob-phone" value={data.phone} onChange={(e) => set("phone", e.target.value)} className="mt-2 h-12 rounded-none border-black/20" placeholder="06 12 34 56 78" />
                </div>
              </div>
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Email (optionnel)</Label>
                <Input data-testid="ob-email" type="email" value={data.email} onChange={(e) => set("email", e.target.value)} className="mt-2 h-12 rounded-none border-black/20" placeholder="contact@exemple.fr" />
              </div>
              <div>
                <Label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Description courte (optionnel)</Label>
                <Textarea data-testid="ob-description" rows={3} value={data.description} onChange={(e) => set("description", e.target.value)} className="mt-2 rounded-none border-black/20" placeholder="Ex: Entreprise familiale depuis 1998, spécialisée dans la rénovation haut de gamme..." />
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <section data-testid="step-4">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">// 04 — style & images</div>
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3">
              Quel <span className="italic font-serif-instrument font-normal">style</span> pour votre site ?
            </h1>
            <p className="text-[#52525B] mb-10">Le style influence la mise en page, les couleurs et le ton.</p>
            <div className="grid md:grid-cols-3 gap-3">
              {STYLES.map((s) => (
                <button key={s.id} type="button" onClick={() => set("style", s.id)} data-testid={`style-${s.id}`}
                  className={`text-left p-6 border transition-all ${data.style === s.id ? "bg-[#09090B] text-white border-[#09090B]" : "bg-white border-black/20 hover:border-[#F95A2C]"}`}>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] mb-2 opacity-60">style / {s.id}</div>
                  <div className="font-display font-bold text-2xl tracking-tight mb-1">{s.label}</div>
                  <div className="text-sm opacity-80">{s.desc}</div>
                </button>
              ))}
            </div>
            <div className="mt-8 p-6 border border-black/10 bg-white flex items-start justify-between gap-4">
              <div>
                <div className="font-display font-bold text-base mb-1">Image de couverture IA</div>
                <p className="text-sm text-[#52525B]">Génère une photo d'ambiance unique de votre métier (Gemini Nano Banana). +30s.</p>
              </div>
              <Switch checked={data.generate_image} onCheckedChange={(v) => set("generate_image", v)} data-testid="ob-generate-image" />
            </div>
          </section>
        )}

        <div className="mt-12 flex justify-between items-center">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : nav("/dashboard")} data-testid="ob-back" className="rounded-none">
            <ArrowLeft className="w-4 h-4 mr-2" /> {step > 1 ? "Précédent" : "Annuler"}
          </Button>
          {step < total ? (
            <Button disabled={nextDisabled()} onClick={() => setStep(step + 1)} data-testid="ob-next" className="rounded-none h-12 px-6 bg-[#09090B] hover:bg-[#F95A2C] text-white">
              Continuer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={submit} data-testid="ob-submit" className="rounded-none h-12 px-6 bg-[#F95A2C] hover:bg-[#09090B] text-white">
              Générer mon site <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
