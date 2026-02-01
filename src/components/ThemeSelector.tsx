import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { themes } from '../themes';

export function ThemeSelector() {
  const { themeName, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-theme bg-theme-tertiary hover:bg-theme-hover transition-colors text-sm"
        title="Change theme"
      >
        <span
          className="w-4 h-4 rounded-full border border-theme"
          style={{ backgroundColor: themes[themeName].colors.accent }}
        />
        <span className="text-theme-secondary">{themes[themeName].name}</span>
        <span className="text-theme-muted text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 py-2 bg-theme-secondary border border-theme rounded-theme shadow-xl z-50 min-w-48">
          <div className="px-3 py-1 text-xs text-theme-muted uppercase tracking-wide">
            Select Theme
          </div>
          {availableThemes.map((name) => {
            const theme = themes[name];
            const isActive = name === themeName;

            return (
              <button
                key={name}
                onClick={() => {
                  setTheme(name);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-theme-selected' : 'hover:bg-theme-hover'
                }`}
              >
                {/* Color preview */}
                <div className="flex gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.colors.bgPrimary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.colors.textPrimary }}
                  />
                </div>

                {/* Theme name */}
                <span className={isActive ? 'text-theme-primary font-medium' : 'text-theme-secondary'}>
                  {theme.name}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <span className="ml-auto text-theme-accent">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
