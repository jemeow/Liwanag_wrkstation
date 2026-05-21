// ===== NOTES MODULE =====
let notesRef = null;
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
  notesRef = db
    .collection("users")
    .doc(userId)
    .collection("notes")
    .doc("user_notes");

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

  // Load existing notes
  notesRef.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data && data.content) {
        editor.innerHTML = data.content;
        const textLength = editor.innerText.trim().length;
        charCount.textContent = textLength + " characters";
      }
    }
  });

  // Auto-save on input (debounced)
  editor.addEventListener("input", () => {
    const htmlContent = editor.innerHTML;
    const textLength = editor.innerText.trim().length;

    charCount.textContent = textLength + " characters";
    saveStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      notesRef
        .set({
          content: htmlContent,
          updatedAt: Date.now(),
        })
        .then(() => {
          saveStatus.innerHTML =
            '<i class="fas fa-cloud-upload-alt"></i> Saved';
          setTimeout(() => {
            saveStatus.innerHTML = '<i class="fas fa-cloud"></i> Ready';
          }, 2000);
        })
        .catch(() => {
          saveStatus.innerHTML =
            '<i class="fas fa-exclamation-triangle"></i> Error';
        });
    }, 800);
  });
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
  popover.classList.toggle("hidden");

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
    swatch.onclick = () => applyHighlightColor(color);
    container.appendChild(swatch);
  });

  // Render Custom
  customHighlightColors.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
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
        <button class="btn-icon" style="color: var(--success); font-size: 1.1rem;" onclick="confirmCustomColor()" title="Save"><i class="fas fa-check-circle"></i></button>
        <button class="btn-icon" style="color: var(--danger); font-size: 1.1rem;" onclick="cancelCustomColor()" title="Cancel"><i class="fas fa-times-circle"></i></button>
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
