// ============================================================
// SECURE-AUTH.JS  —  Liwanag Secure Authentication Module
// Lab Activity: Unified Authentication System
// Covers: MFA (Email OTP), Rate-Limiting, Account Lockout,
//         AES Encryption, JWT-like Session, Session Timeout
// ============================================================

'use strict';

/* ─────────────────────────────────────────────
   1. CONSTANTS & CONFIGURATION
───────────────────────────────────────────── */
const AUTH_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,          // Account lockout threshold
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,  // 30 minutes idle
  OTP_EXPIRY_MS: 5 * 60 * 1000,        // 5 minutes OTP validity
  OTP_LENGTH: 6,
  TOKEN_KEY: 'liwanag_session_token',
  ATTEMPTS_KEY: 'liwanag_login_attempts',
  LOCKOUT_KEY: 'liwanag_lockout_until',
  ACTIVITY_KEY: 'liwanag_last_activity',
  MFA_VERIFIED_KEY: 'liwanag_mfa_verified',
  AES_KEY_HEX: '4c6977616e61675f4145535f4b657932', // 128-bit demo key (hex)

  // SessionStorage keys for MFA persistence across page refreshes
  OTP_KEY:        'liwanag_pending_otp',
  OTP_EXPIRY_KEY: 'liwanag_otp_expiry',
  MFA_EMAIL_KEY:  'liwanag_pending_mfa_email',
};

/* ─────────────────────────────────────────────
   2. SESSION TIMER STATE
───────────────────────────────────────────── */
let sessionTimeoutId = null;
let sessionWarningId = null;
let pendingMFAUser = null;   // Holds the Firebase user during MFA step

// ─── OTP helpers: always read/write sessionStorage so they survive refresh ───
function _saveOTPState(otp, expiryMs) {
  sessionStorage.setItem(AUTH_CONFIG.OTP_KEY,        otp);
  sessionStorage.setItem(AUTH_CONFIG.OTP_EXPIRY_KEY, String(expiryMs));
}
function _clearOTPState() {
  sessionStorage.removeItem(AUTH_CONFIG.OTP_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.OTP_EXPIRY_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.MFA_EMAIL_KEY);
}
function _getStoredOTP()    { return sessionStorage.getItem(AUTH_CONFIG.OTP_KEY); }
function _getStoredExpiry() { return parseInt(sessionStorage.getItem(AUTH_CONFIG.OTP_EXPIRY_KEY) || '0'); }

/* ─────────────────────────────────────────────
   3. AES ENCRYPTION (Web Crypto API — GCM)
   Used to encrypt sensitive data in storage
───────────────────────────────────────────── */
const CryptoUtils = (() => {
  async function getKey() {
    const raw = hexToBytes(AUTH_CONFIG.AES_KEY_HEX);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2)
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function encrypt(plaintext) {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return bytesToHex(iv) + ':' + bytesToHex(new Uint8Array(cipher));
  }

  async function decrypt(ciphertext) {
    try {
      const [ivHex, dataHex] = ciphertext.split(':');
      const key = await getKey();
      const iv = hexToBytes(ivHex);
      const data = hexToBytes(dataHex);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(plain);
    } catch {
      return null;
    }
  }

  return { encrypt, decrypt };
})();

/* ─────────────────────────────────────────────
   4. JWT-LIKE SESSION TOKEN MANAGEMENT
   Creates signed tokens (HMAC-SHA256) stored
   in sessionStorage (cleared on tab close)
───────────────────────────────────────────── */
const SessionManager = (() => {
  function base64url(data) {
    return btoa(JSON.stringify(data))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async function createToken(uid, email) {
    const header = base64url({ alg: 'HS256', typ: 'JWT' });
    const payload = base64url({
      sub: uid,
      email,
      iat: Date.now(),
      exp: Date.now() + AUTH_CONFIG.SESSION_TIMEOUT_MS,
    });
    const unsigned = header + '.' + payload;
    // HMAC-SHA256 signature using Web Crypto
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(AUTH_CONFIG.AES_KEY_HEX),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(unsigned));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return unsigned + '.' + sigB64;
  }

  async function validateToken(token) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp < Date.now()) { clearToken(); return null; }
      return payload;
    } catch { return null; }
  }

  async function saveToken(uid, email) {
    const token = await createToken(uid, email);
    sessionStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
    updateActivity();
  }

  function clearToken() {
    sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    sessionStorage.removeItem(AUTH_CONFIG.MFA_VERIFIED_KEY);
  }

  function getToken() {
    return sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  }

  function isMFAVerified() {
    return sessionStorage.getItem(AUTH_CONFIG.MFA_VERIFIED_KEY) === 'true';
  }

  function setMFAVerified() {
    sessionStorage.setItem(AUTH_CONFIG.MFA_VERIFIED_KEY, 'true');
  }

  function updateActivity() {
    localStorage.setItem(AUTH_CONFIG.ACTIVITY_KEY, Date.now().toString());
  }

  function getLastActivity() {
    return parseInt(localStorage.getItem(AUTH_CONFIG.ACTIVITY_KEY) || '0');
  }

  return { saveToken, validateToken, clearToken, getToken, isMFAVerified, setMFAVerified, updateActivity, getLastActivity };
})();

