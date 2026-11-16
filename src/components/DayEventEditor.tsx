import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { EVENT_COLORS } from '../data/presets';
import { CalendarDayEvent } from '../types/calendar';
import { getUSHolidaysForYear } from '../utils/calendarMath';

interface DayEventEditorProps {
  dateKey: string;
  events: CalendarDayEvent[];
  onClose: () => void;
  onAddEvent: (dateKey: string, event: Omit<CalendarDayEvent, 'id'>) => void;
  onDeleteEvent: (dateKey: string, eventId: string) => void;
}

export function DayEventEditor({
  dateKey,
  events,
  onClose,
  onAddEvent,
  onDeleteEvent,
}: DayEventEditorProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(EVENT_COLORS[0].hex);
  const [fillCell, setFillCell] = useState(false);

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
    onAddEvent(dateKey, { title: title.trim(), color, fillCell });
    setTitle('');
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
        <div className="py-2 space-y-1.5 border-b border-stone-200">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: ev.color }}
                />
                <span className="truncate font-medium text-stone-800">{ev.title}</span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteEvent(dateKey, ev.id)}
                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer shrink-0"
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
          placeholder="Add label for this date..."
          autoFocus
          className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
        />
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
            <span>Shade cell</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={!title.trim()}
          className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Note</span>
        </button>
      </form>
    </div>
  );
}
