import { jsPDF } from 'jspdf';
import { CalendarConfig } from '../types/calendar';
import { ComputedCalendarLayout, ComputedCell, ComputedLabel, ComputedSpanSegment } from './calendarLayout';
import { measureTextWidthPx, wrapTextToLines } from './textWrap';

export function blendHexColors(baseHex: string, tintHex: string, strength: number): string {
  const s = Math.max(0, Math.min(1, strength));
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };
  const a = parse(baseHex);
  const b = parse(tintHex);
  const r = Math.round(a.r + (b.r - a.r) * s);
  const g = Math.round(a.g + (b.g - a.g) * s);
  const bl = Math.round(a.b + (b.b - a.b) * s);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getFontFamilyForRole(config: CalendarConfig, role: ComputedLabel['fontRole']): string {
  if (role === 'display') return `${config.typography.displayFont}, sans-serif`;
  if (role === 'mono') return `"JetBrains Mono", "Space Mono", monospace`;
  return `${config.typography.bodyFont}, sans-serif`;
}

function setCanvasLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in anyCtx) {
    anyCtx.letterSpacing = `${px.toFixed(2)}px`;
  }
}

function truncateTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '';
}

/**
 * Renders the full calendar layout (or a vertical slice starting at offsetYPx) onto a Canvas2D context.
 */
export function renderCalendarBandToCanvas(
  ctx: CanvasRenderingContext2D,
  layout: ComputedCalendarLayout,
  config: CalendarConfig,
  dpi: number,
  offsetYPx: number,
  bandHeightPx: number
) {
  const s = dpi; // 1 inch = dpi pixels
  const bandTopIn = offsetYPx / dpi;
  const bandBottomIn = (offsetYPx + bandHeightPx) / dpi;

  ctx.save();
  ctx.fillStyle = config.palette.paperBg;
  ctx.fillRect(0, 0, Math.round(layout.totalWidthIn * s), bandHeightPx);

  ctx.translate(0, -offsetYPx);

  const blendedWeekendBg = blendHexColors(
    config.palette.paperBg,
    config.palette.weekendBg,
    config.weekendTintStrength
  );

  // 1. Rectangles (paper bg, weekend tint strips/cells)
  for (const r of layout.rects) {
    if (r.y + r.h < bandTopIn || r.y > bandBottomIn) continue;
    if (r.fill) {
      ctx.fillStyle = r.fill === config.palette.weekendBg ? blendedWeekendBg : r.fill;
      ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
    }
    if (r.stroke && r.strokeWidthIn) {
      ctx.strokeStyle = r.stroke;
      ctx.lineWidth = r.strokeWidthIn * s;
      ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
    }
  }

  // 2. Cells (write lines, day numbers, holidays, events, moons)
  for (const cell of layout.cells) {
    if (cell.y + cell.h < bandTopIn || cell.y > bandBottomIn) continue;
    if (cell.isEmpty) continue;
    renderCellToCanvas(ctx, cell, config, s);
  }

  // 3. Structural Grid Lines
  for (const l of layout.lines) {
    const minY = Math.min(l.y1, l.y2);
    const maxY = Math.max(l.y1, l.y2);
    if (maxY + l.widthIn < bandTopIn || minY - l.widthIn > bandBottomIn) continue;
    ctx.beginPath();
    ctx.moveTo(l.x1 * s, l.y1 * s);
    ctx.lineTo(l.x2 * s, l.y2 * s);
    ctx.strokeStyle = l.color;
    ctx.lineWidth = Math.max(1, l.widthIn * s);
    ctx.stroke();
  }

  // 3b. Multi-day Spanning Event Ribbons (drawn above grid lines so text spans cleanly across cells)
  for (const seg of layout.spanSegments) {
    if (seg.y + seg.h < bandTopIn || seg.y > bandBottomIn) continue;
    renderSpanSegmentToCanvas(ctx, seg, config, s);
  }

  // 4. Labels (Headers, Months, Weekdays, Footers)
  for (const lbl of layout.labels) {
    if (lbl.y + lbl.h < bandTopIn || lbl.y - lbl.h > bandBottomIn) continue;
    const fontSizePx = lbl.fontSizeIn * s;
    const family = getFontFamilyForRole(config, lbl.fontRole);
    ctx.font = `${lbl.fontWeight} ${fontSizePx}px ${family}`;
    ctx.fillStyle = lbl.color;
    ctx.textAlign = lbl.align;
    ctx.textBaseline = lbl.baseline;
    if (lbl.letterSpacingEm) {
      setCanvasLetterSpacing(ctx, lbl.letterSpacingEm * fontSizePx);
    } else {
      setCanvasLetterSpacing(ctx, 0);
    }
    ctx.fillText(lbl.text, lbl.x * s, lbl.y * s);
  }

  // 5. Crop Marks
  for (const cm of layout.cropMarks) {
    const minY = Math.min(cm.y1, cm.y2);
    const maxY = Math.max(cm.y1, cm.y2);
    if (maxY + cm.widthIn < bandTopIn || minY - cm.widthIn > bandBottomIn) continue;
    ctx.beginPath();
    ctx.moveTo(cm.x1 * s, cm.y1 * s);
    ctx.lineTo(cm.x2 * s, cm.y2 * s);
    ctx.strokeStyle = cm.color;
    ctx.lineWidth = Math.max(1, cm.widthIn * s);
    ctx.stroke();
  }

  setCanvasLetterSpacing(ctx, 0);
  ctx.restore();
}

