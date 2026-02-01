export interface Theme {
  name: string;
  colors: {
    // Backgrounds
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    bgSelected: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    // Accents
    accent: string;
    accentHover: string;
    accentMuted: string;

    // Status
    success: string;
    warning: string;
    error: string;

    // Borders
    border: string;
    borderLight: string;

    // Stars
    starFilled: string;
    starEmpty: string;
  };
  fonts: {
    primary: string;
    mono: string;
  };
  borderRadius: string;
}

export const themes: Record<string, Theme> = {
  midnight: {
    name: 'Midnight',
    colors: {
      bgPrimary: '#0f0f1a',
      bgSecondary: '#1a1a2e',
      bgTertiary: '#252540',
      bgHover: '#2d2d4a',
      bgSelected: '#3d3d6b',
      textPrimary: '#e8e8f0',
      textSecondary: '#a8a8c0',
      textMuted: '#6b6b8a',
      accent: '#6366f1',
      accentHover: '#818cf8',
      accentMuted: '#4f46e5',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      border: '#3d3d5c',
      borderLight: '#2d2d4a',
      starFilled: '#fbbf24',
      starEmpty: '#4b5563',
    },
    fonts: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    borderRadius: '8px',
  },

  dark: {
    name: 'Dark',
    colors: {
      bgPrimary: '#111827',
      bgSecondary: '#1f2937',
      bgTertiary: '#374151',
      bgHover: '#4b5563',
      bgSelected: '#1e40af',
      textPrimary: '#f9fafb',
      textSecondary: '#d1d5db',
      textMuted: '#9ca3af',
      accent: '#3b82f6',
      accentHover: '#60a5fa',
      accentMuted: '#2563eb',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      border: '#374151',
      borderLight: '#4b5563',
      starFilled: '#fbbf24',
      starEmpty: '#6b7280',
    },
    fonts: {
      primary: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'Consolas', 'Monaco', monospace",
    },
    borderRadius: '6px',
  },

  light: {
    name: 'Light',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f3f4f6',
      bgTertiary: '#e5e7eb',
      bgHover: '#d1d5db',
      bgSelected: '#dbeafe',
      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#6b7280',
      accent: '#2563eb',
      accentHover: '#3b82f6',
      accentMuted: '#1d4ed8',
      success: '#16a34a',
      warning: '#ca8a04',
      error: '#dc2626',
      border: '#d1d5db',
      borderLight: '#e5e7eb',
      starFilled: '#f59e0b',
      starEmpty: '#d1d5db',
    },
    fonts: {
      primary: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'SF Mono', 'Consolas', monospace",
    },
    borderRadius: '6px',
  },

  nord: {
    name: 'Nord',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      bgHover: '#4c566a',
      bgSelected: '#5e81ac',
      textPrimary: '#eceff4',
      textSecondary: '#e5e9f0',
      textMuted: '#d8dee9',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      accentMuted: '#81a1c1',
      success: '#a3be8c',
      warning: '#ebcb8b',
      error: '#bf616a',
      border: '#4c566a',
      borderLight: '#434c5e',
      starFilled: '#ebcb8b',
      starEmpty: '#4c566a',
    },
    fonts: {
      primary: "'Rubik', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'Source Code Pro', monospace",
    },
    borderRadius: '4px',
  },

  dracula: {
    name: 'Dracula',
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#343746',
      bgTertiary: '#44475a',
      bgHover: '#6272a4',
      bgSelected: '#bd93f9',
      textPrimary: '#f8f8f2',
      textSecondary: '#f8f8f2',
      textMuted: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#ff79c6',
      accentMuted: '#9580ff',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555',
      border: '#44475a',
      borderLight: '#6272a4',
      starFilled: '#f1fa8c',
      starEmpty: '#44475a',
    },
    fonts: {
      primary: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'Fira Code', monospace",
    },
    borderRadius: '8px',
  },

  forest: {
    name: 'Forest',
    colors: {
      bgPrimary: '#1a2f1a',
      bgSecondary: '#243524',
      bgTertiary: '#2e4a2e',
      bgHover: '#3d5c3d',
      bgSelected: '#4a7c4a',
      textPrimary: '#e8f5e8',
      textSecondary: '#b8d4b8',
      textMuted: '#7a9f7a',
      accent: '#4ade80',
      accentHover: '#86efac',
      accentMuted: '#22c55e',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
      border: '#3d5c3d',
      borderLight: '#2e4a2e',
      starFilled: '#fbbf24',
      starEmpty: '#3d5c3d',
    },
    fonts: {
      primary: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    borderRadius: '10px',
  },

  sunset: {
    name: 'Sunset',
    colors: {
      bgPrimary: '#1f1520',
      bgSecondary: '#2d1f2d',
      bgTertiary: '#3d2a3d',
      bgHover: '#4d3a4d',
      bgSelected: '#7c3aed',
      textPrimary: '#fce7f3',
      textSecondary: '#f9a8d4',
      textMuted: '#a855a8',
      accent: '#f472b6',
      accentHover: '#f9a8d4',
      accentMuted: '#ec4899',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      border: '#4d3a4d',
      borderLight: '#3d2a3d',
      starFilled: '#fbbf24',
      starEmpty: '#4d3a4d',
    },
    fonts: {
      primary: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'Fira Code', monospace",
    },
    borderRadius: '12px',
  },
};

export const defaultTheme = 'dark';
