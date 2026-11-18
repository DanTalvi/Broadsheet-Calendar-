import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { EVENT_COLORS } from '../data/presets';
import { CalendarDayEvent, CalendarSpanEvent, EventColorItem } from '../types/calendar';
import { getUSHolidaysForYear } from '../utils/calendarMath';

interface DayEventEditorProps {
  dateKey: string;
  events: CalendarSpanEvent[];
  eventPalette?: EventColorItem[];
  onClose: () => void;
  onAddEventRange: (startKey: string, endKey: string, event: Omit<CalendarDayEvent, 'id'>) => void;
  onUpdateEvent: (eventId: string, updates: Partial<Omit<CalendarSpanEvent, 'id'>>) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function DayEventEditor({
  dateKey,
  events,
  eventPalette = EVENT_COLORS,
  onClose,
  onAddEventRange,
  onUpdateEvent,
  onDeleteEvent,
}: DayEventEditorProps) {
  const [title, setTitle] = useState('');
  const [endDate, setEndDate] = useState(dateKey);
  const [color, setColor] = useState(EVENT_COLORS[0].hex);
  const [fillCell, setFillCell] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editColor, setEditColor] = useState(EVENT_COLORS[0].hex);
  const [editFillCell, setEditFillCell] = useState(false);

  useEffect(() => {
    setEndDate(dateKey);
    setEditingId(null);
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

  const startEdit = (ev: CalendarSpanEvent) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditStart(ev.startDate);
    setEditEnd(ev.endDate);
    setEditColor(ev.color);
    setEditFillCell(Boolean(ev.fillCell));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editTitle.trim() || !editStart) return;
    onUpdateEvent(editingId, {
      title: editTitle.trim(),
      startDate: editStart,
      endDate: editEnd && editEnd >= editStart ? editEnd : editStart,
      color: editColor,
      fillCell: editFillCell,
    });
    setEditingId(null);
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
        <div className="py-2 space-y-1.5 border-b border-stone-200 max-h-56 overflow-y-auto">
          {events.map((ev) => {
            if (editingId === ev.id) {
              return (
                <form
                  key={ev.id}
                  onSubmit={handleSaveEdit}
                  className="p-2 bg-stone-50 border border-stone-300 rounded space-y-2 text-xs"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={editStart}
                      onChange={(e) => {
                        setEditStart(e.target.value);
                        if (editEnd < e.target.value) setEditEnd(e.target.value);
                      }}
                      className="w-full px-1.5 py-1 text-[11px] tabular-nums bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    />
                    <input
                      type="date"
                      value={editEnd}
                      min={editStart}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="w-full px-1.5 py-1 text-[11px] tabular-nums bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {eventPalette.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditColor(c.hex)}
                          aria-label={c.category ? `${c.category} (${c.label})` : c.label}
                          title={c.category ? `${c.category} (${c.label})` : c.label}
                          className={`w-4 h-4 rounded-sm border border-stone-300/80 cursor-pointer ${
                            editColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'ring-2 ring-offset-1 ring-stone-900'
                              : ''
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                      <label
                        title="Custom color (auto-saves on save)"
                        className="w-4 h-4 rounded-sm border border-stone-400 overflow-hidden cursor-pointer"
                        style={{ backgroundColor: editColor }}
                      >
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="opacity-0 w-full h-full cursor-pointer"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-1 text-[11px] text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFillCell}
                        onChange={(e) => setEditFillCell(e.target.checked)}
                        className="accent-stone-900"
                      />
                      <span>Shade cells</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-[11px] text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!editTitle.trim() || !editStart}
                      className="px-2 py-1 text-[11px] font-semibold text-white bg-stone-900 rounded hover:bg-stone-800 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div key={ev.id} className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => startEdit(ev)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer hover:bg-stone-50 rounded py-0.5 px-1 -mx-1"
                  title="Click to revise event"
                >
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
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(ev)}
                    className="p-1 text-stone-400 hover:text-stone-900 cursor-pointer"
                    aria-label={`Revise ${ev.title}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(ev.id)}
                    className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                    aria-label={`Remove ${ev.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
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
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {eventPalette.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.hex)}
                aria-label={c.category ? `${c.category} (${c.label})` : c.label}
                title={c.category ? `${c.category} (${c.label})` : c.label}
                className={`w-4 h-4 rounded-sm border border-stone-300/80 cursor-pointer ${
                  color.toLowerCase() === c.hex.toLowerCase()
                    ? 'ring-2 ring-offset-1 ring-stone-900'
                    : ''
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <label
              title="Custom color (auto-saves on add)"
              className="w-4 h-4 rounded-sm border border-stone-400 overflow-hidden cursor-pointer"
              style={{ backgroundColor: color }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom highlight color"
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </label>
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