/* ─────────────────────────────────────────────
   5. RATE LIMITING & ACCOUNT LOCKOUT
───────────────────────────────────────────── */
const RateLimiter = (() => {
  function getAttempts(email) {
    const data = JSON.parse(localStorage.getItem(AUTH_CONFIG.ATTEMPTS_KEY) || '{}');
    return data[email] || 0;
  }

  function incrementAttempts(email) {
    const data = JSON.parse(localStorage.getItem(AUTH_CONFIG.ATTEMPTS_KEY) || '{}');
    data[email] = (data[email] || 0) + 1;
    localStorage.setItem(AUTH_CONFIG.ATTEMPTS_KEY, JSON.stringify(data));
    if (data[email] >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
      const lockouts = JSON.parse(localStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY) || '{}');
      lockouts[email] = Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MS;
      localStorage.setItem(AUTH_CONFIG.LOCKOUT_KEY, JSON.stringify(lockouts));
    }
    return data[email];
  }

  function resetAttempts(email) {
    const data = JSON.parse(localStorage.getItem(AUTH_CONFIG.ATTEMPTS_KEY) || '{}');
    delete data[email];
    localStorage.setItem(AUTH_CONFIG.ATTEMPTS_KEY, JSON.stringify(data));
    const lockouts = JSON.parse(localStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY) || '{}');
    delete lockouts[email];
    localStorage.setItem(AUTH_CONFIG.LOCKOUT_KEY, JSON.stringify(lockouts));
  }

  function isLocked(email) {
    const lockouts = JSON.parse(localStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY) || '{}');
    if (!lockouts[email]) return false;
    if (Date.now() > lockouts[email]) {
      resetAttempts(email); // Auto-unlock after duration
      return false;
    }
    return true;
  }

  function getLockoutRemaining(email) {
    const lockouts = JSON.parse(localStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY) || '{}');
    if (!lockouts[email]) return 0;
    return Math.max(0, Math.ceil((lockouts[email] - Date.now()) / 60000));
  }

  function getRemainingAttempts(email) {
    return Math.max(0, AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - getAttempts(email));
  }

  return { incrementAttempts, resetAttempts, isLocked, getLockoutRemaining, getRemainingAttempts };
})();

/* ─────────────────────────────────────────────
   6. OTP GENERATOR (Email MFA)
   All state persisted in sessionStorage so it
   survives page refreshes within same tab.
───────────────────────────────────────────── */
const OTPManager = (() => {
  function generate() {
    // Cryptographically random 6-digit OTP
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const otp = String(arr[0] % 1000000).padStart(AUTH_CONFIG.OTP_LENGTH, '0');
    const expiry = Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS;
    _saveOTPState(otp, expiry);  // Persist to sessionStorage
    return otp;
  }

  function verify(inputOTP) {
    const stored = _getStoredOTP();
    const expiry = _getStoredExpiry();
    if (!stored || !expiry) return { valid: false, reason: 'No OTP found. Please log in again.' };
    if (Date.now() > expiry) {
      _clearOTPState();
      return { valid: false, reason: 'OTP has expired. Please request a new one.' };
    }
    if (inputOTP.trim() !== stored) return { valid: false, reason: 'Incorrect OTP. Please try again.' };
    _clearOTPState(); // Consume OTP — single use
    return { valid: true };
  }

  function getRemainingSeconds() {
    const expiry = _getStoredExpiry();
    if (!expiry) return 0;
    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  }

  function hasPendingOTP() {
    const stored = _getStoredOTP();
    const expiry = _getStoredExpiry();
    return !!(stored && expiry && Date.now() < expiry);
  }

  return { generate, verify, getRemainingSeconds, hasPendingOTP };
})();

/* ─────────────────────────────────────────────
   7. SESSION TIMEOUT (Auto-Logout)
───────────────────────────────────────────── */
function startSessionTimeout() {
  clearTimeout(sessionTimeoutId);
  clearTimeout(sessionWarningId);

  // Warn user 2 minutes before timeout
  const warningDelay = AUTH_CONFIG.SESSION_TIMEOUT_MS - 2 * 60 * 1000;
  if (warningDelay > 0) {
    sessionWarningId = setTimeout(() => {
      showSecurityBanner('⚠️ Your session will expire in 2 minutes due to inactivity.', 'warning');
    }, warningDelay);
  }

  sessionTimeoutId = setTimeout(() => {
    console.warn('[SecureAuth] Session timed out due to inactivity.');
    performSecureLogout('timeout');
  }, AUTH_CONFIG.SESSION_TIMEOUT_MS);
}

