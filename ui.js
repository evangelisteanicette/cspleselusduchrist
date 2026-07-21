import { APP_NAME, INSTITUTION_NAME } from "./firebase-config.js";
import { ROLE_LABELS, menuForRole, hasPermission, PERMISSIONS, canViewAllSchools } from "./roles.js";
import { icon } from "./icons.js";
import { toggleTheme, currentTheme } from "./theme.js";
import { logout } from "./auth.js";
import { subscribeToSchools, addSchool } from "./schools.js";
import { subscribeToAcademicYear, seedDefaultAcademicYearIfEmpty } from "./academicYears.js";
import { CLASSES, nextClass } from "./classes.js";
import {
  subscribeToStudents,
  subscribeToStudent,
  enrollStudent,
  reEnrollStudent,
  searchStudents,
  getStudentEnrollmentHistory
} from "./students.js";
import {
  subscribeToSubjects,
  addSubject,
  updateSubject,
  deleteSubject,
  subscribeToAcademicMeta,
  seedAcademicMetaIfEmpty,
  addEvaluationType,
  addPeriod,
  saveGrade,
  subscribeToStudentGrades,
  fetchClassGrades,
  computeSubjectAverages,
  computeOverallAverage,
  computeClassRanking,
  meritDecision,
  subscribeToValidation,
  validateResults,
  unlockResults,
  subscribeToObservations,
  addObservation,
  subscribeToAbsences,
  addAbsence
} from "./academic.js";
import {
  TUITION_COMPONENTS,
  PAYMENT_MODES,
  seedFeeSettingsIfEmpty,
  subscribeToFeeSettings,
  saveFeeSettings,
  subscribeToFeeTypes,
  addFeeType,
  deleteFeeType,
  subscribeToStudentFees,
  assignFeeToStudent,
  subscribeToReductions,
  addReduction,
  recordPayment,
  voidPayment,
  subscribeToStudentPayments,
  subscribeToSchoolPayments,
  subscribeToSchoolReductions,
  subscribeToSchoolStudentFees,
  computeStudentBalance,
  formatFCFA
} from "./finance.js";
import { createUserAccount, subscribeToUsers, updateUser, setUserStatus, sendPasswordReset } from "./users.js";
import { seedInstitutionSettingsIfEmpty, subscribeToInstitutionSettings, saveInstitutionSettings } from "./institution.js";
import { addAcademicYear, setCurrentAcademicYear } from "./academicYears.js";
import { exportToCSV } from "./csv.js";
import { db } from "./firebase-init.js";
import { collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

let activeView = "dashboard";
let activeStudentId = null;
let currentProfile = null;

let schoolsUnsub = null;
let usersUnsub = null;
let studentsUnsub = null;      // liste filtrée de la page courante
let globalStudentsUnsub = null; // cache global pour la recherche du bandeau
let academicYearUnsub = null;
let studentDetailUnsub = null;
let subjectsUnsub = null;
let academicMetaUnsub = null;
let financeUnsub = null;
let usersListUnsub = null;
let institutionUnsub = null;

let currentSchools = [];
let currentUsersCount = 0;
let allStudentsCache = [];
let academicYear = { current: "", years: [] };
let studentFilters = { schoolId: "all", classe: "all", sexe: "all" };
let academicMeta = { evaluationTypes: [], periods: [] };
let subjectsCache = [];
let academicSubTab = "subjects";
let financeSubTab = "dashboard";
let feeSettingsCache = {};
let feeTypesCache = [];
let usersCache = [];
let institutionSettings = {};

// ============================================================= SHELL =====

export function renderAppShell(profile) {
  currentProfile = profile;
  const root = document.getElementById("view-app");
  root.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <img src="assets/icons/icon-192.png" alt="" width="36" height="36" />
        <div>
          <div class="brand-name">${APP_NAME}</div>
          <div class="brand-sub">${escapeHtml(INSTITUTION_NAME)}</div>
        </div>
      </div>
      <nav class="sidebar-nav" id="sidebar-nav"></nav>
      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="avatar">${initials(profile)}</div>
          <div class="user-chip-text">
            <div class="user-name">${escapeHtml(profile.firstName || "")} ${escapeHtml(profile.lastName || "")}</div>
            <div class="user-role">${ROLE_LABELS[profile.role] || profile.role}</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <button class="icon-btn" id="btn-menu" aria-label="Menu">${icon("menu")}</button>
        <div class="topbar-search" id="topbar-search-wrap">
          ${icon("search", 18)}
          <input type="text" id="topbar-search" placeholder="Rechercher un élève (nom, matricule, téléphone parent)..." autocomplete="off" />
          <div class="search-results" id="search-results" hidden></div>
        </div>
        <div class="topbar-year" id="topbar-year" title="Année scolaire active"></div>
        <button class="icon-btn" id="btn-theme" aria-label="Changer de thème">${icon(currentTheme() === "dark" ? "sun" : "moon")}</button>
        <button class="icon-btn" id="btn-logout" aria-label="Se déconnecter">${icon("log-out")}</button>
      </header>
      <main class="content" id="content"></main>
    </div>
  `;

  renderSidebarNav(profile);
  document.getElementById("btn-theme").addEventListener("click", () => {
    const next = toggleTheme();
    document.getElementById("btn-theme").innerHTML = icon(next === "dark" ? "sun" : "moon");
  });
  document.getElementById("btn-logout").addEventListener("click", () => logout());
  document.getElementById("btn-menu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  wireTopbarSearch(profile);

  if (academicYearUnsub) academicYearUnsub();
  seedDefaultAcademicYearIfEmpty().catch(() => {});
  academicYearUnsub = subscribeToAcademicYear((data) => {
    academicYear = data;
    const el = document.getElementById("topbar-year");
    if (el) el.textContent = data.current || "";
    if (profile.role === "adminGeneral" && data.current) {
      seedFeeSettingsIfEmpty(data.current).catch(() => {});
    }
  });

  if (hasPermission(profile.role, PERMISSIONS.VIEW_STUDENTS)) {
    if (globalStudentsUnsub) globalStudentsUnsub();
    globalStudentsUnsub = subscribeToStudents((students) => {
      allStudentsCache = students;
    });
  }

  if (hasPermission(profile.role, PERMISSIONS.VIEW_ACADEMICS) || hasPermission(profile.role, PERMISSIONS.MANAGE_GRADES)) {
    seedAcademicMetaIfEmpty().catch(() => {});
    if (subjectsUnsub) subjectsUnsub();
    subjectsUnsub = subscribeToSubjects((subjects) => { subjectsCache = subjects; });
    if (academicMetaUnsub) academicMetaUnsub();
    academicMetaUnsub = subscribeToAcademicMeta((meta) => { academicMeta = meta; });
  }

  if (profile.role === "adminGeneral") {
    seedInstitutionSettingsIfEmpty().catch(() => {});
  }

  navigateTo(activeView, profile);
}

function renderSidebarNav(profile) {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = menuForRole(profile.role)
    .map(
      (item) => `
      <button class="nav-item ${item.id === activeView ? "active" : ""}" data-view="${item.id}">
        ${icon(item.icon)}<span>${item.label}</span>
      </button>`
    )
    .join("");
  nav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeStudentId = null;
      navigateTo(btn.dataset.view, profile);
      document.getElementById("sidebar").classList.remove("open");
    });
  });
}

function navigateTo(view, profile) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const content = document.getElementById("content");
  if (!content) return;

  if (studentDetailUnsub) { studentDetailUnsub(); studentDetailUnsub = null; }
  if (tabGradesUnsub) { tabGradesUnsub(); tabGradesUnsub = null; }
  if (tabObservationsUnsub) { tabObservationsUnsub(); tabObservationsUnsub = null; }
  if (tabAbsencesUnsub) { tabAbsencesUnsub(); tabAbsencesUnsub = null; }
  if (gradeEntryValidationUnsub) { gradeEntryValidationUnsub(); gradeEntryValidationUnsub = null; }
  Object.keys(tabFinanceUnsub).forEach((k) => { if (tabFinanceUnsub[k]) { tabFinanceUnsub[k](); tabFinanceUnsub[k] = null; } });
  if (financeUnsub) { financeUnsub(); financeUnsub = null; }

  if (view === "dashboard") return renderDashboard(content, profile);
  if (view === "schools") return renderSchools(content, profile);
  if (view === "students") return renderStudents(content, profile);
  if (view === "academics") return renderAcademics(content, profile);
  if (view === "finance") return renderFinance(content, profile);
  if (view === "users") return renderUsers(content, profile);
  if (view === "activity") return renderActivityLog(content, profile);
  if (view === "reports") return renderReports(content, profile);
  if (view === "settings") return renderSettings(content, profile);
  return renderComingSoon(content, view);
}

function openStudentDetail(studentId, profile) {
  activeStudentId = studentId;
  const content = document.getElementById("content");
  renderStudentDetail(content, profile, studentId);
}

// ============================================================= SEARCH ====

function wireTopbarSearch(profile) {
  const input = document.getElementById("topbar-search");
  const results = document.getElementById("search-results");
  if (!input) return;

  if (!hasPermission(profile.role, PERMISSIONS.VIEW_STUDENTS)) {
    input.disabled = true;
    input.placeholder = "Recherche disponible selon votre rôle";
    return;
  }

  input.addEventListener("input", () => {
    const term = input.value.trim();
    if (!term) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    const matches = searchStudents(allStudentsCache, term).slice(0, 8);
    if (matches.length === 0) {
      results.innerHTML = `<div class="search-empty">Aucun élève trouvé</div>`;
    } else {
      results.innerHTML = matches
        .map(
          (s) => `
        <button class="search-result-item" data-id="${s.id}">
          <span class="search-result-name">${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</span>
          <span class="search-result-meta">${escapeHtml(s.matricule)} · ${escapeHtml(s.currentClass)}</span>
        </button>`
        )
        .join("");
    }
    results.hidden = false;
    results.querySelectorAll(".search-result-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        results.hidden = true;
        input.value = "";
        navigateTo("students", profile);
        openStudentDetail(btn.dataset.id, profile);
      });
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#topbar-search-wrap")) results.hidden = true;
  });
}

// ============================================================= DASHBOARD =

function renderDashboard(content, profile) {
  const cards = [];
  if (canViewAllSchools(profile.role)) cards.push({ key: "schools", icon: "school", label: "Écoles" });
  if (hasPermission(profile.role, PERMISSIONS.MANAGE_USERS)) {
    cards.push({ key: "teachers", icon: "user-cog", label: "Enseignants" });
    cards.push({ key: "directors", icon: "user-cog", label: "Directeurs" });
    cards.push({ key: "accountants", icon: "user-cog", label: "Comptables" });
  }
  if (hasPermission(profile.role, PERMISSIONS.VIEW_STUDENTS)) cards.push({ key: "students", icon: "users", label: "Élèves" });
  if (hasPermission(profile.role, PERMISSIONS.VIEW_FINANCE)) {
    cards.push({ key: "revenueToday", icon: "wallet", label: "Recettes du jour" });
    cards.push({ key: "revenueMonth", icon: "wallet", label: "Recettes du mois" });
    cards.push({ key: "remaining", icon: "alert-triangle", label: "Restant à recouvrer" });
    cards.push({ key: "late", icon: "alert-triangle", label: "Élèves en retard" });
  }

  content.innerHTML = `
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <p>Bienvenue, ${escapeHtml(profile.firstName || profile.email)}. Voici la vue d'ensemble du complexe.</p>
    </div>
    <div class="card-grid" id="stat-cards">
      ${cards.map((c) => statCard(c.icon, c.label, "—", c.key)).join("")}
    </div>
    ${hasPermission(profile.role, PERMISSIONS.VIEW_ACTIVITY_LOG) ? `
      <div class="panel">
        <h3>Dernières activités</h3>
        <ul class="history-list" id="dashboard-activity"><li class="muted">Chargement…</li></ul>
      </div>` : ""}
  `;

  if (canViewAllSchools(profile.role)) {
    if (schoolsUnsub) schoolsUnsub();
    schoolsUnsub = subscribeToSchools((schools) => {
      currentSchools = schools;
      setStatByKey("schools", schools.length);
    });
  }

  if (hasPermission(profile.role, PERMISSIONS.VIEW_STUDENTS)) {
    if (studentsUnsub) studentsUnsub();
    studentsUnsub = subscribeToStudents((students) => setStatByKey("students", students.length));
  }

  if (hasPermission(profile.role, PERMISSIONS.MANAGE_USERS)) {
    if (usersUnsub) usersUnsub();
    usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => d.data());
      setStatByKey("teachers", list.filter((u) => u.role === "enseignant").length);
      setStatByKey("directors", list.filter((u) => u.role === "directeur").length);
      setStatByKey("accountants", list.filter((u) => u.role === "comptable").length);
    });
  }

  if (hasPermission(profile.role, PERMISSIONS.VIEW_FINANCE)) {
    const schoolId = canViewAllSchools(profile.role) ? null : profile.schoolId;
    if (financeUnsub) financeUnsub();
    let payments = [], reductions = [], otherFees = [];
    const repaint = () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthPrefix = today.slice(0, 7);
      const valid = payments.filter((p) => !p.voided);
      setStatByKey("revenueToday", formatFCFA(valid.filter((p) => p.date === today).reduce((s, p) => s + p.amount, 0)));
      setStatByKey("revenueMonth", formatFCFA(valid.filter((p) => p.date.startsWith(monthPrefix)).reduce((s, p) => s + p.amount, 0)));

      const students = allStudentsCache.filter((s) => !schoolId || s.schoolId === schoolId);
      let remaining = 0, late = 0;
      students.forEach((s) => {
        const balance = computeStudentBalance(
          s, feeSettingsCache,
          otherFees.filter((f) => f.studentId === s.id),
          reductions.filter((r) => r.studentId === s.id),
          payments.filter((p) => p.studentId === s.id)
        );
        remaining += balance.totalRemaining;
        if (balance.isLate) late += 1;
      });
      setStatByKey("remaining", formatFCFA(remaining));
      setStatByKey("late", late);
    };
    const u1 = subscribeToSchoolPayments(schoolId, academicYear.current, (d) => { payments = d; repaint(); });
    const u2 = subscribeToSchoolReductions(schoolId, academicYear.current, (d) => { reductions = d; repaint(); });
    const u3 = subscribeToSchoolStudentFees(schoolId, academicYear.current, (d) => { otherFees = d; repaint(); });
    const u4 = subscribeToFeeSettings(academicYear.current, (d) => { feeSettingsCache = d; repaint(); });
    financeUnsub = () => { u1(); u2(); u3(); u4(); };
  }

  if (hasPermission(profile.role, PERMISSIONS.VIEW_ACTIVITY_LOG)) {
    const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), limit(8));
    onSnapshot(q, (snap) => {
      const list = document.getElementById("dashboard-activity");
      if (!list) return;
      const logs = snap.docs.map((d) => d.data());
      list.innerHTML = logs.length
        ? logs.map((l) => `<li>${escapeHtml(l.description)} <span class="muted">— ${escapeHtml(l.userEmail || "")}</span></li>`).join("")
        : '<li class="muted">Aucune activité récente.</li>';
    });
  }
}

function setStatByKey(key, value) {
  const el = document.querySelector(`[data-stat="${key}"] .stat-value`);
  if (el) el.textContent = value;
}

function statCard(iconName, label, value, key) {
  return `
    <div class="stat-card" data-stat="${key || iconName}">
      <div class="stat-icon">${icon(iconName, 22)}</div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;
}

// ============================================================= SCHOOLS ===

function renderSchools(content, profile) {
  const canManage = hasPermission(profile.role, PERMISSIONS.MANAGE_SCHOOLS);
  content.innerHTML = `
    <div class="page-header">
      <h1>Écoles du complexe</h1>
      <p>${INSTITUTION_NAME}</p>
      ${canManage ? `<button class="btn-primary" id="btn-add-school">${icon("plus", 18)} Ajouter une école</button>` : ""}
    </div>
    <div class="card-grid" id="schools-grid"><p class="muted">Chargement…</p></div>
  `;

  if (canManage) {
    document.getElementById("btn-add-school").addEventListener("click", () => openAddSchoolModal());
  }

  if (schoolsUnsub) schoolsUnsub();
  schoolsUnsub = subscribeToSchools((schools) => {
    currentSchools = schools;
    const grid = document.getElementById("schools-grid");
    if (!grid) return;
    if (schools.length === 0) {
      grid.innerHTML = `<p class="muted">Aucune école pour le moment.</p>`;
      return;
    }
    grid.innerHTML = schools
      .map(
        (s) => `
      <div class="school-card">
        <div class="school-card-icon">${icon("school", 24)}</div>
        <h3>${escapeHtml(s.name)}</h3>
        <p class="muted">${icon("map-pin", 14)} ${escapeHtml(s.commune)}</p>
        <span class="badge">${escapeHtml(s.code)}</span>
      </div>`
      )
      .join("");
  });
}

function openAddSchoolModal() {
  return createModal({
    title: "Ajouter une école",
    bodyHtml: `
      <label>Nom de l'école
        <input type="text" name="name" required placeholder="Ex. Agouna" />
      </label>
      <label>Commune
        <input type="text" name="commune" required placeholder="Ex. Djidja" />
      </label>
      <label>Code (préfixe matricule)
        <input type="text" name="code" required maxlength="5" placeholder="Ex. AGO" />
      </label>
    `,
    onSubmit: async (data) => addSchool(data)
  });
}

// ============================================================= STUDENTS ==

function renderStudents(content, profile) {
  const canManage = hasPermission(profile.role, PERMISSIONS.MANAGE_STUDENTS);
  const showSchoolFilter = canViewAllSchools(profile.role);

  content.innerHTML = `
    <div class="page-header">
      <h1>Élèves</h1>
      <p>Année scolaire active : <strong>${escapeHtml(academicYear.current || "—")}</strong></p>
      ${canManage ? `<button class="btn-primary" id="btn-add-student">${icon("plus", 18)} Inscrire un élève</button>` : ""}
    </div>

    <div class="filters-bar">
      ${showSchoolFilter ? `<select id="filter-school"><option value="all">Toutes les écoles</option></select>` : ""}
      <select id="filter-class">
        <option value="all">Toutes les classes</option>
        ${CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("")}
      </select>
      <select id="filter-sex">
        <option value="all">Filles et garçons</option>
        <option value="F">Filles</option>
        <option value="M">Garçons</option>
      </select>
    </div>

    <div class="table-wrap">
      <table class="data-table" id="students-table">
        <thead>
          <tr>
            <th>Matricule</th><th>Nom</th><th>Prénom</th><th>Sexe</th><th>Classe</th>
            ${showSchoolFilter ? "<th>École</th>" : ""}
            <th>Type</th><th></th>
          </tr>
        </thead>
        <tbody><tr><td colspan="8" class="muted">Chargement…</td></tr></tbody>
      </table>
    </div>
  `;

  if (showSchoolFilter) {
    const sel = document.getElementById("filter-school");
    sel.innerHTML += currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    sel.value = studentFilters.schoolId;
    sel.addEventListener("change", () => {
      studentFilters.schoolId = sel.value;
      renderStudentsTable(profile, showSchoolFilter);
    });
  }
  document.getElementById("filter-class").value = studentFilters.classe;
  document.getElementById("filter-class").addEventListener("change", (e) => {
    studentFilters.classe = e.target.value;
    renderStudentsTable(profile, showSchoolFilter);
  });
  document.getElementById("filter-sex").value = studentFilters.sexe;
  document.getElementById("filter-sex").addEventListener("change", (e) => {
    studentFilters.sexe = e.target.value;
    renderStudentsTable(profile, showSchoolFilter);
  });

  if (canManage) {
    document.getElementById("btn-add-student").addEventListener("click", () => openEnrollStudentModal(profile));
  }

  if (studentsUnsub) studentsUnsub();
  studentsUnsub = subscribeToStudents((students) => {
    allStudentsCache = students;
    renderStudentsTable(profile, showSchoolFilter);
  });
}

function renderStudentsTable(profile, showSchoolFilter) {
  const tbody = document.querySelector("#students-table tbody");
  if (!tbody) return;

  let list = allStudentsCache;
  if (studentFilters.schoolId !== "all") list = list.filter((s) => s.schoolId === studentFilters.schoolId);
  if (studentFilters.classe !== "all") list = list.filter((s) => s.currentClass === studentFilters.classe);
  if (studentFilters.sexe !== "all") list = list.filter((s) => s.sex === studentFilters.sexe);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Aucun élève ne correspond à ces filtres.</td></tr>`;
    return;
  }

  const schoolName = (id) => currentSchools.find((s) => s.id === id)?.name || "—";

  tbody.innerHTML = list
    .map(
      (s) => `
    <tr data-id="${s.id}" class="row-clickable">
      <td>${escapeHtml(s.matricule)}</td>
      <td>${escapeHtml(s.lastName)}</td>
      <td>${escapeHtml(s.firstName)}</td>
      <td>${s.sex === "F" ? "F" : "M"}</td>
      <td>${escapeHtml(s.currentClass)}</td>
      ${showSchoolFilter ? `<td>${escapeHtml(schoolName(s.schoolId))}</td>` : ""}
      <td><span class="badge badge-soft">${s.enrollmentType === "new" ? "Nouveau" : "Réinscrit"}</span></td>
      <td><button class="btn-secondary btn-sm" data-open="${s.id}">Ouvrir</button></td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openStudentDetail(btn.dataset.open, profile));
  });
  tbody.querySelectorAll("tr.row-clickable").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openStudentDetail(row.dataset.id, profile);
    });
  });
}

