import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Eye } from 'lucide-react';
import { CalendarConfig } from '../types/calendar';
import { ComputedCalendarLayout } from '../utils/calendarLayout';
import { blendHexColors, hexToRgba } from '../utils/canvasRenderer';

interface CalendarPreviewCanvasProps {
  config: CalendarConfig;
  layout: ComputedCalendarLayout;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
}

export function CalendarPreviewCanvas({
  config,
  layout,
  selectedDateKey,
  onSelectDate,
}: CalendarPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('fit');
  const [zoomScale, setZoomScale] = useState<number>(0.25);
  const [fitScale, setFitScale] = useState<number>(0.25);
  const [showGuides, setShowGuides] = useState<boolean>(false);

  // 1 inch = 96 CSS px at 100% physical screen inspection scale
  const PX_PER_IN = 96;
  const fullW = layout.totalWidthIn * PX_PER_IN;
  const fullH = layout.totalHeightIn * PX_PER_IN;

  useEffect(() => {
    const updateFit = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availW = Math.max(240, rect.width - 80);
      const availH = Math.max(200, rect.height - 80);
      const scale = Math.min(availW / fullW, availH / fullH, 1.0);
      setFitScale(scale);
      if (zoomMode === 'fit') {
        setZoomScale(scale);
      }
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fullW, fullH, zoomMode]);

  const activeScale = zoomMode === 'fit' ? fitScale : zoomScale;
  const pt = 72;
  const wPt = layout.totalWidthIn * pt;
  const hPt = layout.totalHeightIn * pt;

  const blendedWeekendBg = blendHexColors(
    config.palette.paperBg,
    config.palette.weekendBg,
    config.weekendTintStrength
  );

  const px300W = Math.round(layout.totalWidthIn * 300);
  const px300H = Math.round(layout.totalHeightIn * 300);

  const handleZoomIn = () => {
    setZoomMode('custom');
    setZoomScale((s) => Math.min(1.5, Number((s + 0.08).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomMode('custom');
    setZoomScale((s) => Math.max(0.08, Number((s - 0.08).toFixed(2))));
  };

  const handleSetZoom = (target: number | 'fit') => {
    if (target === 'fit') {
      setZoomMode('fit');
      setZoomScale(fitScale);
    } else {
      setZoomMode('custom');
      setZoomScale(target);
    }
  };

  const displayFamily = `${config.typography.displayFont}, sans-serif`;
  const bodyFamily = `${config.typography.bodyFont}, sans-serif`;
  const numberFamily = config.typography.useMonoNumbers
    ? '"JetBrains Mono", monospace'
    : bodyFamily;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* Studio Proof Toolbar */}
      <div className="h-11 bg-[#F4F3EF] border-b border-stone-200 px-5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-xs text-stone-600 tabular-nums whitespace-nowrap overflow-hidden">
          <span className="font-semibold text-stone-900">
            {config.widthIn.toFixed(config.widthIn % 1 === 0 ? 0 : 2)}&Prime; &times;{' '}
            {config.heightIn.toFixed(config.heightIn % 1 === 0 ? 0 : 2)}&Prime;
          </span>
          <span aria-hidden="true" className="text-stone-400">·</span>
          <span>
            {px300W.toLocaleString()} &times; {px300H.toLocaleString()} px @ 300 DPI
          </span>
          <span aria-hidden="true" className="text-stone-400 hidden sm:inline">·</span>
          <span className="hidden sm:inline text-stone-500">Click any day cell to annotate</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuides((v) => !v)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              showGuides
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
            title="Toggle trim and margin print guides"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Guides</span>
          </button>

          <div className="flex items-center bg-white border border-stone-300 rounded overflow-hidden">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              className="px-2 py-1 text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleSetZoom('fit')}
              className={`px-2.5 py-1 text-xs font-medium tabular-nums border-x border-stone-200 transition-colors whitespace-nowrap cursor-pointer ${
                zoomMode === 'fit' ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              Fit ({Math.round(activeScale * 100)}%)
            </button>
            <button
              type="button"
              onClick={() => handleSetZoom(0.5)}
              className={`px-2 py-1 text-xs font-medium tabular-nums border-r border-stone-200 transition-colors hidden md:inline-block cursor-pointer ${
                zoomMode === 'custom' && Math.abs(activeScale - 0.5) < 0.02
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => handleSetZoom(1)}
              className={`px-2 py-1 text-xs font-medium tabular-nums border-r border-stone-200 transition-colors hidden md:inline-block cursor-pointer ${
                zoomMode === 'custom' && Math.abs(activeScale - 1) < 0.02
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              className="px-2 py-1 text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleSetZoom('fit')}
              aria-label="Fit sheet to viewport"
              className="px-2 py-1 text-stone-600 hover:bg-stone-100 border-l border-stone-200 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Drafting Mat Viewport */}
      <div
        ref={containerRef}
        className="flex-1 drafting-mat overflow-auto flex items-center justify-center p-8"
      >
        <div
          className="relative shrink-0 shadow-[0_20px_56px_rgba(28,25,23,0.16)] transition-transform duration-150 ease-out"
          style={{
            width: `${fullW * activeScale}px`,
            height: `${fullH * activeScale}px`,
          }}
        >
          <svg
            viewBox={`0 0 ${wPt} ${hPt}`}
            className="w-full h-full block select-none"
            shapeRendering="geometricPrecision"
          >
            <defs>
              {layout.cells.map((cell) =>
                !cell.isEmpty ? (
                  <clipPath key={`clip-${cell.id}`} id={`clip-${cell.id}`}>
                    <rect
                      x={cell.x * pt}
                      y={cell.y * pt}
                      width={cell.w * pt}
                      height={cell.h * pt}
                    />
                  </clipPath>
                ) : null
              )}
            </defs>

            {/* Base Rectangles (Paper & Weekend Tint Columns) */}
            {layout.rects.map((r, idx) => (
              <rect
                key={`rect-${idx}`}
                x={r.x * pt}
                y={r.y * pt}
                width={r.w * pt}
                height={r.h * pt}
                fill={r.fill === config.palette.weekendBg ? blendedWeekendBg : r.fill ?? 'none'}
              />
            ))}

            {/* Interactive Day Cells */}
            {layout.cells.map((cell) => {
              if (cell.isEmpty || !cell.dateKey) return null;
              const cx = cell.x * pt;
              const cy = cell.y * pt;
              const cw = cell.w * pt;
              const ch = cell.h * pt;
              const padX = Math.min(cell.w * 0.09, 0.1) * pt;
              const padY = Math.min(cell.h * 0.08, 0.09) * pt;
              const isSelected = selectedDateKey === cell.dateKey;
              const filledEvent = cell.events.find((ev) => ev.fillCell);

              const dayColor = cell.holiday
                ? config.palette.holidayInk
                : cell.isWeekend
                  ? config.palette.weekendInk
                  : config.palette.inkPrimary;

              const baseScale =
                cell.styleVariant === 'matrix'
                  ? Math.min(cw * 0.34, ch * 0.22)
                  : Math.min(cw * 0.22, ch * 0.24);
              const numFontSize = Math.max(4, baseScale * config.typography.dayNumberScale);

              const writeLines: number[] = [];
              if (config.showWriteLines && cell.styleVariant !== 'vertical' && ch > 0.35 * pt) {
                const topZone = padY + numFontSize * 1.35;
                const bottomZone = ch - padY * 0.9;
                const space = bottomZone - topZone;
                if (space > 0.15 * pt && config.writeLineCount > 0) {
                  for (let i = 1; i <= config.writeLineCount; i++) {
                    writeLines.push(cy + topZone + (space / config.writeLineCount) * i);
                  }
                }
              }

              const align = config.typography.dayNumberAlign;
              const anchor = align === 'top-left' ? 'start' : align === 'top-right' ? 'end' : 'middle';
              const numX =
                align === 'top-left' ? cx + padX : align === 'top-right' ? cx + cw - padX : cx + cw * 0.5;

              const lineSize = Math.max(4, Math.min(numFontSize * 0.56, cw * 0.13));
              let cursorY = cy + padY + numFontSize * 1.22;

              return (
                <g
                  key={cell.id}
                  clipPath={`url(#clip-${cell.id})`}
                  onClick={() => onSelectDate(cell.dateKey!)}
                  className="cursor-pointer group"
                >
                  {/* Transparent hit target + subtle hover highlight */}
                  <rect
                    x={cx}
                    y={cy}
                    width={cw}
                    height={ch}
                    fill={filledEvent ? hexToRgba(filledEvent.color, 0.14) : 'transparent'}
                  />
                  <rect
                    x={cx}
                    y={cy}
                    width={cw}
                    height={ch}
                    fill={config.palette.accent}
                    fillOpacity={isSelected ? 0.12 : 0.08}
                    className={
                      isSelected
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
                    }
                  />

                  {cell.styleVariant === 'vertical' ? (
                    (() => {
                      const vFontSize = Math.min(ch * 0.48, cw * 0.12) * config.typography.dayNumberScale;
                      const primaryEv = cell.events[0];
                      return (
                        <>
                          <text
                            x={cx + padX}
                            y={cy + ch * 0.5}
                            fontFamily={numberFamily}
                            fontSize={vFontSize}
                            fontWeight={700}
                            fill={dayColor}
                            dominantBaseline="central"
                          >
                            {cell.day}
                          </text>
                          <text
                            x={cx + padX + vFontSize * 1.5}
                            y={cy + ch * 0.5}
                            fontFamily={bodyFamily}
                            fontSize={vFontSize * 0.68}
                            fontWeight={600}
                            fill={cell.isWeekend ? config.palette.accent : config.palette.inkMuted}
                            dominantBaseline="central"
                          >
                            {cell.weekdayLabel.slice(0, 3).toUpperCase()}
                          </text>
                          {primaryEv ? (
                            <>
                              <rect
                                x={cx + padX + vFontSize * 3.8}
                                y={cy + ch * 0.22}
                                width={Math.max(1.5, 0.025 * pt)}
                                height={ch * 0.56}
                                fill={primaryEv.color}
                              />
                              <text
                                x={cx + padX + vFontSize * 3.8 + 5}
                                y={cy + ch * 0.5}
                                fontFamily={bodyFamily}
                                fontSize={vFontSize * 0.72}
                                fontWeight={600}
                                fill={config.palette.inkPrimary}
                                dominantBaseline="central"
                              >
                                {primaryEv.title}
                              </text>
                            </>
                          ) : cell.holiday ? (
                            <text
                              x={cx + padX + vFontSize * 3.8}
                              y={cy + ch * 0.5}
                              fontFamily={bodyFamily}
                              fontSize={vFontSize * 0.68}
                              fontWeight={500}
                              fill={config.palette.holidayInk}
                              dominantBaseline="central"
                            >
                              {cell.holiday}
                            </text>
                          ) : null}
                          {cell.moonPhase && (
                            <circle
                              cx={cx + cw - padX - Math.min(ch * 0.13, 0.045 * pt)}
                              cy={cy + ch * 0.5}
                              r={Math.min(ch * 0.13, 0.045 * pt)}
                              fill={cell.moonPhase === 'new' ? config.palette.inkMuted : 'none'}
                              stroke={cell.moonPhase === 'full' ? config.palette.inkMuted : 'none'}
                              strokeWidth={1}
                            />
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <>
                      {/* Writeable lines */}
                      {writeLines.map((ly, i) => (
                        <line
                          key={i}
                          x1={cx + padX}
                          y1={ly}
                          x2={cx + cw - padX}
                          y2={ly}
                          stroke={config.palette.gridRule}
                          strokeOpacity={0.55}
                          strokeWidth={0.5}
                        />
                      ))}

                      {/* Day Number */}
                      <text
                        x={numX}
                        y={cy + padY}
                        textAnchor={anchor}
                        dominantBaseline="hanging"
                        fontFamily={numberFamily}
                        fontSize={numFontSize}
                        fontWeight={700}
                        fill={dayColor}
                      >
                        {cell.day}
                      </text>

                      {/* Optional weekday label in day-matrix */}
                      {cell.showWeekdayInCell && align !== 'center' && (
                        <text
                          x={align === 'top-left' ? cx + cw - padX : cx + padX}
                          y={cy + padY + numFontSize * 0.16}
                          textAnchor={align === 'top-left' ? 'end' : 'start'}
                          dominantBaseline="hanging"
                          fontFamily={bodyFamily}
                          fontSize={numFontSize * 0.54}
                          fontWeight={600}
                          fill={cell.isWeekend ? config.palette.accent : config.palette.inkMuted}
                        >
                          {cell.weekdayLabel.slice(0, 3).toUpperCase()}
                        </text>
                      )}

                      {/* Moon Phase */}
                      {cell.moonPhase && !cell.showWeekdayInCell && (
                        <circle
                          cx={
                            align === 'top-right'
                              ? cx + padX + Math.max(1.5, Math.min(numFontSize * 0.24, 0.042 * pt))
                              : cx + cw - padX - Math.max(1.5, Math.min(numFontSize * 0.24, 0.042 * pt))
                          }
                          cy={cy + padY + numFontSize * 0.45}
                          r={Math.max(1.5, Math.min(numFontSize * 0.24, 0.042 * pt))}
                          fill={cell.moonPhase === 'new' ? config.palette.inkMuted : 'none'}
                          stroke={cell.moonPhase === 'full' ? config.palette.inkMuted : 'none'}
                          strokeWidth={Math.max(0.8, numFontSize * 0.08)}
                        />
                      )}

                      {/* Holiday */}
                      {cell.holiday && cursorY + lineSize < cy + ch - padY * 0.6 && (
                        <text
                          x={cx + padX}
                          y={cursorY}
                          dominantBaseline="hanging"
                          fontFamily={bodyFamily}
                          fontSize={lineSize * 0.92}
                          fontWeight={600}
                          fill={config.palette.holidayInk}
                        >
                          {cell.holiday}
                        </text>
                      )}

                      {/* User Events */}
                      {cell.events.map((ev, eIdx) => {
                        const yPos =
                          cursorY +
                          (cell.holiday ? lineSize * 1.3 : 0) +
                          eIdx * (lineSize * 1.48);
                        if (yPos + lineSize > cy + ch - padY * 0.5) return null;
                        return (
                          <React.Fragment key={ev.id}>
                            <rect
                              x={cx + padX}
                              y={yPos}
                              width={Math.max(1.5, 0.025 * pt)}
                              height={lineSize * 1.2}
                              fill={ev.color}
                            />
                            <text
                              x={cx + padX + Math.max(1.5, 0.025 * pt) + padX * 0.4}
                              y={yPos + lineSize * 0.08}
                              dominantBaseline="hanging"
                              fontFamily={bodyFamily}
                              fontSize={lineSize}
                              fontWeight={600}
                              fill={config.palette.inkPrimary}
                            >
                              {ev.title}
                            </text>
                          </React.Fragment>
                        );
                      })}

                      {/* DOY or ISO Week Badge */}
                      {(cell.dayOfYear !== null || cell.isoWeek !== null) && (
                        <text
                          x={cx + cw - padX}
                          y={cy + ch - padY * 0.6}
                          textAnchor="end"
                          dominantBaseline="ideographic"
                          fontFamily='"JetBrains Mono", monospace'
                          fontSize={Math.max(3.5, numFontSize * 0.46)}
                          fontWeight={500}
                          fill={config.palette.inkMuted}
                        >
                          {cell.isoWeek !== null
                            ? `W${cell.isoWeek}`
                            : `#${String(cell.dayOfYear).padStart(3, '0')}`}
                        </text>
                      )}
                    </>
                  )}

                  {isSelected && (
                    <rect
                      x={cx + 1}
                      y={cy + 1}
                      width={Math.max(1, cw - 2)}
                      height={Math.max(1, ch - 2)}
                      fill="none"
                      stroke={config.palette.accent}
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}

            {/* Structural Grid Lines */}
            {layout.lines.map((l, idx) => (
              <line
                key={`line-${idx}`}
                x1={l.x1 * pt}
                y1={l.y1 * pt}
                x2={l.x2 * pt}
                y2={l.y2 * pt}
                stroke={l.color}
                strokeWidth={Math.max(0.4, l.widthIn * pt)}
              />
            ))}

            {/* Text Labels */}
            {layout.labels.map((lbl, idx) => {
              const family =
                lbl.fontRole === 'display'
                  ? displayFamily
                  : lbl.fontRole === 'mono'
                    ? '"JetBrains Mono", monospace'
                    : bodyFamily;
              const anchor =
                lbl.align === 'left' ? 'start' : lbl.align === 'right' ? 'end' : 'middle';
              const base =
                lbl.baseline === 'top'
                  ? 'hanging'
                  : lbl.baseline === 'bottom'
                    ? 'ideographic'
                    : 'central';
              return (
                <text
                  key={`lbl-${idx}`}
                  x={lbl.x * pt}
                  y={lbl.y * pt}
                  textAnchor={anchor}
                  dominantBaseline={base}
                  fontFamily={family}
                  fontSize={lbl.fontSizeIn * pt}
                  fontWeight={lbl.fontWeight}
                  fill={lbl.color}
                  letterSpacing={lbl.letterSpacingEm ? `${lbl.letterSpacingEm}em` : undefined}
                >
                  {lbl.text}
                </text>
              );
            })}

            {/* Crop Marks */}
            {layout.cropMarks.map((cm, idx) => (
              <line
                key={`cm-${idx}`}
                x1={cm.x1 * pt}
                y1={cm.y1 * pt}
                x2={cm.x2 * pt}
                y2={cm.y2 * pt}
                stroke={cm.color}
                strokeWidth={Math.max(0.5, cm.widthIn * pt)}
              />
            ))}

            {/* Optional Studio Safe Margin & Trim Overlay */}
            {showGuides && (
              <g pointerEvents="none">
                <rect
                  x={layout.trimX * pt}
                  y={layout.trimY * pt}
                  width={layout.trimW * pt}
                  height={layout.trimH * pt}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={1.2}
                  strokeDasharray="6 4"
                />
                <rect
                  x={layout.contentX * pt}
                  y={layout.contentY * pt}
                  width={layout.contentW * pt}
                  height={layout.contentH * pt}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
