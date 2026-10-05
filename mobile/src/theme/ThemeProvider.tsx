import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, shadows, type ColorScheme, type Palette } from './tokens';

/** Choix de l'utilisateur. « systeme » suit le réglage du téléphone (§ 12). */
export type ThemePreference = 'systeme' | 'clair' | 'sombre';

type ThemeValue = {
  scheme: ColorScheme;
  c: Palette;
  shadow: { card: string; float: string };
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('systeme');

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme =
      preference === 'clair' ? 'light' : preference === 'sombre' ? 'dark' : system === 'dark' ? 'dark' : 'light';
    return {
      scheme,
      c: scheme === 'dark' ? dark : light,
      shadow: shadows[scheme],
      preference,
      setPreference,
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme doit être utilisé dans <ThemeProvider>.');
  return v;
}
