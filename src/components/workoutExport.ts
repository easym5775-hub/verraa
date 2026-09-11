/* ================================================================
   VERRAA — workout plan image/PDF export.
   Each plan day is drawn as a neon gym-poster card on a <canvas>
   (no DOM screenshots, so Tailwind v4 colors can't break it) and the
   pages are assembled into a multi-page A4 PDF with jsPDF — or
   downloaded as JPG.
   Visual language mirrors nutritionExport.ts on purpose:
   same backdrop, same neon title, same summary strip, same footer —
   only the card body lists exercises instead of meals.
   JPEG quality is tuned so a 7-page poster PDF stays ~1–2 MB.
   ================================================================ */

import { jsPDF } from "jspdf";

export interface WorkoutExportItem {
  name: string;
  category?: string;
  sets: number;
  reps: number;
  rest: number; // seconds, 0 = no rest
  notes?: string;
  hasVideo?: boolean;
}

export interface WorkoutExportDay {
  day: number;
  dayName: string;
  items: WorkoutExportItem[]; // pre-sorted (display order)
  totals: { exercises: number; sets: number; reps: number };
}

interface WorkoutExportMeta {
  clientName: string;
  coachName?: string;
  planName?: string;
}

/* ---------------- canvas helpers (same theme as nutrition) ---------------- */

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

const SKY = "#7DD3FC";
const WARN = "#FBBF24";

const CAT_COLORS: Record<string, string> = {
  Chest: "#FB7185",
  Back: "#38BDF8",
  Legs: "#FBBF24",
  Arms: "#FB923C",
  Core: "#CDF14B",
  Cardio: "#F87171",
};

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

interface BlockEx {
  nameLines: string[];
  metaLines: Seg[][];
  notes: string[];
  h: number;
}

// Card-safe type sizes — single full-width card, so names can be a touch
// bigger than nutrition's 4-column cards and still never overflow.
const EX_NAME_FONT = `800 34px ${FONT}`;
const EX_NAME_LH = 48;
const SETS_FONT = `800 27px ${FONT}`;
const DETAIL_FONT = `700 24px ${FONT}`;
const DETAIL_GAP = 20;
const DETAIL_LH = 36;
const NOTE_FONT = `italic 400 23px ${FONT}`;
const NOTE_LH = 32;
const TOTAL_FONT = `800 27px ${FONT}`;
const TITLE_FONT = `700 52px ${DISPLAY}`;
const TITLE_H = 56;
const TYPE_FONT = `700 26px ${FONT}`;
const TYPE_H = 36;
const DIV_H = 26;
const CARD_PAD_TOP = 44;
const CARD_PAD_BOTTOM = 40;

