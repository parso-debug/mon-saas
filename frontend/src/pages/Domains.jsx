import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import DomainManager from "@/components/DomainManager";

export default function Domains() {
  const nav = useNavigate();
  const [project, setProject] = useState(null); // { kind, id, business_type, city } default target

  useEffect(() => {
    // Attach default target = user's first site (if any) so purchased domain auto-connects
    api.get("/sites").then((r) => {
      const first = (r.data || [])[0];
      if (first) {
        setProject({ kind: "site", id: first.id, business_type: first.business_type, city: first.city });
      } else {
        api.get("/shops").then((rs) => {
          const firstShop = (rs.data || [])[0];
          if (firstShop) setProject({ kind: "shop", id: firstShop.id, business_type: "boutique", city: firstShop.city });
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="domains-page">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm hover:text-[#F95A2C]" data-testid="domains-back">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-[#F95A2C]" />
            <span className="font-display font-bold">Vos domaines</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-2">// domaine personnalisé</div>
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-[1.05]">Achetez & connectez votre domaine<br/><span className="font-serif-instrument italic font-normal text-[#F95A2C]">en 30 secondes.</span></h1>
          <p className="text-[#52525B] mt-3 max-w-xl font-manrope">Recherche, paiement, DNS et SSL — tout est automatique. Aucune configuration technique à faire de votre côté.</p>
          {project && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white border border-black/10 px-3 py-1.5 text-xs font-mono-grotesk uppercase tracking-[0.15em] text-[#71717A]">
              <span>cible d'attachement :</span>
              <span className="text-[#F95A2C]">{project.kind}</span>
              <span>·</span>
              <span className="text-black">{project.business_type} {project.city && `/ ${project.city}`}</span>
            </div>
          )}
        </div>

        <DomainManager
          businessType={project?.business_type}
          city={project?.city}
          projectId={project?.id}
          projectKind={project?.kind || "site"}
        />
      </main>
    </div>
  );
}
