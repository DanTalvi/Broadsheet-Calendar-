import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bookmark,
  CalendarArrowDown,
  CalendarArrowUp,
  Check,
  Download,
  FolderOpen,
  LogOut,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { CalendarConfig } from '../types/calendar';
import { GoogleCalendarListItem, getVisibleDateBounds } from '../utils/googleCalendarApi';
import { SavedCalendarSnapshot } from '../utils/projectStorage';
import { GoogleSignInButton } from './GoogleSignInButton';

interface EventsSyncPanelProps {
  config: CalendarConfig;
  lastSavedAt: string | null;
  snapshots: SavedCalendarSnapshot[];
  onSaveSnapshot: (name: string) => void;
  onLoadSnapshot: (snapshot: SavedCalendarSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onDownloadJson: () => void;
  onUploadJsonFile: (file: File) => void;
  onExportICS: () => void;
  onImportICSFile: (file: File, replaceExisting: boolean) => void;
  icsStatus: string | null;
  // Google Calendar props
  googleUser: User | null;
  needsGoogleAuth: boolean;
  isGoogleSigningIn: boolean;
  isGoogleBusy: boolean;
  googleCalendars: GoogleCalendarListItem[];
  selectedCalendarId: string;
  onSelectCalendarId: (id: string) => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onRefreshCalendars: () => void;
  onPullGoogleEvents: (replaceExisting: boolean) => void;
  onRequestPushGoogleEvents: () => void;
  googleStatus: { type: 'info' | 'error'; text: string } | null;
}

export function EventsSyncPanel({
  config,
  lastSavedAt,
  snapshots,
  onSaveSnapshot,
  onLoadSnapshot,
  onDeleteSnapshot,
  onDownloadJson,
  onUploadJsonFile,
  onExportICS,
  onImportICSFile,
  icsStatus,
  googleUser,
  needsGoogleAuth,
  isGoogleSigningIn,
  isGoogleBusy,
  googleCalendars,
  selectedCalendarId,
  onSelectCalendarId,
  onGoogleSignIn,
  onGoogleSignOut,
  onRefreshCalendars,
  onPullGoogleEvents,
  onRequestPushGoogleEvents,
  googleStatus,
}: EventsSyncPanelProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const icsInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const bounds = getVisibleDateBounds(config.year, config.schoolYear);

  const handleSnapshotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSnapshot(snapshotName);
    setSnapshotName('');
  };

