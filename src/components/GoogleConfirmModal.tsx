import { AlertTriangle, X } from 'lucide-react';
import { CalendarSpanEvent } from '../types/calendar';

interface GoogleConfirmModalProps {
  calendarName: string;
  events: CalendarSpanEvent[];
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GoogleConfirmModal({
  calendarName,
  events,
  isSubmitting,
  onConfirm,
  onCancel,
}: GoogleConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-stone-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gcal-confirm-title"
    >
      <div className="w-full max-w-md bg-white rounded-lg border border-stone-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <h2 id="gcal-confirm-title" className="text-sm font-bold text-stone-900">
              Confirm Google Calendar Sync
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel sync"
            className="p-1 text-stone-400 hover:text-stone-900 rounded transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs text-stone-700">
          <p className="leading-relaxed">
            This will create or update{' '}
            <span className="font-semibold text-stone-900 tabular-nums">
              {events.length} {events.length === 1 ? 'all-day event' : 'all-day events'}
            </span>{' '}
            on your Google Calendar{' '}
            <span className="font-semibold text-stone-900">“{calendarName}”</span>.
          </p>

          <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-md divide-y divide-stone-100 bg-stone-50/60">
            {events.map((ev) => (
              <div key={ev.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-3.5 rounded-xs shrink-0"
                    style={{ backgroundColor: ev.color }}
                  />
                  <span className="font-medium text-stone-900 truncate">{ev.title}</span>
                </div>
                <span className="text-[11px] text-stone-500 tabular-nums shrink-0">
                  {ev.endDate > ev.startDate ? `${ev.startDate} → ${ev.endDate}` : ev.startDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Syncing…' : `Sync ${events.length} ${events.length === 1 ? 'Event' : 'Events'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
