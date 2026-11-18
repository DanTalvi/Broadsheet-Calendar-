export type LayoutArchetype =
  | 'aligned-matrix'
  | 'day-matrix'
  | 'vertical-columns'
  | 'grid-4x3'
  | 'grid-6x2'
  | 'grid-3x4';

export type GridStrokeWeight = 'none' | 'hairline' | 'crisp' | 'bold';
export type MonthCaseStyle = 'uppercase' | 'title' | 'abbr-upper';
export type DayNumberAlign = 'top-left' | 'top-right' | 'center';
export type HeaderAlign = 'left' | 'center' | 'split';
export type HeaderLogoPosition = 'left' | 'right';
export type ExportFormat = 'png' | 'pdf' | 'svg';
export type InspectorSection = 'layout' | 'typography' | 'palette' | 'events';

export interface HeaderLogoConfig {
  dataUrl: string;
  fileName: string;
  aspectRatio: number;
  position: HeaderLogoPosition;
  scale: number;
}

export interface EventColorItem {
  id: string;
  label: string;
  hex: string;
  category?: string;
  isCustom?: boolean;
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
  category: 'condensed' | 'editorial-serif' | 'grotesque' | 'mono';
  weight: number;
}

export interface TypographyConfig {
  displayFont: string;
  bodyFont: string;
  displayWeight: number;
  useMonoNumbers: boolean;
  titleScale: number;
  monthScale: number;
  dayNumberScale: number;
  monthCase: MonthCaseStyle;
  dayNumberAlign: DayNumberAlign;
  gridStrokeWeight: GridStrokeWeight;
  letterSpacingScale: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  paperBg: string;
  inkPrimary: string;
  inkMuted: string;
  gridRule: string;
  weekendBg: string;
  weekendInk: string;
  accent: string;
  accentText: string;
  holidayInk: string;
}

export interface CalendarDayEvent {
  id: string;
  title: string;
  color: string;
  fillCell?: boolean;
}

export interface CalendarSpanEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  color: string;
  fillCell?: boolean;
}

export interface PaperSizePreset {
  id: string;
  name: string;
  subtitle: string;
  widthIn: number;
  heightIn: number;
  recommendedLayout?: LayoutArchetype;
}

export interface CalendarConfig {
  year: number;
  schoolYear: boolean;
  title: string;
  subtitle: string;
  footerNote: string;
  headerAlign: HeaderAlign;
  headerLogo?: HeaderLogoConfig | null;
  showHeader: boolean;
  showFooter: boolean;
  weekStart: 0 | 1;
  layout: LayoutArchetype;
  widthIn: number;
  heightIn: number;
  marginIn: number;
  bleedIn: number;
  showCropMarks: boolean;
  showHolidays: boolean;
  showMoonPhases: boolean;
  showIsoWeeks: boolean;
  showDayOfYear: boolean;
  showWriteLines: boolean;
  writeLineCount: number;
  weekendTintStrength: number;
  typography: TypographyConfig;
  palette: ColorPalette;
  eventPalette?: EventColorItem[];
  showCategoryKey?: boolean;
  spanEvents: CalendarSpanEvent[];
  events?: Record<string, CalendarDayEvent[]>;
}
