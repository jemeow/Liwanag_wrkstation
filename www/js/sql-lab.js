// ============================================================
// SQL-LAB.JS - Simulated DVWA Backend
// Simulates SQL Injection vulnerabilities using AlaSQL
// ============================================================

"use strict";

let isSecureMode = false;

// Initialize AlaSQL Database
alasql("CREATE TABLE users (id INT, username STRING, password STRING, secret_flag STRING)");
alasql("INSERT INTO users VALUES (1, 'admin', 'SuperSecretAdminP@ss123!', 'FLAG{SQLi_M4st3r_Admin_Byp4ss}')");
alasql("INSERT INTO users VALUES (2, 'student', 'password123', 'FLAG{Student_Data_L3ak}')");

function logToConsole(message, type = "info") {
  const consoleEl = document.getElementById("lab-console");
  let color = "#a3e635"; // default green
  if (type === "error") color = "#f87171"; // red
  if (type === "warning") color = "#fbbf24"; // yellow
  if (type === "success") color = "#38bdf8"; // blue

  const line = document.createElement("div");
  line.style.color = color;
  line.innerText = `> ${message}`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function updateSecurityLevel() {
  const level = document.getElementById("security-level").value;
  const btn = document.getElementById("submit-btn");
  
  if (level === "secure") {
    isSecureMode = true;
    btn.className = "btn btn-secure";
    logToConsole("[CONFIG] Security Level set to SECURE (Prepared Statements).", "warning");
  } else {
    isSecureMode = false;
    btn.className = "btn btn-vuln";
    logToConsole("[CONFIG] Security Level set to VULNERABLE (Raw Concatenation).", "error");
  }
  updatePreview();
}

function updatePreview() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  const preview = document.getElementById("query-preview");

  if (isSecureMode) {
    preview.innerHTML = `<span style="color: #cbd5e1;">SELECT * FROM users WHERE username =</span> <span style="color: #a3e635;">?</span> <span style="color: #cbd5e1;">AND password =</span> <span style="color: #a3e635;">?</span><br><br><span style="color: #94a3b8; font-size: 0.8rem;">Params: ["${user.replace(/"/g, '&quot;')}", "${pass.replace(/"/g, '&quot;')}"]</span>`;
  } else {
    preview.innerHTML = `<span style="color: #cbd5e1;">SELECT * FROM users WHERE username = '</span><span style="color: #ef4444;">${user.replace(/</g, '&lt;')}</span><span style="color: #cbd5e1;">' AND password = '</span><span style="color: #ef4444;">${pass.replace(/</g, '&lt;')}</span><span style="color: #cbd5e1;">'</span>`;
  }
}

function executeLogin(e) {
  e.preventDefault();
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  logToConsole(`[REQ] Incoming login request for user: ${user}`);

  try {
    let result;
    if (isSecureMode) {
      // SECURE: Parameterized Query
      // AlaSQL handles parameterized queries via ? and passing an array of parameters.
      // This neutralizes the SQL injection by treating the input strictly as data strings.
      result = alasql("SELECT * FROM users WHERE username = ? AND password = ?", [user, pass]);
    } else {
      // VULNERABLE: Direct string concatenation
      // Notice how the user input is directly dumped into the query string.
      const rawQuery = `SELECT * FROM users WHERE username = '${user}' AND password = '${pass}'`;
      logToConsole(`[DB] Executing Raw Query: ${rawQuery}`, "warning");
      result = alasql(rawQuery);
    }

    // Process Result
    if (result && result.length > 0) {
      logToConsole("[AUTH] SUCCESS: Database returned matching records.", "success");
      
      if (result.length > 1) {
         logToConsole(`[!] CRITICAL: Query returned ${result.length} user records! SQL Injection payload bypassed authentication boundaries!`, "error");
      }

      // Dump Extracted Data
      result.forEach(row => {
        logToConsole(`[DATA EXFIL] Logged in as ID ${row.id} (${row.username}). Extracted Secret: ${row.secret_flag}`, "error");
      });

    } else {
      logToConsole("[AUTH] FAILED: Invalid credentials or empty result set.", "warning");
    }

  } catch (error) {
    // If the payload causes an SQL syntax error, catch it to simulate backend crashing/logging
    logToConsole(`[DB ERROR] SQL Syntax Exception: ${error.message}`, "error");
  }
}

// Initial preview render
updatePreview();
