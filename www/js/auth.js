// ===== AUTH MODULE =====
let currentUser = null;

function switchAuthTab(tab) {
  const loginTab = document.getElementById("tab-login");
  const signupTab = document.getElementById("tab-signup");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const indicator = document.querySelector(".tab-indicator");
  const errorEl = document.getElementById("auth-error");

  errorEl.classList.remove("show");
  errorEl.textContent = "";

  if (tab === "login") {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.classList.add("active");
    signupForm.classList.remove("active");
    indicator.classList.remove("right");
  } else {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.classList.add("active");
    loginForm.classList.remove("active");
    indicator.classList.add("right");
  }
}

function showAuthError(message) {
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = message;
  errorEl.classList.add("show");
  setTimeout(() => errorEl.classList.remove("show"), 5000);
}

// Login
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const btn = document.getElementById("login-btn");

      if (!email || !password)
        return showAuthError("Please fill in all fields.");

      btn.disabled = true;
      btn.querySelector("span").textContent = "Logging in...";

      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        showAuthError(getAuthErrorMessage(err.code));
      } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Log In";
      }
    });

  // Sign Up
  document
    .getElementById("signup-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      const confirm = document.getElementById("signup-confirm").value;
      const btn = document.getElementById("signup-btn");

      if (!email || !password || !confirm)
        return showAuthError("Please fill in all fields.");
      if (password !== confirm) return showAuthError("Passwords do not match.");
      if (password.length < 6)
        return showAuthError("Password must be at least 6 characters.");

      btn.disabled = true;
      btn.querySelector("span").textContent = "Creating...";

      try {
        await auth.createUserWithEmailAndPassword(email, password);
      } catch (err) {
        showAuthError(getAuthErrorMessage(err.code));
      } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Create Account";
      }
    });
});

function logOut() {
  auth.signOut();
}

function getAuthErrorMessage(code) {
  const messages = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment.",
    "auth/invalid-credential": "Invalid email or password.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}

// Profile & Settings
function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  modal.classList.remove("hidden");
  // Small delay to allow the browser to register the removal of 'hidden' before transitioning opacity
  setTimeout(() => modal.classList.add("visible"), 10);
  
  if (currentUser) {
    document.getElementById("profile-display-name").value = currentUser.displayName || "";
    
    // Fetch user's MFA settings from Firestore
    const statusText = document.getElementById("mfa-status-text");
    if (statusText) statusText.textContent = "Status: Loading...";
    
    db.collection("users").doc(currentUser.uid).get().then((doc) => {
      const mfaEnabled = doc.exists && doc.data().mfaEnabled !== undefined ? doc.data().mfaEnabled : true;
      window.mfaEnabledState = mfaEnabled;
      updateMFAStatusUI(mfaEnabled);
    }).catch((err) => {
      console.error("Error fetching MFA settings:", err);
      if (statusText) statusText.textContent = "Status: Error loading";
    });
  }
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  modal.classList.remove("visible");
  setTimeout(() => modal.classList.add("hidden"), 300); // Wait for transition
  document.getElementById("profile-error").classList.add("hidden");
  document.getElementById("profile-success").classList.add("hidden");
  
  // Clear password fields
  document.getElementById("confirm-email-input").value = "";
  document.getElementById("new-password-input").value = "";
  document.getElementById("password-feedback").classList.add("hidden");
  
  // Reset MFA modal header text
  const mfaTitle = document.getElementById("mfa-title");
  if (mfaTitle) mfaTitle.textContent = "Two-Factor Authentication";
}

function updateMFAStatusUI(enabled) {
  const statusText = document.getElementById("mfa-status-text");
  const checkbox = document.getElementById("mfa-checkbox");
  if (statusText) {
    statusText.textContent = enabled ? "Status: ENABLED" : "Status: DISABLED";
    statusText.style.color = enabled ? "var(--success)" : "var(--gray-500)";
  }
  if (checkbox) {
    checkbox.checked = enabled;
  }
}

