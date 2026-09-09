import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env['VITE_SUPABASE_URL'];
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

/**
 * Vrai quand les deux variables d'environnement sont renseignées.
 *
 * L'application doit pouvoir démarrer sans configuration : plutôt que de
 * planter au chargement du module, on expose ce drapeau et l'interface affiche
 * un écran d'installation expliquant quoi remplir.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'cle-absente',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Indispensable dès que la confirmation d'e-mail est active : le lien
      // reçu par courriel renvoie vers l'application avec un code en
      // paramètre d'URL, que le client doit échanger contre une session.
      // À `false`, l'utilisateur confirmerait son adresse puis retomberait
      // sur l'écran de connexion sans comprendre pourquoi.
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

/**
 * Traduit une erreur Supabase en message affichable.
 *
 * Les codes `P000x` proviennent des `raise exception` de nos fonctions SQL
 * (voir `supabase/migrations/0003_functions.sql`) : leur message est déjà
 * rédigé en français et destiné à l'utilisateur.
 */
export function toErrorMessage(error: unknown): string {
  if (!error) return 'Une erreur inattendue est survenue.';

  if (typeof error === 'object' && 'message' in error) {
    const { message, code } = error as { message: string; code?: string };

    switch (code) {
      case '23505':
        return 'Cet enregistrement existe déjà.';
      case '42501':
        return 'Vous n’avez pas les droits nécessaires pour cette action.';
      case 'PGRST301':
        return 'Session expirée, veuillez vous reconnecter.';
      default:
        break;
    }

    switch (message) {
      case 'Invalid login credentials':
        return 'Adresse e-mail ou mot de passe incorrect.';
      case 'Email not confirmed':
        return 'Adresse e-mail non confirmée. Désactivez « Confirm email » dans Supabase pour les tests.';
      case 'User already registered':
        return 'Un compte existe déjà avec cette adresse e-mail.';
      case 'Failed to fetch':
        return 'Impossible de joindre Supabase. Vérifiez votre connexion et VITE_SUPABASE_URL.';
      default:
        return message;
    }
  }

  return String(error);
}
