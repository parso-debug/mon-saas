import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Globe, Loader2, Inbox, Save, Phone, Mail, MapPin, Copy, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtisanTemplate from "@/components/ArtisanTemplate";

export default function Builder() {
  const { siteId } = useParams();
  const nav = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState([]);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/sites/${siteId}`);
      setSite(r.data);
      const lr = await api.get(`/sites/${siteId}/leads`);
      setLeads(lr.data);
    } catch (e) {
      toast.error("Impossible de charger le site");
      nav("/dashboard");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [siteId]);

  const updateField = (path, value) => {
    setSite((s) => {
      const ns = { ...s };
      if (path.startsWith("content.")) {
        const k = path.slice("content.".length);
        ns.content = { ...ns.content, [k]: value };
      } else {
        ns[path] = value;
      }
      return ns;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/sites/${siteId}`, {
        business_name: site.business_name,
        phone: site.phone,
        email: site.email,
        city: site.city,
        content: site.content,
        services: site.services,
      });
      toast.success("Modifications enregistrées");
    } catch (e) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    try {
      await api.post(`/sites/${siteId}/publish`);
      setSite((s) => ({ ...s, status: "published" }));
      toast.success("Site publié !");
    } catch (e) {
      toast.error("Erreur de publication");
    }
  };

  const publicUrl = site ? `${window.location.origin}/site/${site.slug}` : "";
  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("URL copiée");
  };

  if (loading || !site) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#F95A2C]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" data-testid="builder-page">
      {/* Top bar */}
      <header className="border-b border-black/10 bg-white sticky top-0 z-40">
        <div className="px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[#F95A2C]" data-testid="builder-back">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="font-display font-bold tracking-tight">{site.business_name}</span>
              <span className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">/ {site.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")} className="rounded-none border-black/20 hover:bg-black hover:text-white" data-testid="builder-view-public">
              <ExternalLink className="w-3.5 h-3.5 md:mr-2" /> <span className="hidden md:inline">Voir le site</span>
            </Button>
            <Button onClick={save} disabled={saving} size="sm" className="rounded-none bg-[#09090B] hover:bg-[#F95A2C] text-white" data-testid="builder-save">
              <Save className="w-3.5 h-3.5 md:mr-2" /> <span className="hidden md:inline">{saving ? "..." : "Enregistrer"}</span>
            </Button>
            <Button onClick={publish} size="sm" className="rounded-none bg-[#F95A2C] hover:bg-[#09090B] text-white" data-testid="builder-publish">
              <Globe className="w-3.5 h-3.5 md:mr-2" /> <span className="hidden md:inline">{site.status === "published" ? "Publié" : "Publier"}</span>
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="preview" className="w-full">
        <div className="border-b border-black/10 bg-white px-4 md:px-8">
          <TabsList className="h-12 bg-transparent rounded-none p-0 gap-1">
            <TabsTrigger value="preview" className="rounded-none data-[state=active]:bg-[#09090B] data-[state=active]:text-white px-5" data-testid="tab-preview">Aperçu & édition</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-[#09090B] data-[state=active]:text-white px-5" data-testid="tab-settings">Paramètres</TabsTrigger>
            <TabsTrigger value="leads" className="rounded-none data-[state=active]:bg-[#09090B] data-[state=active]:text-white px-5" data-testid="tab-leads">
              Leads <span className="ml-2 bg-[#F95A2C] text-white text-[10px] px-1.5 py-0.5 font-mono-grotesk">{leads.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* PREVIEW + INLINE EDIT */}
        <TabsContent value="preview" className="m-0">
          <div className="bg-[#E4E4E7] p-2 md:p-4">
            <div className="bg-white border border-black/10 overflow-hidden">
              <div className="bg-[#FAFAFA] border-b border-black/10 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white border border-black/10 px-3 py-1 text-xs font-mono-grotesk text-[#71717A] truncate flex items-center justify-between gap-2">
                  <span className="truncate">{publicUrl}</span>
                  <button onClick={copyUrl} className="text-[#F95A2C] hover:text-[#09090B] shrink-0" data-testid="copy-url">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] hidden md:block">cliquez sur un texte pour l'éditer</div>
              </div>
              <ArtisanTemplate site={site} editable={true} onEdit={(field, value) => updateField(field, value)} />
            </div>
          </div>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="m-0">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <h2 className="font-display font-bold text-3xl tracking-tight mb-8">Paramètres du site</h2>
            <div className="space-y-5 bg-white border border-black/10 p-8">
              <div>
                <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Nom de l'entreprise</label>
                <Input data-testid="settings-business-name" value={site.business_name} onChange={(e) => updateField("business_name", e.target.value)} className="h-12 rounded-none border-black/20" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Téléphone</label>
                  <Input data-testid="settings-phone" value={site.phone} onChange={(e) => updateField("phone", e.target.value)} className="h-12 rounded-none border-black/20" />
                </div>
                <div>
                  <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Ville</label>
                  <Input data-testid="settings-city" value={site.city} onChange={(e) => updateField("city", e.target.value)} className="h-12 rounded-none border-black/20" />
                </div>
              </div>
              <div>
                <label className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] block mb-2">Email</label>
                <Input data-testid="settings-email" value={site.email || ""} onChange={(e) => updateField("email", e.target.value)} className="h-12 rounded-none border-black/20" />
              </div>
              <div className="pt-4 border-t border-black/10 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Slug</div>
                  <div className="font-display font-bold text-sm truncate">{site.slug}</div>
                </div>
                <div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Statut</div>
                  <div className="font-display font-bold text-sm">{site.status}</div>
                </div>
                <div>
                  <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A]">Style</div>
                  <div className="font-display font-bold text-sm">{site.style}</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads" className="m-0">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-display font-bold text-3xl tracking-tight">Demandes de contact</h2>
                <p className="text-[#52525B] mt-1">{leads.length} {leads.length > 1 ? "leads reçus" : "lead reçu"}</p>
              </div>
            </div>
            {leads.length === 0 ? (
              <div className="bg-white border border-black/10 p-16 text-center">
                <div className="w-14 h-14 bg-[#FAFAFA] border border-black/10 mx-auto mb-5 flex items-center justify-center">
                  <Inbox className="w-6 h-6 text-[#71717A]" />
                </div>
                <h3 className="font-display font-bold text-xl tracking-tight mb-2">Aucun lead pour le moment</h3>
                <p className="text-[#52525B] text-sm">Partagez l'URL de votre site pour commencer à recevoir des demandes.</p>
                <div className="mt-6 inline-flex items-center gap-2 border border-black/10 px-4 py-2 font-mono-grotesk text-xs">
                  {publicUrl}
                  <button onClick={copyUrl} className="text-[#F95A2C]">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((l) => (
                  <div key={l.id} className="bg-white border border-black/10 p-5" data-testid={`lead-${l.id}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-display font-bold">{l.name}</div>
                        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mt-0.5">{new Date(l.created_at).toLocaleString("fr-FR")}</div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <a href={`mailto:${l.email}`} className="flex items-center gap-1 hover:text-[#F95A2C]"><Mail className="w-3.5 h-3.5" /> {l.email}</a>
                        {l.phone && <a href={`tel:${l.phone}`} className="flex items-center gap-1 hover:text-[#F95A2C]"><Phone className="w-3.5 h-3.5" /> {l.phone}</a>}
                      </div>
                    </div>
                    <p className="text-sm text-[#374151] leading-relaxed border-t border-black/5 pt-3">{l.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
