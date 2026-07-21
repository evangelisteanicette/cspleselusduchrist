/**
 * =============================================================
 *  RÔLES ET PERMISSIONS — Élus School Pro
 * =============================================================
 *  Toute la logique d'autorisation de l'application part de ce
 *  fichier. Les règles de sécurité Firestore (à publier depuis la
 *  console Firebase, voir README.md) appliquent les mêmes règles
 *  côté serveur : ce fichier gère l'affichage côté interface,
 *  les règles Firestore empêchent tout contournement.
 * =============================================================
 */

export const ROLES = {
  ADMIN_GENERAL: "adminGeneral",
  DIRECTEUR: "directeur",
  COMPTABLE: "comptable",
  ENSEIGNANT: "enseignant"
};

export const ROLE_LABELS = {
  [ROLES.ADMIN_GENERAL]: "Administrateur Général",
  [ROLES.DIRECTEUR]: "Directeur",
  [ROLES.COMPTABLE]: "Comptable",
  [ROLES.ENSEIGNANT]: "Enseignant"
};

/**
 * Permissions disponibles dans l'application.
 * Chaque module futur (élèves, notes, finances...) s'appuiera
 * sur ces mêmes clés.
 */
export const PERMISSIONS = {
  VIEW_ALL_SCHOOLS: "viewAllSchools",
  MANAGE_SCHOOLS: "manageSchools",
  MANAGE_USERS: "manageUsers",
  VIEW_ACTIVITY_LOG: "viewActivityLog",
  MANAGE_SETTINGS: "manageSettings",

  VIEW_STUDENTS: "viewStudents",
  MANAGE_STUDENTS: "manageStudents",

  VIEW_ACADEMICS: "viewAcademics",
  MANAGE_GRADES: "manageGrades",
  CORRECT_ACADEMICS: "correctAcademics",
  MANAGE_SUBJECTS: "manageSubjects",
  VALIDATE_RESULTS: "validateResults",

  VIEW_FINANCE: "viewFinance",
  MANAGE_PAYMENTS: "managePayments",
  CORRECT_PAYMENTS: "correctPayments",
  GRANT_REDUCTIONS: "grantReductions",
  MANAGE_FEE_SETTINGS: "manageFeeSettings",

  VIEW_REPORTS: "viewReports",
  EXPORT_DATA: "exportData"
};

/** Matrice rôle -> permissions accordées. */
const MATRIX = {
  [ROLES.ADMIN_GENERAL]: Object.values(PERMISSIONS), // accès complet

  [ROLES.DIRECTEUR]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.VIEW_ACADEMICS,
    PERMISSIONS.CORRECT_ACADEMICS,
    PERMISSIONS.VALIDATE_RESULTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_DATA
  ],

  [ROLES.COMPTABLE]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_DATA
  ],

  [ROLES.ENSEIGNANT]: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.MANAGE_GRADES
  ]
};

/** Renvoie vrai si le rôle possède la permission demandée. */
export function hasPermission(role, permission) {
  return Boolean(MATRIX[role] && MATRIX[role].includes(permission));
}

/**
 * Filtre du périmètre "école" : seul l'Administrateur Général voit
 * toutes les écoles. Les autres rôles sont cantonnés à l'école
 * inscrite sur leur profil utilisateur (champ `schoolId`).
 */
export function canViewAllSchools(role) {
  return hasPermission(role, PERMISSIONS.VIEW_ALL_SCHOOLS);
}

/** Liste des entrées de menu visibles pour un rôle (module de base). */
export function menuForRole(role) {
  const menu = [{ id: "dashboard", label: "Tableau de bord", icon: "grid" }];

  if (hasPermission(role, PERMISSIONS.VIEW_STUDENTS)) {
    menu.push({ id: "students", label: "Élèves", icon: "users" });
  }
  if (hasPermission(role, PERMISSIONS.VIEW_ACADEMICS) || hasPermission(role, PERMISSIONS.MANAGE_GRADES)) {
    menu.push({ id: "academics", label: "Académique", icon: "book" });
  }
  if (hasPermission(role, PERMISSIONS.VIEW_FINANCE)) {
    menu.push({ id: "finance", label: "Finances", icon: "wallet" });
  }
  if (hasPermission(role, PERMISSIONS.VIEW_REPORTS)) {
    menu.push({ id: "reports", label: "Rapports", icon: "file-text" });
  }
  if (hasPermission(role, PERMISSIONS.MANAGE_SCHOOLS)) {
    menu.push({ id: "schools", label: "Écoles", icon: "school" });
  }
  if (hasPermission(role, PERMISSIONS.MANAGE_USERS)) {
    menu.push({ id: "users", label: "Utilisateurs", icon: "user-cog" });
  }
  if (hasPermission(role, PERMISSIONS.VIEW_ACTIVITY_LOG)) {
    menu.push({ id: "activity", label: "Journal d'activités", icon: "history" });
  }
  if (hasPermission(role, PERMISSIONS.MANAGE_SETTINGS)) {
    menu.push({ id: "settings", label: "Paramètres", icon: "settings" });
  }
  return menu;
}
