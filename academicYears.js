/**
 * Années scolaires (§22). Chaque année scolaire est indépendante ; les
 * données des années précédentes restent archivées et consultables.
 * Stockage : un unique document settings/academicYear
 *   { current: "2026-2027", years: ["2026-2027", ...] }
 */
import { db } from "./firebase-init.js";
import { doc, getDoc, setDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { DEFAULT_SCHOOL_YEAR } from "./firebase-config.js";
import { logActivity } from "./logger.js";

const ref = doc(db, "settings", "academicYear");

/** Crée le document d'année scolaire par défaut s'il n'existe pas encore. */
export async function seedDefaultAcademicYearIfEmpty() {
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { current: DEFAULT_SCHOOL_YEAR, years: [DEFAULT_SCHOOL_YEAR] });
  logActivity("seed_academic_year", `Création de l'année scolaire par défaut ${DEFAULT_SCHOOL_YEAR}`);
}

export function subscribeToAcademicYear(callback) {
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : { current: DEFAULT_SCHOOL_YEAR, years: [DEFAULT_SCHOOL_YEAR] });
  });
}

/** Ajoute une nouvelle année scolaire (ex. "2027-2028") sans supprimer les précédentes. */
export async function addAcademicYear(year) {
  await setDoc(ref, { years: arrayUnion(year) }, { merge: true });
  logActivity("add_academic_year", `Ajout de l'année scolaire ${year}`);
}

/** Change l'année scolaire active pour toute l'application. */
export async function setCurrentAcademicYear(year) {
  await setDoc(ref, { current: year, years: arrayUnion(year) }, { merge: true });
  logActivity("set_current_academic_year", `Année scolaire active définie sur ${year}`);
}
