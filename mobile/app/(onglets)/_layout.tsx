import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '@/theme';
import { TabBar, type TabItem } from '@/ui';

const ONGLETS: TabItem[] = [
  { name: 'visites', label: 'Visites', icon: 'calendar' },
  { name: 'kaye', label: 'Kayé', icon: 'book' },
  { name: 'profil', label: 'Profil', icon: 'user' },
];

/** Onglets de l'accompagnant : Visites, Kayé, Profil (ADR 0008, lot M1). */
export default function OngletsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state, navigation }) => (
        <TabBar
          items={ONGLETS}
          activeName={state.routes[state.index]?.name ?? 'visites'}
          onSelect={(name) => navigation.navigate(name)}
        />
      )}
    >
      {ONGLETS.map((o) => (
        <Tabs.Screen key={o.name} name={o.name} options={{ title: o.label }} />
      ))}
    </Tabs>
  );
}
