import React, { useState } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  BODY_FONTS,
  COLOR_PALETTES,
  DISPLAY_FONTS,
  EVENT_COLORS,
  LAYOUT_OPTIONS,
  PAPER_PRESETS,
} from '../data/presets';
import {
  CalendarConfig,
  CalendarDayEvent,
  DayNumberAlign,
  GridStrokeWeight,
  HeaderAlign,
  InspectorSection,
  MonthCaseStyle,
} from '../types/calendar';

interface InspectorPanelProps {
  activeSection: InspectorSection;
  config: CalendarConfig;
  onChange: (updater: (prev: CalendarConfig) => CalendarConfig) => void;
  onAddEventRange: (startKey: string, endKey: string, event: Omit<CalendarDayEvent, 'id'>) => void;
  onDeleteEvent: (eventId: string) => void;
  onClearAllEvents: () => void;
  eventsSyncSlot?: React.ReactNode;
}

export function InspectorPanel({
  activeSection,
  config,
  onChange,
  onAddEventRange,
  onDeleteEvent,
  onClearAllEvents,
  eventsSyncSlot,
}: InspectorPanelProps) {
  const [newStart, setNewStart] = useState(`${config.year}-05-10`);
  const [newEnd, setNewEnd] = useState(`${config.year}-05-10`);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0].hex);
  const [newFillCell, setNewFillCell] = useState(false);

  const updateYear = (nextYear: number) => {
    const clamped = Math.max(2020, Math.min(2040, nextYear));
    onChange((prev) => {
      const prevAuto = prev.schoolYear ? `${prev.year}–${prev.year + 1}` : String(prev.year);
      const nextAuto = prev.schoolYear ? `${clamped}–${clamped + 1}` : String(clamped);
      return {
        ...prev,
        year: clamped,
        title: prev.title === prevAuto || prev.title === String(prev.year) ? nextAuto : prev.title,
      };
    });
  };

  const setSchoolYearMode = (enabled: boolean) => {
    onChange((prev) => {
      const prevAuto = prev.schoolYear ? `${prev.year}–${prev.year + 1}` : String(prev.year);
      const nextAuto = enabled ? `${prev.year}–${prev.year + 1}` : String(prev.year);
      return {
        ...prev,
        schoolYear: enabled,
        title: prev.title === prevAuto ? nextAuto : prev.title,
      };
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStart) return;
    onAddEventRange(newStart, newEnd || newStart, {
      title: newTitle.trim(),
      color: newColor,
      fillCell: newFillCell,
    });
    setNewTitle('');
  };

  const allEvents = [...config.spanEvents].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  return (
    <aside className="w-full lg:w-[340px] max-h-[42vh] lg:max-h-none shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-stone-200 flex flex-col lg:h-full overflow-hidden">
      {/* Compact Year & Physical Size Strip */}
      <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-3 shrink-0 bg-stone-50/70">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateYear(config.year - 1)}
            aria-label="Previous year"
            className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 rounded transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-stone-900 tabular-nums px-1.5 whitespace-nowrap">
            {config.schoolYear ? `${config.year}–${config.year + 1}` : config.year}
          </span>
          <button
            type="button"
            onClick={() => updateYear(config.year + 1)}
            aria-label="Next year"
            className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 rounded transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-stone-500 tabular-nums whitespace-nowrap">
          <span>{config.widthIn}&Prime; &times; {config.heightIn}&Prime;</span>
          <span aria-hidden="true" className="mx-1.5">·</span>
          <span>300 DPI</span>
        </div>
      </div>

      {/* Scrollable Active Section Controls */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {activeSection === 'layout' && (
          <>
            {/* Layout Archetype */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Calendar Layout
              </h2>
              <div className="space-y-1.5">
                {LAYOUT_OPTIONS.map((opt) => {
                  const active = config.layout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, layout: opt.id }))}
                      className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors cursor-pointer ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.name}</div>
                      <div
                        className={`text-[11px] mt-0.5 leading-snug ${
                          active ? 'text-stone-300' : 'text-stone-500'
                        }`}
                      >
                        {opt.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <hr className="border-stone-200" />

            {/* Paper Size & Physical Dimensions */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                  Print Dimensions (Up to 40&Prime; Wide)
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    onChange((p) => ({
                      ...p,
                      widthIn: Math.min(40, p.heightIn),
                      heightIn: p.widthIn,
                    }))
                  }
                  className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
                  title="Swap width and height"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Swap</span>
                </button>
              </div>

              <select
                value={
                  PAPER_PRESETS.find(
                    (pr) => pr.widthIn === config.widthIn && pr.heightIn === config.heightIn
                  )?.id ?? 'custom'
                }
                onChange={(e) => {
                  const preset = PAPER_PRESETS.find((pr) => pr.id === e.target.value);
                  if (preset) {
                    onChange((p) => ({
                      ...p,
                      widthIn: preset.widthIn,
                      heightIn: preset.heightIn,
                    }));
                  }
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-white border border-stone-300 rounded-md text-stone-900 focus:outline-none focus:border-stone-900"
              >
                {PAPER_PRESETS.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} — {pr.subtitle}
                  </option>
                ))}
                <option value="custom">Custom Dimensions</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-600">Width (in, max 40)</span>
                  <input
                    type="number"
                    min={11}
                    max={40}
                    step={0.5}
                    value={config.widthIn}
                    onChange={(e) => {
                      const val = Math.max(11, Math.min(40, Number(e.target.value) || 11));
                      onChange((p) => ({ ...p, widthIn: val }));
                    }}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs tabular-nums border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-stone-600">Height (in, max 60)</span>
                  <input
                    type="number"
                    min={11}
                    max={60}
                    step={0.5}
                    value={config.heightIn}
                    onChange={(e) => {
                      const val = Math.max(11, Math.min(60, Number(e.target.value) || 11));
                      onChange((p) => ({ ...p, heightIn: val }));
                    }}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs tabular-nums border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                  />
                </label>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                  <span>Safe Margin</span>
                  <span className="tabular-nums font-medium">{config.marginIn.toFixed(2)}&Prime;</span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={1.75}
                  step={0.05}
                  value={config.marginIn}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, marginIn: Number(e.target.value) }))
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.bleedIn > 0}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, bleedIn: e.target.checked ? 0.125 : 0 }))
                    }
                    className="rounded border-stone-300 accent-stone-900"
                  />
                  <span>0.125&Prime; Bleed</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showCropMarks}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, showCropMarks: e.target.checked }))
                    }
                    className="rounded border-stone-300 accent-stone-900"
                  />
                  <span>Crop Marks</span>
                </label>
              </div>
            </section>

            <hr className="border-stone-200" />

            {/* Calendar Features */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Grid Structure & Details
              </h2>

              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                {([
                  { val: false, label: 'Jan – Dec' },
                  { val: true, label: 'School Year (Jul – Jun)' },
                ] as const).map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setSchoolYearMode(opt.val)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      config.schoolYear === opt.val
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                {([
                  { val: 1 as const, label: 'Monday Start' },
                  { val: 0 as const, label: 'Sunday Start' },
                ]).map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => onChange((p) => ({ ...p, weekStart: opt.val }))}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      config.weekStart === opt.val
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                {[
                  { key: 'showHolidays' as const, label: 'US Federal & Major Holidays' },
                  { key: 'showMoonPhases' as const, label: 'New & Full Moon Markers' },
                  { key: 'showIsoWeeks' as const, label: 'ISO Week Numbers' },
                  { key: 'showDayOfYear' as const, label: 'Day of Year (001–365)' },
                  { key: 'showWriteLines' as const, label: 'Writeable Ruled Lines in Cells' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between text-xs text-stone-700 cursor-pointer py-0.5"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={config[item.key]}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, [item.key]: e.target.checked }))
                      }
                      className="rounded border-stone-300 accent-stone-900"
                    />
                  </label>
                ))}
              </div>

              {config.showWriteLines && (
                <div className="pt-1">
                  <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                    <span>Ruled Lines per Cell</span>
                    <span className="tabular-nums font-medium">{config.writeLineCount}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={1}
                    value={config.writeLineCount}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, writeLineCount: Number(e.target.value) }))
                    }
                    className="w-full accent-stone-900 cursor-pointer"
                  />
                </div>
              )}
            </section>
          </>
        )}

        {activeSection === 'typography' && (
          <>
            {/* Titles & Header */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                  Poster Title & Header
                </h2>
                <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showHeader}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, showHeader: e.target.checked }))
                    }
                    className="accent-stone-900"
                  />
                  <span>Show</span>
                </label>
              </div>

              {config.showHeader && (
                <div className="space-y-2.5">
                  <label className="block">
                    <span className="text-[11px] font-medium text-stone-600">Headline</span>
                    <input
                      type="text"
                      value={config.title}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="2027"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-stone-600">Subtitle</span>
                    <input
                      type="text"
                      value={config.subtitle}
                      onChange={(e) =>
                        onChange((p) => ({ ...p, subtitle: e.target.value }))
                      }
                      placeholder="ANNUAL WALL PLANNER"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                    />
                  </label>
                  <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                    {(['left', 'center', 'split'] as HeaderAlign[]).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => onChange((p) => ({ ...p, headerAlign: align }))}
                        className={`flex-1 py-1 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                          config.headerAlign === align
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-stone-700">Footer Legend</span>
                <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showFooter}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, showFooter: e.target.checked }))
                    }
                    className="accent-stone-900"
                  />
                  <span>Show</span>
                </label>
              </div>
              {config.showFooter && (
                <input
                  type="text"
                  value={config.footerNote}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, footerNote: e.target.value }))
                  }
                  placeholder="Footer note or motto"
                  className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                />
              )}
            </section>

            <hr className="border-stone-200" />

            {/* Font Selection */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Typeface Pairing
              </h2>

              <label className="block">
                <span className="text-[11px] font-medium text-stone-600">
                  Display Font (Title & Months)
                </span>
                <select
                  value={config.typography.displayFont}
                  onChange={(e) => {
                    const font = DISPLAY_FONTS.find((f) => f.family === e.target.value);
                    onChange((p) => ({
                      ...p,
                      typography: {
                        ...p.typography,
                        displayFont: e.target.value,
                        displayWeight: font?.weight ?? 700,
                      },
                    }));
                  }}
                  className="mt-1 w-full px-2.5 py-2 text-xs font-medium bg-white border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                >
                  {DISPLAY_FONTS.map((f) => (
                    <option key={f.id} value={f.family}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-stone-600">
                  Grid & Event Font
                </span>
                <select
                  value={config.typography.bodyFont}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      typography: { ...p.typography, bodyFont: e.target.value },
                    }))
                  }
                  className="mt-1 w-full px-2.5 py-2 text-xs font-medium bg-white border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f.id} value={f.family}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center justify-between text-xs text-stone-700 cursor-pointer pt-1">
                <span>Monospace Day Numerals</span>
                <input
                  type="checkbox"
                  checked={config.typography.useMonoNumbers}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      typography: { ...p.typography, useMonoNumbers: e.target.checked },
                    }))
                  }
                  className="accent-stone-900"
                />
              </label>
            </section>

            <hr className="border-stone-200" />

            {/* Proportions & Grid Rules */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Scale & Line Weight
              </h2>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                  <span>Title Scale</span>
                  <span className="tabular-nums font-medium">
                    {Math.round(config.typography.titleScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.5}
                  step={0.05}
                  value={config.typography.titleScale}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      typography: { ...p.typography, titleScale: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                  <span>Month Label Scale</span>
                  <span className="tabular-nums font-medium">
                    {Math.round(config.typography.monthScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.45}
                  step={0.05}
                  value={config.typography.monthScale}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      typography: { ...p.typography, monthScale: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                  <span>Day Number Scale</span>
                  <span className="tabular-nums font-medium">
                    {Math.round(config.typography.dayNumberScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={config.typography.dayNumberScale}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      typography: { ...p.typography, dayNumberScale: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-stone-600 block">Month Case</span>
                <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                  {([
                    { id: 'uppercase', label: 'UPPER' },
                    { id: 'title', label: 'Title' },
                    { id: 'abbr-upper', label: 'JAN–DEC' },
                  ] as { id: MonthCaseStyle; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onChange((p) => ({
                          ...p,
                          typography: { ...p.typography, monthCase: opt.id },
                        }))
                      }
                      className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                        config.typography.monthCase === opt.id
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-600 block">
                  Day Number Alignment
                </span>
                <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                  {([
                    { id: 'top-left', label: 'Left' },
                    { id: 'center', label: 'Center' },
                    { id: 'top-right', label: 'Right' },
                  ] as { id: DayNumberAlign; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onChange((p) => ({
                          ...p,
                          typography: { ...p.typography, dayNumberAlign: opt.id },
                        }))
                      }
                      className={`flex-1 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                        config.typography.dayNumberAlign === opt.id
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-600 block">
                  Grid Rule Weight
                </span>
                <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                  {(['none', 'hairline', 'crisp', 'bold'] as GridStrokeWeight[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        onChange((p) => ({
                          ...p,
                          typography: { ...p.typography, gridStrokeWeight: w },
                        }))
                      }
                      className={`flex-1 py-1 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                        config.typography.gridStrokeWeight === w
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {activeSection === 'palette' && (
          <>
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Curated Paper & Ink Themes
              </h2>
              <div className="space-y-1.5">
                {COLOR_PALETTES.map((pal) => {
                  const active = config.palette.id === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, palette: { ...pal } }))}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md border transition-colors cursor-pointer ${
                        active
                          ? 'border-stone-900 bg-stone-50'
                          : 'border-stone-200 hover:border-stone-400 bg-white'
                      }`}
                    >
                      <span className="text-xs font-semibold text-stone-900">{pal.name}</span>
                      <div className="flex items-center gap-1">
                        {[pal.paperBg, pal.weekendBg, pal.inkPrimary, pal.accent].map((hex, i) => (
                          <span
                            key={i}
                            className="w-4 h-4 rounded-sm border border-stone-300/80"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <hr className="border-stone-200" />

            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Custom Color Overrides
              </h2>

              <div>
                <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                  <span>Weekend Shading Intensity</span>
                  <span className="tabular-nums font-medium">
                    {Math.round(config.weekendTintStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.weekendTintStrength}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, weekendTintStrength: Number(e.target.value) }))
                  }
                  className="w-full accent-stone-900 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { key: 'paperBg' as const, label: 'Paper Stock' },
                  { key: 'inkPrimary' as const, label: 'Primary Ink' },
                  { key: 'weekendBg' as const, label: 'Weekend Tint' },
                  { key: 'gridRule' as const, label: 'Grid Rules' },
                  { key: 'accent' as const, label: 'Accent Color' },
                  { key: 'holidayInk' as const, label: 'Holiday Ink' },
                ].map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center justify-between px-2.5 py-1.5 border border-stone-200 rounded-md text-xs text-stone-700 cursor-pointer hover:border-stone-400"
                  >
                    <span className="truncate mr-2">{field.label}</span>
                    <input
                      type="color"
                      value={config.palette[field.key]}
                      onChange={(e) =>
                        onChange((p) => ({
                          ...p,
                          palette: {
                            ...p.palette,
                            id: 'custom',
                            [field.key]: e.target.value,
                          },
                        }))
                      }
                      className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer shrink-0"
                    />
                  </label>
                ))}
              </div>
            </section>
          </>
        )}

        {activeSection === 'events' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                Add Event or Multi-Day Span
              </h2>
              <form onSubmit={handleAddSubmit} className="space-y-2.5">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Milestone, trip, or deadline"
                  className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-stone-600">Start Date</span>
                    <input
                      type="date"
                      value={newStart}
                      onChange={(e) => {
                        setNewStart(e.target.value);
                        if (newEnd < e.target.value) setNewEnd(e.target.value);
                      }}
                      className="mt-0.5 w-full px-2 py-1 text-xs tabular-nums border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-stone-600">End Date</span>
                    <input
                      type="date"
                      value={newEnd}
                      min={newStart}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="mt-0.5 w-full px-2 py-1 text-xs tabular-nums border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    {EVENT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewColor(c.hex)}
                        aria-label={c.label}
                        className={`w-5 h-5 rounded-sm transition-transform cursor-pointer ${
                          newColor === c.hex ? 'ring-2 ring-offset-1 ring-stone-900 scale-110' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFillCell}
                      onChange={(e) => setNewFillCell(e.target.checked)}
                      className="accent-stone-900"
                    />
                    <span>Shade cell</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Calendar</span>
                </button>
              </form>
            </section>

            <hr className="border-stone-200" />

            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
                  Scheduled Annotations ({allEvents.length})
                </h2>
                {allEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAllEvents}
                    className="text-[11px] text-red-700 hover:underline cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {allEvents.length === 0 ? (
                <p className="text-xs text-stone-500 py-3">
                  No events yet. Click any day on the sheet, add one above, or import from Google Calendar / .ics below.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 border-t border-stone-100 max-h-52 overflow-y-auto pr-1">
                  {allEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-1.5 h-4 rounded-xs shrink-0"
                          style={{ backgroundColor: ev.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-stone-900 truncate">{ev.title}</div>
                          <div className="text-[11px] text-stone-500 tabular-nums">
                            {ev.endDate > ev.startDate
                              ? `${ev.startDate} → ${ev.endDate}`
                              : ev.startDate}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(ev.id)}
                        aria-label={`Remove ${ev.title}`}
                        className="p-1 text-stone-400 hover:text-red-700 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {eventsSyncSlot && (
              <>
                <hr className="border-stone-200" />
                {eventsSyncSlot}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
