import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { CalendarPreviewCanvas } from './components/CalendarPreviewCanvas';
import { DayEventEditor } from './components/DayEventEditor';
import { EventsSyncPanel } from './components/EventsSyncPanel';
import { ExportModal } from './components/ExportModal';
import { GoogleConfirmModal } from './components/GoogleConfirmModal';
import { HeaderBar } from './components/HeaderBar';
import { InspectorPanel } from './components/InspectorPanel';
import { DEFAULT_CONFIG } from './data/presets';
import {
  CalendarConfig,
  CalendarDayEvent,
  CalendarSpanEvent,
  InspectorSection,
} from './types/calendar';
import { computeCalendarLayout } from './utils/calendarLayout';
import {
  fetchGoogleCalendarEvents,
  fetchGoogleCalendars,
  getVisibleDateBounds,
  GoogleAuthExpiredError,
  GoogleCalendarListItem,
  syncEventsToGoogleCalendar,
} from './utils/googleCalendarApi';
import {
  clearCachedAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './utils/googleCalendarAuth';
import {
  downloadICSFile,
  exportEventsToICS,
  parseICSToSpanEvents,
} from './utils/icalendar';
import {
  deleteCalendarSnapshot,
  downloadProjectJson,
  loadSavedSnapshots,
  parseProjectJson,
  saveCalendarSnapshot,
  SavedCalendarSnapshot,
} from './utils/projectStorage';

const STORAGE_KEY = 'broadsheet_studio_config_v1';
const LEGACY_DEFAULTS_CLEANED_KEY = 'broadsheet_defaults_removed_v1';
const LEGACY_SAMPLE_IDS = new Set(['sample-1', 'sample-2', 'sample-3']);

function migrateLegacyEvents(
  legacy: Record<string, CalendarDayEvent[]> | undefined
): CalendarSpanEvent[] {
  if (!legacy) return [];
  const flat: CalendarSpanEvent[] = [];
  for (const [dateKey, items] of Object.entries(legacy).sort(([a], [b]) => a.localeCompare(b))) {
    for (const item of items) {
      flat.push({
        id: item.id,
        title: item.title,
        startDate: dateKey,
        endDate: dateKey,
        color: item.color,
        fillCell: item.fillCell,
      });
    }
  }
  return flat;
}

function loadInitialConfig(): CalendarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<CalendarConfig>;
    let spanEvents = Array.isArray(parsed.spanEvents)
      ? parsed.spanEvents
      : parsed.events
        ? migrateLegacyEvents(parsed.events)
        : [];

    // One-time cleanup of old auto-generated sample events if present
    if (!localStorage.getItem(LEGACY_DEFAULTS_CLEANED_KEY)) {
      spanEvents = spanEvents.filter((ev) => !LEGACY_SAMPLE_IDS.has(ev.id));
      localStorage.setItem(LEGACY_DEFAULTS_CLEANED_KEY, '1');
    }

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
      spanEvents,
      events: undefined,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeSpanEvents(
  existing: CalendarSpanEvent[],
  incoming: CalendarSpanEvent[],
  replaceExisting: boolean
): { next: CalendarSpanEvent[]; addedCount: number } {
  if (replaceExisting) {
    return { next: incoming, addedCount: incoming.length };
  }
  const seen = new Set(
    existing.map((ev) => `${ev.title.trim().toLowerCase()}|${ev.startDate}|${ev.endDate}`)
  );
  const additions: CalendarSpanEvent[] = [];
  for (const ev of incoming) {
    const key = `${ev.title.trim().toLowerCase()}|${ev.startDate}|${ev.endDate}`;
    if (!seen.has(key)) {
      seen.add(key);
      additions.push(ev);
    }
  }
  return {
    next: [...existing, ...additions],
    addedCount: additions.length,
  };
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
  const [config, setConfig] = useState<CalendarConfig>(loadInitialConfig);
  const [activeSection, setActiveSection] = useState<InspectorSection>('layout');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Save progress & snapshots
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SavedCalendarSnapshot[]>(loadSavedSnapshots);

  // iCalendar status
  const [icsStatus, setIcsStatus] = useState<string | null>(null);

  // Google Calendar auth & sync state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('primary');
  const [googleStatus, setGoogleStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(
    null
  );
  const [showPushConfirm, setShowPushConfirm] = useState(false);

  // Persist config automatically to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setLastSavedAt(formatTimeLabel(new Date()));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  const loadCalendarsWithToken = useCallback(async (token: string) => {
    setIsGoogleBusy(true);
    try {
      const list = await fetchGoogleCalendars(token);
      setGoogleCalendars(list);
      const primaryCal = list.find((c) => c.primary) ?? list[0];
      if (primaryCal) {
        setSelectedCalendarId((cur) =>
          list.some((c) => c.id === cur) ? cur : primaryCal.id
        );
      }
    } catch (err: unknown) {
      if (err instanceof GoogleAuthExpiredError) {
        clearCachedAccessToken();
        setNeedsGoogleAuth(true);
      }
      setGoogleStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load Google calendars.',
      });
    } finally {
      setIsGoogleBusy(false);
    }
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setNeedsGoogleAuth(false);
        void loadCalendarsWithToken(token);
      },
      () => {
        setGoogleUser(null);
        setNeedsGoogleAuth(true);
        setGoogleCalendars([]);
      }
    );
    return unsubscribe;
  }, [loadCalendarsWithToken]);

  const layout = useMemo(() => computeCalendarLayout(config), [config]);

  const handleAddEventRange = (
    startKey: string,
    endKey: string,
    ev: Omit<CalendarDayEvent, 'id'>
  ) => {
    const normalizedEnd = endKey && endKey >= startKey ? endKey : startKey;
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSpan: CalendarSpanEvent = {
      id,
      title: ev.title,
      startDate: startKey,
      endDate: normalizedEnd,
      color: ev.color,
      fillCell: ev.fillCell,
    };

    setConfig((prev) => ({
      ...prev,
      spanEvents: [...prev.spanEvents, newSpan],
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    setConfig((prev) => ({
      ...prev,
      spanEvents: prev.spanEvents.filter((item) => item.id !== eventId),
    }));
  };

  const handleClearAllEvents = () => {
    setConfig((prev) => ({ ...prev, spanEvents: [] }));
    setSelectedDateKey(null);
  };

  // Snapshot & JSON backup handlers
  const handleSaveSnapshot = (name: string) => {
    const next = saveCalendarSnapshot(name, config);
    setSnapshots(next);
    setLastSavedAt(formatTimeLabel(new Date()));
  };

  const handleLoadSnapshot = (snap: SavedCalendarSnapshot) => {
    setConfig(snap.config);
    setSelectedDateKey(null);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(deleteCalendarSnapshot(id));
  };

  const handleUploadJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const restored = parseProjectJson(text);
      setConfig(restored);
      setSelectedDateKey(null);
      setIcsStatus(`Restored project from ${file.name}`);
    } catch (err: unknown) {
      setIcsStatus(err instanceof Error ? err.message : 'Failed to load project JSON file.');
    }
  };

  // iCalendar (.ics) handlers
  const handleExportICS = () => {
    const label = config.schoolYear ? `${config.year}-${config.year + 1}` : `${config.year}`;
    const calTitle = config.title || `Broadsheet ${label}`;
    const ics = exportEventsToICS(config.spanEvents, calTitle);
    downloadICSFile(ics, `broadsheet-${label}.ics`);
    setIcsStatus(`Exported ${config.spanEvents.length} events to broadsheet-${label}.ics`);
  };

  const handleImportICSFile = async (file: File, replaceExisting: boolean) => {
    try {
      const text = await file.text();
      const { events: parsedEvents, skippedCount } = parseICSToSpanEvents(text);
      if (parsedEvents.length === 0) {
        setIcsStatus(`No valid events found in ${file.name}.`);
        return;
      }

      let addedCount = parsedEvents.length;
      setConfig((prev) => {
        const merged = mergeSpanEvents(prev.spanEvents, parsedEvents, replaceExisting);
        addedCount = merged.addedCount;
        return { ...prev, spanEvents: merged.next };
      });

      const skipNote = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
      setIcsStatus(
        replaceExisting
          ? `Loaded ${parsedEvents.length} events from ${file.name}${skipNote}.`
          : `Imported ${addedCount} new events from ${file.name}${skipNote}.`
      );
    } catch {
      setIcsStatus(`Could not parse ${file.name}. Ensure it is a valid .ics iCalendar file.`);
    }
  };

  // Google Calendar handlers
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setGoogleStatus(null);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setNeedsGoogleAuth(false);
      await loadCalendarsWithToken(result.accessToken);
      setGoogleStatus({ type: 'info', text: 'Connected to Google Calendar.' });
    } catch (err: unknown) {
      setGoogleStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.',
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setNeedsGoogleAuth(true);
    setGoogleCalendars([]);
    setGoogleStatus(null);
  };

  const handleRefreshCalendars = async () => {
    const token = getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return;
    }
    await loadCalendarsWithToken(token);
  };

  const handlePullGoogleEvents = async (replaceExisting: boolean) => {
    const token = getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      setGoogleStatus({ type: 'error', text: 'Session expired. Please sign in again.' });
      return;
    }

    setIsGoogleBusy(true);
    setGoogleStatus(null);
    try {
      const bounds = getVisibleDateBounds(config.year, config.schoolYear);
      const fetched = await fetchGoogleCalendarEvents(
        token,
        selectedCalendarId,
        bounds.startDate,
        bounds.endDate
      );

      let addedCount = fetched.length;
      setConfig((prev) => {
        const merged = mergeSpanEvents(prev.spanEvents, fetched, replaceExisting);
        addedCount = merged.addedCount;
        return { ...prev, spanEvents: merged.next };
      });

      const calName =
        googleCalendars.find((c) => c.id === selectedCalendarId)?.summary || 'Primary Calendar';
      setGoogleStatus({
        type: 'info',
        text: replaceExisting
          ? `Loaded ${fetched.length} events (${bounds.label}) from ${calName}.`
          : `Pulled ${fetched.length} events (${addedCount} new) from ${calName}.`,
      });
    } catch (err: unknown) {
      if (err instanceof GoogleAuthExpiredError) {
        clearCachedAccessToken();
        setNeedsGoogleAuth(true);
      }
      setGoogleStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to fetch Google Calendar events.',
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleConfirmPushGoogleEvents = async () => {
    const token = getAccessToken();
    if (!token) {
      setShowPushConfirm(false);
      setNeedsGoogleAuth(true);
      setGoogleStatus({ type: 'error', text: 'Session expired. Please sign in again.' });
      return;
    }

    setIsGoogleBusy(true);
    setGoogleStatus(null);
    try {
      const result = await syncEventsToGoogleCalendar(
        token,
        selectedCalendarId,
        config.spanEvents
      );
      const calName =
        googleCalendars.find((c) => c.id === selectedCalendarId)?.summary || 'Primary Calendar';
      setGoogleStatus({
        type: 'info',
        text: `Synced to ${calName}: ${result.created} created, ${result.updated} updated, ${result.skipped} unchanged.`,
      });
      setShowPushConfirm(false);
    } catch (err: unknown) {
      if (err instanceof GoogleAuthExpiredError) {
        clearCachedAccessToken();
        setNeedsGoogleAuth(true);
        setShowPushConfirm(false);
      }
      setGoogleStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to push events to Google Calendar.',
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDateKey) return [];
    return config.spanEvents.filter(
      (ev) => selectedDateKey >= ev.startDate && selectedDateKey <= ev.endDate
    );
  }, [config.spanEvents, selectedDateKey]);

  const selectedCalendarName = useMemo(() => {
    const found = googleCalendars.find((c) => c.id === selectedCalendarId);
    return found?.summary || 'Primary Calendar';
  }, [googleCalendars, selectedCalendarId]);

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
          eventsSyncSlot={
            <EventsSyncPanel
              config={config}
              lastSavedAt={lastSavedAt}
              snapshots={snapshots}
              onSaveSnapshot={handleSaveSnapshot}
              onLoadSnapshot={handleLoadSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onDownloadJson={() => downloadProjectJson(config)}
              onUploadJsonFile={handleUploadJsonFile}
              onExportICS={handleExportICS}
              onImportICSFile={handleImportICSFile}
              icsStatus={icsStatus}
              googleUser={googleUser}
              needsGoogleAuth={needsGoogleAuth}
              isGoogleSigningIn={isGoogleSigningIn}
              isGoogleBusy={isGoogleBusy}
              googleCalendars={googleCalendars}
              selectedCalendarId={selectedCalendarId}
              onSelectCalendarId={setSelectedCalendarId}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onRefreshCalendars={handleRefreshCalendars}
              onPullGoogleEvents={handlePullGoogleEvents}
              onRequestPushGoogleEvents={() => setShowPushConfirm(true)}
              googleStatus={googleStatus}
            />
          }
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
            events={selectedDayEvents}
            onClose={() => setSelectedDateKey(null)}
            onAddEventRange={handleAddEventRange}
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

      {showPushConfirm && (
        <GoogleConfirmModal
          calendarName={selectedCalendarName}
          events={config.spanEvents}
          isSubmitting={isGoogleBusy}
          onConfirm={handleConfirmPushGoogleEvents}
          onCancel={() => setShowPushConfirm(false)}
        />
      )}
    </div>
  );
}
