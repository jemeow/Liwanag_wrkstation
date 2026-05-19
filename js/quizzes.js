// ===== QUIZZES MODULE =====
let subjectsRef = null;
let quizUserId = null;
let subjectsData = {};
let activeQuizSubjectId = null;
let activeSubjectQuizzes = {};

// View State
let currentQuizView = 'subjects'; // subjects, dashboard, creator, taker
let editingQuizId = null;
let builderQuestions = [];

// Taker State
let activeQuizId = null;
let activeQuizData = null;
let userAnswers = {};

function initQuizzes(userId) {
  quizUserId = userId;
  subjectsRef = db.ref('users/' + userId + '/quizzes/subjects');

  subjectsRef.on('value', (snapshot) => {
    subjectsData = snapshot.val() || {};
    renderQuizSubjectsGrid(subjectsData);
    
    // If currently inside a subject, refresh active quizzes list
    if (activeQuizSubjectId && subjectsData[activeQuizSubjectId]) {
      activeSubjectQuizzes = subjectsData[activeQuizSubjectId].quizzes || {};
      renderQuizDashboard();
    }
  });
}

function cleanupQuizzes() {
  if (subjectsRef) subjectsRef.off();
  quizUserId = null;
  subjectsData = {};
  activeQuizSubjectId = null;
  activeSubjectQuizzes = {};
}

// ----- VIEWS -----
function showQuizView(viewId) {
  document.getElementById('quiz-subjects-view').classList.add('hidden');
  document.getElementById('quiz-dashboard-view').classList.add('hidden');
  document.getElementById('quiz-creator-view').classList.add('hidden');
  document.getElementById('quiz-taker-view').classList.add('hidden');
  document.getElementById(viewId).classList.remove('hidden');
}

function showQuizSubjects() {
  currentQuizView = 'subjects';
  activeQuizSubjectId = null;
  activeSubjectQuizzes = {};
  showQuizView('quiz-subjects-view');
}

function showQuizDashboard() {
  currentQuizView = 'dashboard';
  showQuizView('quiz-dashboard-view');
  renderQuizDashboard();
}

function showQuizCreator(quizId = null) {
  currentQuizView = 'creator';
  editingQuizId = quizId;
  builderQuestions = [];
  
  const titleInput = document.getElementById('quiz-title-input');
  
  if (quizId && activeSubjectQuizzes[quizId]) {
    titleInput.value = activeSubjectQuizzes[quizId].title;
    // Deep copy questions
    builderQuestions = JSON.parse(JSON.stringify(activeSubjectQuizzes[quizId].questions || []));
  } else {
    titleInput.value = '';
    addQuizQuestion('multiple-choice'); // default first question
  }
  
  renderQuizBuilder();
  showQuizView('quiz-creator-view');
}

function startTakingQuiz(quizId) {
  if (!activeSubjectQuizzes[quizId]) return;
  currentQuizView = 'taker';
  activeQuizId = quizId;
  activeQuizData = activeSubjectQuizzes[quizId];
  userAnswers = {};
  
  document.getElementById('taker-quiz-title').textContent = activeQuizData.title;
  document.getElementById('quiz-results-container').classList.add('hidden');
  document.getElementById('btn-submit-quiz').classList.remove('hidden');
  document.getElementById('btn-retake-quiz').classList.add('hidden');
  
  renderQuizTaker();
  showQuizView('quiz-taker-view');
}

// ----- SUBJECT FOLDERS -----

function createQuizSubject() {
  const input = document.getElementById('quiz-subject-input');
  const name = input.value.trim();
  if (!name) return;

  subjectsRef.push({
    name: name,
    createdAt: Date.now()
  });

  input.value = '';
}

function deleteQuizSubject(subjectId, event) {
  if (event) event.stopPropagation();
  if (confirm("Are you sure you want to delete this folder and all its quizzes?")) {
    subjectsRef.child(subjectId).remove();
    if (activeQuizSubjectId === subjectId) {
      showQuizSubjects();
    }
  }
}