function syncMFACheckbox() {
  const checkbox = document.getElementById("mfa-checkbox");
  if (checkbox) {
    checkbox.checked = !!window.mfaEnabledState;
  }
  updateMFAStatusUI(!!window.mfaEnabledState);
}

async function handleMFAToggleClick(checkbox) {
  if (!currentUser) return;
  
  const intendedNewState = checkbox.checked;
  
  try {
    // Save directly to Firestore without OTP verification
    await db.collection("users").doc(currentUser.uid).set({
      mfaEnabled: intendedNewState
    }, { merge: true });
    
    window.mfaEnabledState = intendedNewState;
    if (typeof updateMFAStatusUI === "function") {
      updateMFAStatusUI(intendedNewState);
    }
    
    SecureAuth.showSecurityBanner(
      `✅ Two-factor authentication has been ${intendedNewState ? "enabled" : "disabled"}.`,
      "success",
    );
  } catch (dbErr) {
    console.error("Error saving MFA status to Firestore:", dbErr);
    SecureAuth.showSecurityBanner("❌ Failed to update MFA settings. Please try again.", "error");
    checkbox.checked = !intendedNewState; // Revert checkbox
    if (typeof syncMFACheckbox === "function") syncMFACheckbox();
  }
}

async function updateProfile() {
  const displayName = document.getElementById("profile-display-name").value.trim();
  const btn = document.getElementById("profile-submit-btn");
  const errorEl = document.getElementById("profile-error");
  const successEl = document.getElementById("profile-success");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");
  
  if (!currentUser) return;
  
  btn.disabled = true;
  btn.querySelector("span").textContent = "Saving...";

  try {
    await currentUser.updateProfile({
      displayName: displayName
    });
    
    // Update UI
    const emailDisplay = document.getElementById("user-email-display");
    if (emailDisplay) emailDisplay.textContent = currentUser.displayName || currentUser.email;
    
    successEl.textContent = "Profile updated successfully!";
    successEl.classList.remove("hidden");
    
    setTimeout(() => {
      closeSettingsModal();
      successEl.classList.add("hidden");
    }, 1500);
  } catch (err) {
    errorEl.textContent = err.message || "Failed to update profile.";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Save Changes";
  }
}

async function changePassword() {
  const confirmEmail = document.getElementById("confirm-email-input").value.trim();
  const newPassword = document.getElementById("new-password-input").value;
  const btn = document.getElementById("password-submit-btn");
  const feedbackEl = document.getElementById("password-feedback");

  feedbackEl.classList.add("hidden");

  if (!currentUser) return;
  if (!confirmEmail || !newPassword) {
    feedbackEl.textContent = "Please fill in all fields.";
    feedbackEl.style.color = "var(--error)";
    feedbackEl.classList.remove("hidden");
    return;
  }
  
  if (confirmEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
    feedbackEl.textContent = "Email confirmation does not match your current email.";
    feedbackEl.style.color = "var(--error)";
    feedbackEl.classList.remove("hidden");
    return;
  }

  if (newPassword.length < 6) {
    feedbackEl.textContent = "Password must be at least 6 characters.";
    feedbackEl.style.color = "var(--error)";
    feedbackEl.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  btn.querySelector("span").textContent = "Updating...";

  try {
    await currentUser.updatePassword(newPassword);
    
    feedbackEl.textContent = "Password updated successfully!";
    feedbackEl.style.color = "var(--success)";
    feedbackEl.classList.remove("hidden");
    
    document.getElementById("confirm-email-input").value = "";
    document.getElementById("new-password-input").value = "";
    
    setTimeout(() => {
      closeSettingsModal();
      feedbackEl.classList.add("hidden");
    }, 1500);
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      feedbackEl.textContent = "Please log out and log back in to change your password.";
    } else {
      feedbackEl.textContent = getAuthErrorMessage(err.code) || err.message;
    }
    feedbackEl.style.color = "var(--error)";
    feedbackEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Update Password";
  }
}
