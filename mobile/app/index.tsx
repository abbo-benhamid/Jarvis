import { Redirect } from 'expo-router';
import { useSession } from '@/session/SessionProvider';

/** Point d'entrée : connexion si besoin, sinon la liste des visites. */
export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/visites' : '/connexion'} />;
}
