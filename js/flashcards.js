// ===== FLASHCARDS MODULE =====
let decksRef = null;
let cardsRef = null;
let activeDeckId = null;
let fcUserId = null;

let decksData = {};
let activeCardsData = {};

let testCards = [];
let currentTestCardIndex = 0;
let fcTimerInterval = null;
let fcTimeLeft = 15;
let fcScore = 0;

function initFlashcards(userId) {
  fcUserId = userId;
  decksRef = db.ref('users/' + userId + '/flashcards/decks');

  decksRef.on('value', (snapshot) => {
    decksData = snapshot.val() || {};
    renderDecksGrid(decksData);
    
    // If inside a deck, refresh active deck cards list too
    if (activeDeckId && decksData[activeDeckId]) {
      activeCardsData = decksData[activeDeckId].cards || {};
      renderFlashcards(activeCardsData);
    }
  });
}

function createFlashcardDeck() {
  const input = document.getElementById('deck-name-input');
  const name = input.value.trim();
  if (!name) return;

  decksRef.push({
    name: name,
    createdAt: Date.now()
  });

  input.value = '';
}

function deleteFlashcardDeck(deckId, event) {
  if (event) event.stopPropagation();
  if (confirm("Are you sure you want to delete this folder and all its flashcards?")) {
    decksRef.child(deckId).remove();
    if (activeDeckId === deckId) {
      showFlashcardDecks();
    }
  }
}

