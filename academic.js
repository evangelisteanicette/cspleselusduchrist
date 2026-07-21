/**
 * =============================================================
 *  MODULE ACADÉMIQUE — Élus School Pro (§31 à §50)
 * =============================================================
 */
import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { logActivity } from "./logger.js";
import { getCurrentUserProfile } from "./auth.js";

const DEFAULT_EVALUATION_TYPES = ["Devoir", "Composition", "Composition Extra", "Examen Blanc"];
const DEFAULT_PERIODS = ["1er Trimestre", "2e Trimestre", "3e Trimestre"];

// ============================================================= MATIÈRES ==

const subjectsCol = collection(db, "subjects");

export function subscribeToSubjects(callback) {
  return onSnapshot(query(subjectsCol, orderBy("name")), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addSubject({ name, classes, maxScore }) {
  await addDoc(subjectsCol, {
    name: name.trim(),
    classes: classes || [],
    maxScore: Number(maxScore) || 20,
    createdAt: serverTimestamp()
  });
  logActivity("create_subject", `Création de la matière ${name}`);
}

export async function updateSubject(id, { name, classes, maxScore }) {
  await updateDoc(doc(db, "subjects", id), {
    name: name.trim(),
    classes: classes || [],
    maxScore: Number(maxScore) || 20
  });
  logActivity("update_subject", `Modification de la matière ${name}`);
}

export async function deleteSubject(id, name) {
  await deleteDoc(doc(db, "subjects", id));
  logActivity("delete_subject", `Suppression de la matière ${name}`);
}

// ================================================ TYPES D'ÉVALUATION / PÉRIODES

const academicMetaRef = doc(db, "settings", "academicMeta");

export async function seedAcademicMetaIfEmpty() {
  const snap = await getDocs(query(collection(db, "settings")));
  const exists = snap.docs.some((d) => d.id === "academicMeta");
  if (exists) return;
  await setDoc(academicMetaRef, { evaluationTypes: DEFAULT_EVALUATION_TYPES, periods: DEFAULT_PERIODS });
}

export function subscribeToAcademicMeta(callback) {
  return onSnapshot(academicMetaRef, (snap) => {
    callback(snap.exists() ? snap.data() : { evaluationTypes: DEFAULT_EVALUATION_TYPES, periods: DEFAULT_PERIODS });
  });
}

export async function addEvaluationType(type) {
  await setDoc(academicMetaRef, { evaluationTypes: arrayUnion(type) }, { merge: true });
  logActivity("add_evaluation_type", `Ajout du type d'évaluation ${type}`);
}

export async function addPeriod(period) {
  await setDoc(academicMetaRef, { periods: arrayUnion(period) }, { merge: true });
  logActivity("add_period", `Ajout de la période ${period}`);
}

// ============================================================= NOTES =====

const gradesCol = collection(db, "grades");

/** Clé de verrouillage des résultats validés (§44). */
function validationKey(schoolId, classe, schoolYear, period) {
  return `${schoolId}_${classe}_${schoolYear}_${period}`;
}

export function subscribeToValidation(schoolId, classe, schoolYear, period, callback) {
  const ref = doc(db, "resultsValidations", validationKey(schoolId, classe, schoolYear, period));
  return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : { validated: false }));
}

export async function validateResults(schoolId, classe, schoolYear, period) {
  const profile = getCurrentUserProfile();
  const ref = doc(db, "resultsValidations", validationKey(schoolId, classe, schoolYear, period));
  await setDoc(ref, {
    validated: true,
    schoolId, classe, schoolYear, period,
    validatedBy: profile?.email || null,
    validatedAt: serverTimestamp()
  });
  logActivity("validate_results", `Validation des résultats ${classe} — ${period} (${schoolYear})`, { schoolId });
}

/** Déverrouillage exceptionnel — réservé à l'Administrateur Général (§44), tracé au journal. */
export async function unlockResults(schoolId, classe, schoolYear, period) {
  const ref = doc(db, "resultsValidations", validationKey(schoolId, classe, schoolYear, period));
  await setDoc(ref, { validated: false }, { merge: true });
  logActivity("unlock_results", `Déverrouillage exceptionnel des résultats ${classe} — ${period} (${schoolYear})`, { schoolId });
}

/**
 * Enregistre une note (§35). Vérifie qu'elle est dans les bornes autorisées
 * et empêche une saisie strictement identique le même jour (§36).
 */
