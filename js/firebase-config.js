// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbU_yDR9E8v49qDssp1jTl-d_YLnzetZ0",
  authDomain: "ias-project-5759f.firebaseapp.com",
  databaseURL: "https://ias-project-5759f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ias-project-5759f",
  storageBucket: "ias-project-5759f.firebasestorage.app",
  messagingSenderId: "190225526938",
  appId: "1:190225526938:web:abe97cfd43707e5f75ef23",
  measurementId: "G-QPZQTPFE2C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