function renderQuizSubjectsGrid(subjects) {
  const grid = document.getElementById('quiz-subjects-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const entries = Object.entries(subjects).sort((a, b) => b[1].createdAt - a[1].createdAt);

  if (entries.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);">
        <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 12px;"></i>
        <p>No quiz folders yet. Create one above to get started!</p>
      </div>
    `;
    return;
  }

  entries.forEach(([id, subject]) => {
    const quizCount = Object.keys(subject.quizzes || {}).length;
    const folderCard = document.createElement('div');
    folderCard.className = 'glass-card quick-action-card';
    folderCard.style.padding = '20px';
    folderCard.style.position = 'relative';
    folderCard.onclick = () => openQuizSubject(id);
    
    folderCard.innerHTML = `
      <button class="flashcard-delete" onclick="deleteQuizSubject('${id}', event)"><i class="fas fa-trash-alt"></i></button>
      <div class="quick-action-icon" style="background: linear-gradient(135deg, var(--gold-400), var(--gold-500)); width: 48px; height: 48px; border-radius: 12px;">
        <i class="fas fa-folder"></i>
      </div>
      <div class="quick-action-title" style="font-size: 1rem; margin-top: 8px;">${escapeHtml(subject.name)}</div>
      <div class="quick-action-desc" style="font-size: 0.8rem; margin-top: 4px;">${quizCount} quiz${quizCount !== 1 ? 'zes' : ''}</div>
    `;
    grid.appendChild(folderCard);
  });
}

function openQuizSubject(subjectId) {
  activeQuizSubjectId = subjectId;
  const subject = subjectsData[subjectId];
  if (!subject) return;

  document.getElementById('active-subject-title').textContent = subject.name;
  activeSubjectQuizzes = subject.quizzes || {};
  renderQuizDashboard();

  document.getElementById('quiz-subjects-view').classList.add('hidden');
  document.getElementById('quiz-dashboard-view').classList.remove('hidden');
}

// ----- DASHBOARD -----
function renderQuizDashboard() {
  const list = document.getElementById('quiz-list');
  list.innerHTML = '';
  
  const entries = Object.entries(activeSubjectQuizzes).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  if (entries.length === 0) {
    list.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);">
        <i class="fas fa-graduation-cap" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
        <p>This folder is empty. Create your first quiz!</p>
      </div>
    `;
    return;
  }
  
  entries.forEach(([id, quiz]) => {
    const qCount = quiz.questions ? quiz.questions.length : 0;
    const scoreText = quiz.bestScore !== undefined ? `Best Score: ${quiz.bestScore}%` : 'Not taken yet';
    
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.innerHTML = `
      <div class="quiz-card-title">${escapeHtml(quiz.title)}</div>
      <div class="quiz-card-stats">
        <span>${qCount} questions</span>
        <span>${scoreText}</span>
      </div>
      <div class="quiz-card-actions">
        <button class="btn btn-primary" style="flex: 1; padding: 8px;" onclick="startTakingQuiz('${id}')">Take Quiz</button>
        <button class="btn-icon" onclick="showQuizCreator('${id}')" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn-icon" style="color: var(--danger);" onclick="deleteQuiz('${id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;
    list.appendChild(card);
  });
}

function deleteQuiz(id) {
  if (confirm('Are you sure you want to delete this quiz?')) {
    if (activeQuizSubjectId && quizUserId) {
      db.ref('users/' + quizUserId + '/quizzes/subjects/' + activeQuizSubjectId + '/quizzes/' + id).remove();
    }
  }
}

// ----- CREATOR -----
function addQuizQuestion(type) {
  const q = { type: type, text: '' };
  if (type === 'multiple-choice') {
    q.options = ['', '', '', ''];
    q.correctIndex = 0;
  } else if (type === 'fill-blank') {
    q.correctAnswer = '';
  }
  builderQuestions.push(q);
  renderQuizBuilder();
}

function removeQuizQuestion(index) {
  builderQuestions.splice(index, 1);
  renderQuizBuilder();
}

function renderQuizBuilder() {
  const container = document.getElementById('quiz-questions-container');
  container.innerHTML = '';
  
  builderQuestions.forEach((q, index) => {
    const el = document.createElement('div');
    el.className = 'quiz-question-builder';
    
    let innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--gray-500); font-size: 0.9rem;">
        Question ${index + 1} (${q.type === 'multiple-choice' ? 'Multiple Choice' : 'Fill in the Blank'})
      </div>
      <button class="btn-icon builder-remove-btn" onclick="removeQuizQuestion(${index})"><i class="fas fa-trash"></i></button>
      <div class="input-group">
        <input type="text" placeholder="Enter question text..." value="${escapeHtml(q.text)}" 
               oninput="builderQuestions[${index}].text = this.value" />
      </div>
    `;
    
    if (q.type === 'multiple-choice') {
      innerHTML += `<div style="margin-top: 12px; font-size: 0.85rem; color: var(--gray-500); margin-bottom: 8px;">Select the correct option:</div>`;
      q.options.forEach((opt, optIndex) => {
        innerHTML += `
          <div class="builder-option-row">
            <input type="radio" name="q-correct-${index}" ${q.correctIndex === optIndex ? 'checked' : ''} 
                   onchange="builderQuestions[${index}].correctIndex = ${optIndex}" />
            <input type="text" placeholder="Option ${optIndex + 1}" value="${escapeHtml(opt)}" 
                   oninput="builderQuestions[${index}].options[${optIndex}] = this.value" />
          </div>
        `;
      });
    } else if (q.type === 'fill-blank') {
      innerHTML += `
        <div style="margin-top: 12px; font-size: 0.85rem; color: var(--gray-500); margin-bottom: 8px;">Correct Answer:</div>
        <div class="input-group">
          <input type="text" placeholder="Enter the exact correct answer..." value="${escapeHtml(q.correctAnswer)}" 
                 oninput="builderQuestions[${index}].correctAnswer = this.value" />
        </div>
      `;
    }
    
    el.innerHTML = innerHTML;
    container.appendChild(el);
  });
}

