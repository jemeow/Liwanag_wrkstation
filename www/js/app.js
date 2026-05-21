// Floating Timer State
let isFloatingTimerDismissed =
  localStorage.getItem("liwanag_floating_timer_dismissed") === "true";

function dismissFloatingTimer() {
  isFloatingTimerDismissed = true;
  localStorage.setItem("liwanag_floating_timer_dismissed", "true");

  const floatingTimer = document.getElementById("floating-timer");
  if (floatingTimer) floatingTimer.classList.add("hidden");

  // Show restore buttons if we are not on the pomodoro panel
  const activePanel = document.querySelector(".panel.active");
  const isPomodoroActive = activePanel && activePanel.id === "panel-pomodoro";
  if (!isPomodoroActive) {
    const restoreBtn = document.getElementById("restore-floating-btn");
    const mobRestoreBtn = document.getElementById(
      "mobile-restore-floating-btn",
    );
    if (restoreBtn) restoreBtn.classList.remove("hidden");
    if (mobRestoreBtn) mobRestoreBtn.classList.remove("hidden");
  }
}

function restoreFloatingTimer() {
  isFloatingTimerDismissed = false;
  localStorage.setItem("liwanag_floating_timer_dismissed", "false");

  const restoreBtn = document.getElementById("restore-floating-btn");
  const mobRestoreBtn = document.getElementById("mobile-restore-floating-btn");
  if (restoreBtn) restoreBtn.classList.add("hidden");
  if (mobRestoreBtn) mobRestoreBtn.classList.add("hidden");

  // Show floating timer if we are not on the pomodoro panel
  const activePanel = document.querySelector(".panel.active");
  const isPomodoroActive = activePanel && activePanel.id === "panel-pomodoro";
  if (!isPomodoroActive) {
    const floatingTimer = document.getElementById("floating-timer");
    if (floatingTimer) floatingTimer.classList.remove("hidden");
  }
}

// Navigation
function switchPanel(panelName) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  const panel = document.getElementById("panel-" + panelName);
  const nav = document.getElementById("nav-" + panelName);
  if (panel) panel.classList.add("active");
  if (nav) nav.classList.add("active");

  // Quit active flashcard test and reset flashcard/quiz states if switching away
  if (panelName !== "flashcards") {
    if (typeof quitFlashcardTest === "function") quitFlashcardTest();
    if (typeof showFlashcardDecks === "function") showFlashcardDecks();
  }
  if (panelName !== "quizzes") {
    if (typeof showQuizSubjects === "function") showQuizSubjects();
  }

  // Floating timer logic
  const floatingTimer = document.getElementById("floating-timer");
  const restoreBtn = document.getElementById("restore-floating-btn");
  const mobRestoreBtn = document.getElementById("mobile-restore-floating-btn");

  if (panelName === "pomodoro") {
    if (floatingTimer) floatingTimer.classList.add("hidden");
    if (restoreBtn) restoreBtn.classList.add("hidden");
    if (mobRestoreBtn) mobRestoreBtn.classList.add("hidden");
  } else {
    if (isFloatingTimerDismissed) {
      if (floatingTimer) floatingTimer.classList.add("hidden");
      if (restoreBtn) restoreBtn.classList.remove("hidden");
      if (mobRestoreBtn) mobRestoreBtn.classList.remove("hidden");
    } else {
      if (floatingTimer) floatingTimer.classList.remove("hidden");
      if (restoreBtn) restoreBtn.classList.add("hidden");
      if (mobRestoreBtn) mobRestoreBtn.classList.add("hidden");
    }
  }

  // Close mobile sidebar
  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// Date display
function updateWelcomeDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  document.getElementById("welcome-date").textContent = now.toLocaleDateString(
    "en-US",
    options,
  );
}

// Hide loading overlay
function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  overlay.classList.add("fade-out");
  setTimeout(() => (overlay.style.display = "none"), 400);
}

// ===== DASHBOARD INITIALIZATION =====
// We extract this so it can be called manually after MFA is completed
window.initializeDashboard = function (user) {
  currentUser = user;

  // Show dashboard, hide auth
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  // Set user info
  const emailDisplay = document.getElementById("user-email-display");
  if (emailDisplay) emailDisplay.textContent = user.displayName || user.email;

  // Update welcome
  updateWelcomeDate();

  // Initialize modules
  initPomodoro();
  initTasks(user.uid);
  initNotes(user.uid);
  initFlashcards(user.uid);
  initQuizzes(user.uid);
  initCalendar(user.uid);
};

// ===== AUTH STATE LISTENER =====
auth.onAuthStateChanged((user) => {
  if (user) {
    // ── MFA Guard ──────────────────────────────────────────────────────
    // Firebase auth listener fires the moment the password is correct,
    // but before the OTP is generated. We must STRICTLY block the dashboard
    // until the user actually passes the MFA check.
    if (
      typeof SecureAuth !== "undefined" &&
      !SecureAuth.SessionManager.isMFAVerified()
    ) {
      console.log(
        "[App] Firebase user active but MFA not verified yet — holding dashboard.",
      );
      hideLoading();
      return; // Stay on auth screen
    }

    // User is fully authenticated AND MFA verified (or SecureAuth disabled)
    initializeDashboard(user);
  } else {
    currentUser = null;

    // Show auth, hide dashboard
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");

    // Clear auth forms so passwords don't stay typed in
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.reset();

    const signupForm = document.getElementById("signup-form");
    if (signupForm) signupForm.reset();

    // Cleanup modules
    cleanupTasks();
    cleanupNotes();
    cleanupFlashcards();
    cleanupQuizzes();
    cleanupCalendar();
    resetTimer();
  }

  hideLoading();
});

// Close sidebar & notification dropdowns when clicking outside
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");
  if (
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    e.target !== menuToggle &&
    !menuToggle.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }

  const notiDropdown = document.getElementById("noti-dropdown");
  const mobNotiDropdown = document.getElementById("mobile-noti-dropdown");

  if (
    notiDropdown &&
    !notiDropdown.classList.contains("hidden") &&
    !e.target.closest(".notification-wrapper")
  ) {
    notiDropdown.classList.add("hidden");
  }
  if (
    mobNotiDropdown &&
    !mobNotiDropdown.classList.contains("hidden") &&
    !e.target.closest(".notification-wrapper")
  ) {
    mobNotiDropdown.classList.add("hidden");
  }
});

// ===== THEME =====
function initTheme() {
  const savedTheme = localStorage.getItem("liwanag_theme") || "light";
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    const checkbox = document.getElementById("checkbox");
    const mobileCheckbox = document.getElementById("mobile-checkbox");
    if (checkbox) checkbox.checked = true;
    if (mobileCheckbox) mobileCheckbox.checked = true;
  }
}

function toggleTheme(isDark) {
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("liwanag_theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("liwanag_theme", "light");
  }

  // Sync checkboxes
  const checkbox = document.getElementById("checkbox");
  const mobileCheckbox = document.getElementById("mobile-checkbox");
  if (checkbox) checkbox.checked = isDark;
  if (mobileCheckbox) mobileCheckbox.checked = isDark;
}

initTheme();
