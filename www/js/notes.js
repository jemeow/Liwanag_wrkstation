// ===== NOTES MODULE =====
let notesCollection = null;
let activeNoteId = null;
let saveTimeout = null;

// Highlighter State
const defaultPastels = [
  "#fef08a", // Yellow
  "#bbf7d0", // Green
  "#bfdbfe", // Blue
  "#fbcfe8", // Pink
  "#e9d5ff", // Purple
];
let customHighlightColors = [];
let savedRange = null;
let pendingCustomColor = null;

function saveSelection() {
  const sel = window.getSelection();
  if (sel.getRangeAt && sel.rangeCount) {
    savedRange = sel.getRangeAt(0);
  }
}

function restoreSelection() {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

function initNotes(userId) {
  notesCollection = db.collection("users").doc(userId).collection("notes");

  const editor = document.getElementById("notes-editor");
  const charCount = document.getElementById("notes-char-count");
  const saveStatus = document.getElementById("notes-save-status");

  // Load custom colors
  const savedColors = localStorage.getItem("liwanag_custom_colors");
  if (savedColors) {
    try {
      customHighlightColors = JSON.parse(savedColors);
    } catch (e) {}
  }
  renderColorPalette();

  // Load list of notes
  loadNotesList();

  const titleInput = document.getElementById("notes-title-input");

  // Auto-save on input (debounced)
  const handleSave = () => {
    if (!activeNoteId) return;
    const htmlContent = editor.innerHTML;
    const titleVal = titleInput.value.trim() || "Untitled Note";
    const textLength = editor.innerText.trim().length;

    charCount.textContent = textLength + " characters";
    saveStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Real-time update sidebar preview
    const activeSidebarItem = document.getElementById(`sidebar-item-${activeNoteId}`);
    if (activeSidebarItem) {
      activeSidebarItem.querySelector(".note-title").textContent = titleVal;
      activeSidebarItem.querySelector(".note-preview").textContent = extractPreview(htmlContent);
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      notesCollection.doc(activeNoteId)
        .set({
          title: titleVal,
          content: htmlContent,
          updatedAt: Date.now(),
        }, { merge: true })
        .then(() => {
          saveStatus.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Saved';
          setTimeout(() => {
            saveStatus.innerHTML = '<i class="fas fa-cloud"></i> Ready';
          }, 2000);
        })
        .catch(() => {
          saveStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        });
    }, 800);
  };

  editor.addEventListener("input", handleSave);
  titleInput.addEventListener("input", handleSave);
}

function loadNotesList() {
  notesCollection.orderBy("updatedAt", "desc").get().then(snapshot => {
    const sidebar = document.getElementById("notes-list-sidebar");
    sidebar.innerHTML = '';
    
    if (snapshot.empty) {
      // Legacy fallback check
      notesCollection.doc("user_notes").get().then(oldDoc => {
         if(oldDoc.exists) {
            const data = oldDoc.data();
            notesCollection.doc("user_notes").set({...data, title: "Migrated Note", updatedAt: Date.now()}).then(() => loadNotesList());
         } else {
            window.createNewNote();
         }
      });
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const title = data.title || extractTitleFallback(data.content);
      const preview = extractPreview(data.content);
      const date = new Date(data.updatedAt || Date.now());
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const item = document.createElement("div");
      item.id = `sidebar-item-${doc.id}`;
      item.className = "note-list-item";
      item.style.padding = "12px 14px";
      item.style.borderRadius = "8px";
      item.style.cursor = "pointer";
      item.style.marginBottom = "4px";
      item.style.transition = "all 0.2s";
      item.style.borderLeft = "3px solid transparent";
      
      // Highlight if it's the active note
      if (activeNoteId === doc.id) {
        item.style.background = "var(--bg-color)";
        item.style.borderLeftColor = "var(--sky-500)";
        item.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
      }

      item.onclick = () => window.switchNote(doc.id);

      item.innerHTML = `
        <div class="note-title" style="font-weight: 600; font-size: 0.95rem; color: var(--gray-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${title}</div>
        <div class="note-preview" style="font-size: 0.8rem; color: var(--gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">${preview}</div>
        <div style="font-size: 0.7rem; color: var(--gray-400); font-weight: 500;">${dateStr}</div>
      `;
      sidebar.appendChild(item);
    });

    if (!activeNoteId && snapshot.docs.length > 0) {
      window.switchNote(snapshot.docs[0].id);
    }
  });
}

