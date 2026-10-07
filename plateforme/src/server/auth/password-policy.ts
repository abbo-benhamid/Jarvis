/**
 * Politique des mots de passe (L1, contrat § 2.1). Fonctions PURES : serveur, tests, formulaires.
 * - 10 caractères au moins, 128 au plus.
 * - Refus des mots de passe trop courants (liste ci-dessous, avec ou sans chiffres et signes à la fin).
 * - Refus d'un mot de passe qui reprend l'e-mail, le prénom ou le nom, ou qui répète un seul caractère.
 * Recommandation ANSSI / CNIL (délibération 2022-100) : longueur d'abord, liste de refus ensuite.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/**
 * Mots de passe trop courants (fuites publiques, en minuscules). Liste courte et volontairement locale :
 * français, créole, Martinique. [À VÉRIFIER] étendre avec une liste plus longue (ex. 10 000 entrées) si besoin.
 */
const COMMON = [
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910", "0123456789", "987654321", "111111", "000000",
  "password", "passw0rd", "motdepasse", "mot2passe", "motdepass", "azerty", "azertyuiop", "qwerty", "qwertyuiop", "abc123",
  "iloveyou", "jetaime", "jetaime123", "doudou", "soleil", "chouchou", "bonjour", "bonjour123", "loulou", "marseille",
  "martinique", "madinina", "matinik", "fortdefrance", "fort-de-france", "lamentin", "schoelcher", "guadeloupe", "caraibes", "antilles",
  "koudmen", "koudmen972", "admin", "administrateur", "welcome", "bienvenue", "football", "princesse", "nicolas", "camille",
  "sunshine", "dragon", "monkey", "letmein", "superman", "batman", "starwars", "pokemon", "master", "shadow",
  "trustno1", "freedom", "whatever", "qazwsx", "zaq12wsx", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "aaaaaa", "azerty123",
  "motdepasse1", "password1", "password123", "changeme", "secret", "secret123", "maison", "famille", "manman", "papa",
  "maman", "mamie", "papie", "grandmere", "accompagnant", "accompagnante", "aidant", "carnaval", "zouk", "biguine",
  "972972", "971971", "97200", "97232", "france", "paris", "lyon", "toulouse", "liberte", "vacances",
] as const;

const COMMON_SET = new Set<string>(COMMON);

/** Partie « de base » d'un mot de passe : minuscules, sans accents, sans chiffres ni signes à la fin. */
function baseOf(pw: string): string {
  return pw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+$/g, "");
}

export type PasswordContext = { email?: string | null; firstName?: string | null; lastName?: string | null };

/** Problème du mot de passe (message affichable), ou null s'il est accepté. */
export function passwordProblem(pw: string, ctx: PasswordContext = {}): string | null {
  if (pw.length < PASSWORD_MIN) return `${PASSWORD_MIN} caractères minimum.`;
  if (pw.length > PASSWORD_MAX) return `${PASSWORD_MAX} caractères maximum.`;
  const lower = pw.toLowerCase();
  if (new Set(lower).size <= 2) return "Ce mot de passe est trop simple. Choisissez-en un autre.";
  const base = baseOf(pw);
  if (COMMON_SET.has(lower) || (base.length >= 4 && COMMON_SET.has(base)) || /^\d+$/.test(pw)) {
    return "Ce mot de passe est trop courant. Choisissez-en un autre.";
  }
  const parts = [ctx.email?.split("@")[0], ctx.firstName, ctx.lastName]
    .map((p) => (p ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim())
    .filter((p) => p.length >= 4);
  if (parts.some((p) => base === p || lower === p)) return "Le mot de passe ne doit pas reprendre votre nom ou votre e-mail.";
  return null;
}

/** Nombre d'entrées de la liste de refus (tests, documentation). */
export const COMMON_PASSWORD_COUNT = COMMON_SET.size;