function renderCellToCanvas(
  ctx: CanvasRenderingContext2D,
  cell: ComputedCell,
  config: CalendarConfig,
  s: number
) {
  const padX = Math.min(cell.w * 0.09, 0.1) * s;
  const padY = Math.min(cell.h * 0.08, 0.09) * s;
  const cx = cell.x * s;
  const cy = cell.y * s;
  const cw = cell.w * s;
  const ch = cell.h * s;

  // Event or spanning full-cell fill highlight if flagged
  const filledEvent = cell.events.find((ev) => ev.fillCell);
  const fillHex = filledEvent?.color ?? cell.spanFillColor;
  if (fillHex) {
    ctx.fillStyle = hexToRgba(fillHex, 0.14);
    ctx.fillRect(cx, cy, cw, ch);
  }

  const numberFamily = config.typography.useMonoNumbers
    ? '"JetBrains Mono", monospace'
    : `${config.typography.bodyFont}, sans-serif`;
  const bodyFamily = `${config.typography.bodyFont}, sans-serif`;

  const dayColor = cell.holiday
    ? config.palette.holidayInk
    : cell.isWeekend
      ? config.palette.weekendInk
      : config.palette.inkPrimary;

  if (cell.styleVariant === 'vertical') {
    // Horizontal strip cell: [DayNum + Weekday] on left, event/holiday on right
    const fontSize = Math.min(ch * 0.48, cw * 0.12) * config.typography.dayNumberScale;
    const dayStr = String(cell.day ?? '');
    const wdStr = cell.weekdayLabel.slice(0, 3).toUpperCase();

    ctx.font = `700 ${fontSize}px ${numberFamily}`;
    ctx.fillStyle = dayColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    setCanvasLetterSpacing(ctx, 0);
    ctx.fillText(dayStr, cx + padX, cy + ch * 0.5);

    const dayWidth = ctx.measureText('31').width;
    const wdFontSize = fontSize * 0.68;
    ctx.font = `600 ${wdFontSize}px ${bodyFamily}`;
    ctx.fillStyle = cell.isWeekend ? config.palette.accent : config.palette.inkMuted;
    ctx.fillText(wdStr, cx + padX + dayWidth + padX * 0.55, cy + ch * 0.51);

    const metaStartX = cx + padX + dayWidth + ctx.measureText('WED').width + padX * 1.4;
    let rightCursorX = cx + cw - padX;

    if (cell.moonPhase) {
      const r = Math.min(ch * 0.13, 0.045 * s);
      drawMoonCanvas(ctx, rightCursorX - r, cy + ch * 0.5, r, cell.moonPhase, config.palette.inkMuted);
      rightCursorX -= r * 2.8;
    }

    if (cell.isoWeek !== null) {
      const wkSize = fontSize * 0.62;
      ctx.font = `500 ${wkSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = config.palette.inkMuted;
      ctx.textAlign = 'right';
      ctx.fillText(`W${cell.isoWeek}`, rightCursorX, cy + ch * 0.5);
      rightCursorX -= ctx.measureText('W52').width + padX * 0.7;
    }

    const availW = rightCursorX - metaStartX;
    if (availW > 0.2 * s && !cell.hasVerticalSpan) {
      const primaryEv = cell.events[0];
      if (primaryEv) {
        const barW = Math.max(2, 0.025 * s);
        const evFontSize = Math.min(fontSize * 0.72, ch * 0.38);
        const lineH = evFontSize * 1.18;
        const maxLines = Math.max(1, Math.min(2, Math.floor((ch - padY * 0.6) / lineH)));
        const textAvail = availW - barW - padX * 0.5;
        ctx.font = `600 ${evFontSize}px ${bodyFamily}`;
        const lines = wrapTextToLines(primaryEv.title, textAvail, maxLines, (str) =>
          ctx.measureText(str).width
        );
        const blockH = lines.length * lineH;
        const startY = cy + (ch - blockH) * 0.5;
        ctx.fillStyle = primaryEv.color;
        ctx.fillRect(metaStartX, cy + ch * 0.18, barW, ch * 0.64);
        ctx.fillStyle = config.palette.inkPrimary;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((ln, idx) => {
          ctx.fillText(ln, metaStartX + barW + padX * 0.45, startY + idx * lineH);
        });
      } else if (cell.holiday) {
        ctx.font = `500 ${fontSize * 0.68}px ${bodyFamily}`;
        ctx.fillStyle = config.palette.holidayInk;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const txt = truncateTextToWidth(ctx, cell.holiday, availW);
        ctx.fillText(txt, metaStartX, cy + ch * 0.5);
      }
    }
    return;
  }

  // Matrix or Block cell
  const baseScale = cell.styleVariant === 'matrix'
    ? Math.min(cw * 0.34, ch * 0.22)
    : Math.min(cw * 0.22, ch * 0.24);
  const numFontSize = Math.max(4, baseScale * config.typography.dayNumberScale);

  // Writeable ruled lines inside empty lower portion of cell
  if (config.showWriteLines && ch > 0.35 * s) {
    const lineCount = config.writeLineCount;
    const topZone = padY + numFontSize * 1.35;
    const bottomZone = ch - padY * 0.9;
    const space = bottomZone - topZone;
    if (space > 0.15 * s && lineCount > 0) {
      ctx.save();
      ctx.strokeStyle = hexToRgba(config.palette.gridRule, 0.55);
      ctx.lineWidth = Math.max(0.75, 0.006 * s);
      for (let i = 1; i <= lineCount; i++) {
        const ly = topZone + (space / lineCount) * i;
        ctx.beginPath();
        ctx.moveTo(cx + padX, cy + ly);
        ctx.lineTo(cx + cw - padX, cy + ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Day Number
  ctx.font = `700 ${numFontSize}px ${numberFamily}`;
  ctx.fillStyle = dayColor;
  setCanvasLetterSpacing(ctx, 0);

  const align = config.typography.dayNumberAlign;
  let numX = cx + padX;
  let numY = cy + padY;
  ctx.textBaseline = 'top';
  if (align === 'top-left') {
    ctx.textAlign = 'left';
    numX = cx + padX;
  } else if (align === 'top-right') {
    ctx.textAlign = 'right';
    numX = cx + cw - padX;
  } else {
    ctx.textAlign = 'center';
    numX = cx + cw * 0.5;
  }
  ctx.fillText(String(cell.day ?? ''), numX, numY);

  // Optional weekday label in day-matrix cells
  if (cell.showWeekdayInCell) {
    const wdSize = numFontSize * 0.54;
    ctx.font = `600 ${wdSize}px ${bodyFamily}`;
    ctx.fillStyle = cell.isWeekend ? config.palette.accent : config.palette.inkMuted;
    ctx.textBaseline = 'top';
    if (align === 'top-left') {
      ctx.textAlign = 'right';
      ctx.fillText(cell.weekdayLabel.slice(0, 3).toUpperCase(), cx + cw - padX, cy + padY + numFontSize * 0.18);
    } else if (align === 'top-right') {
      ctx.textAlign = 'left';
      ctx.fillText(cell.weekdayLabel.slice(0, 3).toUpperCase(), cx + padX, cy + padY + numFontSize * 0.18);
    }
  }

  // Moon phase marker
  if (cell.moonPhase && !cell.showWeekdayInCell) {
    const r = Math.max(1.5, Math.min(numFontSize * 0.24, 0.042 * s));
    const moonX = align === 'top-right' ? cx + padX + r : cx + cw - padX - r;
    const moonY = cy + padY + numFontSize * 0.45;
    drawMoonCanvas(ctx, moonX, moonY, r, cell.moonPhase, config.palette.inkMuted);
  }

  // Optional Day-of-Year or ISO week badge
  if (cell.dayOfYear !== null || cell.isoWeek !== null) {
    const microSize = Math.max(3.5, numFontSize * 0.46);
    ctx.font = `500 ${microSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = config.palette.inkMuted;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    const badge = cell.isoWeek !== null ? `W${cell.isoWeek}` : `#${String(cell.dayOfYear).padStart(3, '0')}`;
    ctx.fillText(badge, cx + cw - padX, cy + ch - padY * 0.6);
  }

  // Holiday & Events stack (offset cleanly below any spanning ribbons in this cell)
  let cursorY = cy + padY + numFontSize * 1.18 + cell.reservedTopIn * s;
  const maxCursorY = cy + ch - padY * 0.7;
  const lineFontSize = Math.max(4, Math.min(numFontSize * 0.58, cw * 0.13));
  const lineStep = lineFontSize * 1.24;

  if (cell.holiday && cursorY + lineFontSize <= maxCursorY) {
    const holFontSize = lineFontSize * 0.92;
    const holStep = holFontSize * 1.22;
    const availLines = Math.max(1, Math.floor((maxCursorY - cursorY) / holStep));
    ctx.font = `600 ${holFontSize}px ${bodyFamily}`;
    ctx.fillStyle = config.palette.holidayInk;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const holLines = wrapTextToLines(cell.holiday, cw - padX * 2, Math.min(2, availLines), (str) =>
      ctx.measureText(str).width
    );
    holLines.forEach((ln, idx) => {
      ctx.fillText(ln, cx + padX, cursorY + idx * holStep);
    });
    cursorY += holLines.length * holStep + lineFontSize * 0.2;
  }

  for (const ev of cell.events) {
    if (cursorY + lineFontSize > maxCursorY) break;
    const barW = Math.max(2, 0.025 * s);
    const textAvail = cw - padX * 2 - barW - padX * 0.4;
    const remainLines = Math.max(1, Math.floor((maxCursorY - cursorY) / lineStep));
    ctx.font = `600 ${lineFontSize}px ${bodyFamily}`;
    const evLines = wrapTextToLines(ev.title, textAvail, remainLines, (str) =>
      ctx.measureText(str).width
    );
    if (evLines.length === 0) continue;

    const blockH = evLines.length * lineStep;
    ctx.fillStyle = ev.color;
    ctx.fillRect(cx + padX, cursorY, barW, blockH);
    ctx.fillStyle = config.palette.inkPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    evLines.forEach((ln, idx) => {
      ctx.fillText(ln, cx + padX + barW + padX * 0.4, cursorY + idx * lineStep + lineFontSize * 0.06);
    });
    cursorY += blockH + lineFontSize * 0.3;
  }
}

function renderSpanSegmentToCanvas(
  ctx: CanvasRenderingContext2D,
  seg: ComputedSpanSegment,
  config: CalendarConfig,
  s: number
) {
  const sx = seg.x * s;
  const sy = seg.y * s;
  const sw = seg.w * s;
  const sh = seg.h * s;
  const barW = Math.max(2, 0.03 * s);
  const fontSizePx = seg.fontSizeIn * s;
  const lineHPx = seg.lineHeightIn * s;
  const bodyFamily = `${config.typography.bodyFont}, sans-serif`;

  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();

  // Opaque blended ribbon backing so vertical cell dividers don't cut through spanning text
  ctx.fillStyle = blendHexColors(config.palette.paperBg, seg.color, 0.14);
  ctx.fillRect(sx, sy, sw, sh);

  // Crisp left accent bar
  ctx.fillStyle = seg.color;
  ctx.fillRect(sx, sy, barW, sh);

  ctx.font = `600 ${fontSizePx}px ${bodyFamily}`;
  ctx.fillStyle = config.palette.inkPrimary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  setCanvasLetterSpacing(ctx, 0);

  const textPadX = barW + Math.max(4, fontSizePx * 0.45);
  const totalTextH = seg.lines.length * lineHPx;
  const startY =
    seg.orientation === 'vertical'
      ? sy + Math.max(fontSizePx * 0.35, (sh - totalTextH) * 0.5)
      : sy + Math.max(fontSizePx * 0.15, (sh - totalTextH) * 0.52);

  seg.lines.forEach((ln, idx) => {
    ctx.fillText(ln, sx + textPadX, startY + idx * lineHPx);
  });

  ctx.restore();
}

function drawMoonCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: 'new' | 'full',
  color: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (phase === 'new') {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- CRC32 & Pure Strip-Based PNG Encoder (supports 12,000+ px width & 300 DPI pHYs metadata) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const view = new DataView(out.buffer);
  view.setUint32(0, len, false);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  view.setUint32(8 + len, crc, false);
  return out;
}

export async function exportHighResPNG(
  layout: ComputedCalendarLayout,
  config: CalendarConfig,
  dpi: number,
  onProgress?: (pct: number, label: string) => void
): Promise<Blob> {
  await document.fonts.ready;

  const width = Math.round(layout.totalWidthIn * dpi);
  const height = Math.round(layout.totalHeightIn * dpi);

  // Strip-based streaming PNG encoder using native CompressionStream('deflate')
  if (typeof CompressionStream !== 'undefined') {
    const stripHeight = Math.min(600, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = stripHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Unable to initialize 2D rendering context.');

    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    const compressedChunks: Uint8Array[] = [];
    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) compressedChunks.push(value);
      }
    })();

    const rowByteLen = 1 + width * 3;
    const writePromise = (async () => {
      for (let y = 0; y < height; y += stripHeight) {
        const curH = Math.min(stripHeight, height - y);
        renderCalendarBandToCanvas(ctx, layout, config, dpi, y, curH);
        const imgData = ctx.getImageData(0, 0, width, curH).data;
        const rawBand = new Uint8Array(curH * rowByteLen);

        for (let row = 0; row < curH; row++) {
          const dstStart = row * rowByteLen;
          rawBand[dstStart] = 0; // PNG filter type 0 (None)
          let srcIdx = row * width * 4;
          let dstIdx = dstStart + 1;
          for (let x = 0; x < width; x++) {
            rawBand[dstIdx++] = imgData[srcIdx++];
            rawBand[dstIdx++] = imgData[srcIdx++];
            rawBand[dstIdx++] = imgData[srcIdx++];
            srcIdx++; // skip alpha
          }
        }

        await writer.write(rawBand);
        onProgress?.(Math.min(92, Math.round(((y + curH) / height) * 90)), `Rendering ${width.toLocaleString()} × ${height.toLocaleString()} px…`);
        // Yield to UI event loop
        await new Promise((r) => setTimeout(r, 0));
      }
      await writer.close();
    })();

    await Promise.all([readPromise, writePromise]);
    onProgress?.(95, 'Packaging 300 DPI PNG metadata…');

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, height, false);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 2; // RGB color
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;
    const ihdrChunk = makePngChunk('IHDR', ihdrData);

    // pHYs chunk: embed exact DPI (pixels per meter)
    const ppm = Math.round(dpi / 0.0254);
    const physData = new Uint8Array(9);
    const physView = new DataView(physData.buffer);
    physView.setUint32(0, ppm, false);
    physView.setUint32(4, ppm, false);
    physData[8] = 1; // meters
    const physChunk = makePngChunk('pHYs', physData);

    const idatChunks: Uint8Array[] = [];
    for (const c of compressedChunks) {
      idatChunks.push(makePngChunk('IDAT', c));
    }
    const iendChunk = makePngChunk('IEND', new Uint8Array(0));

    onProgress?.(100, 'Complete');
    const blobParts: BlobPart[] = [
      signature.buffer as ArrayBuffer,
      ihdrChunk.buffer as ArrayBuffer,
      physChunk.buffer as ArrayBuffer,
      ...idatChunks.map((u) => u.buffer as ArrayBuffer),
      iendChunk.buffer as ArrayBuffer,
    ];
    return new Blob(blobParts, { type: 'image/png' });
  }

  // Fallback for environments without CompressionStream
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Unable to initialize canvas.');
  renderCalendarBandToCanvas(ctx, layout, config, dpi, 0, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed.'));
    }, 'image/png');
  });
}

