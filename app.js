/* =====================================================
   Liwanag – Student Workstation  |  app.js
   ===================================================== */
'use strict';

// ── Utilities ─────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Clock ─────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  $('clock').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('today-date').textContent = now.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ── Navigation ────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + btn.dataset.panel).classList.add('active');
  });
});

// ═══════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════
let tasks  = load('lw_tasks', []);
let taskFilter = 'all';

function saveTasks() { save('lw_tasks', tasks); }

function renderTasks() {
  const list  = $('task-list');
  const empty = $('task-empty');
  list.innerHTML = '';

  const visible = tasks.filter(t => {
    if (taskFilter === 'pending') return !t.done;
    if (taskFilter === 'done')    return  t.done;
    return true;
  });

  empty.style.display = visible.length === 0 ? 'block' : 'none';

  visible.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    const dueTxt = task.due
      ? `<span class="badge badge-due">Due ${task.due}</span>` : '';
    const subjTxt = task.subject
      ? `<span class="badge badge-subject">${task.subject}</span>` : '';
    const priBadge = task.priority !== 'normal'
      ? `<span class="badge badge-${task.priority}">${task.priority.toUpperCase()}</span>` : '';

    li.innerHTML = `
      <input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} title="Mark done" />
      <div class="task-info">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">${subjTxt}${dueTxt}${priBadge}</div>
      </div>
      <button class="task-del" title="Delete task">✕</button>`;

    li.querySelector('.task-check').addEventListener('change', () => toggleTask(task.id));
    li.querySelector('.task-del').addEventListener('click', () => deleteTask(task.id));
    list.appendChild(li);
  });
}

function addTask(text, subject, due, priority) {
  tasks.unshift({ id: Date.now(), text, subject, due, priority, done: false });
  saveTasks();
  renderTasks();
}
function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; saveTasks(); renderTasks(); }
}
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(); renderTasks();
}

$('task-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('task-input').value.trim();
  if (!text) return;
  addTask(text, $('task-subject').value, $('task-due').value, $('task-priority').value);
  $('task-input').value = '';
  $('task-due').value   = '';
  $('task-subject').value = '';
  $('task-priority').value = 'normal';
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    taskFilter = btn.dataset.filter;
    renderTasks();
  });
});

renderTasks();

// ═══════════════════════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════════════════════
let notes        = load('lw_notes', []);
let activeNoteId = null;

function saveNotes() { save('lw_notes', notes); }

function renderNoteList() {
  const list  = $('note-list');
  const empty = $('note-empty');
  list.innerHTML = '';

  if (notes.length === 0) {
    empty.style.display = 'block';
    clearEditor();
    return;
  }
  empty.style.display = 'none';

  notes.forEach(n => {
    const li = document.createElement('li');
    li.className = 'note-item' + (n.id === activeNoteId ? ' active' : '');
    li.textContent = n.title || 'Untitled';
    li.dataset.id  = n.id;
    li.addEventListener('click', () => openNote(n.id));
    list.appendChild(li);
  });
}

function openNote(id) {
  activeNoteId = id;
  const n = notes.find(n => n.id === id);
  if (!n) return;
  $('note-title').value = n.title;
  $('note-body').value  = n.body;
  $('delete-note-btn').style.display = '';
  renderNoteList();
}

function clearEditor() {
  activeNoteId = null;
  $('note-title').value = '';
  $('note-body').value  = '';
  $('delete-note-btn').style.display = 'none';
}

$('new-note-btn').addEventListener('click', () => {
  const newNote = { id: Date.now(), title: '', body: '' };
  notes.unshift(newNote);
  saveNotes();
  openNote(newNote.id);
});

$('save-note-btn').addEventListener('click', () => {
  if (activeNoteId === null) return;
  const n = notes.find(n => n.id === activeNoteId);
  if (!n) return;
  n.title = $('note-title').value.trim() || 'Untitled';
  n.body  = $('note-body').value;
  saveNotes();
  renderNoteList();
});

$('delete-note-btn').addEventListener('click', () => {
  if (activeNoteId === null) return;
  if (!confirm('Delete this note?')) return;
  notes = notes.filter(n => n.id !== activeNoteId);
  saveNotes();
  clearEditor();
  renderNoteList();
});

renderNoteList();
if (notes.length > 0) openNote(notes[0].id);

// ═══════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════
const MODES = { pomodoro: 25, short: 5, long: 15 };
let timerMode     = 'pomodoro';
let totalSeconds  = MODES.pomodoro * 60;
let remaining     = totalSeconds;
let timerRunning  = false;
let timerInterval = null;

// sessions stored per calendar day
const todayKey    = () => 'lw_sessions_' + new Date().toISOString().slice(0, 10);
let sessionCount  = load(todayKey(), 0);
$('session-count').textContent = sessionCount;

function displayTime(secs) {
  $('timer-mm').textContent = pad(Math.floor(secs / 60));
  $('timer-ss').textContent = pad(secs % 60);
}

