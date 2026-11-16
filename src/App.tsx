import { useEffect, useMemo, useState } from 'react';
import { CalendarPreviewCanvas } from './components/CalendarPreviewCanvas';
import { DayEventEditor } from './components/DayEventEditor';
import { ExportModal } from './components/ExportModal';
import { HeaderBar } from './components/HeaderBar';
import { InspectorPanel } from './components/InspectorPanel';
import { DEFAULT_CONFIG } from './data/presets';
import { CalendarConfig, CalendarDayEvent, InspectorSection } from './types/calendar';
import { computeCalendarLayout } from './utils/calendarLayout';

const STORAGE_KEY = 'broadsheet_studio_config_v1';

function loadInitialConfig(): CalendarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<CalendarConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      typography: {
        ...DEFAULT_CONFIG.typography,
        ...(parsed.typography ?? {}),
      },
      palette: {
        ...DEFAULT_CONFIG.palette,
        ...(parsed.palette ?? {}),
      },
      events: parsed.events ?? DEFAULT_CONFIG.events,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function App() {
  const [config, setConfig] = useState<CalendarConfig>(loadInitialConfig);
  const [activeSection, setActiveSection] = useState<InspectorSection>('layout');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  const layout = useMemo(() => computeCalendarLayout(config), [config]);

  const handleAddEvent = (dateKey: string, ev: Omit<CalendarDayEvent, 'id'>) => {
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setConfig((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [dateKey]: [...(prev.events[dateKey] ?? []), { ...ev, id }],
      },
    }));
  };

  const handleAddEventRange = (
    startKey: string,
    endKey: string,
    ev: Omit<CalendarDayEvent, 'id'>
  ) => {
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const [ey, em, ed] = endKey.split('-').map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd));
    const endDate = new Date(Date.UTC(ey, em - 1, ed));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return;

    const nextEvents = { ...config.events };
    const cursor = new Date(startDate);
    let safety = 0;
    while (cursor <= endDate && safety < 366) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cursor.getUTCDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const id = `ev-${Date.now()}-${safety}-${Math.random().toString(36).slice(2, 5)}`;
      nextEvents[key] = [...(nextEvents[key] ?? []), { ...ev, id }];
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      safety++;
    }

    setConfig((prev) => ({
      ...prev,
      events: nextEvents,
    }));
  };

  const handleDeleteEvent = (dateKey: string, eventId: string) => {
    setConfig((prev) => {
      const existing = prev.events[dateKey] ?? [];
      const filtered = existing.filter((item) => item.id !== eventId);
      const next = { ...prev.events };
      if (filtered.length === 0) {
        delete next[dateKey];
      } else {
        next[dateKey] = filtered;
      }
      return { ...prev, events: next };
    });
  };

  const handleClearAllEvents = () => {
    setConfig((prev) => ({ ...prev, events: {} }));
    setSelectedDateKey(null);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F3EF] text-stone-900">
      <HeaderBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenExport={() => setShowExportModal(true)}
      />

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        <InspectorPanel
          activeSection={activeSection}
          config={config}
          onChange={setConfig}
          onAddEventRange={handleAddEventRange}
          onDeleteEvent={handleDeleteEvent}
          onClearAllEvents={handleClearAllEvents}
        />

        <CalendarPreviewCanvas
          config={config}
          layout={layout}
          selectedDateKey={selectedDateKey}
          onSelectDate={(dateKey) =>
            setSelectedDateKey((cur) => (cur === dateKey ? null : dateKey))
          }
        />

        {selectedDateKey && (
          <DayEventEditor
            dateKey={selectedDateKey}
            events={config.events[selectedDateKey] ?? []}
            onClose={() => setSelectedDateKey(null)}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </main>

      {showExportModal && (
        <ExportModal
          config={config}
          layout={layout}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
