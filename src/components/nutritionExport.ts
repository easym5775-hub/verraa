/* ================================================================
   VERRAA — nutrition plan image/PDF export.
   Each plan day is drawn as a neon gym-poster card on a <canvas>
   (no DOM screenshots, so Tailwind v4 colors can't break it) and the
   pages are assembled into a multi-page A4 PDF with jsPDF — or
   downloaded as PNG.
   ================================================================ */

import { jsPDF } from "jspdf";
import type { Meal, MealType, NutritionTargets } from "../types";
import { MEAL_TYPES } from "../types";

export interface ExportDay {
  day: number;
  dayName: string;
  meals: Meal[]; // pre-sorted
  totals: { calories: number; protein: number; carbs: number; fats: number };
}

interface ExportMeta {
  clientName: string;
  coachName?: string;
  planName?: string;
  targets?: NutritionTargets;
}

/* ---------------- canvas helpers ---------------- */

const W = 1400;
const PAD = 70;
const CW = W - PAD * 2;

const VOLT = "#CDF14B";
const CREAM = "#FFF6DC";
const BODY = "#EDE7D2";
const DIM = "#9AA394";
const CARD = "rgba(17, 23, 20, 0.94)";
const HAIR = "rgba(205, 241, 75, 0.22)";
const TRACK = "#232B26";

const MACRO = { p: "#CDF14B", c: "#7DD3FC", f: "#FBBF24" } as const;

const FONT = `"Manrope", "Segoe UI", Tahoma, Arial, sans-serif`;
const DISPLAY = `"Barlow Condensed", "Manrope", "Segoe UI", Tahoma, Arial, sans-serif`;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Cream text with a volt neon glow, centered on x. */
function neonTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(205, 241, 75, 0.9)";
  ctx.shadowBlur = 42;
  ctx.fillStyle = CREAM;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 12;
  ctx.fillText(text, x, y);
  ctx.restore();
}

interface Seg {
  text: string;
  font: string;
  color: string;
}