window.switchNote = function(noteId) {
  activeNoteId = noteId;
  const editor = document.getElementById("notes-editor");
  const titleInput = document.getElementById("notes-title-input");
  const charCount = document.getElementById("notes-char-count");

  // Update Sidebar Styles visually
  const allItems = document.querySelectorAll('.note-list-item');
  allItems.forEach(el => {
    el.style.background = "transparent";
    el.style.borderLeftColor = "transparent";
    el.style.boxShadow = "none";
  });
  const activeEl = document.getElementById(`sidebar-item-${noteId}`);
  if (activeEl) {
    activeEl.style.background = "var(--bg-color)";
    activeEl.style.borderLeftColor = "var(--sky-500)";
    activeEl.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
  }

  // Load content
  notesCollection.doc(noteId).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      editor.innerHTML = data.content || "";
      titleInput.value = data.title || extractTitleFallback(data.content) || "";
      charCount.textContent = editor.innerText.trim().length + " characters";
    }
  });

  // Trigger mobile view slide
  const notesContainer = document.querySelector(".notes-container");
  if (notesContainer) notesContainer.classList.add("viewing-note");
};

window.exitNoteEditor = function() {
  const notesContainer = document.querySelector(".notes-container");
  if (notesContainer) notesContainer.classList.remove("viewing-note");
  activeNoteId = null;
  document.getElementById("notes-editor").innerHTML = "";
  document.getElementById("notes-title-input").value = "";
  
  // Remove active highlight
  const allItems = document.querySelectorAll('.note-list-item');
  allItems.forEach(el => {
    el.style.background = "transparent";
    el.style.borderLeftColor = "transparent";
    el.style.boxShadow = "none";
  });
};

window.createNewNote = function() {
  const noteId = "note_" + Date.now();
  
  notesCollection.doc(noteId).set({
    title: "",
    content: "",
    updatedAt: Date.now()
  }).then(() => {
    activeNoteId = noteId;
    loadNotesList();
    setTimeout(() => { 
      window.switchNote(noteId); 
      document.getElementById("notes-title-input").focus();
      document.getElementById("notes-title-input").select();
    }, 300);
  });
};

window.deleteCurrentNote = function() {
  if (!activeNoteId) return;
  const modal = document.getElementById("delete-note-modal");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.add("visible");
  }, 10);
};

window.confirmDeleteNote = function() {
  if (!activeNoteId) return;
  notesCollection.doc(activeNoteId).delete().then(() => {
    window.exitNoteEditor();
    window.cancelDeleteNote();
    loadNotesList();
  });
};

window.cancelDeleteNote = function() {
  const modal = document.getElementById("delete-note-modal");
  if (modal) {
    modal.classList.remove("visible");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }
};

function extractTitleFallback(htmlContent) {
  if (!htmlContent) return "Untitled Note";
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  const text = temp.innerText.trim();
  if (text.length === 0) return "Untitled Note";
  const firstLine = text.split('\n')[0];
  return firstLine.substring(0, 30) + (firstLine.length > 30 ? "..." : "");
}

function extractPreview(htmlContent) {
  if (!htmlContent) return "No additional text";
  // Replace common block tags with spaces to prevent words from squishing together
  let text = htmlContent.replace(/<(div|p|br|li|h[1-6])[^>]*>/gi, ' <$1>');
  // Strip all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Collapse multiple spaces into one
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return "No additional text";
  return text.substring(0, 60) + (text.length > 60 ? "..." : "");
}

function formatNote(command, value = null) {
  // Force browser to use inline CSS styles instead of legacy HTML tags
  document.execCommand("styleWithCSS", false, true);

  if (command === "hiliteColor") {
    // Some browsers prefer backColor for background highlights
    document.execCommand("backColor", false, value);
    document.execCommand("hiliteColor", false, value);
  } else {
    document.execCommand(command, false, value);
  }

  const editor = document.getElementById("notes-editor");
  editor.focus();
}