function renderDayCard(meta: WorkoutExportMeta, d: WorkoutExportDay): HTMLCanvasElement {
  const meas = document.createElement("canvas").getContext("2d")!;
  const cv = document.createElement("canvas");
  cv.width = W;
  const totals = d.totals;

  /* ---- layout model (measured once, drawn once) ---- */
  const innerW = CW - 96;
  const blocks: BlockEx[] = d.items.map((it, i) => {
    meas.font = EX_NAME_FONT;
    const nameLines = wrap(meas, `${i + 1}. ${it.name || "Exercise"}`, innerW);
    const segs: Seg[] = [
      { text: `${it.sets} × ${it.reps}`, font: SETS_FONT, color: "#FFFFFF" },
      { text: it.rest > 0 ? `${it.rest}s rest` : "no rest", font: DETAIL_FONT, color: DIM },
      ...(it.category
        ? [{ text: it.category, font: DETAIL_FONT, color: CAT_COLORS[it.category] ?? BODY } as Seg]
        : []),
      ...(it.hasVideo ? [{ text: "▶ video", font: DETAIL_FONT, color: DIM } as Seg] : []),
    ];
    const metaLines = packRow(meas, segs, innerW, DETAIL_GAP);
    meas.font = NOTE_FONT;
    const notes = it.notes ? wrap(meas, it.notes, innerW) : [];
    const bh =
      nameLines.length * EX_NAME_LH + 8 + metaLines.length * DETAIL_LH + notes.length * NOTE_LH + 34 + 28;
    return { nameLines, metaLines, notes, h: bh };
  });

  meas.font = TOTAL_FONT;
  const totalsLines = packRow(
    meas,
    [
      { text: `${totals.exercises} exercises`, font: TOTAL_FONT, color: VOLT },
      { text: `${totals.sets} sets`, font: DETAIL_FONT, color: BODY },
      { text: `${totals.reps} reps`, font: DETAIL_FONT, color: BODY },
    ],
    innerW,
    DETAIL_GAP,
  );
  const contentH =
    CARD_PAD_TOP + TITLE_H + TYPE_H + DIV_H + blocks.reduce((s, b) => s + b.h, 0) + totalsLines.length * 34 + 26 + CARD_PAD_BOTTOM;

  const hasItems = d.items.length > 0;
  const headerH = 448;
  const summaryH = hasItems ? 150 : 96;
  const cardsH = hasItems ? contentH : 210;
  const footerH = 110;
  cv.height = Math.ceil(70 + headerH + 8 + summaryH + 44 + cardsH + 40 + footerH + 70);

  /* ---- draw pass ---- */
  const ctx = cv.getContext("2d")!;
  // gym-night backdrop (identical to nutrition)
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
  neonTitle(ctx, "WORKOUT PLAN", cx, cy + 196, `700 152px ${DISPLAY}`);
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
    hasItems
      ? `${totals.exercises} exercises   •   ${totals.sets} sets   •   ${totals.reps} reps`
      : "Recovery day — no session programmed",
    cx,
    cy + 386,
  );
  ctx.textAlign = "left";
  cy += headerH + 8;

  // Stats strip (same 3-box rhythm as nutrition targets strip)
  if (hasItems) {
    const defs = [
      { label: "EXERCISES", value: String(totals.exercises), sub: "movements", color: VOLT },
      { label: "TOTAL SETS", value: String(totals.sets), sub: "working sets", color: SKY },
      { label: "TOTAL REPS", value: String(totals.reps), sub: "sets × reps", color: WARN },
    ];
    const bw = 330;
    const totalW = bw * 3 + 60 * 2;
    let bx = cx - totalW / 2;
    for (const c of defs) {
      ctx.fillStyle = DIM;
      ctx.font = `800 24px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(c.label, bx + bw / 2, cy + 28);
      ctx.fillStyle = c.color;
      ctx.font = `800 52px ${DISPLAY}`;
      ctx.fillText(c.value, bx + bw / 2, cy + 84);
      ctx.fillStyle = DIM;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(c.sub, bx + bw / 2, cy + 112);
      ctx.fillStyle = TRACK;
      rr(ctx, bx, cy + 124, bw, 12, 6);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = c.color;
      rr(ctx, bx, cy + 124, bw, 12, 6);
      ctx.fill();
      ctx.restore();
      bx += bw + 60;
    }
    ctx.textAlign = "left";
    cy += summaryH;
  } else {
    cy += summaryH;
  }
  cy += 44;

  // Session card
  if (!hasItems) {
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
    ctx.fillText("No exercises programmed — recovery & mobility", cx, cy + 158);
    ctx.textAlign = "left";
    cy += 210;
  } else {
    const x = PAD;
    const cardW = CW;
    const cardH = contentH;
    // neon frame (same as nutrition meal cards)
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
    neonTitle(ctx, "Exercises", ccx, ty + 44, TITLE_FONT);
    ty += TITLE_H;
    ctx.fillStyle = VOLT;
    ctx.font = TYPE_FONT;
    ctx.textAlign = "center";
    ctx.fillText(`${d.items.length} movement${d.items.length === 1 ? "" : "s"} • ${totals.sets} sets`, ccx, ty + 28, innerW);
    ctx.textAlign = "left";
    ty += TYPE_H;
    // divider
    ctx.fillStyle = HAIR;
    ctx.fillRect(x + 48, ty, cardW - 96, 2);
    ty += DIV_H;

    blocks.forEach((b, bi) => {
      ctx.fillStyle = BODY;
      ctx.font = EX_NAME_FONT;
      ctx.textAlign = "center";
      for (const ln of b.nameLines) {
        ctx.fillText(ln, ccx, ty + 36, innerW);
        ty += EX_NAME_LH;
      }
      ty += 8;
      drawPackedRow(ctx, b.metaLines, ccx, ty + 28, DETAIL_GAP, DETAIL_LH);
      ty += b.metaLines.length * DETAIL_LH;
      if (b.notes.length) {
        ctx.fillStyle = DIM;
        ctx.font = NOTE_FONT;
        for (const ln of b.notes) {
          ctx.fillText(ln, ccx, ty + 24, innerW);
          ty += NOTE_LH;
        }
      }
      ty += 34;
      // hair divider between exercises (not after the last one)
      if (bi < blocks.length - 1) {
        ctx.fillStyle = "rgba(205, 241, 75, 0.14)";
        ctx.fillRect(x + 60, ty, cardW - 120, 2);
        ty += 28;
      } else {
        ty += 6;
      }
    });
    // totals pinned near the bottom (wrapped, never overflowing)
    const tTop = cy + cardH - CARD_PAD_BOTTOM - (totalsLines.length - 1) * 34;
    drawPackedRow(ctx, totalsLines, ccx, tTop, DETAIL_GAP, 34);
    cy += cardH;
  }
  cy += 40;

  // Footer (identical to nutrition)
  ctx.fillStyle = "rgba(205, 241, 75, 0.5)";
  ctx.fillRect(cx - 160, cy, 320, 3);
  cy += 44;
  ctx.fillStyle = DIM;
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Made with VERRAA  •  Ask your coach before swapping exercises", cx, cy);
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

export async function exportWorkoutDayImage(meta: WorkoutExportMeta, day: WorkoutExportDay): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* system fonts are fine */
  }
  const cv = renderDayCard(meta, day);
  // JPEG at high quality: visually identical poster, ~10x smaller than PNG.
  download(cv.toDataURL("image/jpeg", 0.9), `workout-${slug(meta.clientName)}-${slug(day.dayName)}.jpg`);
}

export async function exportWorkoutWeekPdf(meta: WorkoutExportMeta, days: WorkoutExportDay[]): Promise<void> {
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
  pdf.save(`workout-plan-${slug(meta.clientName)}.pdf`);
}