function resetSessionTimeout() {
  SessionManager.updateActivity();
  startSessionTimeout();
}

// Reset on user activity
['click', 'keydown', 'mousemove', 'touchstart'].forEach(event => {
  document.addEventListener(event, () => {
    if (sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY)) {
      resetSessionTimeout();
    }
  }, { passive: true });
});

/* ─────────────────────────────────────────────
   8. SECURE LOGOUT
───────────────────────────────────────────── */
async function performSecureLogout(reason = 'manual') {
  clearTimeout(sessionTimeoutId);
  clearTimeout(sessionWarningId);
  SessionManager.clearToken();
  _clearOTPState();  // Wipe persisted OTP on logout
  pendingMFAUser = null;

  if (reason === 'timeout') {
    sessionStorage.setItem('liwanag_logout_reason', 'timeout');
  }

  try {
    await auth.signOut();
  } catch (e) {
    console.error('[SecureAuth] Sign-out error:', e);
  }
}

/* ─────────────────────────────────────────────
   9. SECURE LOGIN FLOW (called from auth.js)
───────────────────────────────────────────── */
async function secureLogin(email, password) {
  // Check rate limiting
  if (RateLimiter.isLocked(email)) {
    const mins = RateLimiter.getLockoutRemaining(email);
    return { success: false, error: `Account temporarily locked. Try again in ${mins} minute(s).`, locked: true };
  }

  try {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    RateLimiter.resetAttempts(email);
    pendingMFAUser = credential.user;

    // Persist the email so MFA modal can restore after page refresh
    sessionStorage.setItem(AUTH_CONFIG.MFA_EMAIL_KEY, credential.user.email);

    // Trigger MFA
    const otp = OTPManager.generate();
    await sendOTPEmail(credential.user.email, otp);

    return { success: true, mfaRequired: true, user: credential.user };
  } catch (err) {
    const attempts = RateLimiter.incrementAttempts(email);
    const remaining = AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - attempts;
    if (remaining <= 0) {
      return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.', locked: true };
    }
    return { success: false, error: getAuthErrorMessage(err.code), attemptsLeft: remaining };
  }
}

/* ─────────────────────────────────────────────
   10. SECURE SIGNUP
───────────────────────────────────────────── */
async function secureSignUp(email, password) {
  // Password strength validation
  const strength = checkPasswordStrength(password);
  if (strength.score < 2) {
    return { success: false, error: `Weak password: ${strength.feedback}` };
  }
  try {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    // Send email verification
    await credential.user.sendEmailVerification();
    return { success: true, user: credential.user, verificationSent: true };
  } catch (err) {
    return { success: false, error: getAuthErrorMessage(err.code) };
  }
}

/* ─────────────────────────────────────────────
   11. MFA OTP VERIFICATION
───────────────────────────────────────────── */
async function verifyMFAOTP(inputOTP) {
  const result = OTPManager.verify(inputOTP);
  if (!result.valid) {
    return { success: false, error: result.reason };
  }

  // After a page refresh, pendingMFAUser is null but Firebase still has the
  // authenticated user in its own persistence layer — use that.
  const firebaseUser = pendingMFAUser || auth.currentUser;
  if (!firebaseUser) {
    return { success: false, error: 'Session expired. Please log in again.' };
  }

  // MFA passed — create session token
  await SessionManager.saveToken(firebaseUser.uid, firebaseUser.email);
  SessionManager.setMFAVerified();
  _clearOTPState();
  startSessionTimeout();

  pendingMFAUser = null;
  return { success: true, user: firebaseUser };
}

/* ─────────────────────────────────────────────
   12. RESEND OTP
───────────────────────────────────────────── */
async function resendOTP() {
  // pendingMFAUser may be null after a page refresh; fall back to stored email
  const email = pendingMFAUser
    ? pendingMFAUser.email
    : sessionStorage.getItem(AUTH_CONFIG.MFA_EMAIL_KEY);
  if (!email) return { success: false, error: 'No pending MFA session. Please log in again.' };
  const otp = OTPManager.generate();
  await sendOTPEmail(email, otp);
  return { success: true };
}

