export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'streamfile-theme';

export const THEME_META_COLOR: Record<ResolvedTheme, string> = {
  light: '#f6f8fb',
  dark: '#0b1120',
};

export function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? resolveSystemTheme() : preference;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_META_COLOR[resolved]);
  }
  return resolved;
}

export function setPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // storage unavailable; preference still applies for this session
  }
  applyTheme(preference);
}

export function initTheme(): () => void {
  applyTheme(getStoredPreference());
  if (typeof window === 'undefined' || typeof matchMedia === 'undefined') {
    return () => undefined;
  }
  const systemMedia = window.matchMedia('(prefers-color-scheme: light)');
  const onSystemChange = () => {
    if (getStoredPreference() === 'system') {
      applyTheme('system');
    }
  };
  systemMedia.addEventListener('change', onSystemChange);
  return () => systemMedia.removeEventListener('change', onSystemChange);
}
