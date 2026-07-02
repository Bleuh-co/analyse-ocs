// Rôle interne Analyse OCS (mappé depuis le rôle standardisé Chanv)
// - superadmin   : accès total
// - admin        : écriture + suppression de stores
// - gestionnaire : écriture (import, stores, sheets, marketing) — grade Hub "Gestionnaire"
// - membre       : lecture seule — grade Hub "Consulter"
// - blocked      : pas d'accès
export type Role = "superadmin" | "admin" | "gestionnaire" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  gestionnaire: "Gestionnaire",
  membre: "Membre",
  blocked: "Bloqué",
};