/* ─────────────────────────────────────────────
   13. SIMULATED OTP EMAIL (Demo)
   In production: use Firebase Cloud Functions
   + a mail service (SendGrid / Mailgun).
   Here we simulate with a visible on-screen
   notification for testing purposes.
───────────────────────────────────────────── */
async function sendOTPEmail(email, otp) {
  console.log(`[SecureAuth] OTP for ${email}: ${otp}`);

  // If the user has configured EmailJS credentials, dispatch a real email!
  if (window.emailjsConfig && window.emailjsConfig.publicKey) {
    try {
      emailjs.init({
        publicKey: window.emailjsConfig.publicKey
      });

      await emailjs.send(
        window.emailjsConfig.serviceId,
        window.emailjsConfig.templateId,
        {
          email: email,       // Matches {{email}} in "To Email"
          passcode: otp,      // Matches {{passcode}} in message body
          time: "5 minutes"   // Added to match {{time}} in their template
        }
      );

      console.log(`[SecureAuth] Live MFA email dispatched successfully to ${email}!`);
      // Don't show the OTP on screen, just a success message that it was sent!
      showSecurityBanner(`📧 A real MFA OTP verification code has been sent to: ${email}!`, 'success', 8000);
      return; // Exit here if successful
    } catch (err) {
      console.error("[SecureAuth] Live email dispatch failed:", err);
      // If it fails, fall through to the demo banner below
    }
  }

  // Fallback: If no EmailJS config or if email sending failed, show the demo OTP on screen
  showSecurityBanner(
    `📧 (Demo Mode) OTP Sent to ${email}. <strong>Demo OTP: ${otp}</strong> (expires in 5 min)`,
    'info',
    15000
  );
}

/* ─────────────────────────────────────────────
   14. PASSWORD STRENGTH CHECKER
───────────────────────────────────────────── */
function checkPasswordStrength(password) {
  let score = 0;
  const feedback = [];
  if (password.length >= 8) score++; else feedback.push('at least 8 characters');
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++; else feedback.push('an uppercase letter');
  if (/[a-z]/.test(password)) score++; else feedback.push('a lowercase letter');
  if (/[0-9]/.test(password)) score++; else feedback.push('a number');
  if (/[^A-Za-z0-9]/.test(password)) score++; else feedback.push('a special character');

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];
  const idx = Math.min(score, 5);
  return {
    score,
    label: labels[idx],
    color: colors[idx],
    percent: Math.round((score / 6) * 100),
    feedback: feedback.length ? `Need: ${feedback.join(', ')}.` : 'Strong password!'
  };
}

/* ─────────────────────────────────────────────
   15. SECURITY BANNER
───────────────────────────────────────────── */
function showSecurityBanner(message, type = 'info', duration = 6000) {
  let banner = document.getElementById('security-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'security-banner';
    banner.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 9999; padding: 14px 24px; border-radius: 12px;
      font-family: Inter, sans-serif; font-size: 0.9rem; font-weight: 500;
      max-width: 520px; width: 90%; text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2); backdrop-filter: blur(12px);
      transition: all 0.3s ease; display: flex; align-items: center; gap: 10px;
      justify-content: center; animation: slideDown 0.3s ease;
    `;
    document.body.appendChild(banner);
  }

  const colors = {
    info:    'rgba(14,165,233,0.95)',
    warning: 'rgba(234,179,8,0.95)',
    error:   'rgba(239,68,68,0.95)',
    success: 'rgba(34,197,94,0.95)',
  };
  banner.style.background = colors[type] || colors.info;
  banner.style.color = type === 'warning' ? '#1a1a1a' : '#fff';
  banner.innerHTML = message;
  banner.style.display = 'flex';
  banner.style.opacity = '1';

  clearTimeout(banner._timeout);
  banner._timeout = setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => (banner.style.display = 'none'), 300);
  }, duration);
}

/* ─────────────────────────────────────────────
   16. SECURE DATA ENCRYPTION HELPERS
   (For storing sensitive data in Firestore/LS)
───────────────────────────────────────────── */
async function encryptUserData(data) {
  return await CryptoUtils.encrypt(JSON.stringify(data));
}

async function decryptUserData(ciphertext) {
  const plain = await CryptoUtils.decrypt(ciphertext);
  if (!plain) return null;
  try { return JSON.parse(plain); } catch { return null; }
}

/* ─────────────────────────────────────────────
   17. EXPOSE TO GLOBAL SCOPE
───────────────────────────────────────────── */
// Helper: true when a valid OTP exists in sessionStorage AND MFA isn't done yet
function hasPendingMFA() {
  return OTPManager.hasPendingOTP() && !SessionManager.isMFAVerified();
}

window.SecureAuth = {
  secureLogin,
  secureSignUp,
  verifyMFAOTP,
  resendOTP,
  performSecureLogout,
  checkPasswordStrength,
  encryptUserData,
  decryptUserData,
  showSecurityBanner,
  RateLimiter,
  SessionManager,
  OTPManager,
  resetSessionTimeout,
  hasPendingMFA,
  // Exposed so the UI layer can wipe OTP state on cancel
  _clearOTPState,
};

console.log('[SecureAuth] Secure authentication module loaded ✓');
