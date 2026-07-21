/**
 * Gestion des écoles (§21). Une école = { name, commune, code, createdAt }.
 * Le "code" (ex: AGO, AVO) sert de préfixe pour les matricules élèves (§26).
 */
import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { DEFAULT_SCHOOLS } from "./firebase-config.js";
import { logActivity } from "./logger.js";

const schoolsCol = collection(db, "schools");

/** Crée les deux écoles de départ, uniquement si la collection est vide. */
export async function seedDefaultSchoolsIfEmpty() {
  const snap = await getDocs(schoolsCol);
  if (!snap.empty) return;

  for (const school of DEFAULT_SCHOOLS) {
    await addDoc(schoolsCol, {
      ...school,
      createdAt: serverTimestamp()
    });
  }
  logActivity("seed_schools", "Création automatique des écoles de départ (Agouna, Avogbana)");
}

/** Abonnement temps réel à la liste des écoles, triée par nom. */
export function subscribeToSchools(callback) {
  const q = query(schoolsCol, orderBy("name"));
  return onSnapshot(q, (snap) => {
    const schools = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(schools);
  });
}

/** Ajoute une nouvelle école (Administrateur Général uniquement, vérifié côté UI + règles Firestore). */
export async function addSchool({ name, commune, code }) {
  const ref = await addDoc(schoolsCol, {
    name: name.trim(),
    commune: commune.trim(),
    code: code.trim().toUpperCase(),
    createdAt: serverTimestamp()
  });
  logActivity("create_school", `Création de l'école ${name} (${commune})`, { schoolId: ref.id });
  return ref.id;
}
