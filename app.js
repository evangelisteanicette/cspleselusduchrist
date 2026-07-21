import { initTheme } from "./theme.js";
import { login, resetPassword, onAuthReady, getResolvingAuthError, logout } from "./auth.js";
import { renderAppShell, teardownSubscriptions } from "./ui.js";
import { seedDefaultSchoolsIfEmpty } from "./schools.js";
import { ROLES } from "./roles.js";
import { isFirebaseConfigured } from "./firebase-init.js";
import { APP_NAME, INSTITUTION_NAME } from "./firebase-config.js";

initTheme();

const viewLogin = document.getElementById("view-login");
const viewApp = document.getElementById("view-app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-submit");
const forgotLink = document.getElementById("forgot-password");

document.getElementById("login-app-name").textContent = APP_NAME;
document.getElementById("login-institution").textContent = INSTITUTION_NAME;

if (!isFirebaseConfigured()) {
  loginError.textContent =
    "Firebase n'est pas encore configuré. Ouvrez js/firebase-config.js et collez votre configuration (voir README.md).";
  loginError.hidden = false;
  loginBtn.disabled = true;
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = "Connexion…";

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const result = await login(email, password);

  if (!result.success) {
    loginError.textContent = result.error;
    loginError.hidden = false;
  }
  loginBtn.disabled = false;
  loginBtn.textContent = "Se connecter";
});

forgotLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  if (!email) {
    loginError.textContent = "Saisissez d'abord votre adresse e-mail, puis cliquez sur ce lien.";
    loginError.hidden = false;
    return;
  }
  const result = await resetPassword(email);
  loginError.textContent = result.success
    ? "E-mail de réinitialisation envoyé. Vérifiez votre boîte de réception."
    : result.error;
  loginError.hidden = false;
});

// ---- Routage selon l'état de connexion ----------------------------------
onAuthReady(async (profile) => {
  if (!profile) {
    const err = getResolvingAuthError();
    teardownSubscriptions();
    stopInactivityWatch();
    viewApp.hidden = true;
    viewLogin.hidden = false;
    if (err) {
      loginError.textContent = err;
      loginError.hidden = false;
    }
    return;
  }

  if (profile.error) {
    // Compte non autorisé — déjà déconnecté par auth.js
    viewApp.hidden = true;
    viewLogin.hidden = false;
    loginError.textContent = profile.error;
    loginError.hidden = false;
    return;
  }

  viewLogin.hidden = true;
  viewApp.hidden = false;
  renderAppShell(profile);
  startInactivityWatch();

  // Seed des écoles de départ, uniquement fait une fois par l'Administrateur Général.
  if (profile.role === ROLES.ADMIN_GENERAL) {
    seedDefaultSchoolsIfEmpty().catch((err) => console.warn("Amorçage des écoles :", err));
  }
});

// ---- Déconnexion automatique après inactivité (§15) ----------------------
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    logout();
  }, INACTIVITY_LIMIT_MS);
}

function startInactivityWatch() {
  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evt) =>
    document.addEventListener(evt, resetInactivityTimer)
  );
  resetInactivityTimer();
}

function stopInactivityWatch() {
  clearTimeout(inactivityTimer);
  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evt) =>
    document.removeEventListener(evt, resetInactivityTimer)
  );
}

// ---- Service worker (PWA installable, §8 / §92) ---------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker : échec de l'enregistrement", err);
    });
  });
}
