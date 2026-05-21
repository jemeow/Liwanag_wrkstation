// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbU_yDR9E8v49qDssp1jTl-d_YLnzetZ0",
  authDomain: "ias-project-5759f.firebaseapp.com",
  databaseURL:
    "https://ias-project-5759f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ias-project-5759f",
  storageBucket: "ias-project-5759f.firebasestorage.app",
  messagingSenderId: "190225526938",
  appId: "1:190225526938:web:abe97cfd43707e5f75ef23",
  measurementId: "G-QPZQTPFE2C",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// LIVE MFA EMAIL CONFIGURATION (EmailJS Integration)
// To send actual emails to your inbox for MFA OTP codes:
// 1. Sign up for a free account at https://www.emailjs.com
// 2. Connect an Email service (e.g. Gmail) to get a Service ID
// 3. Create an Email Template with subject and message containing {{otp_code}}
// 4. Copy your Public Key, Service ID, and Template ID below
// ============================================================
window.emailjsConfig = {
  publicKey: "Y6lF7woEHyKLCErJo", // ✅ EmailJS Public Key
  serviceId: "service_18aauxq", // ✅ EmailJS Service ID
  templateId: "template_a4djzmp", // ✅ EmailJS Template ID
};
