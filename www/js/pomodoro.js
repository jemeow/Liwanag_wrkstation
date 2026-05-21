// ===== POMODORO MODULE =====
const TIMER_MODES = { focus: 25, short: 5, long: 15 };
let timerInterval = null;
let timerSeconds = TIMER_MODES.focus * 60;
let timerTotalSeconds = timerSeconds;
let timerRunning = false;
let currentMode = "focus";
let sessionCount = 0;

const CIRCUMFERENCE = 2 * Math.PI * 90; // r=90

function setTimerMode(mode) {
  currentMode = mode;
  resetTimer();

  document
    .querySelectorAll(".timer-mode")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("mode-" + mode).classList.add("active");

  const progress = document.getElementById("timer-ring-progress");
  if (mode === "focus") {
    progress.style.stroke = "var(--sky-500)";
  } else if (mode === "short") {
    progress.style.stroke = "var(--success)";
  } else {
    progress.style.stroke = "var(--gold-500)";
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  const displayTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  document.getElementById("timer-minutes").textContent = String(mins).padStart(
    2,
    "0",
  );
  document.getElementById("timer-seconds").textContent = String(secs).padStart(
    2,
    "0",
  );

  const floatingDisplay = document.getElementById("floating-time-display");
  if (floatingDisplay) floatingDisplay.textContent = displayTime;

  // Update ring
  const progress = (timerTotalSeconds - timerSeconds) / timerTotalSeconds;
  const offset = CIRCUMFERENCE * (1 - progress);
  document.getElementById("timer-ring-progress").style.strokeDashoffset =
    offset;
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;

  document.getElementById("timer-start").classList.add("hidden");
  document.getElementById("timer-pause").classList.remove("hidden");

  const floatingIcon = document.getElementById("floating-timer-icon");
  if (floatingIcon) {
    floatingIcon.classList.remove("fa-play");
    floatingIcon.classList.add("fa-pause");
  }

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerCompleted();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById("timer-start").classList.remove("hidden");
  document.getElementById("timer-pause").classList.add("hidden");

  const floatingIcon = document.getElementById("floating-timer-icon");
  if (floatingIcon) {
    floatingIcon.classList.remove("fa-pause");
    floatingIcon.classList.add("fa-play");
  }
}

function toggleTimerState() {
  if (timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = TIMER_MODES[currentMode] * 60;
  timerTotalSeconds = timerSeconds;
  updateTimerDisplay();
  document.getElementById("timer-start").classList.remove("hidden");
  document.getElementById("timer-pause").classList.add("hidden");
  document.getElementById("timer-ring-progress").style.strokeDashoffset = 0;

  const floatingIcon = document.getElementById("floating-timer-icon");
  if (floatingIcon) {
    floatingIcon.classList.remove("fa-pause");
    floatingIcon.classList.add("fa-play");
  }
}

function timerCompleted() {
  if (currentMode === "focus") {
    sessionCount++;
    document.getElementById("session-count").textContent = sessionCount;
    document.getElementById("stat-sessions").textContent = sessionCount;
  }

  // Play notification sound
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.stop(ctx.currentTime + 1);
  } catch (e) {}

  document.getElementById("timer-start").classList.remove("hidden");
  document.getElementById("timer-pause").classList.add("hidden");

  // Auto-suggest next mode
  if (currentMode === "focus") {
    if (sessionCount % 4 === 0) {
      setTimerMode("long");
    } else {
      setTimerMode("short");
    }
  } else {
    setTimerMode("focus");
  }
}

function initPomodoro() {
  document.getElementById("timer-ring-progress").style.strokeDasharray =
    CIRCUMFERENCE;
  document.getElementById("timer-ring-progress").style.strokeDashoffset = 0;
  updateTimerDisplay();
}