function saveQuiz() {
  if (!activeQuizSubjectId || !quizUserId) return;

  const title = document.getElementById('quiz-title-input').value.trim();
  if (!title) return alert('Please enter a quiz title.');
  if (builderQuestions.length === 0) return alert('Please add at least one question.');
  
  // Basic validation
  for (let i = 0; i < builderQuestions.length; i++) {
    const q = builderQuestions[i];
    if (!q.text.trim()) return alert(`Question ${i+1} is missing text.`);
    if (q.type === 'multiple-choice') {
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) return alert(`Option ${j+1} on Question ${i+1} is empty.`);
      }
    } else if (q.type === 'fill-blank') {
      if (!q.correctAnswer.trim()) return alert(`Question ${i+1} is missing a correct answer.`);
    }
  }

  const quizData = {
    title: title,
    questions: builderQuestions,
    updatedAt: Date.now()
  };
  
  const targetRef = db.ref('users/' + quizUserId + '/quizzes/subjects/' + activeQuizSubjectId + '/quizzes');

  if (editingQuizId) {
    // Preserve best score
    quizData.bestScore = activeSubjectQuizzes[editingQuizId].bestScore || 0;
    targetRef.child(editingQuizId).set(quizData);
  } else {
    quizData.bestScore = 0;
    targetRef.push(quizData);
  }
  
  showQuizDashboard();
}

// ----- TAKER -----
function renderQuizTaker() {
  const container = document.getElementById('taker-questions-container');
  container.innerHTML = '';
  
  if (!activeQuizData.questions) return;
  
  activeQuizData.questions.forEach((q, index) => {
    const el = document.createElement('div');
    el.className = 'quiz-question-view';
    el.id = `taker-q-${index}`;
    
    let innerHTML = `<div class="quiz-question-text">${index + 1}. ${escapeHtml(q.text)}</div>`;
    
    if (q.type === 'multiple-choice') {
      innerHTML += `<div class="quiz-options-list">`;
      q.options.forEach((opt, optIndex) => {
        innerHTML += `
          <div class="quiz-option" id="taker-q-${index}-opt-${optIndex}" onclick="selectQuizOption(${index}, ${optIndex})">
            <div style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--gray-300); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">
              ${String.fromCharCode(65 + optIndex)}
            </div>
            <div>${escapeHtml(opt)}</div>
          </div>
        `;
      });
      innerHTML += `</div>`;
    } else if (q.type === 'fill-blank') {
      innerHTML += `
        <input type="text" class="quiz-fill-input" id="taker-q-${index}-input" placeholder="Type your answer here..." 
               oninput="userAnswers[${index}] = this.value" autocomplete="off" />
      `;
    }
    
    el.innerHTML = innerHTML;
    container.appendChild(el);
  });
}

function selectQuizOption(qIndex, optIndex) {
  userAnswers[qIndex] = optIndex;
  
  // Update UI to show selection
  const qData = activeQuizData.questions[qIndex];
  for (let i = 0; i < qData.options.length; i++) {
    const optEl = document.getElementById(`taker-q-${qIndex}-opt-${i}`);
    if (i === optIndex) {
      optEl.classList.add('selected');
      optEl.querySelector('div').style.borderColor = 'var(--sky-500)';
      optEl.querySelector('div').style.backgroundColor = 'var(--sky-500)';
      optEl.querySelector('div').style.color = 'white';
    } else {
      optEl.classList.remove('selected');
      optEl.querySelector('div').style.borderColor = 'var(--gray-300)';
      optEl.querySelector('div').style.backgroundColor = 'transparent';
      optEl.querySelector('div').style.color = 'inherit';
    }
  }
}

