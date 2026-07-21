/**
 * =============================================================
 *  GESTION DES ÉLÈVES — Élus School Pro (§24 à §30)
 * =============================================================
 *  - Matricule automatique et définitif : CODE-ANNÉE-0001 (§26),
 *    généré via une transaction Firestore sur un compteur par école
 *    pour éviter tout doublon en cas de saisies simultanées.
 *  - Réinscription (§25) : conserve le même document élève, mais
 *    archive chaque année dans la sous-collection "enrollments" afin
 *    de garder l'historique complet des classes fréquentées.
 * =============================================================
 */
import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { logActivity } from "./logger.js";
import { getCurrentUserProfile } from "./auth.js";
import { canViewAllSchools } from "./roles.js";

const studentsCol = collection(db, "students");

/**
 * Génère un matricule unique et incrémente le compteur de l'école
 * de façon atomique (transaction) afin d'éviter les collisions.
 */
async function generateMatricule(schoolId, schoolCode, schoolYear) {
  const schoolRef = doc(db, "schools", schoolId);
  const yearPrefix = schoolYear.split("-")[0]; // ex. "2026-2027" -> "2026"

  return runTransaction(db, async (tx) => {
    const schoolSnap = await tx.get(schoolRef);
    const current = schoolSnap.exists() ? schoolSnap.data().studentCounter || 0 : 0;
    const next = current + 1;
    tx.update(schoolRef, { studentCounter: next });
    const serial = String(next).padStart(4, "0");
    return `${schoolCode}-${yearPrefix}-${serial}`;
  });
}

/**
 * Inscrit un nouvel élève. `data` doit contenir tous les champs du
 * formulaire d'inscription (§24). Crée aussi la première entrée de
 * l'historique des inscriptions.
 */
export async function enrollStudent(data) {
  const matricule = await generateMatricule(data.schoolId, data.schoolCode, data.schoolYear);
  const profile = getCurrentUserProfile();

  const studentRef = await addDoc(studentsCol, {
    matricule,
    schoolId: data.schoolId,
    lastName: data.lastName.trim(),
    firstName: data.firstName.trim(),
    sex: data.sex,
    birthDate: data.birthDate,
    nationality: data.nationality || "Béninoise",
    address: data.address || "",
    neighborhood: data.neighborhood || "",
    commune: data.commune || "",
    father: { name: data.fatherName || "", phone: data.fatherPhone || "", profession: data.fatherProfession || "" },
    mother: { name: data.motherName || "", phone: data.motherPhone || "", profession: data.motherProfession || "" },
    guardian: { name: data.guardianName || "", phone: data.guardianPhone || "" },
    uniformGiven: Boolean(data.uniformGiven),
    observations: data.observations || "",
    status: "active",
    currentSchoolYear: data.schoolYear,
    currentClass: data.studentClass,
    enrollmentType: "new",
    registrationDate: data.registrationDate || new Date().toISOString().slice(0, 10),
    createdBy: profile?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, "students", studentRef.id, "enrollments", data.schoolYear), {
    schoolYear: data.schoolYear,
    class: data.studentClass,
    type: "new",
    date: serverTimestamp()
  });

  logActivity("enroll_student", `Inscription de ${data.firstName} ${data.lastName} (${matricule})`, {
    schoolId: data.schoolId,
    studentId: studentRef.id
  });

  return { id: studentRef.id, matricule };
}

/**
 * Réinscrit un élève existant pour une nouvelle année scolaire (§25).
 * Le matricule ne change jamais. Une nouvelle entrée d'historique est
 * créée ; les notes et paiements de l'année précédente restent intacts
 * et consultables (gérés par les modules Académique et Finances).
 */
export async function reEnrollStudent(studentId, { schoolYear, studentClass }) {
  const studentRef = doc(db, "students", studentId);
  const snap = await getDoc(studentRef);
  if (!snap.exists()) throw new Error("Élève introuvable.");
  const student = snap.data();

  await updateDoc(studentRef, {
    currentSchoolYear: schoolYear,
    currentClass: studentClass,
    enrollmentType: "re-enrollment",
    status: "active",
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, "students", studentId, "enrollments", schoolYear), {
    schoolYear,
    class: studentClass,
    type: "re-enrollment",
    date: serverTimestamp()
  });

  logActivity(
    "re_enroll_student",
    `Réinscription de ${student.firstName} ${student.lastName} (${student.matricule}) en ${studentClass} pour ${schoolYear}`,
    { schoolId: student.schoolId, studentId }
  );
}

/** Historique complet des inscriptions d'un élève (une entrée par année). */
export async function getStudentEnrollmentHistory(studentId) {
  const snap = await getDocs(
    query(collection(db, "students", studentId, "enrollments"), orderBy("schoolYear"))
  );
  return snap.docs.map((d) => d.data());
}

/**
 * Abonnement temps réel à la liste des élèves, automatiquement cantonné
 * à l'école de l'utilisateur sauf pour l'Administrateur Général (§90).
 */
export function subscribeToStudents(callback) {
  const profile = getCurrentUserProfile();
  const base = canViewAllSchools(profile.role)
    ? query(studentsCol, orderBy("lastName"))
    : query(studentsCol, where("schoolId", "==", profile.schoolId), orderBy("lastName"));

  return onSnapshot(base, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToStudent(studentId, callback) {
  return onSnapshot(doc(db, "students", studentId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/**
 * Recherche instantanée (§28) : matricule, nom, prénom, téléphone parent.
 * Filtrage côté client sur la liste déjà chargée (suffisant à cette échelle
 * de projet ; un index de recherche dédié pourra être ajouté si le nombre
 * d'élèves devient très important — voir §48).
 */
export function searchStudents(students, term) {
  const t = term.trim().toLowerCase();
  if (!t) return students;
  return students.filter((s) =>
    [s.matricule, s.firstName, s.lastName, s.currentClass, s.father?.phone, s.mother?.phone]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(t))
  );
}
