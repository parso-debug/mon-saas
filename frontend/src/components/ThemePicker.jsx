import { useEffect } from "react";

export const DEFAULT_THEME = {
  primary_color: "#1F3D2D",
  accent_color: "#C84B31",
  font_heading: "Instrument Serif",
  font_body: "Manrope",
};

export const COLOR_PRESETS = [
  { name: "Forêt & Terre", primary_color: "#1F3D2D", accent_color: "#C84B31" },
  { name: "Bleu nuit", primary_color: "#1E3A8A", accent_color: "#F59E0B" },
  { name: "Anthracite", primary_color: "#111827", accent_color: "#F95A2C" },
  { name: "Bordeaux", primary_color: "#7F1D1D", accent_color: "#D4A373" },
  { name: "Marine pâle", primary_color: "#0F4C5C", accent_color: "#E36414" },
  { name: "Olive", primary_color: "#3F4A2A", accent_color: "#BC4749" },
];

export const FONT_PAIRS = [
  { name: "Élégant (par défaut)", font_heading: "Instrument Serif", font_body: "Manrope" },
  { name: "Magazine", font_heading: "Playfair Display", font_body: "Inter" },
  { name: "Éditorial chaleureux", font_heading: "Fraunces", font_body: "Work Sans" },
  { name: "Moderne premium", font_heading: "DM Serif Display", font_body: "DM Sans" },
  { name: "Classique sobre", font_heading: "Cormorant Garamond", font_body: "Lato" },
  { name: "Sans-serif puissant", font_heading: "Space Grotesk", font_body: "Inter" },
];

const ALL_FONTS = Array.from(new Set(FONT_PAIRS.flatMap((p) => [p.font_heading, p.font_body])));

/** Lazy-load Google Fonts globally for builder previews. */
export function ensureGoogleFontsLoaded() {
  if (typeof document === "undefined") return;
  const id = "ap-google-fonts";
  if (document.getElementById(id)) return;
  const families = ALL_FONTS.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&");
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

export default function ThemePicker({ value, onChange }) {
  const theme = { ...DEFAULT_THEME, ...(value || {}) };
  useEffect(() => { ensureGoogleFontsLoaded(); }, []);

  const update = (patch) => onChange({ ...theme, ...patch });
  const isPresetActive = (p) => p.primary_color === theme.primary_color && p.accent_color === theme.accent_color;
  const isFontActive = (p) => p.font_heading === theme.font_heading && p.font_body === theme.font_body;

  return (
    <div className="space-y-8" data-testid="theme-picker">
      {/* Couleurs */}
      <div>
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">Palette de couleurs</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              data-testid={`color-preset-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => update({ primary_color: p.primary_color, accent_color: p.accent_color })}
              className={`flex items-center gap-3 border px-3 py-2.5 text-left transition-colors ${isPresetActive(p) ? "border-[#F95A2C] bg-[#F95A2C]/5" : "border-black/10 hover:border-black/40 bg-white"}`}
            >
              <span className="flex">
                <span className="w-5 h-5 border border-black/10" style={{ backgroundColor: p.primary_color }} />
                <span className="w-5 h-5 border-y border-r border-black/10" style={{ backgroundColor: p.accent_color }} />
              </span>
              <span className="text-xs font-medium">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#52525B] block mb-1.5">Couleur principale (boutons, fonds sombres)</label>
            <div className="flex items-center gap-2">
              <input type="color" data-testid="theme-primary-color" value={theme.primary_color} onChange={(e) => update({ primary_color: e.target.value })} className="w-12 h-10 cursor-pointer border border-black/20" />
              <input type="text" value={theme.primary_color} onChange={(e) => update({ primary_color: e.target.value })} className="flex-1 h-10 px-3 border border-black/20 font-mono-grotesk text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#52525B] block mb-1.5">Couleur d'accent (titres « — », étoiles, hover)</label>
            <div className="flex items-center gap-2">
              <input type="color" data-testid="theme-accent-color" value={theme.accent_color} onChange={(e) => update({ accent_color: e.target.value })} className="w-12 h-10 cursor-pointer border border-black/20" />
              <input type="text" value={theme.accent_color} onChange={(e) => update({ accent_color: e.target.value })} className="flex-1 h-10 px-3 border border-black/20 font-mono-grotesk text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Polices */}
      <div>
        <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] mb-3">Couples de polices</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {FONT_PAIRS.map((p) => (
            <button
              key={p.name}
              type="button"
              data-testid={`font-pair-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => update({ font_heading: p.font_heading, font_body: p.font_body })}
              className={`text-left border px-4 py-3 transition-colors ${isFontActive(p) ? "border-[#F95A2C] bg-[#F95A2C]/5" : "border-black/10 hover:border-black/40 bg-white"}`}
            >
              <div className="text-2xl leading-tight" style={{ fontFamily: `'${p.font_heading}', serif` }}>Aa</div>
              <div className="text-xs mt-1" style={{ fontFamily: `'${p.font_body}', sans-serif` }}>
                <span className="font-medium">{p.name}</span> · <span className="text-[#71717A]">{p.font_heading} + {p.font_body}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
