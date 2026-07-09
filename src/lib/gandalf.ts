import "server-only";
import type { AdminLike } from "@bleuh-co/gandalf-sdk-next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { isEmailDomainAllowed } from "./utils";
import { resolveRole } from "./auth-server";

/**
 * Adaptateur firebase-admin → contrat AdminLike du SDK Gandalf.
 * L'app expose adminAuth()/adminDb() ; le SDK attend admin.auth()/admin.firestore().
 */
export const gandalfAdmin: AdminLike = {
  auth: () => adminAuth() as unknown as ReturnType<AdminLike["auth"]>,
  firestore: () => adminDb() as unknown as ReturnType<AdminLike["firestore"]>,
};

/**
 * roleMapper : branche la résolution de rôle propre à Analyse OCS dans le SDK —
 * règles EXACTES de l'ancien getSession, zéro régression :
 *   1. filtre de domaine (isEmailDomainAllowed) → sinon "blocked",
 *   2. resolveRole (bootstrap admins → superadmin ;
 *      user_app_roles `${email}__${appId}` (ANALYOCS_APP_ID ou matcher par nom)
 *      → mapping grades Hub (Gestionnaire → gestionnaire, Consulter → membre…) ;
 *      users.role legacy global en fallback ; défaut "membre").
 * "blocked" est listé dans noAccessRoles → refus (deny-by-default).
 * Le rôle « gestionnaire » et ses droits d'écriture (requireGestionnaire :
 * upload, stores, sheets, marketing — suppression réservée à requireAdmin)
 * restent inchangés.
 */
export const analyOcsRoleMapper = async (email: string): Promise<string> => {
  if (!isEmailDomainAllowed(email)) return "blocked";
  return resolveRole(email);
};
