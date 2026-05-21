// ============================================================
// SECURE-AUTH-UI.JS  —  UI Layer for Secure Authentication
// Connects HTML forms to SecureAuth module
// Handles: MFA modal, password strength meter, OTP countdown,
//          login attempt warnings, session-timeout messaging
// ============================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ────────────────────────────────────────────
     PATCH: Override the original login submit
     to use SecureAuth (rate-limit + MFA flow)
  ──────────────────────────────────────────── */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Clone to remove old listener added in auth.js
    const newLoginForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);

    newLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn      = document.getElementById('login-btn');

      if (!email || !password) return showAuthError('Please fill in all fields.');

      // Check lockout BEFORE calling Firebase
      if (SecureAuth.RateLimiter.isLocked(email)) {
        const mins = SecureAuth.RateLimiter.getLockoutRemaining(email);
        return showAuthError(`🔒 Account locked. Try again in ${mins} min(s).`);
      }

      btn.disabled = true;
      btn.querySelector('span').textContent = 'Verifying...';

      const result = await SecureAuth.secureLogin(email, password);

      if (result.success && result.mfaRequired) {
        // Show MFA modal
        openMFAModal(email);
      } else if (!result.success) {
        let msg = result.error;
        if (result.attemptsLeft !== undefined && result.attemptsLeft > 0) {
          msg += ` (${result.attemptsLeft} attempt(s) left)`;
        }
        showAuthError(msg);
        shakeCard();
      }

      btn.disabled = false;
      btn.querySelector('span').textContent = 'Log In';
    });
  }

  /* ────────────────────────────────────────────
     PATCH: Override signup to use SecureAuth
     with password-strength validation
  ──────────────────────────────────────────── */
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    const newSignupForm = signupForm.cloneNode(true);
    signupForm.parentNode.replaceChild(newSignupForm, signupForm);

    // Re-attach password strength meter to new form
    const pwInput = document.getElementById('signup-password');
    if (pwInput) {
      pwInput.addEventListener('input', updatePasswordStrength);
    }

    newSignupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email   = document.getElementById('signup-email').value.trim();
      const pw      = document.getElementById('signup-password').value;
      const confirm = document.getElementById('signup-confirm').value;
      const btn     = document.getElementById('signup-btn');

      if (!email || !pw || !confirm) return showAuthError('Please fill in all fields.');
      if (pw !== confirm) return showAuthError('Passwords do not match.');

      const strength = SecureAuth.checkPasswordStrength(pw);
      if (strength.score < 2) {
        return showAuthError(`Password too weak. ${strength.feedback}`);
      }

      btn.disabled = true;
      btn.querySelector('span').textContent = 'Creating...';

      const result = await SecureAuth.secureSignUp(email, pw);

      if (result.success) {
        showAuthError('✅ Account created! Check your email for verification.', 'success');
        if (result.verificationSent) {
          SecureAuth.showSecurityBanner('📧 Verification email sent. Please verify before logging in.', 'success');
        }
      } else {
        showAuthError(result.error);
        shakeCard();
      }

      btn.disabled = false;
      btn.querySelector('span').textContent = 'Create Account';
    });
  }

  /* ────────────────────────────────────────────
     PASSWORD STRENGTH METER
  ──────────────────────────────────────────── */
  function updatePasswordStrength() {
    const pw = document.getElementById('signup-password')?.value || '';
    const meter = document.getElementById('pw-strength-bar');
    const label = document.getElementById('pw-strength-label');
    if (!meter || !label) return;

    const s = SecureAuth.checkPasswordStrength(pw);
    meter.style.width   = pw ? s.percent + '%' : '0%';
    meter.style.background = s.color;
    label.textContent   = pw ? s.label : '';
    label.style.color   = s.color;
  }

  // Attach to password input on the page
  const pwInput = document.getElementById('signup-password');
  if (pwInput) pwInput.addEventListener('input', updatePasswordStrength);

  /* ────────────────────────────────────────────
     SHAKE ANIMATION for failed login
  ──────────────────────────────────────────── */
  function shakeCard() {
    const card = document.querySelector('.auth-card');
    if (!card) return;
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 600);
  }

  /* ────────────────────────────────────────────
     MFA MODAL
  ──────────────────────────────────────────── */
  let otpCountdownInterval = null;

  function openMFAModal(email) {
    const modal = document.getElementById('mfa-modal');
    if (!modal) return;
    document.getElementById('mfa-email-hint').textContent = email;
    modal.classList.remove('hidden');
    modal.classList.add('visible');
    startOTPCountdown();
    setTimeout(() => document.getElementById('mfa-otp-input')?.focus(), 300);
  }
  // Expose so app.js can call it after Firebase auth state restores
  window.openMFAModal = openMFAModal;

  window.closeMFAModal = function () {
    const modal = document.getElementById('mfa-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
    clearInterval(otpCountdownInterval);
    // Clear persisted OTP state so user returns to login screen cleanly
    SecureAuth._clearOTPState && SecureAuth._clearOTPState();
    sessionStorage.removeItem('liwanag_pending_otp');
    sessionStorage.removeItem('liwanag_otp_expiry');
    sessionStorage.removeItem('liwanag_pending_mfa_email');
    // Sign out the pending Firebase user
    auth.signOut();
  };

  window.submitMFAOTP = async function () {
    const input = document.getElementById('mfa-otp-input');
    const btn   = document.getElementById('mfa-submit-btn');
    const otp   = input?.value.trim();

    if (!otp || otp.length !== 6) {
      setMFAError('Please enter the 6-digit OTP.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying…';

    const result = await SecureAuth.verifyMFAOTP(otp);

    if (result.success) {
      clearInterval(otpCountdownInterval);
      const modal = document.getElementById('mfa-modal');
      modal.classList.remove('visible');
      setTimeout(() => modal.classList.add('hidden'), 300);
      SecureAuth.showSecurityBanner('✅ MFA verified! Welcome back.', 'success');
      // Manually trigger dashboard initialization now that MFA is completely passed
      if (typeof window.initializeDashboard === 'function') {
        window.initializeDashboard(result.user);
      }
    } else {
      setMFAError(result.error);
      input.value = '';
      input.focus();
    }

    btn.disabled = false;
    btn.textContent = 'Verify';
  };

  window.resendMFAOTP = async function () {
    const result = await SecureAuth.resendOTP();
    if (result.success) {
      setMFAError('New OTP sent!', 'success');
      startOTPCountdown();
    } else {
      setMFAError(result.error || 'Could not resend OTP.');
    }
  };

  function setMFAError(msg, type = 'error') {
    const el = document.getElementById('mfa-error');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mfa-feedback ' + type;
    el.classList.remove('hidden');
    if (type === 'error') setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function startOTPCountdown() {
    clearInterval(otpCountdownInterval);
    updateOTPCountdown();
    otpCountdownInterval = setInterval(updateOTPCountdown, 1000);
  }

  function updateOTPCountdown() {
    const el = document.getElementById('otp-countdown');
    if (!el) return;
    const secs = SecureAuth.OTPManager.getRemainingSeconds();
    if (secs <= 0) {
      el.textContent = 'OTP expired';
      el.style.color = '#ef4444';
      clearInterval(otpCountdownInterval);
    } else {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      el.textContent = `Expires in ${m}:${s}`;
      el.style.color = secs <= 30 ? '#f97316' : '#6b7280';
    }
  }

  // Auto-submit OTP when 6 digits entered
  const otpInput = document.getElementById('mfa-otp-input');
  if (otpInput) {
    otpInput.addEventListener('input', () => {
      otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 6);
      if (otpInput.value.length === 6) window.submitMFAOTP();
    });
  }

  /* ────────────────────────────────────────────
     RESTORE MFA MODAL AFTER PAGE REFRESH
     If a valid OTP is still pending in sessionStorage,
     re-open the MFA modal so the user can complete it.
  ──────────────────────────────────────────── */
  (function restoreMFAIfPending() {
    if (!SecureAuth.OTPManager.hasPendingOTP()) return;
    const email = sessionStorage.getItem('liwanag_pending_mfa_email');
    if (!email) return;
    // Small delay so the auth-screen has rendered
    setTimeout(() => {
      openMFAModal(email);
      SecureAuth.showSecurityBanner(
        `🔄 Resuming verification for <strong>${email}</strong>. Your previous OTP is still valid.`,
        'info',
        8000
      );
    }, 600);
  })();

  /* ────────────────────────────────────────────
     SESSION TIMEOUT NOTIFICATION
  ──────────────────────────────────────────── */
  const logoutReason = sessionStorage.getItem('liwanag_logout_reason');
  if (logoutReason === 'timeout') {
    sessionStorage.removeItem('liwanag_logout_reason');
    setTimeout(() => {
      showAuthError('🕐 You were logged out due to inactivity.', 'info');
    }, 500);
  }

  /* ────────────────────────────────────────────
     SECURITY BADGE in Auth Screen
  ──────────────────────────────────────────── */
  const badge = document.getElementById('security-badge');
  if (badge) {
    badge.innerHTML = `
      <span class="badge-item"><i class="fas fa-lock"></i> AES-256</span>
      <span class="badge-item"><i class="fas fa-shield-alt"></i> MFA</span>
      <span class="badge-item"><i class="fas fa-fingerprint"></i> HMAC-JWT</span>
      <span class="badge-item"><i class="fas fa-ban"></i> Rate-Limited</span>
    `;
  }

});

/* ────────────────────────────────────────────
   OVERRIDE GLOBAL logOut (from auth.js)
   to use SecureAuth's secure logout
──────────────────────────────────────────── */
window.logOut = function () {
  SecureAuth.performSecureLogout('manual');
};

/* ────────────────────────────────────────────
   HELPER: showAuthError extended to support
   success type
──────────────────────────────────────────── */
const _originalShowAuthError = window.showAuthError;
window.showAuthError = function (message, type = 'error') {
  const errorEl = document.getElementById('auth-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.className = 'auth-error show';
  if (type === 'success') errorEl.style.background = 'rgba(34,197,94,0.15)';
  else errorEl.style.background = '';
  clearTimeout(window._authErrTimeout);
  window._authErrTimeout = setTimeout(() => errorEl.classList.remove('show'), 6000);
};

console.log('[SecureAuthUI] UI layer loaded ✓');