function setTimerMode(mode) {
  timerMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.mode-tab[data-mode="${mode}"]`).classList.add('active');

  $('custom-time-row').style.display = mode === 'custom' ? '' : 'none';
  const mins = mode === 'custom'
    ? parseInt($('custom-minutes').value) || 25
    : MODES[mode];
  totalSeconds = mins * 60;
  remaining    = totalSeconds;
  displayTime(remaining);
  stopTimer();
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  $('timer-start').disabled = true;
  $('timer-pause').disabled = false;

  timerInterval = setInterval(() => {
    remaining--;
    displayTime(remaining);
    if (remaining <= 0) {
      stopTimer();
      sessionCount++;
      save(todayKey(), sessionCount);
      $('session-count').textContent = sessionCount;
      alert('⏰ Time\'s up! Great work!');
      remaining = totalSeconds;
      displayTime(remaining);
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  $('timer-start').disabled = false;
  $('timer-pause').disabled = true;
}

function stopTimer() {
  pauseTimer();
}

function resetTimer() {
  stopTimer();
  remaining = totalSeconds;
  displayTime(remaining);
}

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => setTimerMode(tab.dataset.mode));
});
$('custom-minutes').addEventListener('change', () => {
  if (timerMode === 'custom') setTimerMode('custom');
});
$('timer-start').addEventListener('click', startTimer);
$('timer-pause').addEventListener('click', pauseTimer);
$('timer-reset').addEventListener('click', resetTimer);
displayTime(remaining);

// ═══════════════════════════════════════════════════════
//  SCHEDULE
// ═══════════════════════════════════════════════════════
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday'
};
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 – 20:00

let schedule = load('lw_schedule', []);

function saveSchedule() { save('lw_schedule', schedule); }

function buildScheduleGrid() {
  const grid = $('schedule-grid');
  grid.innerHTML = '';

  // Header row
  const corner = document.createElement('div');
  corner.className = 'sched-header-cell';
  corner.textContent = 'Time';
  grid.appendChild(corner);
  DAYS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'sched-header-cell';
    h.textContent = DAY_LABELS[d];
    grid.appendChild(h);
  });

  // Time rows
  HOURS.forEach(h => {
    const timeCell = document.createElement('div');
    timeCell.className = 'sched-time-cell';
    timeCell.textContent = `${pad(h)}:00`;
    grid.appendChild(timeCell);

    DAYS.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'sched-cell';
      cell.dataset.day  = day;
      cell.dataset.hour = h;

      // find classes in this slot
      schedule.filter(c => c.day === day && slotOverlaps(c, h)).forEach(cls => {
        const block = document.createElement('div');
        block.className = 'class-block';
        block.innerHTML = `
          <strong>${escapeHtml(cls.subject)}</strong><br/>
          ${cls.start}–${cls.end}
          ${cls.room ? `<br/><em>${escapeHtml(cls.room)}</em>` : ''}
          <button class="del-class" data-id="${cls.id}" title="Remove">✕</button>`;
        block.querySelector('.del-class').addEventListener('click', e => {
          e.stopPropagation();
          deleteClass(cls.id);
        });
        cell.appendChild(block);
      });

      grid.appendChild(cell);
    });
  });
}

function slotOverlaps(cls, hour) {
  const [sh, sm] = cls.start.split(':').map(Number);
  const [eh, em] = cls.end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  const slotStart = hour * 60;
  const slotEnd   = slotStart + 60;
  return startMins < slotEnd && endMins > slotStart;
}

function deleteClass(id) {
  schedule = schedule.filter(c => c.id !== id);
  saveSchedule();
  buildScheduleGrid();
}

$('add-sched-btn').addEventListener('click', () => {
  $('sched-modal').style.display = 'flex';
});
$('sched-cancel-btn').addEventListener('click', () => {
  $('sched-modal').style.display = 'none';
});
$('sched-modal').addEventListener('click', e => {
  if (e.target === $('sched-modal')) $('sched-modal').style.display = 'none';
});

$('sched-save-btn').addEventListener('click', () => {
  const subject = $('sched-subject').value.trim();
  const day     = $('sched-day').value;
  const start   = $('sched-start').value;
  const end     = $('sched-end').value;
  const room    = $('sched-room').value.trim();

  if (!subject || !start || !end) {
    alert('Please fill in subject, start time, and end time.');
    return;
  }
  if (start >= end) {
    alert('End time must be after start time.');
    return;
  }

  schedule.push({ id: Date.now(), subject, day, start, end, room });
  saveSchedule();
  buildScheduleGrid();
  $('sched-modal').style.display = 'none';

  // clear modal fields
  ['sched-subject', 'sched-start', 'sched-end', 'sched-room'].forEach(id => $(id).value = '');
});

buildScheduleGrid();

// ── HTML escape helper ────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
