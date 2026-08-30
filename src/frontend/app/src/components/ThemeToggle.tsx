import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getStoredPreference,
  initTheme,
  setPreference,
  type ThemePreference,
} from '@/lib/theme';

const CYCLE_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

const LABELS: Record<ThemePreference, string> = {
  system: 'Follow system theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

const ICONS: Record<ThemePreference, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export default function ThemeToggle() {
  const [preference, setSelectPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    setSelectPreference(getStoredPreference());
    return initTheme();
  }, []);

  const cycleTheme = () => {
    const next =
      CYCLE_ORDER[(CYCLE_ORDER.indexOf(preference) + 1) % CYCLE_ORDER.length];
    setSelectPreference(next);
    setPreference(next);
  };

  const Icon = ICONS[preference];

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label={`Current theme: ${preference}. Click to switch.`}
      title={LABELS[preference]}
      onClick={cycleTheme}
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