/**
 * Generates an exact-inch Print-Ready PDF (up to 40" wide at 300 DPI) using tiled strips.
 */
export async function exportPrintPDF(
  layout: ComputedCalendarLayout,
  config: CalendarConfig,
  dpi: number,
  onProgress?: (pct: number, label: string) => void
): Promise<Blob> {
  await document.fonts.ready;

  const wIn = layout.totalWidthIn;
  const hIn = layout.totalHeightIn;
  const widthPx = Math.round(wIn * dpi);
  const heightPx = Math.round(hIn * dpi);

  const pdf = new jsPDF({
    orientation: wIn >= hIn ? 'landscape' : 'portrait',
    unit: 'in',
    format: [wIn, hIn],
    compress: true,
  });

  const stripHeightPx = Math.min(1200, heightPx);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = stripHeightPx;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Unable to initialize PDF render canvas.');

  for (let y = 0; y < heightPx; y += stripHeightPx) {
    const curH = Math.min(stripHeightPx, heightPx - y);
    if (canvas.height !== curH) canvas.height = curH;
    renderCalendarBandToCanvas(ctx, layout, config, dpi, y, curH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
    const yIn = y / dpi;
    const hStripIn = curH / dpi;
    pdf.addImage(dataUrl, 'JPEG', 0, yIn, wIn, hStripIn, undefined, 'FAST');

    onProgress?.(
      Math.min(95, Math.round(((y + curH) / heightPx) * 92)),
      `Compiling PDF strip ${Math.floor(y / stripHeightPx) + 1}…`
    );
    await new Promise((r) => setTimeout(r, 0));
  }

  onProgress?.(100, 'PDF Ready');
  return pdf.output('blob');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an infinitely scalable Vector SVG in exact physical inches (72 pt/in).
 */
export function exportVectorSVG(layout: ComputedCalendarLayout, config: CalendarConfig): Blob {
  const pt = 72; // 1 inch = 72 user units (points)
  const wPt = (layout.totalWidthIn * pt).toFixed(2);
  const hPt = (layout.totalHeightIn * pt).toFixed(2);
  const blendedWeekendBg = blendHexColors(
    config.palette.paperBg,
    config.palette.weekendBg,
    config.weekendTintStrength
  );

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.totalWidthIn}in" height="${layout.totalHeightIn}in" viewBox="0 0 ${wPt} ${hPt}">`
  );

  // Rects
  for (const r of layout.rects) {
    const fill = r.fill === config.palette.weekendBg ? blendedWeekendBg : r.fill;
    parts.push(
      `<rect x="${(r.x * pt).toFixed(2)}" y="${(r.y * pt).toFixed(2)}" width="${(r.w * pt).toFixed(2)}" height="${(r.h * pt).toFixed(2)}" fill="${fill ?? 'none'}" />`
    );
  }

  // Clip paths for cells & span segments
  parts.push('<defs>');
  for (const cell of layout.cells) {
    if (cell.isEmpty) continue;
    parts.push(
      `<clipPath id="svg-clip-${escapeXml(cell.id)}"><rect x="${(cell.x * pt).toFixed(2)}" y="${(cell.y * pt).toFixed(2)}" width="${(cell.w * pt).toFixed(2)}" height="${(cell.h * pt).toFixed(2)}" /></clipPath>`
    );
  }
  for (const seg of layout.spanSegments) {
    parts.push(
      `<clipPath id="svg-clip-seg-${escapeXml(seg.id)}"><rect x="${(seg.x * pt).toFixed(2)}" y="${(seg.y * pt).toFixed(2)}" width="${(seg.w * pt).toFixed(2)}" height="${(seg.h * pt).toFixed(2)}" /></clipPath>`
    );
  }
  parts.push('</defs>');

  // Cells
  for (const cell of layout.cells) {
    if (cell.isEmpty) continue;
    const padX = Math.min(cell.w * 0.09, 0.1) * pt;
    const padY = Math.min(cell.h * 0.08, 0.09) * pt;
    const cx = cell.x * pt;
    const cy = cell.y * pt;
    const cw = cell.w * pt;
    const ch = cell.h * pt;

    parts.push(`<g clip-path="url(#svg-clip-${escapeXml(cell.id)})">`);

    const filledEvent = cell.events.find((ev) => ev.fillCell);
    const fillHex = filledEvent?.color ?? cell.spanFillColor;
    if (fillHex) {
      parts.push(
        `<rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${fillHex}" fill-opacity="0.14" />`
      );
    }

    const dayColor = cell.holiday
      ? config.palette.holidayInk
      : cell.isWeekend
        ? config.palette.weekendInk
        : config.palette.inkPrimary;
    const numberFamily = config.typography.useMonoNumbers
      ? 'JetBrains Mono, monospace'
      : `${config.typography.bodyFont.replace(/"/g, '')}, sans-serif`;
    const bodyFamily = `${config.typography.bodyFont.replace(/"/g, '')}, sans-serif`;

    if (cell.styleVariant === 'vertical') {
      const fontSize = Math.min(ch * 0.48, cw * 0.12) * config.typography.dayNumberScale;
      parts.push(
        `<text x="${(cx + padX).toFixed(2)}" y="${(cy + ch * 0.5).toFixed(2)}" font-family="${escapeXml(numberFamily)}" font-size="${fontSize.toFixed(2)}" font-weight="700" fill="${dayColor}" dominant-baseline="central">${cell.day}</text>`
      );
      parts.push(
        `<text x="${(cx + padX + fontSize * 1.45).toFixed(2)}" y="${(cy + ch * 0.5).toFixed(2)}" font-family="${escapeXml(bodyFamily)}" font-size="${(fontSize * 0.68).toFixed(2)}" font-weight="600" fill="${cell.isWeekend ? config.palette.accent : config.palette.inkMuted}" dominant-baseline="central">${cell.weekdayLabel.slice(0, 3).toUpperCase()}</text>`
      );
      if (!cell.hasVerticalSpan) {
        if (cell.events[0]) {
          const evFontSize = Math.min(fontSize * 0.72, ch * 0.38);
          const lineH = evFontSize * 1.18;
          const maxLines = Math.max(1, Math.min(2, Math.floor((ch - padY * 0.6) / lineH)));
          const metaStartX = cx + padX + fontSize * 3.8;
          const availW = Math.max(10, cx + cw - padX - metaStartX - 6);
          const fontSpec = `600 ${evFontSize}px ${config.typography.bodyFont}, sans-serif`;
          const evLines = wrapTextToLines(cell.events[0].title, availW, maxLines, (s) =>
            measureTextWidthPx(s, fontSpec)
          );
          const startY = cy + (ch - evLines.length * lineH) * 0.5;
          parts.push(
            `<rect x="${metaStartX.toFixed(2)}" y="${(cy + ch * 0.18).toFixed(2)}" width="2" height="${(ch * 0.64).toFixed(2)}" fill="${cell.events[0].color}" />`
          );
          evLines.forEach((ln, idx) => {
            parts.push(
              `<text x="${(metaStartX + 6).toFixed(2)}" y="${(startY + idx * lineH).toFixed(2)}" font-family="${escapeXml(bodyFamily)}" font-size="${evFontSize.toFixed(2)}" font-weight="600" fill="${config.palette.inkPrimary}" dominant-baseline="hanging">${escapeXml(ln)}</text>`
            );
          });
        } else if (cell.holiday) {
          parts.push(
            `<text x="${(cx + padX + fontSize * 3.8).toFixed(2)}" y="${(cy + ch * 0.5).toFixed(2)}" font-family="${escapeXml(bodyFamily)}" font-size="${(fontSize * 0.68).toFixed(2)}" font-weight="500" fill="${config.palette.holidayInk}" dominant-baseline="central">${escapeXml(cell.holiday)}</text>`
          );
        }
      }
      parts.push('</g>');
      continue;
    }

    const baseScale = cell.styleVariant === 'matrix'
      ? Math.min(cw * 0.34, ch * 0.22)
      : Math.min(cw * 0.22, ch * 0.24);
    const numFontSize = Math.max(4, baseScale * config.typography.dayNumberScale);

    if (config.showWriteLines && ch > 0.35 * pt) {
      const lineCount = config.writeLineCount;
      const topZone = padY + numFontSize * 1.35;
      const bottomZone = ch - padY * 0.9;
      const space = bottomZone - topZone;
      if (space > 0.15 * pt && lineCount > 0) {
        for (let i = 1; i <= lineCount; i++) {
          const ly = cy + topZone + (space / lineCount) * i;
          parts.push(
            `<line x1="${(cx + padX).toFixed(2)}" y1="${ly.toFixed(2)}" x2="${(cx + cw - padX).toFixed(2)}" y2="${ly.toFixed(2)}" stroke="${config.palette.gridRule}" stroke-opacity="0.55" stroke-width="0.5" />`
          );
        }
      }
    }

    const align = config.typography.dayNumberAlign;
    const anchor = align === 'top-left' ? 'start' : align === 'top-right' ? 'end' : 'middle';
    const numX = align === 'top-left' ? cx + padX : align === 'top-right' ? cx + cw - padX : cx + cw * 0.5;
    parts.push(
      `<text x="${numX.toFixed(2)}" y="${(cy + padY).toFixed(2)}" text-anchor="${anchor}" dominant-baseline="hanging" font-family="${escapeXml(numberFamily)}" font-size="${numFontSize.toFixed(2)}" font-weight="700" fill="${dayColor}">${cell.day}</text>`
    );

    if (cell.showWeekdayInCell && align !== 'center') {
      const wdX = align === 'top-left' ? cx + cw - padX : cx + padX;
      const wdAnchor = align === 'top-left' ? 'end' : 'start';
      parts.push(
        `<text x="${wdX.toFixed(2)}" y="${(cy + padY + numFontSize * 0.16).toFixed(2)}" text-anchor="${wdAnchor}" dominant-baseline="hanging" font-family="${escapeXml(bodyFamily)}" font-size="${(numFontSize * 0.54).toFixed(2)}" font-weight="600" fill="${cell.isWeekend ? config.palette.accent : config.palette.inkMuted}">${cell.weekdayLabel.slice(0, 3).toUpperCase()}</text>`
      );
    }

    if (cell.moonPhase && !cell.showWeekdayInCell) {
      const r = Math.max(1.5, Math.min(numFontSize * 0.24, 0.042 * pt));
      const moonX = align === 'top-right' ? cx + padX + r : cx + cw - padX - r;
      const moonY = cy + padY + numFontSize * 0.45;
      parts.push(
        cell.moonPhase === 'new'
          ? `<circle cx="${moonX.toFixed(2)}" cy="${moonY.toFixed(2)}" r="${r.toFixed(2)}" fill="${config.palette.inkMuted}" />`
          : `<circle cx="${moonX.toFixed(2)}" cy="${moonY.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${config.palette.inkMuted}" stroke-width="${(r * 0.35).toFixed(2)}" />`
      );
    }

    if (cell.dayOfYear !== null || cell.isoWeek !== null) {
      const badge = cell.isoWeek !== null ? `W${cell.isoWeek}` : `#${String(cell.dayOfYear).padStart(3, '0')}`;
      parts.push(
        `<text x="${(cx + cw - padX).toFixed(2)}" y="${(cy + ch - padY * 0.6).toFixed(2)}" text-anchor="end" dominant-baseline="ideographic" font-family="JetBrains Mono, monospace" font-size="${Math.max(3.5, numFontSize * 0.46).toFixed(2)}" font-weight="500" fill="${config.palette.inkMuted}">${badge}</text>`
      );
    }

    let cursorY = cy + padY + numFontSize * 1.18 + cell.reservedTopIn * pt;
    const maxCursorY = cy + ch - padY * 0.7;
    const lineSize = Math.max(4, Math.min(numFontSize * 0.58, cw * 0.13));
    const lineStep = lineSize * 1.24;

    if (cell.holiday && cursorY + lineSize <= maxCursorY) {
      const holSize = lineSize * 0.92;
      const holStep = holSize * 1.22;
      const availLines = Math.max(1, Math.min(2, Math.floor((maxCursorY - cursorY) / holStep)));
      const fontSpec = `600 ${holSize}px ${config.typography.bodyFont}, sans-serif`;
      const holLines = wrapTextToLines(cell.holiday, cw - padX * 2, availLines, (s) =>
        measureTextWidthPx(s, fontSpec)
      );
      holLines.forEach((ln, idx) => {
        parts.push(
          `<text x="${(cx + padX).toFixed(2)}" y="${(cursorY + idx * holStep).toFixed(2)}" dominant-baseline="hanging" font-family="${escapeXml(bodyFamily)}" font-size="${holSize.toFixed(2)}" font-weight="600" fill="${config.palette.holidayInk}">${escapeXml(ln)}</text>`
        );
      });
      cursorY += holLines.length * holStep + lineSize * 0.2;
    }

    for (const ev of cell.events) {
      if (cursorY + lineSize > maxCursorY) break;
      const barW = Math.max(1.8, 0.025 * pt);
      const textAvail = cw - padX * 2 - barW - padX * 0.4;
      const remainLines = Math.max(1, Math.floor((maxCursorY - cursorY) / lineStep));
      const fontSpec = `600 ${lineSize}px ${config.typography.bodyFont}, sans-serif`;
      const evLines = wrapTextToLines(ev.title, textAvail, remainLines, (s) =>
        measureTextWidthPx(s, fontSpec)
      );
      if (evLines.length === 0) continue;
      const blockH = evLines.length * lineStep;
      parts.push(
        `<rect x="${(cx + padX).toFixed(2)}" y="${cursorY.toFixed(2)}" width="${barW.toFixed(2)}" height="${blockH.toFixed(2)}" fill="${ev.color}" />`
      );
      evLines.forEach((ln, idx) => {
        parts.push(
          `<text x="${(cx + padX + barW + padX * 0.4).toFixed(2)}" y="${(cursorY + idx * lineStep + lineSize * 0.06).toFixed(2)}" dominant-baseline="hanging" font-family="${escapeXml(bodyFamily)}" font-size="${lineSize.toFixed(2)}" font-weight="600" fill="${config.palette.inkPrimary}">${escapeXml(ln)}</text>`
        );
      });
      cursorY += blockH + lineSize * 0.3;
    }
    parts.push('</g>');
  }

  // Grid lines
  for (const l of layout.lines) {
    parts.push(
      `<line x1="${(l.x1 * pt).toFixed(2)}" y1="${(l.y1 * pt).toFixed(2)}" x2="${(l.x2 * pt).toFixed(2)}" y2="${(l.y2 * pt).toFixed(2)}" stroke="${l.color}" stroke-width="${Math.max(0.4, l.widthIn * pt).toFixed(2)}" />`
    );
  }

  // Multi-day Spanning Event Ribbons
  for (const seg of layout.spanSegments) {
    const sx = seg.x * pt;
    const sy = seg.y * pt;
    const sw = seg.w * pt;
    const sh = seg.h * pt;
    const barW = Math.max(1.8, 0.03 * pt);
    const fontSizePt = seg.fontSizeIn * pt;
    const lineHPt = seg.lineHeightIn * pt;
    const bodyFamily = `${config.typography.bodyFont.replace(/"/g, '')}, sans-serif`;
    const ribbonBg = blendHexColors(config.palette.paperBg, seg.color, 0.14);
    const textPadX = barW + Math.max(4, fontSizePt * 0.45);
    const totalTextH = seg.lines.length * lineHPt;
    const startY =
      seg.orientation === 'vertical'
        ? sy + Math.max(fontSizePt * 0.35, (sh - totalTextH) * 0.5)
        : sy + Math.max(fontSizePt * 0.15, (sh - totalTextH) * 0.52);

    parts.push(`<g clip-path="url(#svg-clip-seg-${escapeXml(seg.id)})">`);
    parts.push(
      `<rect x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" width="${sw.toFixed(2)}" height="${sh.toFixed(2)}" fill="${ribbonBg}" />`
    );
    parts.push(
      `<rect x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" width="${barW.toFixed(2)}" height="${sh.toFixed(2)}" fill="${seg.color}" />`
    );
    seg.lines.forEach((ln, idx) => {
      parts.push(
        `<text x="${(sx + textPadX).toFixed(2)}" y="${(startY + idx * lineHPt).toFixed(2)}" dominant-baseline="hanging" font-family="${escapeXml(bodyFamily)}" font-size="${fontSizePt.toFixed(2)}" font-weight="600" fill="${config.palette.inkPrimary}">${escapeXml(ln)}</text>`
      );
    });
    parts.push('</g>');
  }

  // Labels
  for (const lbl of layout.labels) {
    const family = getFontFamilyForRole(config, lbl.fontRole).replace(/"/g, '');
    const anchor = lbl.align === 'left' ? 'start' : lbl.align === 'right' ? 'end' : 'middle';
    const base = lbl.baseline === 'top' ? 'hanging' : lbl.baseline === 'bottom' ? 'ideographic' : 'central';
    parts.push(
      `<text x="${(lbl.x * pt).toFixed(2)}" y="${(lbl.y * pt).toFixed(2)}" text-anchor="${anchor}" dominant-baseline="${base}" font-family="${escapeXml(family)}" font-size="${(lbl.fontSizeIn * pt).toFixed(2)}" font-weight="${lbl.fontWeight}" fill="${lbl.color}">${escapeXml(lbl.text)}</text>`
    );
  }

  // Crop marks
  for (const cm of layout.cropMarks) {
    parts.push(
      `<line x1="${(cm.x1 * pt).toFixed(2)}" y1="${(cm.y1 * pt).toFixed(2)}" x2="${(cm.x2 * pt).toFixed(2)}" y2="${(cm.y2 * pt).toFixed(2)}" stroke="${cm.color}" stroke-width="${(cm.widthIn * pt).toFixed(2)}" />`
    );
  }

  parts.push(`</svg>`);
  return new Blob(parts, { type: 'image/svg+xml;charset=utf-8' });
}
