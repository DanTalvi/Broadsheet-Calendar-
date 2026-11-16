import { CalendarConfig, CalendarDayEvent, CalendarSpanEvent } from '../types/calendar';
import {
  formatDateKey,
  getDayOfWeek,
  getDayOfYear,
  getDaysInMonth,
  getISOWeekNumber,
  getMajorMoonPhase,
  getOrderedWeekdays,
  getUSHolidaysForYear,
  MONTH_NAMES_FULL,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES_SHORT,
} from './calendarMath';
import { measureTextWidthPx, wrapTextToLines } from './textWrap';

export interface ComputedCell {
  id: string;
  stripId: string;
  x: number; // inches from sheet top-left (including bleed)
  y: number;
  w: number;
  h: number;
  monthIndex: number;
  day: number | null; // null for empty/padding cells
  dateKey: string | null;
  weekdayIndex: number | null; // 0=Sun..6=Sat
  weekdayLabel: string;
  isWeekend: boolean;
  isEmpty: boolean;
  isoWeek: number | null;
  dayOfYear: number | null;
  moonPhase: 'new' | 'full' | null;
  holiday: string | null;
  events: CalendarDayEvent[];
  spanFillColor: string | null;
  reservedTopIn: number;
  hasVerticalSpan: boolean;
  styleVariant: 'matrix' | 'vertical' | 'block';
  showWeekdayInCell: boolean;
}

export interface ComputedSpanSegment {
  id: string;
  eventId: string;
  title: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: 'horizontal' | 'vertical';
  fontSizeIn: number;
  lines: string[];
  lineHeightIn: number;
  startDateKey: string;
}

export interface ComputedLabel {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center' | 'right';
  baseline: 'top' | 'middle' | 'bottom';
  fontRole: 'display' | 'body' | 'mono';
  fontSizeIn: number;
  fontWeight: number;
  color: string;
  letterSpacingEm?: number;
  bgRect?: { x: number; y: number; w: number; h: number; color: string };
}

export interface ComputedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  widthIn: number;
  color: string;
}

export interface ComputedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidthIn?: number;
}