export async function saveGrade(entry) {
  const { studentId, schoolId, classe, subjectId, subjectName, evaluationType, period, schoolYear, score, maxScore } = entry;
  const numScore = Number(score);

  if (Number.isNaN(numScore) || numScore < 0) throw new Error("La note ne peut pas être négative.");
  if (numScore > Number(maxScore)) throw new Error(`La note ne peut pas dépasser ${maxScore}.`);

  const today = new Date().toISOString().slice(0, 10);
  const dupCheck = await getDocs(
    query(
      gradesCol,
      where("studentId", "==", studentId),
      where("subjectId", "==", subjectId),
      where("evaluationType", "==", evaluationType),
      where("period", "==", period),
      where("schoolYear", "==", schoolYear),
      where("date", "==", today)
    )
  );
  if (!dupCheck.empty) {
    throw new Error("Une note identique a déjà été saisie aujourd'hui pour cet élève, cette matière et ce type d'évaluation.");
  }

  const profile = getCurrentUserProfile();
  await addDoc(gradesCol, {
    studentId, schoolId, classe, subjectId, subjectName, evaluationType, period, schoolYear,
    score: numScore,
    maxScore: Number(maxScore),
    teacherId: profile?.uid || null,
    teacherName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
    date: today,
    createdAt: serverTimestamp()
  });

  logActivity("save_grade", `Note saisie : ${subjectName} — ${evaluationType} (${numScore}/${maxScore})`, {
    schoolId, studentId
  });
}

export async function deleteGrade(gradeId, description) {
  await deleteDoc(doc(db, "grades", gradeId));
  logActivity("delete_grade", `Suppression de note : ${description}`);
}

/** Toutes les notes d'un élève pour une année scolaire donnée. */
export function subscribeToStudentGrades(studentId, schoolYear, callback) {
  const q = query(gradesCol, where("studentId", "==", studentId), where("schoolYear", "==", schoolYear));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Toutes les notes d'une classe pour une période (utilisé pour le classement). */
export async function fetchClassGrades(schoolId, classe, schoolYear, period) {
  const q = query(
    gradesCol,
    where("schoolId", "==", schoolId),
    where("classe", "==", classe),
    where("schoolYear", "==", schoolYear),
    where("period", "==", period)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ============================================================= CALCULS ===

/** Regroupe les notes par matière et calcule la moyenne de chaque matière (ramenée sur 20). */
export function computeSubjectAverages(grades) {
  const bySubject = {};
  grades.forEach((g) => {
    if (!bySubject[g.subjectId]) bySubject[g.subjectId] = { subjectName: g.subjectName, scores: [] };
    bySubject[g.subjectId].scores.push((g.score / g.maxScore) * 20);
  });
  return Object.entries(bySubject).map(([subjectId, { subjectName, scores }]) => ({
    subjectId,
    subjectName,
    average: round2(scores.reduce((a, b) => a + b, 0) / scores.length),
    count: scores.length
  }));
}

export function computeOverallAverage(subjectAverages) {
  if (subjectAverages.length === 0) return null;
  return round2(subjectAverages.reduce((a, s) => a + s.average, 0) / subjectAverages.length);
}

/**
 * Classement d'une classe pour une période (§38) : moyenne générale de
 * chaque élève, triée par ordre décroissant, avec gestion des ex æquo.
 */
export function computeClassRanking(students, allGrades) {
  const gradesByStudent = {};
  allGrades.forEach((g) => {
    if (!gradesByStudent[g.studentId]) gradesByStudent[g.studentId] = [];
    gradesByStudent[g.studentId].push(g);
  });

  const ranking = students
    .map((s) => {
      const grades = gradesByStudent[s.id] || [];
      const subjectAverages = computeSubjectAverages(grades);
      const overall = computeOverallAverage(subjectAverages);
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, average: overall, subjectCount: subjectAverages.length };
    })
    .filter((r) => r.average !== null)
    .sort((a, b) => b.average - a.average);

  let rank = 0, lastAverage = null, position = 0;
  ranking.forEach((r) => {
    position += 1;
    if (r.average !== lastAverage) rank = position;
    r.rank = rank;
    lastAverage = r.average;
  });

  return ranking;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function meritDecision(average) {
  if (average === null) return "—";
  if (average >= 16) return "Excellent";
  if (average >= 14) return "Très bien";
  if (average >= 12) return "Bien";
  if (average >= 10) return "Passable";
  return "Insuffisant";
}

// ============================================================= OBSERVATIONS =

export function subscribeToObservations(studentId, callback) {
  const q = query(collection(db, "students", studentId, "observations"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addObservation(studentId, schoolId, text) {
  const profile = getCurrentUserProfile();
  await addDoc(collection(db, "students", studentId, "observations"), {
    text: text.trim(),
    authorName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
    authorRole: profile?.role || null,
    createdAt: serverTimestamp()
  });
  logActivity("add_observation", "Ajout d'une observation", { studentId, schoolId });
}

// ============================================================= ABSENCES ==

export function subscribeToAbsences(studentId, callback) {
  const q = query(collection(db, "students", studentId, "absences"), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addAbsence(studentId, schoolId, { date, status, reason }) {
  await addDoc(collection(db, "students", studentId, "absences"), {
    date, status, reason: reason || "",
    createdAt: serverTimestamp()
  });
  logActivity("add_absence", `Enregistrement présence : ${status} le ${date}`, { studentId, schoolId });
}
