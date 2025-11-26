export const palette = {
  light: {
    primary: '#7c3aed',
    accent: '#22d3ee',
    background: '#f6f7fb',
    card: '#ffffffcc',
    text: '#0f172a',
    textMuted: '#4b5563',
    success: '#10b981',
    error: '#ef4444',
    border: '#e5e7eb'
  },
  dark: {
    primary: '#a855f7',
    accent: '#2dd4bf',
    background: '#0b1220',
    card: '#0f172acc',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    success: '#22c55e',
    error: '#f43f5e',
    border: '#1f2937'
  }
};

// Default to dark palette for a premium fintech feel; screens can swap to palette.light when a toggle is added.
export const colors = palette.dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
};

export const typography = {
  heading: 22,
  subheading: 18,
  body: 16,
  small: 14
};