function openEnrollStudentModal(profile) {
  const schoolOptions = canViewAllSchools(profile.role)
    ? currentSchools.map((s) => `<option value="${s.id}" data-code="${s.code}">${escapeHtml(s.name)}</option>`).join("")
    : (() => {
        const s = currentSchools.find((x) => x.id === profile.schoolId);
        return s ? `<option value="${s.id}" data-code="${s.code}">${escapeHtml(s.name)}</option>` : "";
      })();

  return createModal({
    title: "Inscrire un nouvel élève",
    wide: true,
    bodyHtml: `
      <div class="form-section-title">Identité</div>
      <div class="form-grid-2">
        <label>Nom<input type="text" name="lastName" required /></label>
        <label>Prénom<input type="text" name="firstName" required /></label>
        <label>Sexe
          <select name="sex" required><option value="F">Féminin</option><option value="M">Masculin</option></select>
        </label>
        <label>Date de naissance<input type="date" name="birthDate" required /></label>
        <label>Nationalité<input type="text" name="nationality" value="Béninoise" /></label>
      </div>

      <div class="form-section-title">Scolarité</div>
      <div class="form-grid-2">
        <label>École
          <select name="schoolId" id="enroll-school" required>${schoolOptions}</select>
        </label>
        <label>Classe
          <select name="studentClass" required>${CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </label>
        <label>Année scolaire<input type="text" name="schoolYear" value="${academicYear.current}" required /></label>
        <label>Date d'inscription<input type="date" name="registrationDate" value="${new Date().toISOString().slice(0, 10)}" /></label>
      </div>

      <div class="form-section-title">Adresse</div>
      <div class="form-grid-2">
        <label>Quartier / village<input type="text" name="neighborhood" /></label>
        <label>Commune<input type="text" name="commune" /></label>
        <label class="span-2">Adresse<input type="text" name="address" /></label>
      </div>

      <div class="form-section-title">Parents / Tuteur</div>
      <div class="form-grid-2">
        <label>Nom du père<input type="text" name="fatherName" /></label>
        <label>Téléphone du père<input type="tel" name="fatherPhone" /></label>
        <label>Profession du père<input type="text" name="fatherProfession" /></label>
        <label>Nom de la mère<input type="text" name="motherName" /></label>
        <label>Téléphone de la mère<input type="tel" name="motherPhone" /></label>
        <label>Profession de la mère<input type="text" name="motherProfession" /></label>
        <label>Nom du tuteur (si nécessaire)<input type="text" name="guardianName" /></label>
        <label>Téléphone du tuteur<input type="tel" name="guardianPhone" /></label>
      </div>

      <div class="form-section-title">Complément</div>
      <label class="checkbox-line"><input type="checkbox" name="uniformGiven" /> Uniforme remis</label>
      <label>Observations<textarea name="observations" rows="2"></textarea></label>
    `,
    onSubmit: async (data) => {
      const schoolSelect = document.getElementById("enroll-school");
      const schoolCode = schoolSelect.options[schoolSelect.selectedIndex]?.dataset.code || "ELV";
      await enrollStudent({ ...data, schoolCode, uniformGiven: data.uniformGiven === "on" });
    }
  });
}

