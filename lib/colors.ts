// lib/colors.ts — All color logic for the three input modes

export type InputType = "task_deadline" | "number" | "general";

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return `rgb(${lerp(r1, r2, t)}, ${lerp(g1, g2, t)}, ${lerp(b1, b2, t)})`;
}

// ── WCAG contrast helpers ──────────────────────────────────────────────────
function sRGB(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGB(r) + 0.7152 * sRGB(g) + 0.0722 * sRGB(b);
}

/** Returns '#000000' or '#ffffff' to guarantee ≥4.5:1 contrast ratio */
export function accessibleTextColor(bgCss: string): string {
  const m = bgCss.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#000000";
  const lum = relativeLuminance(+m[1], +m[2], +m[3]);
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}

// ── 1. DEADLINE COLOUR (blue → yellow → orange → deep-orange) ─────────────
//   ≥24 h  →  #1d4ed8  (blue)
//   12 h   →  #eab308  (yellow)
//    2 h   →  #f97316  (orange)
//   <2 h   →  #c2410c  (deep-orange)
export function deadlineColor(hoursUntil: number): string {
  if (hoursUntil >= 24) return "rgb(29, 78, 216)";          // blue
  if (hoursUntil >= 12) {
    const t = (hoursUntil - 12) / 12;                        // 1→0 as 24h→12h
    return lerpColor("#eab308", "#1d4ed8", t);
  }
  if (hoursUntil >= 2) {
    const t = (hoursUntil - 2) / 10;                         // 1→0 as 12h→2h
    return lerpColor("#f97316", "#eab308", t);
  }
  const t = Math.max(0, hoursUntil / 2);                     // 1→0 as 2h→0h
  return lerpColor("#c2410c", "#f97316", t);
}

// ── 2. NUMBER COLOUR (white → grey → black based on last 2 digits) ────────
//   00 → white   rgb(255,255,255)
//   50 → grey    rgb(128,128,128)
//   99 → black   rgb(0,0,0)
//   100 treated as 100 mod 100 = 0 (i.e. white); per spec "last 2 digits"
export function numberColor(value: number): string {
  const last2 = ((Math.abs(Math.round(value)) % 100));      // 0-99
  const gray = Math.round(255 * (1 - last2 / 99));
  return `rgb(${gray}, ${gray}, ${gray})`;
}

// ── 3. TONE COLOUR (red → amber → green) ─────────────────────────────────
//   -100  →  #dc2626  (deep red)
//     0   →  #d97706  (amber / warm neutral)
//   +100  →  #16a34a  (deep green)
export function toneColor(score: number): string {
  const clamped = Math.max(-100, Math.min(100, score));
  if (clamped < 0) {
    const t = (clamped + 100) / 100;   // 0=red, 1=amber
    return lerpColor("#dc2626", "#d97706", t);
  }
  const t = clamped / 100;             // 0=amber, 1=green
  return lerpColor("#d97706", "#16a34a", t);
}

// ── Dispatcher ────────────────────────────────────────────────────────────
export function resolveColor(
  inputType: InputType,
  colorValue: number
): string {
  switch (inputType) {
    case "task_deadline":
      return deadlineColor(colorValue);
    case "number":
      return numberColor(colorValue);
    case "general":
    default:
      return toneColor(colorValue);
  }
}