function submitQuiz() {
  if (!activeQuizData || !activeQuizData.questions) return;
  
  let correctCount = 0;
  const total = activeQuizData.questions.length;
  let wrongAnswersSummary = [];
  
  activeQuizData.questions.forEach((q, index) => {
    const userAnswer = userAnswers[index];
    let isCorrect = false;
    
    if (q.type === 'multiple-choice') {
      isCorrect = (userAnswer === q.correctIndex);
      
      // Highlight UI
      q.options.forEach((opt, optIndex) => {
        const optEl = document.getElementById(`taker-q-${index}-opt-${optIndex}`);
        optEl.onclick = null; // disable clicks
        optEl.classList.remove('selected');
        
        if (optIndex === q.correctIndex) {
          optEl.classList.add('correct');
        } else if (userAnswer === optIndex && userAnswer !== q.correctIndex) {
          optEl.classList.add('incorrect');
        }
      });
      
      if (!isCorrect) {
        const userText = userAnswer !== undefined ? q.options[userAnswer] : 'No answer';
        wrongAnswersSummary.push({
          question: q.text,
          yourAnswer: userText,
          correctAnswer: q.options[q.correctIndex]
        });
      }
      
    } else if (q.type === 'fill-blank') {
      // Case insensitive comparison for fill-in-the-blank
      const actualUserAnswer = (userAnswer || '').trim().toLowerCase();
      const correctAnswer = q.correctAnswer.trim().toLowerCase();
      isCorrect = (actualUserAnswer === correctAnswer);
      
      const inputEl = document.getElementById(`taker-q-${index}-input`);
      inputEl.disabled = true;
      if (isCorrect) {
        inputEl.classList.add('correct');
      } else {
        inputEl.classList.add('incorrect');
        // Show correct answer below
        const corrEl = document.createElement('div');
        corrEl.style.marginTop = '8px';
        corrEl.style.fontSize = '0.9rem';
        corrEl.style.color = 'var(--success)';
        corrEl.innerHTML = `<i class="fas fa-check-circle"></i> Correct answer: <strong>${escapeHtml(q.correctAnswer)}</strong>`;
        inputEl.parentNode.appendChild(corrEl);
        
        wrongAnswersSummary.push({
          question: q.text,
          yourAnswer: userAnswer || 'No answer',
          correctAnswer: q.correctAnswer
        });
      }
    }
    
    if (isCorrect) correctCount++;
  });
  
  const scorePercent = Math.round((correctCount / total) * 100);
  
  // Build Summary HTML
  let summaryHtml = '';
  if (wrongAnswersSummary.length > 0) {
    summaryHtml = `<div style="margin-top: 24px; text-align: left; background: var(--glass-bg); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--danger);">`;
    summaryHtml += `<h4 style="color: var(--danger); margin-bottom: 12px;"><i class="fas fa-exclamation-triangle"></i> Let's Review:</h4>`;
    summaryHtml += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px;">`;
    wrongAnswersSummary.forEach(w => {
      summaryHtml += `
        <li style="font-size: 0.95rem; border-bottom: 1px solid var(--gray-200); padding-bottom: 8px;">
          <div style="font-weight: 600; color: var(--gray-800);">${escapeHtml(w.question)}</div>
          <div style="color: var(--gray-500); margin-top: 4px;">You answered: <span style="color: var(--danger); text-decoration: line-through;">${escapeHtml(w.yourAnswer)}</span></div>
          <div style="color: var(--success); margin-top: 2px;">Correct answer: <strong>${escapeHtml(w.correctAnswer)}</strong></div>
        </li>
      `;
    });
    summaryHtml += `</ul></div>`;
  }
  
  // Show Results
  const resultsContainer = document.getElementById('quiz-results-container');
  resultsContainer.classList.remove('hidden');
  document.getElementById('btn-submit-quiz').classList.add('hidden');
  document.getElementById('btn-retake-quiz').classList.remove('hidden');
  
  const scoreDisplay = document.getElementById('quiz-score-display');
  const feedbackText = document.getElementById('quiz-feedback-text');
  
  scoreDisplay.textContent = `Score: ${scorePercent}%`;
  
  if (scorePercent === 100) feedbackText.textContent = "Perfect! Amazing job! 🌟";
  else if (scorePercent >= 80) feedbackText.textContent = "Great work! You've got this down. 👍";
  else if (scorePercent >= 60) feedbackText.textContent = "Good effort, keep studying! 📚";
  else feedbackText.textContent = "Time to review this material again. You can do it! 💪";
  
  // Append summary if exists
  if (summaryHtml) {
    let existingSummary = document.getElementById('quiz-review-summary');
    if (existingSummary) existingSummary.remove();
    
    const summaryWrapper = document.createElement('div');
    summaryWrapper.id = 'quiz-review-summary';
    summaryWrapper.innerHTML = summaryHtml;
    resultsContainer.appendChild(summaryWrapper);
  } else {
    let existingSummary = document.getElementById('quiz-review-summary');
    if (existingSummary) existingSummary.remove();
  }
  
  // Save best score to DB
  if (scorePercent > (activeQuizData.bestScore || 0)) {
    if (activeQuizSubjectId && quizUserId) {
      db.ref('users/' + quizUserId + '/quizzes/subjects/' + activeQuizSubjectId + '/quizzes/' + activeQuizId).update({ bestScore: scorePercent });
    }
  }
}

function retakeQuiz() {
  startTakingQuiz(activeQuizId);
}