// ============================================================= ACADÉMIQUE =

function renderAcademics(content, profile) {
  const canManageSubjects = hasPermission(profile.role, PERMISSIONS.MANAGE_SUBJECTS);
  const canEnterGrades = hasPermission(profile.role, PERMISSIONS.MANAGE_GRADES) || hasPermission(profile.role, PERMISSIONS.CORRECT_ACADEMICS);
  const canViewRanking = hasPermission(profile.role, PERMISSIONS.VIEW_ACADEMICS) || canEnterGrades;

  const tabs = [
    canManageSubjects && { id: "subjects", label: "Matières" },
    canEnterGrades && { id: "grades", label: "Saisie des notes" },
    canViewRanking && { id: "ranking", label: "Classements" }
  ].filter(Boolean);

  if (!tabs.some((t) => t.id === academicSubTab)) academicSubTab = tabs[0]?.id || "subjects";

  content.innerHTML = `
    <div class="page-header">
      <h1>Académique</h1>
      <p>Année scolaire active : <strong>${escapeHtml(academicYear.current || "—")}</strong></p>
    </div>
    <div class="tabs">
      ${tabs.map((t) => `<button class="tab ${t.id === academicSubTab ? "active" : ""}" data-subtab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div id="academic-panel"></div>
  `;

  content.querySelectorAll("[data-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      academicSubTab = btn.dataset.subtab;
      content.querySelectorAll("[data-subtab]").forEach((b) => b.classList.toggle("active", b.dataset.subtab === academicSubTab));
      paintAcademicPanel(content, profile);
    });
  });

  paintAcademicPanel(content, profile);
}

function paintAcademicPanel(content, profile) {
  const panel = content.querySelector("#academic-panel");
  if (!panel) return;
  if (academicSubTab === "subjects") return renderSubjectsPanel(panel, profile);
  if (academicSubTab === "grades") return renderGradeEntryPanel(panel, profile);
  if (academicSubTab === "ranking") return renderRankingPanel(panel, profile);
}

// ---- Matières -------------------------------------------------------------

function renderSubjectsPanel(panel, profile) {
  panel.innerHTML = `
    <div class="page-header" style="margin-top:8px;">
      <button class="btn-primary" id="btn-add-subject">${icon("plus", 18)} Ajouter une matière</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Matière</th><th>Classes concernées</th><th>Note maximale</th><th></th></tr></thead>
        <tbody id="subjects-tbody"><tr><td colspan="4" class="muted">Chargement…</td></tr></tbody>
      </table>
    </div>

    <div class="panel" style="margin-top:20px;">
      <h3>Types d'évaluation</h3>
      <div class="chip-row" id="eval-types-chips"></div>
      <form id="form-add-evaltype" class="observation-form" style="margin-top:10px;">
        <input type="text" name="type" placeholder="Ex. Interrogation surprise" required />
        <button type="submit" class="btn-secondary btn-sm">Ajouter</button>
      </form>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>Périodes</h3>
      <div class="chip-row" id="periods-chips"></div>
      <form id="form-add-period" class="observation-form" style="margin-top:10px;">
        <input type="text" name="period" placeholder="Ex. 4e Trimestre" required />
        <button type="submit" class="btn-secondary btn-sm">Ajouter</button>
      </form>
    </div>
  `;

  document.getElementById("btn-add-subject").addEventListener("click", () => openSubjectModal());

  const paintMeta = () => {
    const evalBox = document.getElementById("eval-types-chips");
    const periodBox = document.getElementById("periods-chips");
    if (evalBox) evalBox.innerHTML = academicMeta.evaluationTypes.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    if (periodBox) periodBox.innerHTML = academicMeta.periods.map((p) => `<span class="chip">${escapeHtml(p)}</span>`).join("");
  };
  paintMeta();
  if (academicMetaUnsub) academicMetaUnsub();
  academicMetaUnsub = subscribeToAcademicMeta((meta) => { academicMeta = meta; paintMeta(); });

  document.getElementById("form-add-evaltype").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.type.trim()) await addEvaluationType(data.type.trim());
    e.target.reset();
  });
  document.getElementById("form-add-period").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.period.trim()) await addPeriod(data.period.trim());
    e.target.reset();
  });

  if (subjectsUnsub) subjectsUnsub();
  subjectsUnsub = subscribeToSubjects((subjects) => {
    subjectsCache = subjects;
    const tbody = document.getElementById("subjects-tbody");
    if (!tbody) return;
    if (subjects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Aucune matière pour le moment.</td></tr>`;
      return;
    }
    tbody.innerHTML = subjects
      .map(
        (s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${(s.classes || []).join(", ") || '<span class="muted">Toutes</span>'}</td>
        <td>${s.maxScore}</td>
        <td>
          <button class="btn-secondary btn-sm" data-edit="${s.id}">Modifier</button>
          <button class="btn-secondary btn-sm" data-delete="${s.id}">Supprimer</button>
        </td>
      </tr>`
      )
      .join("");
    tbody.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => openSubjectModal(subjects.find((s) => s.id === btn.dataset.edit)))
    );
    tbody.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const subject = subjects.find((s) => s.id === btn.dataset.delete);
        if (confirm(`Supprimer la matière "${subject.name}" ?`)) await deleteSubject(subject.id, subject.name);
      })
    );
  });
}

function openSubjectModal(subject) {
  const isEdit = Boolean(subject);
  return createModal({
    title: isEdit ? "Modifier la matière" : "Ajouter une matière",
    bodyHtml: `
      <label>Nom de la matière<input type="text" name="name" required value="${subject ? escapeHtml(subject.name) : ""}" /></label>
      <label>Note maximale<input type="number" name="maxScore" min="1" value="${subject ? subject.maxScore : 20}" /></label>
      <div class="form-section-title">Classes concernées</div>
      <div class="checkbox-grid">
        ${CLASSES.map(
          (c) => `
          <label class="checkbox-line">
            <input type="checkbox" name="classes" value="${c}" ${subject && subject.classes?.includes(c) ? "checked" : ""} /> ${c}
          </label>`
        ).join("")}
      </div>
      <p class="muted" style="margin-top:6px;">Aucune case cochée = matière proposée pour toutes les classes.</p>
    `,
    onSubmit: async (data, formEl) => {
      const classes = Array.from(formEl.querySelectorAll('input[name="classes"]:checked')).map((i) => i.value);
      const payload = { name: data.name, maxScore: data.maxScore, classes };
      if (isEdit) await updateSubject(subject.id, payload);
      else await addSubject(payload);
    }
  });
}

// ---- Saisie des notes ------------------------------------------------------

let gradeEntryFilters = { schoolId: "all", classe: CLASSES[0], subjectId: "", evaluationType: "", period: "" };

function renderGradeEntryPanel(panel, profile) {
  const showSchoolFilter = canViewAllSchools(profile.role);
  gradeEntryFilters.schoolId = showSchoolFilter ? gradeEntryFilters.schoolId : profile.schoolId;
  if (!gradeEntryFilters.evaluationType) gradeEntryFilters.evaluationType = academicMeta.evaluationTypes[0] || "";
  if (!gradeEntryFilters.period) gradeEntryFilters.period = academicMeta.periods[0] || "";

  panel.innerHTML = `
    <div class="filters-bar" style="margin-top:8px;">
      ${showSchoolFilter ? `<select id="ge-school">${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>` : ""}
      <select id="ge-class">${CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
      <select id="ge-subject">${subjectsCache.map((s) => `<option value="${s.id}" data-max="${s.maxScore}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("") || '<option value="">Aucune matière</option>'}</select>
      <select id="ge-eval">${academicMeta.evaluationTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
      <select id="ge-period">${academicMeta.periods.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
    </div>
    <div id="ge-lock-banner"></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Élève</th><th>Note</th><th></th></tr></thead>
        <tbody id="ge-tbody"><tr><td colspan="3" class="muted">Sélectionnez une matière pour commencer.</td></tr></tbody>
      </table>
    </div>
  `;

  const schoolSel = document.getElementById("ge-school");
  const classSel = document.getElementById("ge-class");
  const subjectSel = document.getElementById("ge-subject");
  const evalSel = document.getElementById("ge-eval");
  const periodSel = document.getElementById("ge-period");

  if (schoolSel) { schoolSel.value = gradeEntryFilters.schoolId; schoolSel.addEventListener("change", () => { gradeEntryFilters.schoolId = schoolSel.value; refreshGradeEntryTable(profile); }); }
  classSel.value = gradeEntryFilters.classe;
  classSel.addEventListener("change", () => { gradeEntryFilters.classe = classSel.value; refreshGradeEntryTable(profile); });
  subjectSel.value = gradeEntryFilters.subjectId || subjectSel.value;
  gradeEntryFilters.subjectId = subjectSel.value;
  subjectSel.addEventListener("change", () => { gradeEntryFilters.subjectId = subjectSel.value; refreshGradeEntryTable(profile); });
  evalSel.value = gradeEntryFilters.evaluationType;
  evalSel.addEventListener("change", () => { gradeEntryFilters.evaluationType = evalSel.value; refreshGradeEntryTable(profile); });
  periodSel.value = gradeEntryFilters.period;
  periodSel.addEventListener("change", () => { gradeEntryFilters.period = periodSel.value; refreshGradeEntryTable(profile); });

  refreshGradeEntryTable(profile);
}

let gradeEntryValidationUnsub = null;

function refreshGradeEntryTable(profile) {
  const tbody = document.getElementById("ge-tbody");
  const lockBanner = document.getElementById("ge-lock-banner");
  if (!tbody) return;

  const { schoolId, classe, subjectId, evaluationType, period } = gradeEntryFilters;
  const subject = subjectsCache.find((s) => s.id === subjectId);
  const maxScore = subject?.maxScore || 20;

  const students = allStudentsCache.filter((s) => s.schoolId === schoolId && s.currentClass === classe);

  if (gradeEntryValidationUnsub) gradeEntryValidationUnsub();
  gradeEntryValidationUnsub = subscribeToValidation(schoolId, classe, academicYear.current, period, (v) => {
    const isAdmin = profile.role === "adminGeneral";
    lockBanner.innerHTML = v.validated
      ? `<div class="alert" style="background:var(--gold-100); color:var(--navy-900); margin-bottom:14px;">
          ${icon("shield", 16)} Résultats validés pour cette période — la saisie est verrouillée.
          ${isAdmin ? `<button class="btn-secondary btn-sm" id="btn-unlock" style="margin-left:10px;">Déverrouiller</button>` : ""}
        </div>`
      : "";
    if (isAdmin && v.validated) {
      document.getElementById("btn-unlock")?.addEventListener("click", async () => {
        await unlockResults(schoolId, classe, academicYear.current, period);
      });
    }
    paintGradeRows(tbody, students, subject, maxScore, evaluationType, period, schoolId, classe, v.validated, profile);
  });
}

function paintGradeRows(tbody, students, subject, maxScore, evaluationType, period, schoolId, classe, locked, profile) {
  const isAdmin = profile.role === "adminGeneral";
  const disabled = locked && !isAdmin;

  if (!subject || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">${!subject ? "Choisissez une matière." : "Aucun élève dans cette classe."}</td></tr>`;
    return;
  }

  tbody.innerHTML = students
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.lastName)} ${escapeHtml(s.firstName)} <span class="muted">(${escapeHtml(s.matricule)})</span></td>
      <td><input type="number" min="0" max="${maxScore}" step="0.5" class="score-input" data-student="${s.id}" style="width:90px;" ${disabled ? "disabled" : ""} /></td>
      <td><button class="btn-secondary btn-sm" data-save="${s.id}" ${disabled ? "disabled" : ""}>Enregistrer</button></td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const studentId = btn.dataset.save;
      const input = tbody.querySelector(`.score-input[data-student="${studentId}"]`);
      const score = input.value;
      if (score === "") return;
      btn.disabled = true;
      try {
        await saveGrade({
          studentId, schoolId, classe,
          subjectId: subject.id, subjectName: subject.name,
          evaluationType, period, schoolYear: academicYear.current,
          score, maxScore
        });
        input.value = "";
        input.style.borderColor = "var(--success)";
        setTimeout(() => { input.style.borderColor = ""; }, 900);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ---- Classements ------------------------------------------------------------

let rankingFilters = { schoolId: "all", classe: CLASSES[0], period: "" };

function renderRankingPanel(panel, profile) {
  const showSchoolFilter = canViewAllSchools(profile.role);
  rankingFilters.schoolId = showSchoolFilter ? rankingFilters.schoolId : profile.schoolId;
  if (!rankingFilters.period) rankingFilters.period = academicMeta.periods[0] || "";
  const canValidate = hasPermission(profile.role, PERMISSIONS.VALIDATE_RESULTS);

  panel.innerHTML = `
    <div class="filters-bar" style="margin-top:8px;">
      ${showSchoolFilter ? `<select id="rk-school">${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>` : ""}
      <select id="rk-class">${CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
      <select id="rk-period">${academicMeta.periods.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
      ${canValidate ? `<button class="btn-primary btn-sm" id="btn-validate">${icon("shield", 16)} Valider les résultats</button>` : ""}
    </div>
    <div id="rk-validation-badge"></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Rang</th><th>Élève</th><th>Moyenne / 20</th><th>Mention</th></tr></thead>
        <tbody id="rk-tbody"><tr><td colspan="4" class="muted">Chargement…</td></tr></tbody>
      </table>
    </div>
  `;

  const schoolSel = document.getElementById("rk-school");
  const classSel = document.getElementById("rk-class");
  const periodSel = document.getElementById("rk-period");
  if (schoolSel) { schoolSel.value = rankingFilters.schoolId; schoolSel.addEventListener("change", () => { rankingFilters.schoolId = schoolSel.value; refreshRanking(profile); }); }
  classSel.value = rankingFilters.classe;
  classSel.addEventListener("change", () => { rankingFilters.classe = classSel.value; refreshRanking(profile); });
  periodSel.value = rankingFilters.period;
  periodSel.addEventListener("change", () => { rankingFilters.period = periodSel.value; refreshRanking(profile); });

  refreshRanking(profile);
}

async function refreshRanking(profile) {
  const tbody = document.getElementById("rk-tbody");
  const badge = document.getElementById("rk-validation-badge");
  const { schoolId, classe, period } = rankingFilters;
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Calcul en cours…</td></tr>`;

  const students = allStudentsCache.filter((s) => s.schoolId === schoolId && s.currentClass === classe);
  const grades = await fetchClassGrades(schoolId, classe, academicYear.current, period);
  const ranking = computeClassRanking(students, grades);

  if (ranking.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Aucune note saisie pour cette sélection.</td></tr>`;
  } else {
    tbody.innerHTML = ranking
      .map(
        (r) => `<tr><td>${r.rank}</td><td>${escapeHtml(r.name)}</td><td>${r.average}</td><td>${meritDecision(r.average)}</td></tr>`
      )
      .join("");
  }

  subscribeToValidation(schoolId, classe, academicYear.current, period, (v) => {
    badge.innerHTML = v.validated
      ? `<div class="alert" style="background:var(--gold-100); color:var(--navy-900); margin-bottom:14px;">${icon("shield", 16)} Résultats validés.</div>`
      : "";
  });

  const btn = document.getElementById("btn-validate");
  if (btn) {
    btn.addEventListener("click", async () => {
      await validateResults(schoolId, classe, academicYear.current, period);
    });
  }
}

// ============================================================= FINANCES ==

function renderFinance(content, profile) {
  const canConfigure = hasPermission(profile.role, PERMISSIONS.MANAGE_FEE_SETTINGS);
  const tabs = [
    { id: "dashboard", label: "Tableau de bord" },
    { id: "late", label: "Élèves non à jour" },
    canConfigure && { id: "config", label: "Paramètres des frais" }
  ].filter(Boolean);
  if (!tabs.some((t) => t.id === financeSubTab)) financeSubTab = "dashboard";

  content.innerHTML = `
    <div class="page-header">
      <h1>Finances</h1>
      <p>Année scolaire active : <strong>${escapeHtml(academicYear.current || "—")}</strong></p>
    </div>
    <div class="tabs">
      ${tabs.map((t) => `<button class="tab ${t.id === financeSubTab ? "active" : ""}" data-fsubtab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div id="finance-panel"></div>
  `;

  content.querySelectorAll("[data-fsubtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      financeSubTab = btn.dataset.fsubtab;
      content.querySelectorAll("[data-fsubtab]").forEach((b) => b.classList.toggle("active", b.dataset.fsubtab === financeSubTab));
      paintFinancePanel(content, profile);
    });
  });

  paintFinancePanel(content, profile);
}

function paintFinancePanel(content, profile) {
  const panel = content.querySelector("#finance-panel");
  if (!panel) return;
  if (financeSubTab === "dashboard") return renderFinanceDashboard(panel, profile);
  if (financeSubTab === "late") return renderLatePaymentsPanel(panel, profile);
  if (financeSubTab === "config") return renderFeeConfigPanel(panel, profile);
}

// ---- Tableau de bord financier ---------------------------------------------

function renderFinanceDashboard(panel, profile) {
  const showSchoolFilter = canViewAllSchools(profile.role);
  const schoolId = showSchoolFilter ? "all" : profile.schoolId;

  panel.innerHTML = `
    ${showSchoolFilter ? `
      <div class="filters-bar" style="margin-top:8px;">
        <select id="fd-school"><option value="all">Toutes les écoles</option>${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>
      </div>` : ""}
    <div class="card-grid" id="fd-cards">
      ${statCard("wallet", "Recettes du jour", "—")}
      ${statCard("wallet", "Recettes du mois", "—")}
      ${statCard("wallet", "Recettes de l'année scolaire", "—")}
      ${statCard("alert-triangle", "Restant à recouvrer", "—")}
    </div>
    <div class="card-grid">
      ${statCard("users", "Élèves à jour", "—")}
      ${statCard("alert-triangle", "Élèves en retard", "—")}
    </div>
  `;

  const select = document.getElementById("fd-school");
  const refresh = (sid) => computeAndPaintFinanceDashboard(panel, sid);
  if (select) select.addEventListener("change", () => refresh(select.value));
  refresh(schoolId);
}

function computeAndPaintFinanceDashboard(panel, schoolId) {
  const effectiveId = schoolId === "all" ? null : schoolId;
  if (financeUnsub) financeUnsub();

  let payments = [], reductions = [], otherFees = [];
  const repaint = () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);
    const valid = payments.filter((p) => !p.voided);
    const sum = (arr) => arr.reduce((s, p) => s + p.amount, 0);

    const todayRevenue = sum(valid.filter((p) => p.date === today));
    const monthRevenue = sum(valid.filter((p) => p.date.startsWith(monthPrefix)));
    const yearRevenue = sum(valid);

    const students = allStudentsCache.filter((s) => !effectiveId || s.schoolId === effectiveId);
    let remaining = 0, upToDate = 0, late = 0;
    students.forEach((s) => {
      const balance = computeStudentBalance(
        s, feeSettingsCache,
        otherFees.filter((f) => f.studentId === s.id),
        reductions.filter((r) => r.studentId === s.id),
        payments.filter((p) => p.studentId === s.id)
      );
      remaining += balance.totalRemaining;
      if (balance.isLate) late += 1; else upToDate += 1;
    });

    setStatValue(panel, 0, formatFCFA(todayRevenue));
    setStatValue(panel, 1, formatFCFA(monthRevenue));
    setStatValue(panel, 2, formatFCFA(yearRevenue));
    setStatValue(panel, 3, formatFCFA(remaining));
    setStatValue(panel, 4, upToDate);
    setStatValue(panel, 5, late);
  };

  const paymentsUnsub = subscribeToSchoolPayments(effectiveId, academicYear.current, (data) => { payments = data; repaint(); });
  const reductionsUnsub = subscribeToSchoolReductions(effectiveId, academicYear.current, (data) => { reductions = data; repaint(); });
  const feesUnsub = subscribeToSchoolStudentFees(effectiveId, academicYear.current, (data) => { otherFees = data; repaint(); });
  financeUnsub = () => { paymentsUnsub(); reductionsUnsub(); feesUnsub(); };
}

function setStatValue(panel, index, value) {
  const cards = panel.querySelectorAll(".stat-value");
  if (cards[index]) cards[index].textContent = value;
}

// ---- Élèves non à jour ------------------------------------------------------

function renderLatePaymentsPanel(panel, profile) {
  const showSchoolFilter = canViewAllSchools(profile.role);
  const schoolId = showSchoolFilter ? "all" : profile.schoolId;

  panel.innerHTML = `
    <div class="filters-bar" style="margin-top:8px;">
      ${showSchoolFilter ? `<select id="lp-school"><option value="all">Toutes les écoles</option>${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>` : ""}
      <select id="lp-class"><option value="all">Toutes les classes</option>${CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
      <button class="btn-secondary btn-sm" id="lp-export">${icon("file-text", 16)} Exporter en CSV</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Matricule</th><th>Nom</th><th>Classe</th><th>Composantes en retard</th><th>Restant dû</th><th></th></tr></thead>
        <tbody id="lp-tbody"><tr><td colspan="6" class="muted">Calcul en cours…</td></tr></tbody>
      </table>
    </div>
  `;

  let lateRows = [];
  const refresh = () => {
    const sid = document.getElementById("lp-school")?.value || schoolId;
    const cls = document.getElementById("lp-class")?.value || "all";
    computeLateStudents(sid === "all" ? null : sid, (rows) => {
      lateRows = cls === "all" ? rows : rows.filter((r) => r.classe === cls);
      paintLateTable(lateRows, profile);
    });
  };

  document.getElementById("lp-school")?.addEventListener("change", refresh);
  document.getElementById("lp-class").addEventListener("change", refresh);
  document.getElementById("lp-export").addEventListener("click", () => {
    exportToCSV(
      "eleves-non-a-jour",
      ["Matricule", "Nom", "Prénom", "Classe", "École", "Composantes en retard", "Restant dû (FCFA)"],
      lateRows.map((r) => [r.matricule, r.lastName, r.firstName, r.classe, r.schoolName, r.lateLabels, r.remaining])
    );
  });

  refresh();
}

function computeLateStudents(schoolId, callback) {
  if (financeUnsub) financeUnsub();
  let payments = [], reductions = [], otherFees = [];
  const repaint = () => {
    const students = allStudentsCache.filter((s) => !schoolId || s.schoolId === schoolId);
    const rows = students
      .map((s) => {
        const balance = computeStudentBalance(
          s, feeSettingsCache,
          otherFees.filter((f) => f.studentId === s.id),
          reductions.filter((r) => r.studentId === s.id),
          payments.filter((p) => p.studentId === s.id)
        );
        if (!balance.isLate) return null;
        const lateLabels = balance.components.filter((c) => c.late).map((c) => c.label).join(", ");
        const schoolName = currentSchools.find((sc) => sc.id === s.schoolId)?.name || "—";
        return { id: s.id, matricule: s.matricule, lastName: s.lastName, firstName: s.firstName, classe: s.currentClass, schoolName, lateLabels, remaining: Math.round(balance.totalRemaining) };
      })
      .filter(Boolean);
    callback(rows);
  };

  const p1 = subscribeToSchoolPayments(schoolId, academicYear.current, (d) => { payments = d; repaint(); });
  const p2 = subscribeToSchoolReductions(schoolId, academicYear.current, (d) => { reductions = d; repaint(); });
  const p3 = subscribeToSchoolStudentFees(schoolId, academicYear.current, (d) => { otherFees = d; repaint(); });
  financeUnsub = () => { p1(); p2(); p3(); };
}

function paintLateTable(rows, profile) {
  const tbody = document.getElementById("lp-tbody");
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Aucun élève en retard de paiement 🎉</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `<tr data-open="${r.id}" class="row-clickable">
      <td>${escapeHtml(r.matricule)}</td>
      <td>${escapeHtml(r.lastName)} ${escapeHtml(r.firstName)}</td>
      <td>${escapeHtml(r.classe)}</td>
      <td><span class="badge" style="background:var(--danger); color:#fff;">${escapeHtml(r.lateLabels)}</span></td>
      <td>${formatFCFA(r.remaining)}</td>
      <td><button class="btn-secondary btn-sm" data-open-btn="${r.id}">Ouvrir</button></td>
    </tr>`
    )
    .join("");
  tbody.querySelectorAll("[data-open-btn]").forEach((btn) =>
    btn.addEventListener("click", () => openStudentDetail(btn.dataset.openBtn, profile))
  );
}

// ---- Paramètres des frais (admin) ------------------------------------------

let feeTypesPanelUnsub = null;
let feeSettingsPanelUnsub = null;

function renderFeeConfigPanel(panel, profile) {
  panel.innerHTML = `
    <div class="panel" style="margin-top:8px;">
      <h3>Frais de scolarité — ${escapeHtml(academicYear.current)}</h3>
      <form id="form-fee-settings" class="form-grid-2" style="margin-top:12px;">
        ${TUITION_COMPONENTS.map(
          (c) => `
          <label>${c.label} — Montant (FCFA)<input type="number" name="${c.key}" min="0" value="${feeSettingsCache[c.key] || 0}" /></label>
          <label>${c.label} — Échéance<input type="date" name="deadline${c.key.charAt(0).toUpperCase()}${c.key.slice(1)}" value="${feeSettingsCache[`deadline${c.key.charAt(0).toUpperCase()}${c.key.slice(1)}`] || ""}" /></label>
        `
        ).join("")}
        <button type="submit" class="btn-primary span-2">Enregistrer</button>
      </form>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>Catalogue des autres frais</h3>
      <form id="form-add-feetype" class="observation-form" style="margin-top:10px;">
        <input type="text" name="name" placeholder="Ex. Cantine" required />
        <input type="number" name="defaultAmount" placeholder="Montant (FCFA)" min="0" required style="width:150px;" />
        <button type="submit" class="btn-secondary btn-sm">Ajouter</button>
      </form>
      <ul class="history-list" id="fee-types-list" style="margin-top:10px;"></ul>
    </div>
  `;

  document.getElementById("form-fee-settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await saveFeeSettings(academicYear.current, data);
  });

  const feeTypesUnsub = subscribeToFeeTypes((types) => {
    feeTypesCache = types;
    const list = document.getElementById("fee-types-list");
    if (!list) return;
    list.innerHTML = types.length
      ? types.map((t) => `<li>${escapeHtml(t.name)} — ${formatFCFA(t.defaultAmount)} <button class="btn-secondary btn-sm" data-del-feetype="${t.id}" style="margin-left:8px;">Supprimer</button></li>`).join("")
      : '<li class="muted">Aucun frais dans le catalogue.</li>';
    list.querySelectorAll("[data-del-feetype]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const t = types.find((x) => x.id === btn.dataset.delFeetype);
        if (confirm(`Supprimer le frais "${t.name}" du catalogue ?`)) await deleteFeeType(t.id, t.name);
      })
    );
  });

  document.getElementById("form-add-feetype").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await addFeeType(data);
    e.target.reset();
  });

  if (feeTypesPanelUnsub) feeTypesPanelUnsub();
  feeTypesPanelUnsub = feeTypesUnsub;

  if (feeSettingsPanelUnsub) feeSettingsPanelUnsub();
  feeSettingsPanelUnsub = subscribeToFeeSettings(academicYear.current, (data) => { feeSettingsCache = data; });
}



function renderStudentDetail(content, profile, studentId) {
  content.innerHTML = `<div class="muted" style="padding:40px 0;">Chargement du dossier…</div>`;
  let activeTab = "info";

  if (studentDetailUnsub) studentDetailUnsub();
  studentDetailUnsub = subscribeToStudent(studentId, async (student) => {
    if (!student) {
      content.innerHTML = `<div class="empty-state"><h2>Élève introuvable</h2></div>`;
      return;
    }
    const history = await getStudentEnrollmentHistory(studentId);
    paintStudentDetail(content, profile, student, history, activeTab, (tab) => { activeTab = tab; });
  });
}

function paintStudentDetail(content, profile, student, history, activeTab, setTab) {
  const canManage = hasPermission(profile.role, PERMISSIONS.MANAGE_STUDENTS);
  const schoolName = currentSchools.find((s) => s.id === student.schoolId)?.name || "—";
  const tabs = [
    { id: "info", label: "Informations personnelles" },
    { id: "parents", label: "Parents" },
    { id: "academic", label: "Académique" },
    { id: "finance", label: "Finances" },
    { id: "documents", label: "Documents" }
  ];

  content.innerHTML = `
    <button class="btn-secondary btn-sm" id="btn-back">&larr; Retour à la liste</button>

    <div class="student-header">
      <div class="student-avatar">${initialsFrom(student.firstName, student.lastName)}</div>
      <div>
        <h1>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</h1>
        <p class="muted">${escapeHtml(student.matricule)} · ${escapeHtml(student.currentClass)} · ${escapeHtml(schoolName)} · ${escapeHtml(student.currentSchoolYear)}</p>
      </div>
      <span class="badge badge-soft" style="margin-left:auto;">${student.enrollmentType === "new" ? "Nouvel inscrit" : "Réinscrit"}</span>
      ${canManage ? `<button class="btn-primary" id="btn-reenroll">${icon("plus", 16)} Réinscrire</button>` : ""}
    </div>

    <div class="tabs">
      ${tabs.map((t) => `<button class="tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}
    </div>

    <div class="tab-panel" id="tab-panel"></div>
  `;

  document.getElementById("btn-back").addEventListener("click", () => {
    activeStudentId = null;
    navigateTo("students", profile);
  });

  if (canManage) {
    document.getElementById("btn-reenroll").addEventListener("click", () => openReEnrollModal(profile, student));
  }

  content.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTab(btn.dataset.tab);
      paintTabPanel(content, student, history, btn.dataset.tab);
    });
  });

  paintTabPanel(content, student, history, activeTab);
}

function paintTabPanel(content, student, history, tab) {
  content.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const panel = content.querySelector("#tab-panel");
  if (!panel) return;

  if (tab === "info") {
    panel.innerHTML = `
      <div class="info-grid">
        ${infoItem("Date de naissance", formatDate(student.birthDate))}
        ${infoItem("Sexe", student.sex === "F" ? "Féminin" : "Masculin")}
        ${infoItem("Nationalité", student.nationality)}
        ${infoItem("Commune", student.commune)}
        ${infoItem("Quartier / village", student.neighborhood)}
        ${infoItem("Adresse", student.address)}
        ${infoItem("Uniforme remis", student.uniformGiven ? "Oui" : "Non")}
        ${infoItem("Date d'inscription", formatDate(student.registrationDate))}
      </div>
      ${student.observations ? `<div class="panel" style="margin-top:16px;"><h3>Observations</h3><p>${escapeHtml(student.observations)}</p></div>` : ""}
      <div class="panel" style="margin-top:16px;">
        <h3>Historique des inscriptions</h3>
        <ul class="history-list">
          ${history.map((h) => `<li>${escapeHtml(h.schoolYear)} — ${escapeHtml(h.class)} <span class="muted">(${h.type === "new" ? "nouvelle inscription" : "réinscription"})</span></li>`).join("") || '<li class="muted">Aucun historique</li>'}
        </ul>
      </div>
    `;
  } else if (tab === "parents") {
    panel.innerHTML = `
      <div class="info-grid">
        ${infoItem("Nom du père", student.father?.name)}
        ${infoItem("Téléphone du père", student.father?.phone)}
        ${infoItem("Profession du père", student.father?.profession)}
        ${infoItem("Nom de la mère", student.mother?.name)}
        ${infoItem("Téléphone de la mère", student.mother?.phone)}
        ${infoItem("Profession de la mère", student.mother?.profession)}
        ${infoItem("Tuteur", student.guardian?.name)}
        ${infoItem("Téléphone du tuteur", student.guardian?.phone)}
      </div>
    `;
  } else if (tab === "academic") {
    panel.innerHTML = `<div class="muted">Chargement…</div>`;
    renderStudentAcademicTab(panel, student);
  } else if (tab === "documents") {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon("alert-triangle", 28)}</div>
        <h2>Photo et pièces jointes</h2>
        <p>Ce contenu sera disponible avec le module Documents / Firebase Storage.</p>
      </div>
    `;
  } else if (tab === "finance") {
    panel.innerHTML = `<div class="muted">Chargement…</div>`;
    renderStudentFinanceTab(panel, student);
  }
}

let tabGradesUnsub = null;
let tabObservationsUnsub = null;
let tabAbsencesUnsub = null;

function renderStudentAcademicTab(panel, student) {
  const canWrite = hasPermission(currentProfile.role, PERMISSIONS.MANAGE_GRADES) || hasPermission(currentProfile.role, PERMISSIONS.CORRECT_ACADEMICS);

  panel.innerHTML = `
    <div class="panel" id="bulletin-section">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h3>Bulletin — ${escapeHtml(academicYear.current)}</h3>
        <select id="bulletin-period">${academicMeta.periods.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
      </div>
      <div id="bulletin-table"><p class="muted">Chargement des notes…</p></div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>Observations</h3>
      ${canWrite ? `
        <form id="form-observation" class="observation-form">
          <input type="text" name="text" placeholder="Ajouter une observation…" required />
          <button type="submit" class="btn-primary btn-sm">Ajouter</button>
        </form>` : ""}
      <ul class="history-list" id="observations-list"><li class="muted">Chargement…</li></ul>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>Présences</h3>
      ${canWrite ? `
        <form id="form-absence" class="absence-form">
          <input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}" />
          <select name="status"><option value="absent">Absent</option><option value="retard">Retard</option></select>
          <input type="text" name="reason" placeholder="Motif (facultatif)" />
          <button type="submit" class="btn-primary btn-sm">Enregistrer</button>
        </form>` : ""}
      <ul class="history-list" id="absences-list"><li class="muted">Chargement…</li></ul>
    </div>
  `;

  let selectedPeriod = academicMeta.periods[0] || "";
  const periodSel = document.getElementById("bulletin-period");
  periodSel.value = selectedPeriod;
  periodSel.addEventListener("change", () => { selectedPeriod = periodSel.value; renderBulletinTable(student, selectedPeriod); });

  if (tabGradesUnsub) tabGradesUnsub();
  tabGradesUnsub = subscribeToStudentGrades(student.id, academicYear.current, (grades) => {
    student._grades = grades;
    renderBulletinTable(student, selectedPeriod);
  });

  if (tabObservationsUnsub) tabObservationsUnsub();
  tabObservationsUnsub = subscribeToObservations(student.id, (obs) => {
    const list = document.getElementById("observations-list");
    if (!list) return;
    list.innerHTML = obs.length
      ? obs.map((o) => `<li>${escapeHtml(o.text)} <span class="muted">— ${escapeHtml(o.authorName || "")}</span></li>`).join("")
      : '<li class="muted">Aucune observation.</li>';
  });

  if (tabAbsencesUnsub) tabAbsencesUnsub();
  tabAbsencesUnsub = subscribeToAbsences(student.id, (list) => {
    const el = document.getElementById("absences-list");
    if (!el) return;
    el.innerHTML = list.length
      ? list.map((a) => `<li>${formatDate(a.date)} — ${a.status === "absent" ? "Absent" : "Retard"} ${a.reason ? `<span class="muted">(${escapeHtml(a.reason)})</span>` : ""}</li>`).join("")
      : '<li class="muted">Aucune absence enregistrée.</li>';
  });

  document.getElementById("form-observation")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.text.trim()) return;
    await addObservation(student.id, student.schoolId, data.text);
    e.target.reset();
  });

  document.getElementById("form-absence")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await addAbsence(student.id, student.schoolId, data);
    e.target.reset();
  });
}

function renderBulletinTable(student, period) {
  const box = document.getElementById("bulletin-table");
  if (!box) return;
  const grades = (student._grades || []).filter((g) => g.period === period);
  const subjectAverages = computeSubjectAverages(grades);
  const overall = computeOverallAverage(subjectAverages);

  box.innerHTML = `
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Matière</th><th>Nombre de notes</th><th>Moyenne / 20</th></tr></thead>
      <tbody>
        ${subjectAverages.map((s) => `<tr><td>${escapeHtml(s.subjectName)}</td><td>${s.count}</td><td>${s.average}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Aucune note pour cette période.</td></tr>`}
      </tbody>
    </table>
    <div class="bulletin-summary">
      <div><span class="muted">Moyenne générale</span><strong>${overall ?? "—"}</strong></div>
      <div><span class="muted">Mention</span><strong>${meritDecision(overall)}</strong></div>
    </div>
    <button class="btn-secondary btn-sm" id="btn-print-bulletin" style="margin-top:10px;">${icon("file-text", 16)} Imprimer le bulletin</button>
  `;

  document.getElementById("btn-print-bulletin")?.addEventListener("click", () => window.print());

// ---- Onglet Finances du dossier élève --------------------------------------

let tabFinanceUnsub = { payments: null, reductions: null, fees: null, feeSettings: null };

function renderStudentFinanceTab(panel, student) {
  const canPay = hasPermission(currentProfile.role, PERMISSIONS.MANAGE_PAYMENTS);
  const canGrantReduction = hasPermission(currentProfile.role, PERMISSIONS.GRANT_REDUCTIONS);
  const canCorrect = hasPermission(currentProfile.role, PERMISSIONS.CORRECT_PAYMENTS);

  panel.innerHTML = `
    <div class="panel" id="balance-section"><p class="muted">Chargement du solde…</p></div>

    <div class="panel" style="margin-top:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h3>Autres frais assignés</h3>
        ${canPay ? `<button class="btn-secondary btn-sm" id="btn-assign-fee">${icon("plus", 16)} Assigner un frais</button>` : ""}
      </div>
      <ul class="history-list" id="other-fees-list" style="margin-top:10px;"></ul>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h3>Réductions</h3>
        ${canGrantReduction ? `<button class="btn-secondary btn-sm" id="btn-add-reduction">${icon("plus", 16)} Accorder une réduction</button>` : ""}
      </div>
      <ul class="history-list" id="reductions-list" style="margin-top:10px;"></ul>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <h3>Historique des paiements</h3>
        ${canPay ? `<button class="btn-primary btn-sm" id="btn-record-payment">${icon("plus", 16)} Enregistrer un paiement</button>` : ""}
      </div>
      <div class="table-wrap" style="margin-top:10px;">
        <table class="data-table">
          <thead><tr><th>Reçu</th><th>Date</th><th>Nature</th><th>Montant</th><th>Mode</th><th>Comptable</th>${canCorrect ? "<th></th>" : ""}</tr></thead>
          <tbody id="payments-list"><tr><td colspan="7" class="muted">Chargement…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  let feeSettings = {}, otherFees = [], reductions = [], payments = [];

  const repaintBalance = () => {
    const balance = computeStudentBalance(student, feeSettings, otherFees, reductions, payments);
    const box = document.getElementById("balance-section");
    if (!box) return;
    box.innerHTML = `
      <h3>Solde financier — ${escapeHtml(academicYear.current)}</h3>
      <table class="data-table" style="margin-top:10px;">
        <thead><tr><th>Composante</th><th>Dû</th><th>Payé</th><th>Restant</th><th>Statut</th></tr></thead>
        <tbody>
          ${balance.all.map((c) => `
            <tr>
              <td>${escapeHtml(c.label)}</td>
              <td>${formatFCFA(c.required)}</td>
              <td>${formatFCFA(c.paid)}</td>
              <td>${formatFCFA(c.remaining)}</td>
              <td>${c.remaining <= 0 ? '<span class="badge badge-soft">À jour</span>' : c.late ? `<span class="badge" style="background:var(--danger); color:#fff;">En retard</span>` : '<span class="muted">En cours</span>'}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="bulletin-summary">
        <div><span class="muted">Total dû</span><strong>${formatFCFA(balance.totalDue)}</strong></div>
        <div><span class="muted">Total payé</span><strong>${formatFCFA(balance.totalPaid)}</strong></div>
        <div><span class="muted">Restant</span><strong>${formatFCFA(balance.totalRemaining)}</strong></div>
      </div>
    `;
    student._balance = balance;
  };

  const repaintOtherFees = () => {
    const list = document.getElementById("other-fees-list");
    if (!list) return;
    list.innerHTML = otherFees.length
      ? otherFees.map((f) => `<li>${escapeHtml(f.feeTypeName)} — ${formatFCFA(f.amount)}</li>`).join("")
      : '<li class="muted">Aucun frais additionnel assigné.</li>';
  };

  const repaintReductions = () => {
    const list = document.getElementById("reductions-list");
    if (!list) return;
    list.innerHTML = reductions.length
      ? reductions.map((r) => `<li>${escapeHtml(r.componentLabel)} — ${r.type === "percent" ? `${r.value}%` : formatFCFA(r.value)} <span class="muted">(${escapeHtml(r.reason || "sans motif")} — accordée par ${escapeHtml(r.authorizedByName || "")})</span></li>`).join("")
      : '<li class="muted">Aucune réduction accordée.</li>';
  };

  const repaintPayments = () => {
    const tbody = document.getElementById("payments-list");
    if (!tbody) return;
    const sorted = [...payments].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    tbody.innerHTML = sorted.length
      ? sorted.map((p) => `
        <tr class="${p.voided ? "row-voided" : ""}">
          <td>${escapeHtml(p.receiptNumber)}</td>
          <td>${formatDate(p.date)}</td>
          <td>${escapeHtml(p.componentLabel)}</td>
          <td>${formatFCFA(p.amount)}</td>
          <td>${escapeHtml(PAYMENT_MODES.find((m) => m.key === p.mode)?.label || p.mode)}</td>
          <td>${escapeHtml(p.comptableName || "")}</td>
          ${canCorrect ? `<td>
            <button class="btn-secondary btn-sm" data-print="${p.id}">Reçu</button>
            ${!p.voided ? `<button class="btn-secondary btn-sm" data-void="${p.id}">Annuler</button>` : '<span class="muted">Annulé</span>'}
          </td>` : `<td><button class="btn-secondary btn-sm" data-print="${p.id}">Reçu</button></td>`}
        </tr>`).join("")
      : `<tr><td colspan="7" class="muted">Aucun paiement enregistré.</td></tr>`;

    tbody.querySelectorAll("[data-print]").forEach((btn) =>
      btn.addEventListener("click", () => printReceipt(student, payments.find((p) => p.id === btn.dataset.print)))
    );
    tbody.querySelectorAll("[data-void]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const reason = prompt("Motif de l'annulation (obligatoire) :");
        if (!reason) return;
        const p = payments.find((x) => x.id === btn.dataset.void);
        await voidPayment(p.id, reason, `${p.receiptNumber} — ${formatFCFA(p.amount)}`);
      })
    );
  };

  if (tabFinanceUnsub.feeSettings) tabFinanceUnsub.feeSettings();
  tabFinanceUnsub.feeSettings = subscribeToFeeSettings(academicYear.current, (d) => { feeSettings = d; repaintBalance(); });
  if (tabFinanceUnsub.fees) tabFinanceUnsub.fees();
  tabFinanceUnsub.fees = subscribeToStudentFees(student.id, academicYear.current, (d) => { otherFees = d; repaintOtherFees(); repaintBalance(); });
  if (tabFinanceUnsub.reductions) tabFinanceUnsub.reductions();
  tabFinanceUnsub.reductions = subscribeToReductions(student.id, academicYear.current, (d) => { reductions = d; repaintReductions(); repaintBalance(); });
  if (tabFinanceUnsub.payments) tabFinanceUnsub.payments();
  tabFinanceUnsub.payments = subscribeToStudentPayments(student.id, academicYear.current, (d) => { payments = d; repaintPayments(); repaintBalance(); });

  if (canPay) {
    document.getElementById("btn-assign-fee").addEventListener("click", () => openAssignFeeModal(student));
    document.getElementById("btn-record-payment").addEventListener("click", () => openRecordPaymentModal(student));
  }
  if (canGrantReduction) {
    document.getElementById("btn-add-reduction").addEventListener("click", () => openAddReductionModal(student));
  }
}

function openAssignFeeModal(student) {
  if (feeTypesCache.length === 0) {
    alert("Aucun frais dans le catalogue. Ajoutez-en un depuis Finances > Paramètres des frais.");
    return;
  }
  return createModal({
    title: "Assigner un frais",
    bodyHtml: `
      <label>Frais
        <select name="feeTypeId" required>${feeTypesCache.map((f) => `<option value="${f.id}">${escapeHtml(f.name)} (${formatFCFA(f.defaultAmount)})</option>`).join("")}</select>
      </label>
    `,
    onSubmit: async (data) => {
      const feeType = feeTypesCache.find((f) => f.id === data.feeTypeId);
      await assignFeeToStudent(student, feeType, academicYear.current);
    }
  });
}

function openAddReductionModal(student) {
  const componentOptions = [
    ...TUITION_COMPONENTS,
    ...(student._balance?.otherComponents || []).map((c) => ({ key: c.key, label: c.label }))
  ];
  return createModal({
    title: "Accorder une réduction",
    bodyHtml: `
      <label>Composante concernée
        <select name="component" required>${componentOptions.map((c) => `<option value="${c.key}" data-label="${escapeHtml(c.label)}">${escapeHtml(c.label)}</option>`).join("")}</select>
      </label>
      <label>Type
        <select name="type" required><option value="fixed">Montant fixe (FCFA)</option><option value="percent">Pourcentage (%)</option></select>
      </label>
      <label>Valeur<input type="number" name="value" min="0" step="0.01" required /></label>
      <label>Motif<input type="text" name="reason" placeholder="Ex. Fratrie, difficulté sociale…" /></label>
    `,
    onSubmit: async (data, formEl) => {
      const select = formEl.querySelector('select[name="component"]');
      const componentLabel = select.options[select.selectedIndex].dataset.label;
      await addReduction(student, { ...data, componentLabel }, academicYear.current);
    }
  });
}

function openRecordPaymentModal(student) {
  const balance = student._balance;
  if (!balance) { alert("Le solde n'est pas encore chargé, réessayez dans un instant."); return; }
  const options = balance.all.filter((c) => c.remaining > 0);
  if (options.length === 0) {
    alert("Cet élève est à jour sur toutes les composantes de frais.");
    return;
  }
  const schoolCode = currentSchools.find((s) => s.id === student.schoolId)?.code || "ELV";

  return createModal({
    title: "Enregistrer un paiement",
    bodyHtml: `
      <label>Composante
        <select name="component" id="pay-component" required>
          ${options.map((c) => `<option value="${c.key}" data-label="${escapeHtml(c.label)}" data-remaining="${c.remaining}">${escapeHtml(c.label)} — restant ${formatFCFA(c.remaining)}</option>`).join("")}
        </select>
      </label>
      <label>Montant (FCFA)<input type="number" name="amount" min="1" required /></label>
      <label>Mode de paiement
        <select name="mode" required>${PAYMENT_MODES.map((m) => `<option value="${m.key}">${m.label}</option>`).join("")}</select>
      </label>
    `,
    onSubmit: async (data, formEl) => {
      const select = formEl.querySelector("#pay-component");
      const opt = select.options[select.selectedIndex];
      const result = await recordPayment({
        student, schoolCode, schoolYear: academicYear.current,
        component: data.component,
        componentLabel: opt.dataset.label,
        amount: data.amount,
        mode: data.mode,
        remainingForComponent: Number(opt.dataset.remaining)
      });
      setTimeout(() => printReceipt(student, { ...result, componentLabel: opt.dataset.label, mode: data.mode, date: new Date().toISOString().slice(0, 10), comptableName: `${currentProfile.firstName || ""} ${currentProfile.lastName || ""}`.trim() }), 300);
    }
  });
}

function printReceipt(student, payment) {
  const schoolName = currentSchools.find((s) => s.id === student.schoolId)?.name || "—";
  const win = window.open("", "_blank", "width=480,height=700");
  win.document.write(`
    <html><head><title>Reçu ${escapeHtml(payment.receiptNumber)}</title>
    <style>
      body{font-family:Arial,sans-serif; padding:24px; color:#101B33;}
      h1{font-size:1.1rem; margin-bottom:0;}
      h2{font-size:0.9rem; font-weight:400; color:#5B6480; margin-top:4px;}
      table{width:100%; border-collapse:collapse; margin-top:20px;}
      td{padding:8px 0; border-bottom:1px solid #E4E6EF; font-size:0.92rem;}
      td:first-child{color:#5B6480;}
      .total{font-size:1.2rem; font-weight:700; margin-top:16px;}
    </style></head>
    <body>
      <h1>${escapeHtml(INSTITUTION_NAME)}</h1>
      <h2>Reçu de paiement — ${escapeHtml(payment.receiptNumber)}</h2>
      <table>
        <tr><td>Date</td><td>${formatDate(payment.date)}</td></tr>
        <tr><td>Élève</td><td>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</td></tr>
        <tr><td>Matricule</td><td>${escapeHtml(student.matricule)}</td></tr>
        <tr><td>Classe</td><td>${escapeHtml(student.currentClass)}</td></tr>
        <tr><td>École</td><td>${escapeHtml(schoolName)}</td></tr>
        <tr><td>Nature</td><td>${escapeHtml(payment.componentLabel)}</td></tr>
        <tr><td>Mode de paiement</td><td>${escapeHtml(PAYMENT_MODES.find((m) => m.key === payment.mode)?.label || payment.mode)}</td></tr>
        <tr><td>Comptable</td><td>${escapeHtml(payment.comptableName || "")}</td></tr>
      </table>
      <div class="total">Montant payé : ${formatFCFA(payment.amount)}</div>
      <script>window.print();</script>
    </body></html>
  `);
  win.document.close();
}

function openReEnrollModal(profile, student) {
  const suggested = nextClass(student.currentClass);
  return createModal({
    title: `Réinscrire ${student.firstName} ${student.lastName}`,
    bodyHtml: `
      <p class="muted">Matricule ${escapeHtml(student.matricule)} — inchangé.</p>
      <label>Nouvelle année scolaire<input type="text" name="schoolYear" required placeholder="Ex. 2027-2028" /></label>
      <label>Nouvelle classe
        <select name="studentClass" required>
          ${CLASSES.map((c) => `<option value="${c}" ${c === suggested ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </label>
    `,
    onSubmit: async (data) => reEnrollStudent(student.id, data)
  });
}

function infoItem(label, value) {
  return `<div class="info-item"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${value ? escapeHtml(value) : '<span class="muted">—</span>'}</div></div>`;
}

// ============================================================= SHARED ====

// ============================================================= UTILISATEURS =

function renderUsers(content, profile) {
  content.innerHTML = `
    <div class="page-header">
      <h1>Utilisateurs</h1>
      <p>Créez et gérez les comptes Directeur, Comptable et Enseignant.</p>
      <button class="btn-primary" id="btn-add-user">${icon("plus", 18)} Créer un compte</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>École</th><th>Statut</th><th></th></tr></thead>
        <tbody id="users-tbody"><tr><td colspan="6" class="muted">Chargement…</td></tr></tbody>
      </table>
    </div>
  `;

  document.getElementById("btn-add-user").addEventListener("click", () => openCreateUserModal());

  if (usersListUnsub) usersListUnsub();
  usersListUnsub = subscribeToUsers((users) => {
    usersCache = users;
    const tbody = document.getElementById("users-tbody");
    if (!tbody) return;
    tbody.innerHTML = users
      .map((u) => `
      <tr>
        <td>${escapeHtml(u.lastName)} ${escapeHtml(u.firstName)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${ROLE_LABELS[u.role] || u.role}</td>
        <td>${escapeHtml(currentSchools.find((s) => s.id === u.schoolId)?.name || "—")}</td>
        <td>${u.status === "disabled" ? '<span class="badge" style="background:var(--danger); color:#fff;">Désactivé</span>' : '<span class="badge badge-soft">Actif</span>'}</td>
        <td>
          ${u.email === "evangelisteanicette@gmail.com" ? '<span class="muted">Compte principal</span>' : `
            <button class="btn-secondary btn-sm" data-edit-user="${u.id}">Modifier</button>
            <button class="btn-secondary btn-sm" data-toggle-user="${u.id}">${u.status === "disabled" ? "Réactiver" : "Désactiver"}</button>
            <button class="btn-secondary btn-sm" data-reset-user="${u.id}">Mot de passe</button>
          `}
        </td>
      </tr>`)
      .join("");

    tbody.querySelectorAll("[data-edit-user]").forEach((btn) =>
      btn.addEventListener("click", () => openEditUserModal(users.find((u) => u.id === btn.dataset.editUser)))
    );
    tbody.querySelectorAll("[data-toggle-user]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const u = users.find((x) => x.id === btn.dataset.toggleUser);
        await setUserStatus(u.id, u.status === "disabled" ? "active" : "disabled", `${u.firstName} ${u.lastName}`);
      })
    );
    tbody.querySelectorAll("[data-reset-user]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const u = users.find((x) => x.id === btn.dataset.resetUser);
        await sendPasswordReset(u.email);
        alert(`E-mail de réinitialisation envoyé à ${u.email}.`);
      })
    );
  });
}

function openCreateUserModal() {
  return createModal({
    title: "Créer un compte utilisateur",
    wide: true,
    bodyHtml: `
      <div class="form-grid-2">
        <label>Nom<input type="text" name="lastName" required /></label>
        <label>Prénom<input type="text" name="firstName" required /></label>
        <label>Sexe<select name="sex"><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
        <label>Téléphone<input type="tel" name="phone" /></label>
        <label>E-mail<input type="email" name="email" required /></label>
        <label>Rôle
          <select name="role" id="new-user-role" required>
            <option value="directeur">Directeur</option>
            <option value="comptable">Comptable</option>
            <option value="enseignant">Enseignant</option>
          </select>
        </label>
        <label>École<select name="schoolId" required>${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select></label>
      </div>
      <p class="muted">Le nouvel utilisateur recevra un e-mail lui permettant de définir lui-même son mot de passe.</p>
    `,
    onSubmit: async (data) => createUserAccount(data)
  });
}

function openEditUserModal(user) {
  return createModal({
    title: `Modifier ${user.firstName} ${user.lastName}`,
    bodyHtml: `
      <div class="form-grid-2">
        <label>Nom<input type="text" name="lastName" required value="${escapeHtml(user.lastName)}" /></label>
        <label>Prénom<input type="text" name="firstName" required value="${escapeHtml(user.firstName)}" /></label>
        <label>Téléphone<input type="tel" name="phone" value="${escapeHtml(user.phone || "")}" /></label>
        <label>Rôle
          <select name="role" required>
            ${["directeur", "comptable", "enseignant"].map((r) => `<option value="${r}" ${user.role === r ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("")}
          </select>
        </label>
        <label class="span-2">École<select name="schoolId" required>${currentSchools.map((s) => `<option value="${s.id}" ${user.schoolId === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
      </div>
    `,
    onSubmit: async (data) => updateUser(user.id, data, `Modification du profil de ${user.firstName} ${user.lastName}`)
  });
}

// ============================================================= JOURNAL ===

function renderActivityLog(content, profile) {
  content.innerHTML = `
    <div class="page-header">
      <h1>Journal des activités</h1>
      <p>Historique complet des actions effectuées dans l'application.</p>
    </div>
    <div class="filters-bar">
      <input type="text" id="log-search" placeholder="Filtrer par utilisateur ou action…" style="padding:9px 12px; border-radius:8px; border:1.5px solid var(--border); background:var(--surface); color:var(--text); min-width:260px;" />
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Utilisateur</th><th>Rôle</th><th>Action</th></tr></thead>
        <tbody id="log-tbody"><tr><td colspan="4" class="muted">Chargement…</td></tr></tbody>
      </table>
    </div>
  `;

  let logs = [];
  const paint = (filterTerm = "") => {
    const tbody = document.getElementById("log-tbody");
    if (!tbody) return;
    const t = filterTerm.toLowerCase();
    const filtered = t ? logs.filter((l) => `${l.userEmail} ${l.description}`.toLowerCase().includes(t)) : logs;
    tbody.innerHTML = filtered.length
      ? filtered.slice(0, 300).map((l) => `
        <tr>
          <td>${l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString("fr-FR") : ""}</td>
          <td>${escapeHtml(l.userEmail || "—")}</td>
          <td>${ROLE_LABELS[l.userRole] || l.userRole || "—"}</td>
          <td>${escapeHtml(l.description)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" class="muted">Aucune activité.</td></tr>`;
  };

  const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), limit(500));
  onSnapshot(q, (snap) => {
    logs = snap.docs.map((d) => d.data());
    paint(document.getElementById("log-search")?.value || "");
  });

  document.getElementById("log-search").addEventListener("input", (e) => paint(e.target.value));
}

// ============================================================= RAPPORTS ==

function renderReports(content, profile) {
  const showSchoolFilter = canViewAllSchools(profile.role);
  content.innerHTML = `
    <div class="page-header">
      <h1>Rapports</h1>
      <p>Générés automatiquement à partir des données en temps réel.</p>
    </div>
    <div class="filters-bar">
      ${showSchoolFilter ? `<select id="rep-school"><option value="all">Toutes les écoles</option>${currentSchools.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>` : ""}
    </div>
    <div id="reports-body"><p class="muted">Chargement…</p></div>
  `;

  const select = document.getElementById("rep-school");
  const refresh = () => paintReports(document.getElementById("reports-body"), profile, select ? select.value : profile.schoolId);
  select?.addEventListener("change", refresh);
  refresh();
}

function paintReports(box, profile, schoolIdFilter) {
  const schoolId = schoolIdFilter === "all" ? null : schoolIdFilter;
  const students = allStudentsCache.filter((s) => !schoolId || s.schoolId === schoolId);
  const byClass = CLASSES.map((c) => {
    const inClass = students.filter((s) => s.currentClass === c);
    return { classe: c, total: inClass.length, boys: inClass.filter((s) => s.sex === "M").length, girls: inClass.filter((s) => s.sex === "F").length };
  });

  box.innerHTML = `
    <div class="panel" id="report-effectifs">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Effectifs par classe</h3>
        <button class="btn-secondary btn-sm" id="export-effectifs">${icon("file-text", 16)} Exporter CSV</button>
      </div>
      <table class="data-table" style="margin-top:10px;">
        <thead><tr><th>Classe</th><th>Effectif</th><th>Garçons</th><th>Filles</th></tr></thead>
        <tbody>${byClass.map((r) => `<tr><td>${r.classe}</td><td>${r.total}</td><td>${r.boys}</td><td>${r.girls}</td></tr>`).join("")}</tbody>
      </table>
      <button class="btn-secondary btn-sm" style="margin-top:10px;" onclick="window.print()">${icon("file-text", 16)} Imprimer</button>
    </div>

    ${hasPermission(profile.role, PERMISSIONS.VIEW_FINANCE) ? `
      <div class="panel" style="margin-top:16px;" id="report-finance"><p class="muted">Chargement du rapport financier…</p></div>
    ` : ""}

    ${hasPermission(profile.role, PERMISSIONS.VIEW_ACADEMICS) ? `
      <div class="panel" style="margin-top:16px;">
        <h3>Évolution des effectifs par classe</h3>
        <canvas id="chart-effectifs" height="90"></canvas>
      </div>
    ` : ""}
  `;

  document.getElementById("export-effectifs").addEventListener("click", () => {
    exportToCSV("effectifs-par-classe", ["Classe", "Effectif", "Garçons", "Filles"], byClass.map((r) => [r.classe, r.total, r.boys, r.girls]));
  });

  if (window.Chart) {
    const ctx = document.getElementById("chart-effectifs");
    if (ctx) {
      new window.Chart(ctx, {
        type: "bar",
        data: {
          labels: byClass.map((r) => r.classe),
          datasets: [
            { label: "Garçons", data: byClass.map((r) => r.boys), backgroundColor: "#101B33" },
            { label: "Filles", data: byClass.map((r) => r.girls), backgroundColor: "#C89B3C" }
          ]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }
  }

  if (hasPermission(profile.role, PERMISSIONS.VIEW_FINANCE)) {
    subscribeToSchoolPayments(schoolId, academicYear.current, (payments) => {
      const valid = payments.filter((p) => !p.voided);
      const byMonth = {};
      valid.forEach((p) => { byMonth[p.date.slice(0, 7)] = (byMonth[p.date.slice(0, 7)] || 0) + p.amount; });
      const months = Object.keys(byMonth).sort();
      const box2 = document.getElementById("report-finance");
      if (!box2) return;
      box2.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3>Recettes par mois — ${escapeHtml(academicYear.current)}</h3>
          <button class="btn-secondary btn-sm" id="export-finance">${icon("file-text", 16)} Exporter CSV</button>
        </div>
        <table class="data-table" style="margin-top:10px;">
          <thead><tr><th>Mois</th><th>Recettes</th></tr></thead>
          <tbody>${months.map((m) => `<tr><td>${m}</td><td>${formatFCFA(byMonth[m])}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">Aucun paiement enregistré.</td></tr>`}</tbody>
        </table>
        <canvas id="chart-finance" height="90" style="margin-top:14px;"></canvas>
      `;
      document.getElementById("export-finance").addEventListener("click", () => {
        exportToCSV("recettes-par-mois", ["Mois", "Recettes (FCFA)"], months.map((m) => [m, Math.round(byMonth[m])]));
      });
      if (window.Chart) {
        const ctx2 = document.getElementById("chart-finance");
        if (ctx2) {
          new window.Chart(ctx2, {
            type: "line",
            data: { labels: months, datasets: [{ label: "Recettes (FCFA)", data: months.map((m) => byMonth[m]), borderColor: "#C89B3C", backgroundColor: "rgba(200,155,60,0.15)", fill: true, tension: 0.3 }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
          });
        }
      }
    });
  }
}

// ============================================================= PARAMÈTRES =

function renderSettings(content, profile) {
  content.innerHTML = `
    <div class="page-header">
      <h1>Paramètres</h1>
      <p>Informations générales et années scolaires. Les matières, types de frais et classes se gèrent directement dans les modules Académique / Finances.</p>
    </div>

    <div class="panel">
      <h3>Établissement</h3>
      <form id="form-institution" class="form-grid-2" style="margin-top:12px;">
        <label class="span-2">Nom de l'établissement<input type="text" name="name" required /></label>
        <label>Téléphone<input type="tel" name="phone" /></label>
        <label>E-mail<input type="email" name="email" /></label>
        <label class="span-2">Adresse<input type="text" name="address" /></label>
        <button type="submit" class="btn-primary span-2">Enregistrer</button>
      </form>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3>Années scolaires</h3>
      <div class="chip-row" id="years-chips" style="margin-top:10px;"></div>
      <form id="form-add-year" class="observation-form" style="margin-top:12px;">
        <input type="text" name="year" placeholder="Ex. 2027-2028" required />
        <button type="submit" class="btn-secondary btn-sm">Ajouter</button>
      </form>
      <div style="margin-top:10px;">
        <label class="muted" style="font-size:0.85rem;">Année active
          <select id="select-current-year" style="display:block; margin-top:4px;"></select>
        </label>
      </div>
    </div>
  `;

  if (institutionUnsub) institutionUnsub();
  institutionUnsub = subscribeToInstitutionSettings((data) => {
    institutionSettings = data;
    const form = document.getElementById("form-institution");
    if (form) {
      form.name.value = data.name || "";
      form.phone.value = data.phone || "";
      form.email.value = data.email || "";
      form.address.value = data.address || "";
    }
  });

  document.getElementById("form-institution").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await saveInstitutionSettings(data);
    alert("Informations enregistrées.");
  });

  const paintYears = () => {
    const chips = document.getElementById("years-chips");
    const sel = document.getElementById("select-current-year");
    if (chips) chips.innerHTML = academicYear.years.map((y) => `<span class="chip">${escapeHtml(y)}${y === academicYear.current ? " ★" : ""}</span>`).join("");
    if (sel) {
      sel.innerHTML = academicYear.years.map((y) => `<option value="${y}" ${y === academicYear.current ? "selected" : ""}>${y}</option>`).join("");
      sel.onchange = async () => { await setCurrentAcademicYear(sel.value); };
    }
  };
  paintYears();
  if (academicYearUnsub) academicYearUnsub();
  academicYearUnsub = subscribeToAcademicYear((data) => { academicYear = data; paintYears(); });

  document.getElementById("form-add-year").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.year.trim()) await addAcademicYear(data.year.trim());
    e.target.reset();
  });
}

function renderComingSoon(content, view) {
  const labels = {
    documents: "Documents"
  };
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon("alert-triangle", 32)}</div>
      <h2>${labels[view] || view}</h2>
      <p>Ce module arrive dans une prochaine phase de construction du projet.</p>
    </div>
  `;
}

function createModal({ title, bodyHtml, onSubmit, wide = false }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${wide ? "modal-wide" : ""}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="icon-btn" id="modal-close">${icon("x")}</button>
      </div>
      <form class="modal-body">
        ${bodyHtml}
        <div id="modal-form-error" class="alert alert-error" hidden></div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="modal-cancel">Annuler</button>
          <button type="submit" class="btn-primary" id="modal-submit">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#modal-close").addEventListener("click", close);
  overlay.querySelector("#modal-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector("#modal-submit");
    const errorBox = overlay.querySelector("#modal-form-error");
    submitBtn.disabled = true;
    submitBtn.textContent = "Enregistrement…";
    try {
      const data = Object.fromEntries(new FormData(e.target));
      await onSubmit(data, e.target);
      close();
    } catch (err) {
      errorBox.textContent = err.message || "Une erreur est survenue.";
      errorBox.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Enregistrer";
    }
  });

  return overlay;
}

function initials(profile) {
  const f = (profile.firstName || "?")[0];
  const l = (profile.lastName || "")[0] || "";
  return (f + l).toUpperCase();
}

function initialsFrom(first, last) {
  return `${(first || "?")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return value;
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function teardownSubscriptions() {
  [
    schoolsUnsub, usersUnsub, studentsUnsub, globalStudentsUnsub, academicYearUnsub, studentDetailUnsub,
    subjectsUnsub, academicMetaUnsub, tabGradesUnsub, tabObservationsUnsub, tabAbsencesUnsub, gradeEntryValidationUnsub,
    financeUnsub, feeTypesPanelUnsub, feeSettingsPanelUnsub, usersListUnsub, institutionUnsub
  ].forEach((unsub) => unsub && unsub());
  Object.keys(tabFinanceUnsub).forEach((k) => { if (tabFinanceUnsub[k]) tabFinanceUnsub[k](); tabFinanceUnsub[k] = null; });
  schoolsUnsub = usersUnsub = studentsUnsub = globalStudentsUnsub = academicYearUnsub = studentDetailUnsub = null;
  subjectsUnsub = academicMetaUnsub = tabGradesUnsub = tabObservationsUnsub = tabAbsencesUnsub = gradeEntryValidationUnsub = null;
  financeUnsub = feeTypesPanelUnsub = feeSettingsPanelUnsub = usersListUnsub = institutionUnsub = null;
}
