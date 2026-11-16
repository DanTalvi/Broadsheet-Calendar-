import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { EVENT_COLORS } from '../data/presets';
import { CalendarDayEvent, CalendarSpanEvent } from '../types/calendar';
import { getUSHolidaysForYear } from '../utils/calendarMath';

interface DayEventEditorProps {
  dateKey: string;
  events: CalendarSpanEvent[];
  onClose: () => void;
  onAddEventRange: (startKey: string, endKey: string, event: Omit<CalendarDayEvent, 'id'>) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function DayEventEditor({
  dateKey,
  events,
  onClose,
  onAddEventRange,
  onDeleteEvent,
}: DayEventEditorProps) {
  const [title, setTitle] = useState('');
  const [endDate, setEndDate] = useState(dateKey);
  const [color, setColor] = useState(EVENT_COLORS[0].hex);
  const [fillCell, setFillCell] = useState(false);

  useEffect(() => {
    setEndDate(dateKey);
  }, [dateKey]);

  const [yStr, mStr, dStr] = dateKey.split('-');
  const dateObj = new Date(Number(yStr), Number(mStr) - 1, Number(dStr));
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const holiday = getUSHolidaysForYear(Number(yStr))[dateKey];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const effectiveEnd = endDate && endDate >= dateKey ? endDate : dateKey;
    onAddEventRange(dateKey, effectiveEnd, { title: title.trim(), color, fillCell });
    setTitle('');
    setEndDate(dateKey);
  };

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white border border-stone-200 rounded-lg shadow-xl p-4 z-30">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <div className="text-xs font-semibold text-stone-900">{formattedDate}</div>
          {holiday && (
            <div className="text-[11px] font-medium text-red-700 mt-0.5">{holiday}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close day editor"
          className="p-1 text-stone-400 hover:text-stone-900 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {events.length > 0 && (
        <div className="py-2 space-y-1.5 border-b border-stone-200 max-h-40 overflow-y-auto">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: ev.color }}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-stone-800">{ev.title}</div>
                  {ev.endDate > ev.startDate && (
                    <div className="text-[10px] text-stone-500 tabular-nums">
                      {ev.startDate} → {ev.endDate}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteEvent(ev.id)}
                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer shrink-0"
                aria-label={`Remove ${ev.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="pt-3 space-y-2.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add event or span title..."
          autoFocus
          className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
        />
        <label className="flex items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>End Date (optional span)</span>
          <input
            type="date"
            value={endDate}
            min={dateKey}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 text-xs tabular-nums border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
          />
        </label>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.hex)}
                aria-label={c.label}
                className={`w-4 h-4 rounded-sm cursor-pointer ${
                  color === c.hex ? 'ring-2 ring-offset-1 ring-stone-900' : ''
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={fillCell}
              onChange={(e) => setFillCell(e.target.checked)}
              className="accent-stone-900"
            />
            <span>Shade cells</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={!title.trim()}
          className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{endDate > dateKey ? 'Add Spanning Event' : 'Add Note'}</span>
        </button>
      </form>
    </div>
  );
}