export interface ComputedCalendarLayout {
  totalWidthIn: number;
  totalHeightIn: number;
  trimX: number;
  trimY: number;
  trimW: number;
  trimH: number;
  contentX: number;
  contentY: number;
  contentW: number;
  contentH: number;
  strokeWidthIn: number;
  rects: ComputedRect[];
  lines: ComputedLine[];
  labels: ComputedLabel[];
  cells: ComputedCell[];
  spanSegments: ComputedSpanSegment[];
  cropMarks: ComputedLine[];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

interface MonthSlot {
  year: number;
  monthIndex: number;
}

function getMonthSlots(year: number, schoolYear: boolean): MonthSlot[] {
  if (!schoolYear) {
    return Array.from({ length: 12 }, (_, m) => ({ year, monthIndex: m }));
  }
  return Array.from({ length: 12 }, (_, idx) => {
    const monthIndex = (6 + idx) % 12;
    const slotYear = idx < 6 ? year : year + 1;
    return { year: slotYear, monthIndex };
  });
}

export function formatMonthName(
  monthIndex: number,
  style: CalendarConfig['typography']['monthCase'],
  yearSuffix?: number
): string {
  const base =
    style === 'abbr-upper'
      ? MONTH_NAMES_SHORT[monthIndex].toUpperCase()
      : style === 'uppercase'
        ? MONTH_NAMES_FULL[monthIndex].toUpperCase()
        : MONTH_NAMES_FULL[monthIndex];
  if (yearSuffix !== undefined) {
    return `${base} '${String(yearSuffix).slice(-2)}`;
  }
  return base;
}

export function getStrokeWidthIn(weight: CalendarConfig['typography']['gridStrokeWeight'], baseDimIn: number): number {
  // Base physical point-like scale adapted slightly for huge 40" wall prints
  const scale = clamp(baseDimIn / 32, 0.75, 1.35);
  switch (weight) {
    case 'none':
      return 0;
    case 'hairline':
      return 0.008 * scale;
    case 'crisp':
      return 0.015 * scale;
    case 'bold':
      return 0.028 * scale;
  }
}

export function computeCalendarLayout(config: CalendarConfig): ComputedCalendarLayout {
  const bleed = config.bleedIn;
  const trimW = config.widthIn;
  const trimH = config.heightIn;
  const totalWidthIn = trimW + bleed * 2;
  const totalHeightIn = trimH + bleed * 2;

  const trimX = bleed;
  const trimY = bleed;
  const contentX = trimX + config.marginIn;
  const contentY = trimY + config.marginIn;
  const contentW = Math.max(4, trimW - config.marginIn * 2);
  const contentH = Math.max(4, trimH - config.marginIn * 2);

  const minDim = Math.min(trimW, trimH);
  const strokeWidthIn = getStrokeWidthIn(config.typography.gridStrokeWeight, minDim);
  const holidays = config.showHolidays
    ? config.schoolYear
      ? { ...getUSHolidaysForYear(config.year), ...getUSHolidaysForYear(config.year + 1) }
      : getUSHolidaysForYear(config.year)
    : {};

  const { singleDayMap, multiDayEvents } = partitionEvents(config);

  const rects: ComputedRect[] = [];
  const lines: ComputedLine[] = [];
  const labels: ComputedLabel[] = [];
  const cells: ComputedCell[] = [];
  const cropMarks: ComputedLine[] = [];

  // Paper background
  rects.push({
    x: 0,
    y: 0,
    w: totalWidthIn,
    h: totalHeightIn,
    fill: config.palette.paperBg,
  });

  // Crop marks if bleed > 0 or explicitly enabled
  if (config.showCropMarks) {
    const markLen = Math.max(0.22, bleed > 0 ? bleed + 0.15 : 0.25);
    const markOffset = 0.06;
    const markColor = config.palette.inkMuted;
    const mw = 0.012;
    // Top-left
    cropMarks.push(
      { x1: trimX - markLen, y1: trimY, x2: trimX - markOffset, y2: trimY, widthIn: mw, color: markColor },
      { x1: trimX, y1: trimY - markLen, x2: trimX, y2: trimY - markOffset, widthIn: mw, color: markColor }
    );
    // Top-right
    cropMarks.push(
      { x1: trimX + trimW + markOffset, y1: trimY, x2: trimX + trimW + markLen, y2: trimY, widthIn: mw, color: markColor },
      { x1: trimX + trimW, y1: trimY - markLen, x2: trimX + trimW, y2: trimY - markOffset, widthIn: mw, color: markColor }
    );
    // Bottom-left
    cropMarks.push(
      { x1: trimX - markLen, y1: trimY + trimH, x2: trimX - markOffset, y2: trimY + trimH, widthIn: mw, color: markColor },
      { x1: trimX, y1: trimY + trimH + markOffset, x2: trimX, y2: trimY + trimH + markLen, widthIn: mw, color: markColor }
    );
    // Bottom-right
    cropMarks.push(
      { x1: trimX + trimW + markOffset, y1: trimY + trimH, x2: trimX + trimW + markLen, y2: trimY + trimH, widthIn: mw, color: markColor },
      { x1: trimX + trimW, y1: trimY + trimH + markOffset, x2: trimX + trimW, y2: trimY + trimH + markLen, widthIn: mw, color: markColor }
    );
  }

  // Header & Footer vertical allocation
  const headerH = config.showHeader
    ? clamp(trimH * 0.082 * config.typography.titleScale, 0.85, trimH * 0.18)
    : 0;
  const headerGap = config.showHeader ? clamp(trimH * 0.016, 0.18, 0.5) : 0;
  const footerH = config.showFooter ? clamp(trimH * 0.028, 0.35, 0.8) : 0;
  const footerGap = config.showFooter ? clamp(trimH * 0.012, 0.14, 0.36) : 0;

  if (config.showHeader) {
    const titleSize = clamp(headerH * 0.72, 0.42, 2.4);
    const subSize = clamp(headerH * 0.18, 0.11, 0.36);
    const defaultYearTitle = config.schoolYear ? `${config.year}–${config.year + 1}` : String(config.year);
    const titleText = config.title.trim() || defaultYearTitle;
    const subText = config.subtitle.trim();

    if (config.headerAlign === 'split') {
      labels.push({
        text: titleText,
        x: contentX,
        y: contentY + headerH * 0.5,
        w: contentW * 0.65,
        h: headerH,
        align: 'left',
        baseline: 'middle',
        fontRole: 'display',
        fontSizeIn: titleSize,
        fontWeight: config.typography.displayWeight,
        color: config.palette.inkPrimary,
        letterSpacingEm: 0.02 * config.typography.letterSpacingScale,
      });
      if (subText) {
        labels.push({
          text: subText,
          x: contentX + contentW,
          y: contentY + headerH * 0.54,
          w: contentW * 0.35,
          h: headerH,
          align: 'right',
          baseline: 'middle',
          fontRole: 'body',
          fontSizeIn: subSize,
          fontWeight: 600,
          color: config.palette.inkMuted,
          letterSpacingEm: 0.14 * config.typography.letterSpacingScale,
        });
      }
    } else if (config.headerAlign === 'center') {
      labels.push({
        text: titleText,
        x: contentX + contentW * 0.5,
        y: contentY + (subText ? headerH * 0.38 : headerH * 0.5),
        w: contentW,
        h: headerH * 0.7,
        align: 'center',
        baseline: 'middle',
        fontRole: 'display',
        fontSizeIn: titleSize * (subText ? 0.88 : 1),
        fontWeight: config.typography.displayWeight,
        color: config.palette.inkPrimary,
        letterSpacingEm: 0.03 * config.typography.letterSpacingScale,
      });
      if (subText) {
        labels.push({
          text: subText,
          x: contentX + contentW * 0.5,
          y: contentY + headerH * 0.84,
          w: contentW,
          h: headerH * 0.25,
          align: 'center',
          baseline: 'middle',
          fontRole: 'body',
          fontSizeIn: subSize * 0.92,
          fontWeight: 600,
          color: config.palette.inkMuted,
          letterSpacingEm: 0.16 * config.typography.letterSpacingScale,
        });
      }
    } else {
      // left
      labels.push({
        text: titleText,
        x: contentX,
        y: contentY + (subText ? headerH * 0.38 : headerH * 0.5),
        w: contentW,
        h: headerH * 0.7,
        align: 'left',
        baseline: 'middle',
        fontRole: 'display',
        fontSizeIn: titleSize * (subText ? 0.88 : 1),
        fontWeight: config.typography.displayWeight,
        color: config.palette.inkPrimary,
        letterSpacingEm: 0.02 * config.typography.letterSpacingScale,
      });
      if (subText) {
        labels.push({
          text: subText,
          x: contentX,
          y: contentY + headerH * 0.84,
          w: contentW,
          h: headerH * 0.25,
          align: 'left',
          baseline: 'middle',
          fontRole: 'body',
          fontSizeIn: subSize * 0.92,
          fontWeight: 600,
          color: config.palette.inkMuted,
          letterSpacingEm: 0.14 * config.typography.letterSpacingScale,
        });
      }
    }

    // Crisp structural rule under header
    lines.push({
      x1: contentX,
      y1: contentY + headerH + headerGap * 0.35,
      x2: contentX + contentW,
      y2: contentY + headerH + headerGap * 0.35,
      widthIn: Math.max(0.018, strokeWidthIn * 1.4),
      color: config.palette.inkPrimary,
    });
  }

  const gridX = contentX;
  const gridY = contentY + headerH + headerGap;
  const gridW = contentW;
  const gridH = Math.max(2, contentH - headerH - headerGap - footerH - footerGap);

  // Build specific layout
  if (config.layout === 'aligned-matrix') {
    buildAlignedMatrix(config, gridX, gridY, gridW, gridH, strokeWidthIn, holidays, singleDayMap, rects, lines, labels, cells);
  } else if (config.layout === 'day-matrix') {
    buildDayMatrix(config, gridX, gridY, gridW, gridH, strokeWidthIn, holidays, singleDayMap, rects, lines, labels, cells);
  } else if (config.layout === 'vertical-columns') {
    buildVerticalColumns(config, gridX, gridY, gridW, gridH, strokeWidthIn, holidays, singleDayMap, rects, lines, labels, cells);
  } else {
    const cols = config.layout === 'grid-6x2' ? 6 : config.layout === 'grid-3x4' ? 3 : 4;
    const rows = config.layout === 'grid-6x2' ? 2 : config.layout === 'grid-3x4' ? 4 : 3;
    buildBlockGrid(config, cols, rows, gridX, gridY, gridW, gridH, strokeWidthIn, holidays, singleDayMap, rects, lines, labels, cells);
  }

  const spanSegments = computeSpanSegments(cells, multiDayEvents, config);

  // Footer
  if (config.showFooter) {
    const footerY = contentY + contentH - footerH;
    const footFontSize = clamp(footerH * 0.36, 0.085, 0.17);
    const yearRangeLabel = config.schoolYear ? `${config.year}–${config.year + 1}` : String(config.year);
    const leftText = config.footerNote.trim() || `${yearRangeLabel} · ${trimW}" × ${trimH}"`;
    const keyParts: string[] = [];
    if (config.showMoonPhases) keyParts.push('● New Moon  ○ Full Moon');
    if (config.showHolidays) keyParts.push('Holidays Highlighted');
    const rightText = keyParts.join('   ·   ');

    lines.push({
      x1: contentX,
      y1: footerY + footerH * 0.15,
      x2: contentX + contentW,
      y2: footerY + footerH * 0.15,
      widthIn: Math.max(0.01, strokeWidthIn),
      color: config.palette.gridRule,
    });

    labels.push({
      text: leftText,
      x: contentX,
      y: footerY + footerH * 0.62,
      w: contentW * 0.6,
      h: footerH * 0.7,
      align: 'left',
      baseline: 'middle',
      fontRole: 'body',
      fontSizeIn: footFontSize,
      fontWeight: 500,
      color: config.palette.inkMuted,
      letterSpacingEm: 0.1 * config.typography.letterSpacingScale,
    });

    if (rightText) {
      labels.push({
        text: rightText,
        x: contentX + contentW,
        y: footerY + footerH * 0.62,
        w: contentW * 0.4,
        h: footerH * 0.7,
        align: 'right',
        baseline: 'middle',
        fontRole: 'body',
        fontSizeIn: footFontSize,
        fontWeight: 500,
        color: config.palette.inkMuted,
        letterSpacingEm: 0.06 * config.typography.letterSpacingScale,
      });
    }
  }

  return {
    totalWidthIn,
    totalHeightIn,
    trimX,
    trimY,
    trimW,
    trimH,
    contentX,
    contentY,
    contentW,
    contentH,
    strokeWidthIn,
    rects,
    lines,
    labels,
    cells,
    spanSegments,
    cropMarks,
  };
}

function buildAlignedMatrix(
  config: CalendarConfig,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  sw: number,
  holidays: Record<string, string>,
  singleDayMap: Record<string, CalendarDayEvent[]>,
  rects: ComputedRect[],
  lines: ComputedLine[],
  labels: ComputedLabel[],
  cells: ComputedCell[]
) {
  const slots = getMonthSlots(config.year, config.schoolYear);

  // Determine exact number of columns needed (between 35 and 37)
  let maxCol = 35;
  const monthOffsets: number[] = [];
  for (let i = 0; i < 12; i++) {
    const slot = slots[i];
    const firstDow = getDayOfWeek(slot.year, slot.monthIndex, 1);
    const offset = (firstDow - config.weekStart + 7) % 7;
    monthOffsets.push(offset);
    maxCol = Math.max(maxCol, offset + getDaysInMonth(slot.year, slot.monthIndex));
  }

  const labelRatio = config.typography.monthCase === 'abbr-upper'
    ? (config.schoolYear ? 0.068 : 0.058)
    : (config.schoolYear ? 0.094 : 0.082);
  const labelW = clamp(gw * labelRatio * config.typography.monthScale, 1.1, gw * 0.16);
  const headerH = clamp(gh * 0.032, 0.32, 0.65);
  const bodyX = gx + labelW;
  const bodyW = gw - labelW;
  const bodyY = gy + headerH;
  const bodyH = gh - headerH;

  const colW = bodyW / maxCol;
  const rowH = bodyH / 12;
  const orderedWeekdays = getOrderedWeekdays(config.weekStart, false);

  // Shade full weekend vertical strips first so empty cells in weekend cols keep architectural rhythm
  if (config.weekendTintStrength > 0) {
    for (let c = 0; c < maxCol; c++) {
      const dow = (config.weekStart + c) % 7;
      if (dow === 0 || dow === 6) {
        rects.push({
          x: bodyX + c * colW,
          y: gy,
          w: colW,
          h: gh,
          fill: config.palette.weekendBg,
        });
      }
    }
  }

  // Weekday column headers
  const wdFontSize = clamp(Math.min(colW * 0.28, headerH * 0.48), 0.085, 0.22);
  for (let c = 0; c < maxCol; c++) {
    const dow = (config.weekStart + c) % 7;
    const isWknd = dow === 0 || dow === 6;
    labels.push({
      text: orderedWeekdays[c % 7].slice(0, colW < 0.72 ? 1 : 3).toUpperCase(),
      x: bodyX + c * colW + colW * 0.5,
      y: gy + headerH * 0.52,
      w: colW,
      h: headerH,
      align: 'center',
      baseline: 'middle',
      fontRole: 'body',
      fontSizeIn: wdFontSize,
      fontWeight: isWknd ? 700 : 600,
      color: isWknd ? config.palette.accent : config.palette.inkMuted,
      letterSpacingEm: 0.06,
    });
  }

  // Month rows & cells
  const monthFontSize = clamp(Math.min(labelW * 0.28, rowH * 0.34) * config.typography.monthScale, 0.14, 0.55);
  for (let i = 0; i < 12; i++) {
    const slot = slots[i];
    const m = slot.monthIndex;
    const y = slot.year;
    const ry = bodyY + i * rowH;
    const offset = monthOffsets[i];
    const dim = getDaysInMonth(y, m);
    const showYearBadge = config.schoolYear && (i === 0 || m === 0);

    labels.push({
      text: formatMonthName(m, config.typography.monthCase, showYearBadge ? y : undefined),
      x: gx + labelW * 0.88,
      y: ry + rowH * 0.5,
      w: labelW * 0.84,
      h: rowH,
      align: 'right',
      baseline: 'middle',
      fontRole: 'display',
      fontSizeIn: monthFontSize,
      fontWeight: config.typography.displayWeight,
      color: config.palette.inkPrimary,
      letterSpacingEm: 0.03 * config.typography.letterSpacingScale,
    });

    for (let c = 0; c < maxCol; c++) {
      const cx = bodyX + c * colW;
      const dayNum = c - offset + 1;
      const dow = (config.weekStart + c) % 7;
      const isWknd = dow === 0 || dow === 6;

      if (dayNum >= 1 && dayNum <= dim) {
        const dateKey = formatDateKey(y, m, dayNum);
        cells.push({
          id: `cell-${y}-${m}-${c}`,
          stripId: `row-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: dayNum,
          dateKey,
          weekdayIndex: dow,
          weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
          isWeekend: isWknd,
          isEmpty: false,
          isoWeek: config.showIsoWeeks && dow === 1 ? getISOWeekNumber(y, m, dayNum) : null,
          dayOfYear: config.showDayOfYear ? getDayOfYear(y, m, dayNum) : null,
          moonPhase: config.showMoonPhases ? getMajorMoonPhase(y, m, dayNum) : null,
          holiday: holidays[dateKey] ?? null,
          events: singleDayMap[dateKey] ?? [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'matrix',
          showWeekdayInCell: false,
        });
      } else {
        cells.push({
          id: `empty-${y}-${m}-${c}`,
          stripId: `row-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: null,
          dateKey: null,
          weekdayIndex: dow,
          weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
          isWeekend: isWknd,
          isEmpty: true,
          isoWeek: null,
          dayOfYear: null,
          moonPhase: null,
          holiday: null,
          events: [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'matrix',
          showWeekdayInCell: false,
        });
      }
    }
  }

  // Outer & inner grid lines
  if (sw > 0) {
    // Horizontal lines (header + 12 rows)
    lines.push({ x1: gx, y1: gy, x2: gx + gw, y2: gy, widthIn: sw * 1.3, color: config.palette.inkPrimary });
    lines.push({ x1: gx, y1: bodyY, x2: gx + gw, y2: bodyY, widthIn: sw * 1.2, color: config.palette.inkPrimary });
    for (let m = 1; m <= 12; m++) {
      const y = bodyY + m * rowH;
      lines.push({
        x1: gx,
        y1: y,
        x2: gx + gw,
        y2: y,
        widthIn: m === 12 ? sw * 1.3 : sw,
        color: m === 12 ? config.palette.inkPrimary : config.palette.gridRule,
      });
    }
    // Vertical lines
    lines.push({ x1: bodyX, y1: gy, x2: bodyX, y2: gy + gh, widthIn: sw * 1.2, color: config.palette.inkPrimary });
    for (let c = 1; c <= maxCol; c++) {
      const x = bodyX + c * colW;
      lines.push({
        x1: x,
        y1: gy,
        x2: x,
        y2: gy + gh,
        widthIn: c === maxCol ? sw * 1.3 : sw,
        color: c === maxCol ? config.palette.inkPrimary : config.palette.gridRule,
      });
    }
  }
}

function buildDayMatrix(
  config: CalendarConfig,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  sw: number,
  holidays: Record<string, string>,
  singleDayMap: Record<string, CalendarDayEvent[]>,
  rects: ComputedRect[],
  lines: ComputedLine[],
  labels: ComputedLabel[],
  cells: ComputedCell[]
) {
  const labelRatio = config.typography.monthCase === 'abbr-upper'
    ? (config.schoolYear ? 0.068 : 0.058)
    : (config.schoolYear ? 0.094 : 0.082);
  const labelW = clamp(gw * labelRatio * config.typography.monthScale, 1.1, gw * 0.16);
  const headerH = clamp(gh * 0.032, 0.32, 0.65);
  const bodyX = gx + labelW;
  const bodyW = gw - labelW;
  const bodyY = gy + headerH;
  const bodyH = gh - headerH;

  const colW = bodyW / 31;
  const rowH = bodyH / 12;

  const colHeaderSize = clamp(Math.min(colW * 0.32, headerH * 0.5), 0.09, 0.24);
  for (let d = 1; d <= 31; d++) {
    labels.push({
      text: String(d).padStart(2, '0'),
      x: bodyX + (d - 1) * colW + colW * 0.5,
      y: gy + headerH * 0.52,
      w: colW,
      h: headerH,
      align: 'center',
      baseline: 'middle',
      fontRole: 'mono',
      fontSizeIn: colHeaderSize,
      fontWeight: 600,
      color: config.palette.inkMuted,
    });
  }

  const slots = getMonthSlots(config.year, config.schoolYear);
  const monthFontSize = clamp(Math.min(labelW * 0.28, rowH * 0.34) * config.typography.monthScale, 0.14, 0.55);
  for (let i = 0; i < 12; i++) {
    const slot = slots[i];
    const m = slot.monthIndex;
    const y = slot.year;
    const ry = bodyY + i * rowH;
    const dim = getDaysInMonth(y, m);
    const showYearBadge = config.schoolYear && (i === 0 || m === 0);

    labels.push({
      text: formatMonthName(m, config.typography.monthCase, showYearBadge ? y : undefined),
      x: gx + labelW * 0.88,
      y: ry + rowH * 0.5,
      w: labelW * 0.84,
      h: rowH,
      align: 'right',
      baseline: 'middle',
      fontRole: 'display',
      fontSizeIn: monthFontSize,
      fontWeight: config.typography.displayWeight,
      color: config.palette.inkPrimary,
      letterSpacingEm: 0.03 * config.typography.letterSpacingScale,
    });

    for (let d = 1; d <= 31; d++) {
      const cx = bodyX + (d - 1) * colW;
      if (d <= dim) {
        const dow = getDayOfWeek(y, m, d);
        const isWknd = dow === 0 || dow === 6;
        const dateKey = formatDateKey(y, m, d);
        if (isWknd && config.weekendTintStrength > 0) {
          rects.push({ x: cx, y: ry, w: colW, h: rowH, fill: config.palette.weekendBg });
        }
        cells.push({
          id: `cell-${y}-${m}-${d}`,
          stripId: `row-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: d,
          dateKey,
          weekdayIndex: dow,
          weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
          isWeekend: isWknd,
          isEmpty: false,
          isoWeek: config.showIsoWeeks && dow === 1 ? getISOWeekNumber(y, m, d) : null,
          dayOfYear: config.showDayOfYear ? getDayOfYear(y, m, d) : null,
          moonPhase: config.showMoonPhases ? getMajorMoonPhase(y, m, d) : null,
          holiday: holidays[dateKey] ?? null,
          events: singleDayMap[dateKey] ?? [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'matrix',
          showWeekdayInCell: true,
        });
      } else {
        rects.push({ x: cx, y: ry, w: colW, h: rowH, fill: config.palette.weekendBg });
        cells.push({
          id: `empty-${y}-${m}-${d}`,
          stripId: `row-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: null,
          dateKey: null,
          weekdayIndex: null,
          weekdayLabel: '',
          isWeekend: false,
          isEmpty: true,
          isoWeek: null,
          dayOfYear: null,
          moonPhase: null,
          holiday: null,
          events: [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'matrix',
          showWeekdayInCell: false,
        });
      }
    }
  }

  if (sw > 0) {
    lines.push({ x1: gx, y1: gy, x2: gx + gw, y2: gy, widthIn: sw * 1.3, color: config.palette.inkPrimary });
    lines.push({ x1: gx, y1: bodyY, x2: gx + gw, y2: bodyY, widthIn: sw * 1.2, color: config.palette.inkPrimary });
    for (let m = 1; m <= 12; m++) {
      const y = bodyY + m * rowH;
      lines.push({
        x1: gx,
        y1: y,
        x2: gx + gw,
        y2: y,
        widthIn: m === 12 ? sw * 1.3 : sw,
        color: m === 12 ? config.palette.inkPrimary : config.palette.gridRule,
      });
    }
    lines.push({ x1: bodyX, y1: gy, x2: bodyX, y2: gy + gh, widthIn: sw * 1.2, color: config.palette.inkPrimary });
    for (let d = 1; d <= 31; d++) {
      const x = bodyX + d * colW;
      lines.push({
        x1: x,
        y1: gy,
        x2: x,
        y2: gy + gh,
        widthIn: d === 31 ? sw * 1.3 : sw,
        color: d === 31 ? config.palette.inkPrimary : config.palette.gridRule,
      });
    }
  }
}

function buildVerticalColumns(
  config: CalendarConfig,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  sw: number,
  holidays: Record<string, string>,
  singleDayMap: Record<string, CalendarDayEvent[]>,
  rects: ComputedRect[],
  lines: ComputedLine[],
  labels: ComputedLabel[],
  cells: ComputedCell[]
) {
  const colW = gw / 12;
  const headerH = clamp(gh * 0.048 * config.typography.monthScale, 0.42, 1.15);
  const bodyY = gy + headerH;
  const bodyH = gh - headerH;
  const rowH = bodyH / 31;

  const slots = getMonthSlots(config.year, config.schoolYear);
  const monthFontSize = clamp(Math.min(colW * 0.25, headerH * 0.56) * config.typography.monthScale, 0.14, 0.55);

  for (let i = 0; i < 12; i++) {
    const slot = slots[i];
    const m = slot.monthIndex;
    const y = slot.year;
    const cx = gx + i * colW;
    const dim = getDaysInMonth(y, m);
    const showYearBadge = config.schoolYear && (i === 0 || m === 0);

    labels.push({
      text: formatMonthName(m, config.typography.monthCase, showYearBadge ? y : undefined),
      x: cx + colW * 0.5,
      y: gy + headerH * 0.52,
      w: colW * 0.92,
      h: headerH,
      align: 'center',
      baseline: 'middle',
      fontRole: 'display',
      fontSizeIn: monthFontSize,
      fontWeight: config.typography.displayWeight,
      color: config.palette.inkPrimary,
      letterSpacingEm: 0.04 * config.typography.letterSpacingScale,
    });

    for (let d = 1; d <= 31; d++) {
      const ry = bodyY + (d - 1) * rowH;
      if (d <= dim) {
        const dow = getDayOfWeek(y, m, d);
        const isWknd = dow === 0 || dow === 6;
        const dateKey = formatDateKey(y, m, d);
        if (isWknd && config.weekendTintStrength > 0) {
          rects.push({ x: cx, y: ry, w: colW, h: rowH, fill: config.palette.weekendBg });
        }
        cells.push({
          id: `vcell-${y}-${m}-${d}`,
          stripId: `vcol-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: d,
          dateKey,
          weekdayIndex: dow,
          weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
          isWeekend: isWknd,
          isEmpty: false,
          isoWeek: config.showIsoWeeks && dow === 1 ? getISOWeekNumber(y, m, d) : null,
          dayOfYear: config.showDayOfYear ? getDayOfYear(y, m, d) : null,
          moonPhase: config.showMoonPhases ? getMajorMoonPhase(y, m, d) : null,
          holiday: holidays[dateKey] ?? null,
          events: singleDayMap[dateKey] ?? [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'vertical',
          showWeekdayInCell: true,
        });
      } else {
        rects.push({ x: cx, y: ry, w: colW, h: rowH, fill: config.palette.weekendBg });
        cells.push({
          id: `vempty-${y}-${m}-${d}`,
          stripId: `vcol-${i}`,
          x: cx,
          y: ry,
          w: colW,
          h: rowH,
          monthIndex: m,
          day: null,
          dateKey: null,
          weekdayIndex: null,
          weekdayLabel: '',
          isWeekend: false,
          isEmpty: true,
          isoWeek: null,
          dayOfYear: null,
          moonPhase: null,
          holiday: null,
          events: [],
          spanFillColor: null,
          reservedTopIn: 0,
          hasVerticalSpan: false,
          styleVariant: 'vertical',
          showWeekdayInCell: false,
        });
      }
    }
  }

  if (sw > 0) {
    lines.push({ x1: gx, y1: gy, x2: gx + gw, y2: gy, widthIn: sw * 1.3, color: config.palette.inkPrimary });
    lines.push({ x1: gx, y1: bodyY, x2: gx + gw, y2: bodyY, widthIn: sw * 1.3, color: config.palette.inkPrimary });
    for (let d = 1; d <= 31; d++) {
      const y = bodyY + d * rowH;
      lines.push({
        x1: gx,
        y1: y,
        x2: gx + gw,
        y2: y,
        widthIn: d === 31 ? sw * 1.3 : sw,
        color: d === 31 ? config.palette.inkPrimary : config.palette.gridRule,
      });
    }
    for (let m = 0; m <= 12; m++) {
      const x = gx + m * colW;
      lines.push({
        x1: x,
        y1: gy,
        x2: x,
        y2: gy + gh,
        widthIn: m === 0 || m === 12 ? sw * 1.3 : sw * 1.1,
        color: m === 0 || m === 12 ? config.palette.inkPrimary : config.palette.inkMuted,
      });
    }
  }
}

function buildBlockGrid(
  config: CalendarConfig,
  cols: number,
  rows: number,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
  sw: number,
  holidays: Record<string, string>,
  singleDayMap: Record<string, CalendarDayEvent[]>,
  rects: ComputedRect[],
  lines: ComputedLine[],
  labels: ComputedLabel[],
  cells: ComputedCell[]
) {
  const gutterX = clamp(gw * 0.02, 0.28, 0.75);
  const gutterY = clamp(gh * 0.025, 0.28, 0.75);
  const blockW = (gw - gutterX * (cols - 1)) / cols;
  const blockH = (gh - gutterY * (rows - 1)) / rows;
  const orderedWeekdays = getOrderedWeekdays(config.weekStart, false);

  const monthHeaderH = clamp(blockH * 0.13 * config.typography.monthScale, 0.28, 0.85);
  const weekdayBarH = clamp(blockH * 0.065, 0.18, 0.42);
  const gridBodyH = blockH - monthHeaderH - weekdayBarH;
  const isoColW = config.showIsoWeeks ? clamp(blockW * 0.065, 0.22, 0.42) : 0;
  const dayGridW = blockW - isoColW;
  const dayW = dayGridW / 7;
  const dayH = gridBodyH / 6;

  const monthFontSize = clamp(monthHeaderH * 0.62 * config.typography.monthScale, 0.16, 0.55);
  const wdFontSize = clamp(Math.min(dayW * 0.22, weekdayBarH * 0.52), 0.075, 0.18);

  const slots = getMonthSlots(config.year, config.schoolYear);

  for (let i = 0; i < 12; i++) {
    const slot = slots[i];
    const m = slot.monthIndex;
    const y = slot.year;
    const colIdx = i % cols;
    const rowIdx = Math.floor(i / cols);
    const bx = gx + colIdx * (blockW + gutterX);
    const by = gy + rowIdx * (blockH + gutterY);

    // Month heading
    labels.push({
      text: formatMonthName(m, config.typography.monthCase),
      x: bx,
      y: by + monthHeaderH * 0.52,
      w: blockW * 0.72,
      h: monthHeaderH,
      align: 'left',
      baseline: 'middle',
      fontRole: 'display',
      fontSizeIn: monthFontSize,
      fontWeight: config.typography.displayWeight,
      color: config.palette.inkPrimary,
      letterSpacingEm: 0.03 * config.typography.letterSpacingScale,
    });

    // Month index micro-numeral (e.g. 01..12, or 07 · 2027 / 01 · 2028 in school-year mode)
    const microLabel = config.schoolYear
      ? `${String(m + 1).padStart(2, '0')} · ${y}`
      : String(m + 1).padStart(2, '0');
    labels.push({
      text: microLabel,
      x: bx + blockW,
      y: by + monthHeaderH * 0.54,
      w: blockW * 0.28,
      h: monthHeaderH,
      align: 'right',
      baseline: 'middle',
      fontRole: 'mono',
      fontSizeIn: monthFontSize * (config.schoolYear ? 0.44 : 0.58),
      fontWeight: 500,
      color: config.palette.inkMuted,
    });

    const wdY = by + monthHeaderH;
    const bodyX = bx + isoColW;
    const bodyY = wdY + weekdayBarH;

    // Weekday strip
    for (let w = 0; w < 7; w++) {
      const dow = (config.weekStart + w) % 7;
      const isWknd = dow === 0 || dow === 6;
      labels.push({
        text: orderedWeekdays[w].toUpperCase(),
        x: bodyX + w * dayW + dayW * 0.5,
        y: wdY + weekdayBarH * 0.5,
        w: dayW,
        h: weekdayBarH,
        align: 'center',
        baseline: 'middle',
        fontRole: 'body',
        fontSizeIn: wdFontSize,
        fontWeight: 600,
        color: isWknd ? config.palette.accent : config.palette.inkMuted,
        letterSpacingEm: 0.05,
      });
    }

    const firstDow = getDayOfWeek(y, m, 1);
    const offset = (firstDow - config.weekStart + 7) % 7;
    const dim = getDaysInMonth(y, m);

    for (let r = 0; r < 6; r++) {
      const cy = bodyY + r * dayH;
      if (config.showIsoWeeks) {
        // Calculate ISO week for the first valid day in this row
        let sampleDay = r * 7 - offset + 1;
        if (sampleDay < 1) sampleDay = 1;
        if (sampleDay <= dim) {
          const wk = getISOWeekNumber(y, m, sampleDay);
          labels.push({
            text: `W${String(wk).padStart(2, '0')}`,
            x: bx + isoColW * 0.45,
            y: cy + dayH * 0.25,
            w: isoColW,
            h: dayH,
            align: 'center',
            baseline: 'middle',
            fontRole: 'mono',
            fontSizeIn: clamp(dayW * 0.14, 0.065, 0.13),
            fontWeight: 500,
            color: config.palette.inkMuted,
          });
        }
      }

      for (let c = 0; c < 7; c++) {
        const cx = bodyX + c * dayW;
        const dow = (config.weekStart + c) % 7;
        const isWknd = dow === 0 || dow === 6;
        const dayNum = r * 7 + c - offset + 1;

        if (dayNum >= 1 && dayNum <= dim) {
          const dateKey = formatDateKey(y, m, dayNum);
          if (isWknd && config.weekendTintStrength > 0) {
            rects.push({ x: cx, y: cy, w: dayW, h: dayH, fill: config.palette.weekendBg });
          }
          cells.push({
            id: `bcell-${y}-${m}-${r}-${c}`,
            stripId: `block-${i}-row-${r}`,
            x: cx,
            y: cy,
            w: dayW,
            h: dayH,
            monthIndex: m,
            day: dayNum,
            dateKey,
            weekdayIndex: dow,
            weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
            isWeekend: isWknd,
            isEmpty: false,
            isoWeek: null,
            dayOfYear: config.showDayOfYear ? getDayOfYear(y, m, dayNum) : null,
            moonPhase: config.showMoonPhases ? getMajorMoonPhase(y, m, dayNum) : null,
            holiday: holidays[dateKey] ?? null,
            events: singleDayMap[dateKey] ?? [],
            spanFillColor: null,
            reservedTopIn: 0,
            hasVerticalSpan: false,
            styleVariant: 'block',
            showWeekdayInCell: false,
          });
        } else {
          cells.push({
            id: `bempty-${y}-${m}-${r}-${c}`,
            stripId: `block-${i}-row-${r}`,
            x: cx,
            y: cy,
            w: dayW,
            h: dayH,
            monthIndex: m,
            day: null,
            dateKey: null,
            weekdayIndex: dow,
            weekdayLabel: WEEKDAY_NAMES_SHORT[dow],
            isWeekend: isWknd,
            isEmpty: true,
            isoWeek: null,
            dayOfYear: null,
            moonPhase: null,
            holiday: null,
            events: [],
            spanFillColor: null,
            reservedTopIn: 0,
            hasVerticalSpan: false,
            styleVariant: 'block',
            showWeekdayInCell: false,
          });
        }
      }
    }

    // Block grid lines
    if (sw > 0) {
      lines.push({ x1: bx, y1: wdY, x2: bx + blockW, y2: wdY, widthIn: sw * 1.2, color: config.palette.inkPrimary });
      lines.push({ x1: bx, y1: bodyY, x2: bx + blockW, y2: bodyY, widthIn: sw * 1.1, color: config.palette.inkPrimary });
      for (let r = 1; r <= 6; r++) {
        const y = bodyY + r * dayH;
        lines.push({
          x1: bx,
          y1: y,
          x2: bx + blockW,
          y2: y,
          widthIn: r === 6 ? sw * 1.2 : sw,
          color: r === 6 ? config.palette.inkPrimary : config.palette.gridRule,
        });
      }
      for (let c = 0; c <= 7; c++) {
        const x = bodyX + c * dayW;
        lines.push({
          x1: x,
          y1: bodyY,
          x2: x,
          y2: bodyY + gridBodyH,
          widthIn: c === 0 || c === 7 ? sw * 1.2 : sw,
          color: c === 0 || c === 7 ? config.palette.inkPrimary : config.palette.gridRule,
        });
      }
    }
  }
}

function partitionEvents(config: CalendarConfig): {
  singleDayMap: Record<string, CalendarDayEvent[]>;
  multiDayEvents: CalendarSpanEvent[];
} {
  const singleDayMap: Record<string, CalendarDayEvent[]> = {};
  const multiDayEvents: CalendarSpanEvent[] = [];

  const sourceList: CalendarSpanEvent[] = [...(config.spanEvents ?? [])];

  // Fallback for any legacy config.events
  if (sourceList.length === 0 && config.events) {
    for (const [dateKey, items] of Object.entries(config.events)) {
      for (const item of items) {
        sourceList.push({
          id: item.id,
          title: item.title,
          startDate: dateKey,
          endDate: dateKey,
          color: item.color,
          fillCell: item.fillCell,
        });
      }
    }
  }

  for (const ev of sourceList) {
    if (!ev.startDate || !ev.endDate || ev.endDate <= ev.startDate) {
      const key = ev.startDate;
      if (!key) continue;
      if (!singleDayMap[key]) singleDayMap[key] = [];
      singleDayMap[key].push({
        id: ev.id,
        title: ev.title,
        color: ev.color,
        fillCell: ev.fillCell,
      });
    } else {
      multiDayEvents.push(ev);
    }
  }

  return { singleDayMap, multiDayEvents };
}

function computeSpanSegments(
  cells: ComputedCell[],
  multiDayEvents: CalendarSpanEvent[],
  config: CalendarConfig
): ComputedSpanSegment[] {
  if (multiDayEvents.length === 0) return [];

  const segments: ComputedSpanSegment[] = [];
  const strips = new Map<string, ComputedCell[]>();
  for (const cell of cells) {
    if (cell.isEmpty || !cell.dateKey) continue;
    const list = strips.get(cell.stripId);
    if (list) list.push(cell);
    else strips.set(cell.stripId, [cell]);
  }

  const bodyFamily = `${config.typography.bodyFont.replace(/"/g, '')}, sans-serif`;
  const pt = 72;

  for (const [stripId, stripCells] of strips.entries()) {
    if (stripCells.length === 0) continue;
    const isVertical = stripCells[0].styleVariant === 'vertical';

    // Find overlapping multi-day events in this strip
    interface Interval {
      ev: CalendarSpanEvent;
      startIdx: number;
      endIdx: number;
      lane: number;
    }

    const intervals: Interval[] = [];
    for (const ev of multiDayEvents) {
      let runStart = -1;
      for (let i = 0; i < stripCells.length; i++) {
        const dk = stripCells[i].dateKey!;
        const inside = dk >= ev.startDate && dk <= ev.endDate;
        if (inside) {
          if (ev.fillCell) {
            stripCells[i].spanFillColor = ev.color;
          }
          if (runStart === -1) runStart = i;
        } else if (runStart !== -1) {
          intervals.push({ ev, startIdx: runStart, endIdx: i - 1, lane: 0 });
          runStart = -1;
        }
      }
      if (runStart !== -1) {
        intervals.push({ ev, startIdx: runStart, endIdx: stripCells.length - 1, lane: 0 });
      }
    }

    if (intervals.length === 0) continue;

    // Sort earliest first, longest span first, and pack into non-overlapping lanes
    intervals.sort((a, b) => a.startIdx - b.startIdx || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx));
    const laneEnds: number[] = [];
    for (const item of intervals) {
      let assigned = -1;
      for (let l = 0; l < laneEnds.length; l++) {
        if (item.startIdx > laneEnds[l]) {
          assigned = l;
          laneEnds[l] = item.endIdx;
          break;
        }
      }
      if (assigned === -1) {
        assigned = laneEnds.length;
        laneEnds.push(item.endIdx);
      }
      item.lane = assigned;
    }

    if (isVertical) {
      const totalLanes = Math.max(1, laneEnds.length);
      for (const item of intervals) {
        const firstCell = stripCells[item.startIdx];
        const lastCell = stripCells[item.endIdx];
        const padX = Math.min(firstCell.w * 0.09, 0.1);
        const padY = Math.min(firstCell.h * 0.08, 0.09);
        const fontSize = Math.min(firstCell.h * 0.44, firstCell.w * 0.11) * config.typography.dayNumberScale;
        const metaStartX = firstCell.x + padX + fontSize * 3.85;
        const availTotalW = Math.max(0.25, firstCell.x + firstCell.w - padX - metaStartX);
        const laneW = availTotalW / totalLanes;
        const segX = metaStartX + item.lane * laneW;
        const segY = firstCell.y + padY * 0.45;
        const segH = lastCell.y + lastCell.h - padY * 0.45 - segY;

        for (let k = item.startIdx; k <= item.endIdx; k++) {
          stripCells[k].hasVerticalSpan = true;
        }

        const barW = Math.max(0.025, 2 / pt);
        const textFontSize = Math.min(fontSize * 0.78, firstCell.h * 0.42);
        const lineHeightIn = textFontSize * 1.25;
        const maxLines = Math.max(1, Math.floor((segH - padY) / lineHeightIn));
        const textAvailPt = Math.max(12, (laneW - barW - padX * 0.75) * pt);
        const fontSpec = `600 ${textFontSize * pt}px ${bodyFamily}`;
        const lines = wrapTextToLines(item.ev.title, textAvailPt, maxLines, (s) =>
          measureTextWidthPx(s, fontSpec)
        );

        segments.push({
          id: `${stripId}-${item.ev.id}-${item.startIdx}`,
          eventId: item.ev.id,
          title: item.ev.title,
          color: item.ev.color,
          x: segX,
          y: segY,
          w: laneW - (totalLanes > 1 ? padX * 0.35 : 0),
          h: segH,
          orientation: 'vertical',
          fontSizeIn: textFontSize,
          lines,
          lineHeightIn,
          startDateKey: firstCell.dateKey!,
        });
      }
    } else {
      // Horizontal strip (matrix or block week-row)
      const sampleCell = stripCells[0];
      const padX = Math.min(sampleCell.w * 0.09, 0.1);
      const padY = Math.min(sampleCell.h * 0.08, 0.09);
      const baseScale =
        sampleCell.styleVariant === 'matrix'
          ? Math.min(sampleCell.w * 0.34, sampleCell.h * 0.22)
          : Math.min(sampleCell.w * 0.22, sampleCell.h * 0.24);
      const numFontSize = Math.max(4 / pt, baseScale * config.typography.dayNumberScale);
      const lineFontSize = Math.max(4 / pt, Math.min(numFontSize * 0.56, sampleCell.w * 0.13));
      const lineHeightIn = lineFontSize * 1.25;
      const topAnchorY = sampleCell.y + padY + numFontSize * 1.2;
      const singleLineBandH = lineFontSize * 1.48;
      const bandGap = lineFontSize * 0.24;

      // Track extra height if a single-lane span wraps to 2 lines
      const laneExtraY = new Array<number>(laneEnds.length).fill(0);

      for (const item of intervals) {
        const firstCell = stripCells[item.startIdx];
        const lastCell = stripCells[item.endIdx];
        const segX = firstCell.x + padX * 0.65;
        const segW = lastCell.x + lastCell.w - padX * 0.65 - segX;
        const barW = Math.max(0.025, 2.2 / pt);
        const textAvailPt = Math.max(12, (segW - barW - padX * 0.9) * pt);
        const fontSpec = `600 ${lineFontSize * pt}px ${bodyFamily}`;

        const laneTopOffset = item.lane * (singleLineBandH + bandGap) + laneExtraY[item.lane];
        const segY = topAnchorY + laneTopOffset;
        const maxBottomY = sampleCell.y + sampleCell.h - padY * 0.6;
        if (segY + lineFontSize > maxBottomY) continue;

        const canExpandTwoLines =
          laneEnds.length === 1 &&
          segY + lineHeightIn * 2 + bandGap <= maxBottomY;
        const maxLines = canExpandTwoLines ? 2 : 1;
        const lines = wrapTextToLines(item.ev.title, textAvailPt, maxLines, (s) =>
          measureTextWidthPx(s, fontSpec)
        );
        const usedLines = Math.max(1, lines.length);
        const segH = usedLines === 1 ? singleLineBandH : usedLines * lineHeightIn + lineFontSize * 0.35;

        if (usedLines > 1 && item.lane + 1 < laneExtraY.length) {
          laneExtraY[item.lane + 1] += segH - singleLineBandH;
        }

        const bottomRelTop = laneTopOffset + segH + bandGap;
        for (let k = item.startIdx; k <= item.endIdx; k++) {
          stripCells[k].reservedTopIn = Math.max(stripCells[k].reservedTopIn, bottomRelTop);
        }

        segments.push({
          id: `${stripId}-${item.ev.id}-${item.startIdx}`,
          eventId: item.ev.id,
          title: item.ev.title,
          color: item.ev.color,
          x: segX,
          y: segY,
          w: segW,
          h: segH,
          orientation: 'horizontal',
          fontSizeIn: lineFontSize,
          lines,
          lineHeightIn,
          startDateKey: firstCell.dateKey!,
        });
      }
    }
  }

  return segments;
}

