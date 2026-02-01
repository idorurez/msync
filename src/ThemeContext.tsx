import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, themes, defaultTheme } from './themes';

interface ThemeContextType {
  theme: Theme;
  themeName: string;
  setTheme: (name: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'msync_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const theme = themes[themeName] || themes[defaultTheme];

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeName);
    } catch {}

    // Apply CSS variables to root
    const root = document.documentElement;
    const colors = theme.colors;

    root.style.setProperty('--bg-primary', colors.bgPrimary);
    root.style.setProperty('--bg-secondary', colors.bgSecondary);
    root.style.setProperty('--bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--bg-hover', colors.bgHover);
    root.style.setProperty('--bg-selected', colors.bgSelected);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-muted', colors.accentMuted);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--error', colors.error);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--border-light', colors.borderLight);
    root.style.setProperty('--star-filled', colors.starFilled);
    root.style.setProperty('--star-empty', colors.starEmpty);
    root.style.setProperty('--font-primary', theme.fonts.primary);
    root.style.setProperty('--font-mono', theme.fonts.mono);
    root.style.setProperty('--radius', theme.borderRadius);
  }, [theme, themeName]);

  const setTheme = (name: string) => {
    if (themes[name]) {
      setThemeName(name);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeName,
        setTheme,
        availableThemes: Object.keys(themes),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
