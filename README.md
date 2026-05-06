# ☀️ Liwanag — Student Workstation

A lightweight, browser-based workstation designed to help students stay organized and focused.  
No installation required — just open `index.html` in any modern browser.

---

## Features

| Panel | What it does |
|-------|-------------|
| **📋 Tasks** | Add, prioritise, and track assignments. Tag by subject, set a due date, and filter by status (All / Pending / Done). |
| **📝 Notes** | Create and save multiple notes that persist across page refreshes (stored in `localStorage`). |
| **⏱ Timer** | Pomodoro (25 min), short break (5 min), long break (15 min), or a custom countdown. Tracks how many sessions you complete each day. |
| **📅 Schedule** | Build a weekly class timetable. Add class blocks with subject, time range, day, and room/teacher info. |

---

## Getting Started

1. Clone or download this repository.
2. Open `index.html` in your browser — **no build step needed**.
3. All data is saved automatically in your browser's `localStorage`.

---

## File Structure

```
index.html   — Main HTML layout
style.css    — Styles and responsive design
app.js       — All interactive logic (tasks, notes, timer, schedule)
```

---

## Tech Stack

- Vanilla HTML, CSS, and JavaScript (ES6+)
- `localStorage` for client-side persistence
- No frameworks, no dependencies, no build tools