  const handleICSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportICSFile(file, replaceOnImport);
    }
    e.target.value = '';
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJsonFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Google Calendar Sync */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
            Google Calendar Sync
          </h2>
          <span className="text-[11px] text-stone-500 tabular-nums">{bounds.label}</span>
        </div>

        {!googleUser || needsGoogleAuth ? (
          <div className="space-y-2">
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Sign in with Google to import events from your calendars or push sheet events back.
            </p>
            <GoogleSignInButton
              onClick={onGoogleSignIn}
              disabled={isGoogleSigningIn}
              label={isGoogleSigningIn ? 'Connecting…' : 'Sign in with Google'}
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-md">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-stone-900 truncate">
                  {googleUser.displayName || googleUser.email}
                </div>
                {googleUser.displayName && googleUser.email && (
                  <div className="text-[10px] text-stone-500 truncate">{googleUser.email}</div>
                )}
              </div>
              <button
                type="button"
                onClick={onGoogleSignOut}
                title="Disconnect Google account"
                className="p-1 text-stone-500 hover:text-stone-900 rounded transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedCalendarId}
                onChange={(e) => onSelectCalendarId(e.target.value)}
                disabled={isGoogleBusy || googleCalendars.length === 0}
                aria-label="Select Google Calendar"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-medium bg-white border border-stone-300 rounded-md text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
              >
                {googleCalendars.length === 0 ? (
                  <option value="primary">Primary Calendar</option>
                ) : (
                  googleCalendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.primary ? `${cal.summary} (Primary)` : cal.summary}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={onRefreshCalendars}
                disabled={isGoogleBusy}
                title="Refresh calendars"
                aria-label="Refresh Google calendars"
                className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGoogleBusy ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPullGoogleEvents(replaceOnImport)}
                disabled={isGoogleBusy}
                className="py-1.5 px-2.5 text-xs font-medium text-stone-900 bg-white border border-stone-300 rounded-md hover:border-stone-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <CalendarArrowDown className="w-3.5 h-3.5 shrink-0" />
                <span>Pull Events</span>
              </button>
              <button
                type="button"
                onClick={onRequestPushGoogleEvents}
                disabled={isGoogleBusy || config.spanEvents.length === 0}
                className="py-1.5 px-2.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <CalendarArrowUp className="w-3.5 h-3.5 shrink-0" />
                <span>Push Events</span>
              </button>
            </div>
          </div>
        )}

        {googleStatus && (
          <p
            className={`text-[11px] leading-snug px-2.5 py-1.5 rounded-md border ${
              googleStatus.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-stone-50 text-stone-700 border-stone-200'
            }`}
          >
            {googleStatus.text}
          </p>
        )}
      </section>

      <hr className="border-stone-200" />

      {/* iCalendar (.ics) Export & Import */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
            iCalendar (.ics) File
          </h2>
          <label className="flex items-center gap-1.5 text-[11px] text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceOnImport}
              onChange={(e) => setReplaceOnImport(e.target.checked)}
              className="accent-stone-900"
            />
            <span>Replace on import</span>
          </label>
        </div>

        <input
          ref={icsInputRef}
          type="file"
          accept=".ics,.ical,text/calendar"
          onChange={handleICSChange}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => icsInputRef.current?.click()}
            className="py-1.5 px-2.5 text-xs font-medium text-stone-900 bg-white border border-stone-300 rounded-md hover:border-stone-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span>Import .ics</span>
          </button>
          <button
            type="button"
            onClick={onExportICS}
            disabled={config.spanEvents.length === 0}
            className="py-1.5 px-2.5 text-xs font-medium text-stone-900 bg-white border border-stone-300 rounded-md hover:border-stone-900 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export .ics</span>
          </button>
        </div>

        {icsStatus && (
          <p className="text-[11px] text-stone-700 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5">
            {icsStatus}
          </p>
        )}
      </section>

      <hr className="border-stone-200" />

      {/* Save Progress & Snapshots */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
            Save Progress
          </h2>
          {lastSavedAt && (
            <span className="text-[11px] text-stone-500 flex items-center gap-1 tabular-nums">
              <Check className="w-3 h-3 text-emerald-700" />
              <span>Saved {lastSavedAt}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSnapshotSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (optional)"
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </form>

        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleJsonChange}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDownloadJson}
            className="py-1.5 px-2.5 text-xs font-medium text-stone-700 bg-stone-50 border border-stone-200 rounded-md hover:border-stone-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Backup .json</span>
          </button>
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="py-1.5 px-2.5 text-xs font-medium text-stone-700 bg-stone-50 border border-stone-200 rounded-md hover:border-stone-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Restore .json</span>
          </button>
        </div>

        {snapshots.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              <span>Saved Snapshots ({snapshots.length})</span>
            </div>
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-md max-h-40 overflow-y-auto">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="px-2.5 py-2 flex items-center justify-between gap-2 text-xs bg-white"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900 truncate">{snap.name}</div>
                    <div className="text-[10px] text-stone-500 tabular-nums">
                      {snap.yearLabel} · {snap.eventCount}{' '}
                      {snap.eventCount === 1 ? 'event' : 'events'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLoadSnapshot(snap)}
                      className="px-2 py-1 text-[11px] font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded transition-colors cursor-pointer"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSnapshot(snap.id)}
                      aria-label={`Delete snapshot ${snap.name}`}
                      className="p-1 text-stone-400 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
