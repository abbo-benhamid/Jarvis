import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { cacheDirectory, deleteAsync } from 'expo-file-system/legacy';
import { copieEnCache, mimeDepuisNom, type FichierChoisi } from './verifications';

/**
 * L2 : choix d'un justificatif. Modules compatibles Expo Go (`expo-document-picker`, `expo-image-picker`,
 * `expo-file-system`).
 *
 * - Photo : JPEG compressé (qualité 0,7). Sur iOS, la compression convertit aussi le HEIC en JPEG :
 *   le serveur accepte seulement PDF, JPEG et PNG. EXIF non demandé (pas de position dans le fichier).
 * - Fichier : PDF, JPEG ou PNG, copié dans le cache de l'app le temps de l'envoi.
 * - L2b (revue m6) : la COPIE dans le cache de l'app est effacée (`oublierFichier`) après l'envoi, quand la
 *   personne choisit un autre fichier, et quand l'écran se ferme. L'original (galerie, dossier) n'est jamais touché.
 */

/** Efface la copie du justificatif dans le cache de l'app. Sans erreur visible (web, fichier déjà effacé). */
export async function oublierFichier(f: Pick<FichierChoisi, 'uri'> | null | undefined): Promise<void> {
  if (!f) return;
  try {
    if (!copieEnCache(f.uri, cacheDirectory)) return;
    await deleteAsync(f.uri, { idempotent: true });
  } catch {
    // Web ou module absent : rien à effacer dans un cache natif.
  }
}
export type SourceFichier = 'camera' | 'galerie' | 'fichier';

export type ResultatChoix = { fichier: FichierChoisi } | { annule: true } | { erreur: string };

const OPTIONS_PHOTO: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false, allowsEditing: false };

function depuisPhoto(r: ImagePicker.ImagePickerResult): ResultatChoix {
  const a = r.canceled ? null : r.assets[0];
  if (!a) return { annule: true };
  const nom = a.fileName ?? `photo-${Date.now()}.jpg`;
  return { fichier: { uri: a.uri, nom, type: a.mimeType ?? mimeDepuisNom(nom) ?? 'image/jpeg', taille: a.fileSize } };
}

export async function choisirFichier(source: SourceFichier): Promise<ResultatChoix> {
  try {
    if (source === 'camera') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return { erreur: 'La caméra n’est pas autorisée. Choisissez une photo déjà prise, ou autorisez la caméra dans les réglages.' };
      return depuisPhoto(await ImagePicker.launchCameraAsync(OPTIONS_PHOTO));
    }
    if (source === 'galerie') return depuisPhoto(await ImagePicker.launchImageLibraryAsync(OPTIONS_PHOTO));
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return { annule: true };
    return { fichier: { uri: a.uri, nom: a.name, type: a.mimeType ?? mimeDepuisNom(a.name) ?? '', taille: a.size } };
  } catch {
    return { erreur: 'Le fichier ne peut pas être ouvert. Réessayez, ou choisissez une autre source.' };
  }
}
