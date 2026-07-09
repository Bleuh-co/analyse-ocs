/**
 * Dictionnaire trilingue FR/EN/ES du chrome Analyse OCS (UI uniquement).
 *
 * IMPORTANT : les DONNÉES MÉTIER (noms de stores, SKU, catégories OCS,
 * contenus des rapports importés — données Firestore/Sheets) ne sont PAS
 * traduites ici ; seul le chrome l'est.
 *
 * Module « plat » sans directive : importable côté client (src/lib/i18n.ts,
 * hook useT) comme côté serveur (src/lib/i18n-server.ts, getServerT).
 * Repli : fr, puis la clé elle-même. Interpolation {var} optionnelle.
 * ES : tutoiement (« tú »), comme le reste du parc.
 */

export type Lang = "fr" | "en" | "es";

/** Locale de formatage (dates, nombres) par langue. */
export const LANG_LOCALES: Record<Lang, string> = {
  fr: "fr-CA",
  en: "en-CA",
  es: "es",
};

export const MESSAGES: Record<Lang, Record<string, string>> = {
  fr: {
    // Chrome / navigation
    "app.title": "Données OCS",
    "app.subtitle": "Groupe Chanv",
    "nav.dashboard": "Dashboard",
    "nav.marketing": "Marketing",
    "nav.sheets": "Sheets",
    "nav.upload": "Importer",
    "nav.stores": "Stores",
    "nav.help": "Aide",
    "nav.backToHub": "Retour au Hub",
    "nav.menu": "Menu",

    // Rôles (labels UI — les valeurs internes ne changent pas)
    "role.superadmin": "Super Administrateur",
    "role.admin": "Administrateur",
    "role.gestionnaire": "Gestionnaire",
    "role.membre": "Membre",
    "role.blocked": "Bloqué",

    // Connexion
    "login.title": "Analyse OCS",
    "login.domains": "Connexion réservée aux domaines ",
    "login.signIn": "Se connecter avec Google",
    "login.sso": "Connexion SSO en cours...",
    "login.loading": "Chargement...",
    "login.session5days": "Une session s'ouvrira pour 5 jours.",
  },
  en: {
    // Chrome / navigation
    "app.title": "OCS Data",
    "app.subtitle": "Groupe Chanv",
    "nav.dashboard": "Dashboard",
    "nav.marketing": "Marketing",
    "nav.sheets": "Sheets",
    "nav.upload": "Import",
    "nav.stores": "Stores",
    "nav.help": "Help",
    "nav.backToHub": "Back to Hub",
    "nav.menu": "Menu",

    // Roles
    "role.superadmin": "Super Administrator",
    "role.admin": "Administrator",
    "role.gestionnaire": "Manager",
    "role.membre": "Member",
    "role.blocked": "Blocked",

    // Login
    "login.title": "OCS Analysis",
    "login.domains": "Sign-in restricted to domains ",
    "login.signIn": "Sign in with Google",
    "login.sso": "SSO sign-in in progress...",
    "login.loading": "Loading...",
    "login.session5days": "Your session will stay open for 5 days.",
  },
  es: {
    // Chrome / navegación
    "app.title": "Datos OCS",
    "app.subtitle": "Groupe Chanv",
    "nav.dashboard": "Dashboard",
    "nav.marketing": "Marketing",
    "nav.sheets": "Sheets",
    "nav.upload": "Importar",
    "nav.stores": "Tiendas",
    "nav.help": "Ayuda",
    "nav.backToHub": "Volver al Hub",
    "nav.menu": "Menú",

    // Roles
    "role.superadmin": "Superadministrador",
    "role.admin": "Administrador",
    "role.gestionnaire": "Gestor",
    "role.membre": "Miembro",
    "role.blocked": "Bloqueado",

    // Conexión
    "login.title": "Análisis OCS",
    "login.domains": "Acceso reservado a los dominios ",
    "login.signIn": "Iniciar sesión con Google",
    "login.sso": "Conexión SSO en curso...",
    "login.loading": "Cargando...",
    "login.session5days": "Tu sesión quedará abierta durante 5 días.",
  },
};

export type Vars = Record<string, string | number>;

export function format(s: string, vars?: Vars): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Traducteur autonome pour une langue donnée (sans contexte React). */
export function translator(lang: Lang) {
  return (key: string, vars?: Vars): string =>
    format(MESSAGES[lang]?.[key] ?? MESSAGES.fr[key] ?? key, vars);
}

export function normalizeLang(v: string | undefined | null): Lang {
  if (v === "en" || v === "es" || v === "fr") return v;
  return "fr";
}
