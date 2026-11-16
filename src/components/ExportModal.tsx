import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { CalendarConfig, ExportFormat } from '../types/calendar';
import { ComputedCalendarLayout } from '../utils/calendarLayout';
import { exportHighResPNG, exportPrintPDF, exportVectorSVG } from '../utils/canvasRenderer';

interface ExportModalProps {
  config: CalendarConfig;
  layout: ComputedCalendarLayout;
  onClose: () => void;
}

const DPI_OPTIONS = [
  { dpi: 150, label: '150 DPI', note: 'Fast Proof' },
  { dpi: 200, label: '200 DPI', note: 'Large Format' },
  { dpi: 300, label: '300 DPI', note: 'Archival Print' },
];

export function ExportModal({ config, layout, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [dpi, setDpi] = useState<number>(300);
  const [isExporting, setIsExporting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusLabel, setStatusLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pxW = Math.round(layout.totalWidthIn * dpi);
  const pxH = Math.round(layout.totalHeightIn * dpi);
  const megapixels = ((pxW * pxH) / 1_000_000).toFixed(1);

  const triggerDownload = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sizeSlug = `${config.widthIn}x${config.heightIn}`;
    const yearSlug = config.schoolYear ? `${config.year}-${config.year + 1}` : String(config.year);
    const dpiSlug = format === 'svg' ? 'vector' : `${dpi}dpi`;
    link.href = url;
    link.download = `broadsheet-${yearSlug}-${sizeSlug}-${dpiSlug}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleExport = async () => {
    setErrorMsg(null);
    setIsExporting(true);
    setProgressPct(4);
    setStatusLabel('Loading print typography…');

    try {
      if (format === 'svg') {
        const blob = exportVectorSVG(layout, config);
        triggerDownload(blob, 'svg');
        setProgressPct(100);
        setStatusLabel('SVG downloaded');
      } else if (format === 'png') {
        const blob = await exportHighResPNG(layout, config, dpi, (pct, lbl) => {
          setProgressPct(pct);
          setStatusLabel(lbl);
        });
        triggerDownload(blob, 'png');
      } else {
        const blob = await exportPrintPDF(layout, config, dpi, (pct, lbl) => {
          setProgressPct(pct);
          setStatusLabel(lbl);
        });
        triggerDownload(blob, 'pdf');
      }
      setTimeout(() => {
        setIsExporting(false);
      }, 600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed.');
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/45 flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="bg-white border border-stone-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 id="export-modal-title" className="text-base font-bold text-stone-900">
            Export Print Master
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            aria-label="Close export modal"
            className="p-1 text-stone-400 hover:text-stone-900 rounded transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Output Spec Summary */}
          <div className="grid grid-cols-2 gap-4 py-3 border-y border-stone-200 text-xs">
            <div>
              <div className="text-stone-500">Physical Sheet Size</div>
              <div className="font-semibold text-stone-900 tabular-nums mt-0.5">
                {layout.totalWidthIn.toFixed(2)}&Prime; &times; {layout.totalHeightIn.toFixed(2)}&Prime;
              </div>
              {config.bleedIn > 0 && (
                <div className="text-[11px] text-stone-500 tabular-nums">
                  Includes {config.bleedIn}&Prime; bleed
                </div>
              )}
            </div>
            <div>
              <div className="text-stone-500">Output Resolution</div>
              <div className="font-semibold text-stone-900 tabular-nums mt-0.5">
                {format === 'svg'
                  ? 'Infinite Vector'
                  : `${pxW.toLocaleString()} × ${pxH.toLocaleString()} px`}
              </div>
              <div className="text-[11px] text-stone-500 tabular-nums">
                {format === 'svg' ? '72 pt/in architectural SVG' : `${megapixels} MP @ ${dpi} DPI`}
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-600 block">Export Format</span>
            <div className="space-y-1.5">
              {[
                {
                  id: 'png' as const,
                  title: 'High-Res PNG (with 300 DPI Metadata)',
                  desc: 'Lossless raster image with embedded physical DPI header for print shops.',
                },
                {
                  id: 'pdf' as const,
                  title: 'Print-Ready PDF (Exact Inch Trim)',
                  desc: 'Multi-inch single-page PDF sized to exact wall dimensions.',
                },
                {
                  id: 'svg' as const,
                  title: 'Vector SVG (Illustrator / Figma)',
                  desc: 'Scalable vector lines and typography in physical inches.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isExporting}
                  onClick={() => setFormat(opt.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-md border transition-colors cursor-pointer ${
                    format === opt.id
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-400 bg-white'
                  }`}
                >
                  <div className="text-xs font-semibold text-stone-900">{opt.title}</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* DPI Selector (for PNG & PDF) */}
          {format !== 'svg' && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-600 block">Print Resolution</span>
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
                {DPI_OPTIONS.map((opt) => (
                  <button
                    key={opt.dpi}
                    type="button"
                    disabled={isExporting}
                    onClick={() => setDpi(opt.dpi)}
                    className={`flex-1 py-1.5 px-2 rounded transition-colors cursor-pointer ${
                      dpi === opt.dpi
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <div className="text-xs font-semibold tabular-nums">{opt.label}</div>
                    <div className="text-[10px] text-stone-500">{opt.note}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isExporting && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-700 font-medium">{statusLabel}</span>
                <span className="tabular-nums text-stone-600">{progressPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-stone-900 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              disabled={isExporting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting
                  ? 'Rendering…'
                  : format === 'svg'
                    ? 'Download SVG'
                    : `Download ${dpi} DPI ${format.toUpperCase()}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
