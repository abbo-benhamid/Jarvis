import { View } from 'react-native';
import { router } from 'expo-router';
import { IconButton, Text } from '@/ui';

/** Barre du haut des écrans de compte (L1) : retour + titre court. */
export function EnTeteRetour({ titre, retour = '/connexion' }: { titre: string; retour?: '/connexion' | '/' | '/compte-en-validation' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 }}>
      <IconButton
        icon="left"
        accessibilityLabel="Retour"
        testID="bouton-retour"
        onPress={() => (router.canGoBack() ? router.back() : router.replace(retour))}
      />
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginRight: 52 }}>
        {titre}
      </Text>
    </View>
  );
}
