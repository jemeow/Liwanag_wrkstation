// ===== TASKS MODULE =====
let tasksRef = null;
let currentFilter = 'all';

function initTasks(userId) {
  tasksRef = db.ref('users/' + userId + '/tasks');

  // Listen for changes
  tasksRef.on('value', (snapshot) => {
    const tasks = snapshot.val() || {};
    renderTasks(tasks);
    renderRecentTasks(tasks);
  });

  // Add task form
  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    addTask();
  });
}

function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  tasksRef.push({
    text: text,
    completed: false,
    createdAt: Date.now()
  });

  input.value = '';
  input.focus();
}

function toggleTask(taskId, completed) {
  tasksRef.child(taskId).update({ completed: !completed });
}

function deleteTask(taskId) {
  tasksRef.child(taskId).remove();
}

function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filter-btn[data-filter="${filter}"]`).classList.add('active');

  // Re-render from current data
  tasksRef.once('value', (snapshot) => {
    renderTasks(snapshot.val() || {});
  });
}

function renderRecentTasks(tasks) {
  const list = document.getElementById('recent-task-list');
  if (!list) return;
  list.innerHTML = '';
  
  // Get active (not completed) tasks, sort by newest
  const activeTasks = Object.entries(tasks)
    .filter(([, t]) => !t.completed)
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, 4); // Take top 4
    
  if (activeTasks.length === 0) {
    list.innerHTML = '<p style="color: var(--gray-500); padding: 8px;">No active tasks. You\'re all caught up!</p>';
    return;
  }
  
  activeTasks.forEach(([id, task]) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
      <div class="task-checkbox" onclick="toggleTask('${id}', false)"></div>
      <span class="task-text">${escapeHtml(task.text)}</span>
    `;
    list.appendChild(li);
  });
}

function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  const entries = Object.entries(tasks).sort((a, b) => b[1].createdAt - a[1].createdAt);
  let visibleCount = 0;
  let totalCount = entries.length;
  let completedCount = entries.filter(([, t]) => t.completed).length;

  entries.forEach(([id, task]) => {
    if (currentFilter === 'active' && task.completed) return;
    if (currentFilter === 'completed' && !task.completed) return;
    visibleCount++;

    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.innerHTML = `
      <div class="task-checkbox" onclick="toggleTask('${id}', ${task.completed})">
        ${task.completed ? '<i class="fas fa-check" style="font-size:12px"></i>' : ''}
      </div>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="task-delete" onclick="deleteTask('${id}')"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(li);
  });

  document.getElementById('task-count-display').textContent = `${totalCount} task${totalCount !== 1 ? 's' : ''} · ${completedCount} done`;
  document.getElementById('stat-tasks').textContent = totalCount - completedCount;
}

function cleanupTasks() {
  if (tasksRef) tasksRef.off();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
