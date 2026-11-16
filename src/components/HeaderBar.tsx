import { InspectorSection } from '../types/calendar';

interface HeaderBarProps {
  activeSection: InspectorSection;
  onSelectSection: (section: InspectorSection) => void;
  onOpenExport: () => void;
}

const NAV_ITEMS: { id: InspectorSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'typography', label: 'Typography' },
  { id: 'palette', label: 'Palette' },
  { id: 'events', label: 'Events' },
];

export function HeaderBar({
  activeSection,
  onSelectSection,
  onOpenExport,
}: HeaderBarProps) {
  return (
    <header className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between gap-8 shrink-0 z-20">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectSection('layout');
        }}
        className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
        style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}
      >
        Broadsheet
      </a>

      <nav className="flex items-center gap-7" aria-label="Studio Sections">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'text-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          Export 300 DPI
        </button>
      </div>
    </header>
  );
}
