import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";

const PHASES = [
  "Analyse de votre activité",
  "Génération de la structure",
  "Rédaction du hero & des CTA",
  "Optimisation SEO local",
  "Génération de l'image d'ambiance",
  "Assemblage final du site",
];

export default function Generating() {
  const nav = useNavigate();
  const [phase, setPhase] = useState(0);
  const [logs, setLogs] = useState([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const pendingRaw = sessionStorage.getItem("aw_pending");
    if (!pendingRaw) { nav("/onboarding"); return; }
    const payload = JSON.parse(pendingRaw);

    // animate phases
    let p = 0;
    const phaseInt = setInterval(() => {
      p = Math.min(p + 1, PHASES.length - 1);
      setPhase(p);
    }, 1800);

    // animate logs
    const logSeed = [
      "[ ai.core ] booting claude-sonnet-4.5...",
      `[ business ] type=${payload.business_type} city=${payload.city}`,
      `[ services ] count=${payload.services.length}`,
      "[ seo ] scanning local intent vectors",
      "[ copy ] writing hero variants",
      "[ copy ] writing service descriptions",
      "[ seo ] crafting meta tags",
      payload.generate_image ? "[ image ] gemini-3.1-flash-image dispatched" : "[ image ] skipped",
      "[ assemble ] hydrating template",
    ];
    let li = 0;
    const logInt = setInterval(() => {
      if (li >= logSeed.length) return;
      setLogs((prev) => [...prev, logSeed[li]]);
      li++;
    }, 700);

    // launch real request
    api.post("/sites/generate", payload)
      .then((r) => {
        sessionStorage.removeItem("aw_pending");
        clearInterval(phaseInt); clearInterval(logInt);
        setPhase(PHASES.length - 1);
        setLogs((prev) => [...prev, "[ done ] site assembled ✓", `[ redirect ] /builder/${r.data.id}`]);
        setTimeout(() => nav(`/builder/${r.data.id}`), 800);
      })
      .catch((err) => {
        clearInterval(phaseInt); clearInterval(logInt);
        toast.error(err?.response?.data?.detail || "Erreur lors de la génération");
        nav("/onboarding");
      });

    return () => { clearInterval(phaseInt); clearInterval(logInt); };
  }, [nav]);

  return (
    <div className="min-h-screen bg-[#09090B] text-white relative overflow-hidden" data-testid="generating-page">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #F95A2C 0%, transparent 60%)' }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-4">// generation in progress</div>
        <h1 className="font-display font-bold text-5xl md:text-7xl tracking-tight leading-[0.95] mb-12">
          Création de votre site<br/>
          <span className="cursor-blink italic font-serif-instrument font-normal text-[#F95A2C]">{PHASES[phase]}</span>
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Phases */}
          <div className="border border-white/10 bg-white/[0.02] backdrop-blur p-6">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-4">// phases</div>
            <ul className="space-y-3">
              {PHASES.map((p, i) => (
                <li key={i} className="flex items-center gap-3 font-mono-grotesk text-sm" data-testid={`phase-${i}`}>
                  <span className={`w-5 h-5 border flex items-center justify-center text-[10px] ${i < phase ? "bg-[#F95A2C] border-[#F95A2C]" : i === phase ? "border-[#F95A2C] text-[#F95A2C]" : "border-white/20 text-[#A1A1AA]"}`}>
                    {i < phase ? "✓" : i + 1}
                  </span>
                  <span className={i <= phase ? "text-white" : "text-[#A1A1AA]"}>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Terminal log */}
          <div className="border border-white/10 bg-black/60 backdrop-blur p-6 relative scanline overflow-hidden">
            <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-4">// system.log</div>
            <div className="font-mono-grotesk text-xs space-y-1 h-72 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="text-[#A1A1AA]">
                  <span className="text-[#F95A2C]">$</span> {l}
                </div>
              ))}
              <div className="cursor-blink text-[#F95A2C]">$</div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-sm text-[#A1A1AA] font-mono-grotesk uppercase tracking-[0.2em]">
          ne fermez pas cette page · ~60s
        </p>
      </div>
    </div>
  );
}
