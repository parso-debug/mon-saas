import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ArtisanTemplate from "@/components/ArtisanTemplate";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicSite() {
  const { slug } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/public/sites/${slug}`)
      .then((r) => {
        setSite(r.data);
        // Update document head for SEO
        const c = r.data.content || {};
        document.title = c.seo_title || `${r.data.business_name} — ${r.data.business_type} à ${r.data.city}`;
        const setMeta = (name, content) => {
          let m = document.querySelector(`meta[name="${name}"]`);
          if (!m) { m = document.createElement("meta"); m.setAttribute("name", name); document.head.appendChild(m); }
          m.setAttribute("content", content);
        };
        if (c.seo_description) setMeta("description", c.seo_description);
        if (c.seo_keywords) setMeta("keywords", c.seo_keywords.join(", "));
      })
      .catch(() => setError("Site introuvable"))
      .finally(() => setLoading(false));
  }, [slug]);

  const submitLead = async (lead) => {
    try {
      await axios.post(`${API}/public/sites/${slug}/leads`, lead);
      toast.success("Message envoyé ! Nous vous recontactons rapidement.");
    } catch (e) {
      toast.error("Erreur lors de l'envoi");
      throw e;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1F3D2D]" />
      </div>
    );
  }
  if (error || !site) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-center px-6">
        <div>
          <div className="font-serif-instrument italic text-5xl text-[#111827] mb-3">404</div>
          <p className="font-manrope text-[#6B7280]">Ce site n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    );
  }
  return <ArtisanTemplate site={site} onSubmitLead={submitLead} />;
}