function toggleColorPalette(event) {
  const popover = document.getElementById("color-palette-popover");
  
  // Detach and append to body so it escapes all scrolling containers
  if (popover.parentNode !== document.body) {
    document.body.appendChild(popover);
  }

  popover.classList.toggle("hidden");

  if (!popover.classList.contains("hidden")) {
    const btnRect = event.currentTarget.getBoundingClientRect();
    // Position just below the button
    popover.style.top = `${btnRect.bottom + window.scrollY + 8}px`;
    // Align right edge with the button's right edge to avoid mobile screen cutoff
    popover.style.left = 'auto';
    popover.style.right = `${window.innerWidth - btnRect.right}px`;
  }

  // Close if clicked outside
  const closeListener = (e) => {
    if (
      !e.target.closest("#color-palette-popover") &&
      !e.target.closest('.toolbar-btn[title="Highlight"]')
    ) {
      popover.classList.add("hidden");
      document.removeEventListener("click", closeListener);
    }
  };

  if (!popover.classList.contains("hidden")) {
    setTimeout(() => {
      document.addEventListener("click", closeListener);
    }, 10);
  }
}

function renderColorPalette() {
  const container = document.getElementById("color-swatch-container");
  if (!container) return;
  container.innerHTML = "";

  // Render Defaults
  defaultPastels.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.onmousedown = (e) => e.preventDefault();
    swatch.onclick = () => applyHighlightColor(color);
    container.appendChild(swatch);
  });

  // Render Custom
  customHighlightColors.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.onmousedown = (e) => e.preventDefault();
    swatch.onclick = () => applyHighlightColor(color);
    container.appendChild(swatch);
  });

  // Render Pending Confirm UI or Add Button
  if (pendingCustomColor) {
    const confirmUI = document.createElement("div");
    confirmUI.style.gridColumn = "1 / -1";
    confirmUI.style.display = "flex";
    confirmUI.style.alignItems = "center";
    confirmUI.style.justifyContent = "space-between";
    confirmUI.style.marginTop = "8px";
    confirmUI.style.paddingTop = "8px";
    confirmUI.style.borderTop = "1px solid var(--gray-200)";

    confirmUI.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="color-swatch" style="background-color: ${pendingCustomColor}; cursor: default; transform: none; box-shadow: none;"></div>
        <span style="font-size: 0.8rem; color: var(--gray-600);">Save color?</span>
      </div>
      <div style="display: flex; gap: 4px;">
        <button class="btn-icon" style="color: var(--success); font-size: 1.1rem;" onmousedown="event.preventDefault()" onclick="confirmCustomColor()" title="Save"><i class="fas fa-check-circle"></i></button>
        <button class="btn-icon" style="color: var(--danger); font-size: 1.1rem;" onmousedown="event.preventDefault()" onclick="cancelCustomColor()" title="Cancel"><i class="fas fa-times-circle"></i></button>
      </div>
    `;
    container.appendChild(confirmUI);
  } else if (customHighlightColors.length < 10) {
    const addBtn = document.createElement("div");
    addBtn.className = "add-color-swatch";
    addBtn.innerHTML = `
      <i class="fas fa-plus"></i>
      <input type="color" onclick="saveSelection()" onchange="handleColorPickerChange(this.value)" title="Add Custom Color" />
    `;
    container.appendChild(addBtn);
  }
}

function handleColorPickerChange(color) {
  pendingCustomColor = color;
  renderColorPalette();
}

function confirmCustomColor() {
  restoreSelection();
  if (
    pendingCustomColor &&
    !customHighlightColors.includes(pendingCustomColor)
  ) {
    customHighlightColors.push(pendingCustomColor);
    localStorage.setItem(
      "liwanag_custom_colors",
      JSON.stringify(customHighlightColors),
    );
  }
  if (pendingCustomColor) {
    applyHighlightColor(pendingCustomColor);
  }
  pendingCustomColor = null;
  renderColorPalette();
}

function cancelCustomColor() {
  pendingCustomColor = null;
  renderColorPalette();
}

function applyHighlightColor(color) {
  formatNote("hiliteColor", color);
  document.getElementById("color-palette-popover").classList.add("hidden");
}

function cleanupNotes() {
  clearTimeout(saveTimeout);
}
