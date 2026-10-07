import { Redirect } from 'expo-router';
import { etatCompte } from '@/session/compte';
import { useSession } from '@/session/SessionProvider';

/**
 * Point d'entrée : connexion si besoin, sinon l'écran qui correspond à l'état du compte (L1) :
 * visites (actif), « Profil en cours de validation », ou « Koudmen ouvre bientôt » (préinscription).
 */
export default function Index() {
  const { session } = useSession();
  if (!session) return <Redirect href="/connexion" />;
  const etat = etatCompte(session);
  return <Redirect href={etat === 'validation' ? '/compte-en-validation' : etat === 'preinscription' ? '/bientot' : '/visites'} />;
}