function renderDecksGrid(decks) {
  const grid = document.getElementById('flashcard-decks-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const entries = Object.entries(decks).sort((a, b) => b[1].createdAt - a[1].createdAt);

  if (entries.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);">
        <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 12px;"></i>
        <p>No study folders yet. Create one above to get started!</p>
      </div>
    `;
    return;
  }

  entries.forEach(([id, deck]) => {
    const cardCount = Object.keys(deck.cards || {}).length;
    const folderCard = document.createElement('div');
    folderCard.className = 'glass-card quick-action-card';
    folderCard.style.padding = '20px';
    folderCard.style.position = 'relative';
    folderCard.onclick = () => openFlashcardDeck(id);
    
    folderCard.innerHTML = `
      <button class="flashcard-delete" onclick="deleteFlashcardDeck('${id}', event)"><i class="fas fa-trash-alt"></i></button>
      <div class="quick-action-icon" style="background: linear-gradient(135deg, var(--sky-400), var(--sky-500)); width: 48px; height: 48px; border-radius: 12px;">
        <i class="fas fa-folder"></i>
      </div>
      <div class="quick-action-title" style="font-size: 1rem; margin-top: 8px;">${escapeHtml(deck.name)}</div>
      <div class="quick-action-desc" style="font-size: 0.8rem; margin-top: 4px;">${cardCount} card${cardCount !== 1 ? 's' : ''}</div>
    `;
    grid.appendChild(folderCard);
  });
}

function openFlashcardDeck(deckId) {
  activeDeckId = deckId;
  const deck = decksData[deckId];
  if (!deck) return;

  document.getElementById('active-deck-title').textContent = deck.name;
  activeCardsData = deck.cards || {};
  renderFlashcards(activeCardsData);

  document.getElementById('flashcards-decks-view').classList.add('hidden');
  document.getElementById('flashcards-deck-details-view').classList.remove('hidden');
}

function showFlashcardDecks() {
  activeDeckId = null;
  activeCardsData = {};
  
  document.getElementById('flashcards-deck-details-view').classList.add('hidden');
  document.getElementById('flashcards-decks-view').classList.remove('hidden');
}

// Cards CRUD inside active deck
function addFlashcard() {
  if (!activeDeckId || !fcUserId) return;

  const qInput = document.getElementById('card-question');
  const aInput = document.getElementById('card-answer');
  const question = qInput.value.trim();
  const answer = aInput.value.trim();

  if (!question || !answer) return;

  db.ref('users/' + fcUserId + '/flashcards/decks/' + activeDeckId + '/cards').push({
    question: question,
    answer: answer,
    createdAt: Date.now()
  });

  qInput.value = '';
  aInput.value = '';
  qInput.focus();
}

function deleteFlashcard(cardId, event) {
  if (event) event.stopPropagation();
  if (activeDeckId && fcUserId) {
    db.ref('users/' + fcUserId + '/flashcards/decks/' + activeDeckId + '/cards/' + cardId).remove();
  }
}

function flipCard(el) {
  el.classList.toggle('flipped');
}

function renderFlashcards(cards) {
  const grid = document.getElementById('flashcard-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const entries = Object.entries(cards).sort((a, b) => b[1].createdAt - a[1].createdAt);

  if (entries.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--gray-400);">
        <i class="fas fa-layer-group" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
        <p>This folder is empty. Add your first study card above!</p>
      </div>
    `;
    document.getElementById('card-count-display').textContent = '0 cards';
    return;
  }

  entries.forEach(([id, card]) => {
    const div = document.createElement('div');
    div.className = 'flashcard';
    div.onclick = function() { flipCard(this); };
    div.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <button class="flashcard-delete" onclick="deleteFlashcard('${id}', event)"><i class="fas fa-times"></i></button>
          <p>${escapeHtml(card.question)}</p>
        </div>
        <div class="flashcard-back">
          <button class="flashcard-delete" onclick="deleteFlashcard('${id}', event)"><i class="fas fa-times"></i></button>
          <p>${escapeHtml(card.answer)}</p>
        </div>
      </div>
    `;
    grid.appendChild(div);
  });

  document.getElementById('card-count-display').textContent = entries.length + ' card' + (entries.length !== 1 ? 's' : '');
}

// === FLASHCARD TEST MODE ===

function startFlashcardTest() {
  const cardEntries = Object.entries(activeCardsData);
  if (cardEntries.length === 0) {
    alert("Please add at least one flashcard before starting a test!");
    return;
  }

  // Shuffle flashcards
  testCards = cardEntries.map(([id, data]) => ({ id, ...data }));
  for (let i = testCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [testCards[i], testCards[j]] = [testCards[j], testCards[i]];
  }

  currentTestCardIndex = 0;
  fcScore = 0;

  document.getElementById('flashcards-deck-details-view').classList.add('hidden');
  document.getElementById('flashcards-results-view').classList.add('hidden');
  document.getElementById('flashcards-test-view').classList.remove('hidden');

  loadTestCard();
}

function loadTestCard() {
  if (currentTestCardIndex >= testCards.length) {
    endFlashcardTest();
    return;
  }

  const card = testCards[currentTestCardIndex];
  
  // Reset Card State
  document.getElementById('test-card-element').classList.remove('flipped');
  document.getElementById('test-card-front-text').textContent = card.question;
  document.getElementById('test-card-back-text').textContent = card.answer;
  
  // Update progress
  document.getElementById('test-progress').textContent = `Card ${currentTestCardIndex + 1} of ${testCards.length}`;

  // Controls reset
  document.getElementById('fc-btn-flip').classList.remove('hidden');
  document.getElementById('fc-grading-buttons').classList.add('hidden');

  // Reset Timer
  clearInterval(fcTimerInterval);
  fcTimeLeft = 15;
  updateTimerUI();

  // Start Timer ticking
  fcTimerInterval = setInterval(() => {
    fcTimeLeft--;
    updateTimerUI();

    if (fcTimeLeft <= 0) {
      clearInterval(fcTimerInterval);
      flipTestCard();
    }
  }, 1000);
}

function updateTimerUI() {
  const timerBar = document.getElementById('fc-timer-bar');
  const timerText = document.getElementById('fc-timer-text');
  
  if (!timerBar || !timerText) return;

  const percentage = (fcTimeLeft / 15) * 100;
  timerBar.style.width = `${percentage}%`;
  timerText.textContent = fcTimeLeft;

  // Visual feedback based on time left
  if (fcTimeLeft <= 3) {
    timerBar.style.backgroundColor = '#ef4444'; // Red
  } else if (fcTimeLeft <= 6) {
    timerBar.style.backgroundColor = '#f59e0b'; // Yellow/Orange
  } else {
    timerBar.style.backgroundColor = 'var(--sky-500)'; // Default sky blue
  }
}

function flipTestCard() {
  const cardElement = document.getElementById('test-card-element');
  if (cardElement.classList.contains('flipped')) return; // Already flipped

  cardElement.classList.add('flipped');
  
  // Stop Timer
  clearInterval(fcTimerInterval);

  // Toggle Buttons
  document.getElementById('fc-btn-flip').classList.add('hidden');
  document.getElementById('fc-grading-buttons').classList.remove('hidden');
}

function gradeCard(knewIt) {
  if (knewIt) {
    fcScore++;
  }
  
  clearInterval(fcTimerInterval);
  currentTestCardIndex++;
  loadTestCard();
}

function endFlashcardTest() {
  clearInterval(fcTimerInterval);
  
  document.getElementById('flashcards-test-view').classList.add('hidden');
  document.getElementById('flashcards-results-view').classList.remove('hidden');

  const percentage = Math.round((fcScore / testCards.length) * 100);
  
  document.getElementById('fc-score-percentage').textContent = `${percentage}%`;
  document.getElementById('fc-score-raw').textContent = `You knew ${fcScore} out of ${testCards.length} card${testCards.length !== 1 ? 's' : ''}`;

  const resultIconContainer = document.getElementById('fc-result-icon');
  const resultTitle = document.getElementById('fc-result-title');
  const resultSubtitle = document.getElementById('fc-result-subtitle');

  if (percentage >= 80) {
    resultIconContainer.style.backgroundColor = '#22c55e'; // Green
    resultIconContainer.innerHTML = '<i class="fas fa-award"></i>';
    resultTitle.textContent = "Excellent work!";
    resultSubtitle.textContent = "You've mastered this card deck!";
  } else if (percentage >= 50) {
    resultIconContainer.style.backgroundColor = '#f59e0b'; // Orange
    resultIconContainer.innerHTML = '<i class="fas fa-thumbs-up"></i>';
    resultTitle.textContent = "Good progress!";
    resultSubtitle.textContent = "Keep practicing to get even better.";
  } else {
    resultIconContainer.style.backgroundColor = '#ef4444'; // Red
    resultIconContainer.innerHTML = '<i class="fas fa-redo"></i>';
    resultTitle.textContent = "Keep studying!";
    resultSubtitle.textContent = "Don't give up! Try studying the cards again.";
  }
}

function quitFlashcardTest() {
  clearInterval(fcTimerInterval);
  document.getElementById('flashcards-test-view').classList.add('hidden');
  document.getElementById('flashcards-results-view').classList.add('hidden');
  if (activeDeckId) {
    document.getElementById('flashcards-deck-details-view').classList.remove('hidden');
  } else {
    document.getElementById('flashcards-decks-view').classList.remove('hidden');
  }
}

function cleanupFlashcards() {
  clearInterval(fcTimerInterval);
  if (decksRef) decksRef.off();
}