/** Greedily pack colored segments into centered lines that fit maxW. */
function packRow(ctx: CanvasRenderingContext2D, segs: Seg[], maxW: number, gap: number): Seg[][] {
  const lines: Seg[][] = [];
  let cur: Seg[] = [];
  let w = 0;
  for (const s of segs) {
    ctx.font = s.font;
    const sw = ctx.measureText(s.text).width;
    const add = cur.length ? gap + sw : sw;
    if (cur.length && w + add > maxW) {
      lines.push(cur);
      cur = [s];
      w = sw;
    } else {
      cur.push(s);
      w += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Draw packed lines centered on cx; first line baseline = y. */
function drawPackedRow(ctx: CanvasRenderingContext2D, lines: Seg[][], cx: number, y: number, gap: number, lh: number) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  lines.forEach((line, li) => {
    let w = 0;
    line.forEach((s, i) => {
      ctx.font = s.font;
      w += ctx.measureText(s.text).width;
      if (i < line.length - 1) w += gap;
    });
    let x = cx - w / 2;
    const yy = y + li * lh;
    for (const s of line) {
      ctx.font = s.font;
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, x, yy);
      x += ctx.measureText(s.text).width + gap;
    }
  });
  ctx.textAlign = prevAlign;
}

/* ---------------- one day poster ---------------- */

interface BlockMeal {
  desc: string[];
  time: string;
  macroLines: Seg[][];
  notes: string[];
  h: number;
}

interface GroupLayout {
  type: MealType;
  index: number; // Meal N
  list: Meal[];
  blocks: BlockMeal[];
  totalsLines: Seg[][];
  contentH: number;
}

// Card-safe type sizes (4 narrow columns must still contain every line).
const DESC_FONT = `700 30px ${FONT}`;
const DESC_LH = 44;
const TIME_FONT = `600 24px ${FONT}`;
const TIME_H = 32;
const KCAL_FONT = `800 27px ${FONT}`;
const MACRO_FONT = `700 24px ${FONT}`;
const MACRO_GAP = 20;
const MACRO_LH = 36;
const NOTE_FONT = `italic 400 23px ${FONT}`;
const NOTE_LH = 32;
const TITLE_FONT = `700 52px ${DISPLAY}`;
const TITLE_H = 56;
const TYPE_FONT = `700 26px ${FONT}`;
const TYPE_H = 36;
const DIV_H = 26;
const CARD_PAD_TOP = 44;
const CARD_PAD_BOTTOM = 40;

function renderDayCard(meta: ExportMeta, d: ExportDay): HTMLCanvasElement {
  const meas = document.createElement("canvas").getContext("2d")!;
  const cv = document.createElement("canvas");
  cv.width = W;
  const totals = d.totals;

  /* ---- layout model (measured once, drawn once) ---- */
  const groups: GroupLayout[] = [];
  MEAL_TYPES.forEach((t) => {
    const list = d.meals.filter((m) => m.type === t);
    if (!list.length) return;
    groups.push({ type: t, index: groups.length + 1, list, blocks: [], totalsLines: [], contentH: 0 });
  });

  const GAP = 36;
  const cardW = groups.length > 0 ? (CW - GAP * (groups.length - 1)) / groups.length : CW;
  const innerW = cardW - 88;

  let maxContent = 0;
  groups.forEach((g) => {
    // header: "Meal N:" + type + divider
    let h = CARD_PAD_TOP + TITLE_H + TYPE_H + DIV_H;
    const gBlocks: BlockMeal[] = g.list.map((m) => {
      meas.font = DESC_FONT;
      const desc = wrap(meas, m.description || "—", innerW);
      const macroLines = packRow(
        meas,
        [
          { text: `${m.calories} kcal`, font: KCAL_FONT, color: "#FFFFFF" },
          { text: `P${m.protein}g`, font: MACRO_FONT, color: MACRO.p },
          { text: `C${m.carbs}g`, font: MACRO_FONT, color: MACRO.c },
          { text: `F${m.fats}g`, font: MACRO_FONT, color: MACRO.f },
        ],
        innerW,
        MACRO_GAP,
      );
      meas.font = NOTE_FONT;
      const notes = m.notes ? wrap(meas, m.notes, innerW) : [];
      const bh =
        desc.length * DESC_LH + 10 + (m.time ? TIME_H : 0) + macroLines.length * MACRO_LH + notes.length * NOTE_LH + 40;
      return { desc, time: m.time ?? "", macroLines, notes, h: bh };
    });
    g.blocks = gBlocks;
    h += gBlocks.reduce((s, b) => s + b.h, 0);
    const gt = g.list.reduce(
      (a, m) => ({ k: a.k + m.calories, p: a.p + m.protein, c: a.c + m.carbs, f: a.f + m.fats }),
      { k: 0, p: 0, c: 0, f: 0 },
    );
    g.totalsLines = packRow(
      meas,
      [
        { text: `${gt.k.toLocaleString("en-US")} kcal`, font: KCAL_FONT, color: VOLT },
        { text: `P${gt.p}`, font: MACRO_FONT, color: BODY },
        { text: `C${gt.c}`, font: MACRO_FONT, color: BODY },
        { text: `F${gt.f}`, font: MACRO_FONT, color: BODY },
      ],
      innerW,
      MACRO_GAP,
    );
    h += g.totalsLines.length * 34 + 26 + CARD_PAD_BOTTOM;
    g.contentH = h;
    maxContent = Math.max(maxContent, h);
  });

  const hasTargets = !!meta.targets && meta.targets.calories > 0;
  const headerH = 448;
  const summaryH = hasTargets ? 150 : 96;
  const cardsH = groups.length > 0 ? maxContent + 96 : 210;
  const footerH = 110;
  cv.height = Math.ceil(70 + headerH + 8 + summaryH + 44 + cardsH + 40 + footerH + 70);

  /* ---- draw pass ---- */
  const ctx = cv.getContext("2d")!;
  // gym-night backdrop
  ctx.fillStyle = "#0A0E0C";
  ctx.fillRect(0, 0, W, cv.height);
  let glow = ctx.createRadialGradient(W / 2, 120, 60, W / 2, 120, 900);
  glow.addColorStop(0, "rgba(205, 241, 75, 0.10)");
  glow.addColorStop(1, "rgba(205, 241, 75, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, cv.height);
  glow = ctx.createRadialGradient(W * 0.12, cv.height * 0.9, 40, W * 0.12, cv.height * 0.9, 700);
  glow.addColorStop(0, "rgba(45, 140, 130, 0.10)");
  glow.addColorStop(1, "rgba(45, 140, 130, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, cv.height);
  ctx.textBaseline = "alphabetic";
  const cx = W / 2;
  let cy = 70;

  // Eyebrow + title + subtitle (athletic condensed display type)
  ctx.textAlign = "center";
  ctx.fillStyle = VOLT;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(`V E R R A A${meta.planName ? `   •   ${meta.planName.toUpperCase()}` : ""}`, cx, cy + 40, CW);
  neonTitle(ctx, "DIET PLAN", cx, cy + 196, `700 152px ${DISPLAY}`);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 66px ${DISPLAY}`;
  ctx.fillText(meta.clientName, cx, cy + 288, CW);
  drawPackedRow(
    ctx,
    packRow(
      ctx,
      [
        ...(meta.coachName
          ? [
              { text: `Coach ${meta.coachName}`, font: `700 31px ${FONT}`, color: VOLT },
              { text: "•", font: `700 31px ${FONT}`, color: DIM },
            ]
          : []),
        { text: d.dayName, font: `800 35px ${FONT}`, color: CREAM },
      ] as Seg[],
      CW,
      18,
    ),
    cx,
    cy + 338,
    18,
    36,
  );
  ctx.fillStyle = DIM;
  ctx.font = `600 29px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(
    `${totals.calories.toLocaleString("en-US")} kcal   •   P${totals.protein}g   C${totals.carbs}g   F${totals.fats}g`,
    cx,
    cy + 386,
  );
  ctx.textAlign = "left";
  cy += headerH + 8;

  // Targets strip
  if (hasTargets) {
    const t = meta.targets!;
    const defs = [
      { label: "PROTEIN", actual: totals.protein, target: t.protein, unit: "g", color: MACRO.p },
      { label: "CARBS", actual: totals.carbs, target: t.carbs, unit: "g", color: MACRO.c },
      { label: "FATS", actual: totals.fats, target: t.fats, unit: "g", color: MACRO.f },
    ];
    const bw = 330;
    const totalW = bw * 3 + 60 * 2;
    let bx = cx - totalW / 2;
    for (const c of defs) {
      const p = c.target > 0 ? Math.min(1, c.actual / c.target) : 0;
      ctx.fillStyle = DIM;
      ctx.font = `800 24px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`${c.label}  ${c.actual}/${c.target}${c.unit}  •  ${Math.round(p * 100)}%`, bx + bw / 2, cy + 30);
      ctx.fillStyle = TRACK;
      rr(ctx, bx, cy + 48, bw, 14, 7);
      ctx.fill();
      if (p > 0) {
        ctx.save();
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = c.color;
        rr(ctx, bx, cy + 48, Math.max(14, p * bw), 14, 7);
        ctx.fill();
        ctx.restore();
      }
      bx += bw + 60;
    }
    ctx.textAlign = "left";
    cy += summaryH;
  } else {
    cy += summaryH;
  }
  cy += 44;

  // Meal cards row
  if (groups.length === 0) {
    ctx.save();
    ctx.shadowColor = "rgba(205, 241, 75, 0.55)";
    ctx.shadowBlur = 34;
    ctx.strokeStyle = VOLT;
    ctx.lineWidth = 5;
    rr(ctx, PAD, cy, CW, 210, 36);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = CARD;
    rr(ctx, PAD, cy, CW, 210, 36);
    ctx.fill();
    neonTitle(ctx, "Rest day", cx, cy + 108, `800 56px ${FONT}`);
    ctx.fillStyle = DIM;
    ctx.font = `600 30px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("No meals planned — recovery & mobility", cx, cy + 158);
    ctx.textAlign = "left";
    cy += 210;
  }
  groups.forEach((g, gi) => {
    const x = PAD + gi * (cardW + GAP);
    const cardH = maxContent + 96;
    // neon frame
    ctx.save();
    ctx.shadowColor = "rgba(205, 241, 75, 0.6)";
    ctx.shadowBlur = 34;
    ctx.strokeStyle = VOLT;
    ctx.lineWidth = 5;
    rr(ctx, x, cy, cardW, cardH, 38);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2;
    rr(ctx, x + 10, cy + 10, cardW - 20, cardH - 20, 30);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = CARD;
    rr(ctx, x, cy, cardW, cardH, 38);
    ctx.fill();

    let ty = cy + CARD_PAD_TOP;
    const ccx = x + cardW / 2;
    neonTitle(ctx, `Meal ${g.index}:`, ccx, ty + 44, TITLE_FONT);
    ty += TITLE_H;
    ctx.fillStyle = VOLT;
    ctx.font = TYPE_FONT;
    ctx.textAlign = "center";
    ctx.fillText(g.type, ccx, ty + 28, innerW);
    ctx.textAlign = "left";
    ty += TYPE_H;
    // divider
    ctx.fillStyle = HAIR;
    ctx.fillRect(x + 48, ty, cardW - 96, 2);
    ty += DIV_H;

    for (const b of g.blocks) {
      ctx.fillStyle = BODY;
      ctx.font = DESC_FONT;
      ctx.textAlign = "center";
      for (const ln of b.desc) {
        ctx.fillText(ln, ccx, ty + 32, innerW);
        ty += DESC_LH;
      }
      ty += 10;
      if (b.time) {
        ctx.fillStyle = DIM;
        ctx.font = TIME_FONT;
        ctx.fillText(b.time, ccx, ty + 24, innerW);
        ty += TIME_H;
      }
      drawPackedRow(ctx, b.macroLines, ccx, ty + 28, MACRO_GAP, MACRO_LH);
      ty += b.macroLines.length * MACRO_LH;
      if (b.notes.length) {
        ctx.fillStyle = DIM;
        ctx.font = NOTE_FONT;
        for (const ln of b.notes) {
          ctx.fillText(ln, ccx, ty + 24, innerW);
          ty += NOTE_LH;
        }
      }
      ty += 40;
    }
    // group totals pinned near the bottom (wrapped, never overflowing)
    const tTop = cy + cardH - CARD_PAD_BOTTOM - (g.totalsLines.length - 1) * 34;
    drawPackedRow(ctx, g.totalsLines, ccx, tTop, MACRO_GAP, 34);
  });
  if (groups.length > 0) cy += maxContent + 96;
  cy += 40;

  // Footer
  ctx.fillStyle = "rgba(205, 241, 75, 0.5)";
  ctx.fillRect(cx - 160, cy, 320, 3);
  cy += 44;
  ctx.fillStyle = DIM;
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Made with VERRAA  •  Ask your coach before swapping meals", cx, cy);
  ctx.textAlign = "left";

  return cv;
}

/* ---------------- public API ---------------- */

function slug(s: string): string {
  const clean = s.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return clean || "client";
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportDayImage(meta: ExportMeta, day: ExportDay): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* system fonts are fine */
  }
  const cv = renderDayCard(meta, day);
  // JPEG at high quality: visually identical poster, ~10x smaller than PNG.
  download(cv.toDataURL("image/jpeg", 0.9), `nutrition-${slug(meta.clientName)}-${slug(day.dayName)}.jpg`);
}

export async function exportWeekPdf(meta: ExportMeta, days: ExportDay[]): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* system fonts are fine */
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const PW = 210;
  const PH = 297;
  const M = 12;
  const maxW = PW - M * 2;
  const maxH = PH - M * 2;
  days.forEach((d, i) => {
    const cv = renderDayCard(meta, d);
    let w = maxW;
    let h = (w * cv.height) / cv.width;
    if (h > maxH) {
      h = maxH;
      w = (h * cv.width) / cv.height;
    }
    if (i > 0) pdf.addPage();
    // JPEG keeps a 7-page poster PDF around 1–2 MB instead of tens of MB.
    pdf.addImage(cv.toDataURL("image/jpeg", 0.82), "JPEG", M + (maxW - w) / 2, M, w, h);
  });
  pdf.save(`nutrition-plan-${slug(meta.clientName)}.pdf`);
}
