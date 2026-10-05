import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import par graisse : seules ces 8 polices entrent dans l'app (pas les 36 variantes).
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { ThemeProvider, useTheme } from '@/theme';
import { SessionProvider, useSession } from '@/session/SessionProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { c, scheme } = useTheme();
  const { etat, session } = useSession();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
    if (Platform.OS === 'web' && typeof document !== 'undefined') appliquerStylesWeb(c.bg, c.focus, c.focusHalo, scheme);
  }, [c, scheme]);

  if (etat.statut === 'demarrage') {
    // Reprise de la connexion gardée sur l'appareil (POST /auth/refresh) : quelques centaines de ms.
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }} testID="ecran-demarrage">
        <ActivityIndicator color={c.mer} size="large" accessibilityLabel="Ouverture de votre session" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="connexion" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(onglets)" />
          <Stack.Screen name="visite/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kaye/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="propositions" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Web seulement : fond de page, focus visible (§ 12), thème du navigateur. */
function appliquerStylesWeb(bg: string, focus: string, halo: string, scheme: 'light' | 'dark') {
  const id = 'koudmen-web-styles';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = `
    html, body, #root { background: ${bg}; color-scheme: ${scheme}; }
    body { -webkit-font-smoothing: antialiased; }
    :focus-visible { outline: 3px solid ${focus} !important; outline-offset: 2px; box-shadow: 0 0 0 5px ${halo}; border-radius: 12px; }
  `;
  document.documentElement.lang = 'fr';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', bg);
}
