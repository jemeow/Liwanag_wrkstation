// ============================================================
// SECURITY-PORTAL.JS  —  Liwanag Security Policy & Incident Response Portal
// Lab Activity: Security Policies, Compliance Audits & Incident Response
// Handles: Interactive policies, mock firewall, RBAC simulator,
//          compliance scanner, and active incident response simulation.
// ============================================================

'use strict';

// ─── Core State for Security Portal ───
const SecurityPortalState = {
  activeTab: 'policies',
  currentRole: 'Admin', // Default simulated role
  policies: {
    minPasswordLength: 8,
    requireSpecialChars: true,
    requireNumeric: true,
    lockoutAfterFailedAttempts: 5,
    enforceAESGCM: true
  },
  firewallRules: [
    { ip: 'ANY', port: '443', protocol: 'TCP', action: 'ALLOW', description: 'HTTPS Data in Transit' },
    { ip: 'ANY', port: '80', protocol: 'TCP', action: 'DENY', description: 'HTTP Plaintext Block' },
    { ip: '10.0.0.12', port: '22', protocol: 'TCP', action: 'ALLOW', description: 'Secure SSH Administration' }
  ],
  auditRunning: false,
  logs: []
};

// ─── Initialize Portal ───
document.addEventListener('DOMContentLoaded', () => {
  // Add Security Tab in Sidebar (if not already there)
  injectSecurityNav();
  
  // Add Security Panel in Main Dashboard
  injectSecurityPanel();

  // Add event listener for general user activity to log
  logSecurityEvent('SYSTEM', 'Security Management Console initialized successfully.');
  
  // Trigger initial UI render
  renderSecurityPortal();
  
  // Apply initial role restrictions
  applyRBACRestrictions();
});

// ─── Inject Navigation & Panel ───
function injectSecurityNav() {
  const navList = document.querySelector('.nav-list');
  if (navList && !document.getElementById('nav-security')) {
    const securityLi = document.createElement('li');
    securityLi.innerHTML = `
      <button id="nav-security" class="nav-item" onclick="switchPanel('security')">
        <i class="fas fa-shield-alt" style="color: var(--sky-500);"></i>
        <span>Security</span>
      </button>
    `;
    navList.appendChild(securityLi);
  }
}

function injectSecurityPanel() {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent || document.getElementById('panel-security')) return;

  const securityDiv = document.createElement('div');
  securityDiv.id = 'panel-security';
  securityDiv.className = 'panel';
  securityDiv.innerHTML = `
    <div class="panel-header">
      <h2><i class="fas fa-shield-alt"></i> Security & Compliance Center</h2>
      <p>Configure security controls, conduct compliance audits, and manage active incident responses.</p>
    </div>

    <!-- Security Tabs -->
    <div class="security-tabs glass-card" style="display: flex; gap: 8px; padding: 6px; margin-bottom: 20px; border-radius: var(--radius-sm);">
      <button class="sec-tab active" onclick="switchSecurityTab('policies')"><i class="fas fa-file-contract"></i> Policies & Controls</button>
      <button class="sec-tab" onclick="switchSecurityTab('rbac')"><i class="fas fa-users-cog"></i> RBAC Simulator</button>
      <button class="sec-tab" onclick="switchSecurityTab('audit')"><i class="fas fa-clipboard-check"></i> Compliance Audit</button>
      <button class="sec-tab" onclick="switchSecurityTab('incident')"><i class="fas fa-biohazard"></i> Incident Response</button>
    </div>

    <!-- Tab Contents -->
    <div id="security-tab-content">
      <!-- Generated Dynamically -->
    </div>
  `;
  mainContent.appendChild(securityDiv);
  
  // Append basic styling
  const style = document.createElement('style');
  style.textContent = `
    .sec-tab {
      flex: 1; padding: 10px 14px; border-radius: var(--radius-xs);
      font-size: 0.88rem; font-weight: 600; color: var(--gray-600);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: var(--transition); cursor: pointer;
    }
    .sec-tab.active {
      background: var(--sky-500); color: white;
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
    }
    [data-theme="dark"] .sec-tab.active { background: var(--sky-400); }
    .sec-tab:hover:not(.active) { background: rgba(14, 165, 233, 0.08); color: var(--sky-600); }
    
    .security-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .security-card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .policy-toggle-group { display: flex; flex-direction: column; gap: 12px; }
    .policy-toggle-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--gray-100); }
    
    /* Monospace Console */
    .security-console {
      background: #090d16; color: #38bdf8; font-family: 'Courier New', monospace;
      padding: 14px; border-radius: var(--radius-sm); font-size: 0.82rem;
      min-height: 200px; max-height: 300px; overflow-y: auto;
      border: 1px solid #1e293b; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
      line-height: 1.5; margin-top: 10px;
    }
    
    /* Firewall Table */
    .fw-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
    .fw-table th, .fw-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--gray-200); }
    .fw-table th { font-weight: 700; color: var(--gray-700); background: rgba(14, 165, 233, 0.05); }
    
    .badge-allow { background: rgba(34, 197, 94, 0.15); color: #16a34a; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; }
    .badge-deny { background: rgba(239, 68, 68, 0.15); color: var(--danger); padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; }
    
    /* Progress bar */
    .audit-progress-track { width: 100%; height: 8px; background: var(--gray-100); border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .audit-progress-bar { height: 100%; width: 0%; background: var(--sky-500); transition: width 0.3s; }
  `;
  document.head.appendChild(style);
}

// ─── Tab Switching ───
window.switchSecurityTab = function(tabId) {
  SecurityPortalState.activeTab = tabId;
  document.querySelectorAll('.sec-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabId));
  });
  renderSecurityPortal();
};

// ─── Main Render Engine ───
function renderSecurityPortal() {
  const contentDiv = document.getElementById('security-tab-content');
  if (!contentDiv) return;

  const tab = SecurityPortalState.activeTab;

  if (tab === 'policies') {
    renderPoliciesTab(contentDiv);
  } else if (tab === 'rbac') {
    renderRbacTab(contentDiv);
  } else if (tab === 'audit') {
    renderAuditTab(contentDiv);
  } else if (tab === 'incident') {
    renderIncidentTab(contentDiv);
  }
}

// ─── Render Policies Tab ───
function renderPoliciesTab(container) {
  container.innerHTML = `
    <div class="security-grid">
      <!-- Security Objectives & Scope -->
      <div class="security-card glass-card">
        <h3 style="color: var(--sky-600);"><i class="fas fa-bullseye"></i> Security Objectives & Scope</h3>
        <p style="font-size: 0.88rem; color: var(--gray-600); line-height: 1.6;">
          This student workstation implements structural cybersecurity controls aligned with international data security regulatory frameworks:
        </p>
        <ul style="font-size: 0.82rem; color: var(--gray-600); display: flex; flex-direction: column; gap: 8px; padding-left: 16px; list-style-type: disc;">
          <li><strong>GDPR (Data Minimization):</strong> Strictly isolating local workspace resources (Tasks, Notes, Flashcards) per user context and encrypting local data.</li>
          <li><strong>HIPAA (Encryption at Rest):</strong> Enabling fully integrated client-side cryptographic encryption to secure local work files.</li>
          <li><strong>Least Privilege:</strong> Restricting system configuration controls strictly based on simulated user permissions (RBAC).</li>
        </ul>
      </div>

      <!-- Password & Data Policy Configuration -->
      <div class="security-card glass-card">
        <h3 style="color: var(--sky-600);"><i class="fas fa-key"></i> Policy Enforcement Panel</h3>
        <div class="policy-toggle-group">
          <div class="policy-toggle-item">
            <span style="font-size: 0.88rem; font-weight: 500;">Min Password Length (8+ chars)</span>
            <input type="checkbox" checked disabled />
          </div>
          <div class="policy-toggle-item">
            <span style="font-size: 0.88rem; font-weight: 500;">Require Special Characters</span>
            <label class="theme-switch" for="policy-special">
              <input type="checkbox" id="policy-special" ${SecurityPortalState.policies.requireSpecialChars ? 'checked' : ''} onchange="togglePolicy('requireSpecialChars', this.checked)" />
              <div class="slider round"></div>
            </label>
          </div>
          <div class="policy-toggle-item">
            <span style="font-size: 0.88rem; font-weight: 500;">Require Numeric Characters</span>
            <label class="theme-switch" for="policy-numeric">
              <input type="checkbox" id="policy-numeric" ${SecurityPortalState.policies.requireNumeric ? 'checked' : ''} onchange="togglePolicy('requireNumeric', this.checked)" />
              <div class="slider round"></div>
            </label>
          </div>
          <div class="policy-toggle-item">
            <span style="font-size: 0.88rem; font-weight: 500;">AES-GCM Encryption (Data at Rest)</span>
            <label class="theme-switch" for="policy-aes">
              <input type="checkbox" id="policy-aes" ${SecurityPortalState.policies.enforceAESGCM ? 'checked' : ''} onchange="togglePolicy('enforceAESGCM', this.checked)" />
              <div class="slider round"></div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Local Firewall Policies -->
    <div class="security-card glass-card" style="margin-top: 20px;">
      <h3 style="color: var(--sky-600);"><i class="fas fa-network-wired"></i> Local Firewall Rules (ACL)</h3>
      <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 12px;">
        Enforce strict network communication boundaries. Unencrypted http traffic (Port 80) is actively blocked to prevent eavesdropping.
      </p>
      
      <!-- Rules Table -->
      <table class="fw-table">
        <thead>
          <tr>
            <th>IP Address</th>
            <th>Port</th>
            <th>Protocol</th>
            <th>Action</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody id="fw-rules-body">
          ${SecurityPortalState.firewallRules.map(r => `
            <tr>
              <td><code>${r.ip}</code></td>
              <td><code>${r.port}</code></td>
              <td><code>${r.protocol}</code></td>
              <td><span class="${r.action === 'ALLOW' ? 'badge-allow' : 'badge-deny'}">${r.action}</span></td>
              <td>${r.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Add Rule Input Form -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px;">
        <input type="text" id="fw-ip" placeholder="IP Address (e.g. 192.168.1.100)" style="flex: 2; padding: 8px 12px; font-size: 0.85rem; border: 1px solid var(--gray-200); border-radius: var(--radius-xs); background: var(--input-bg); color: var(--gray-800);" />
        <input type="text" id="fw-port" placeholder="Port" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; border: 1px solid var(--gray-200); border-radius: var(--radius-xs); background: var(--input-bg); color: var(--gray-800);" />
        <select id="fw-proto" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; border: 1px solid var(--gray-200); border-radius: var(--radius-xs); background: var(--input-bg); color: var(--gray-800);">
          <option>TCP</option>
          <option>UDP</option>
          <option>ICMP</option>
        </select>
        <select id="fw-action" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; border: 1px solid var(--gray-200); border-radius: var(--radius-xs); background: var(--input-bg); color: var(--gray-800);">
          <option value="ALLOW">ALLOW</option>
          <option value="DENY">DENY</option>
        </select>
        <button class="btn btn-primary" onclick="addFirewallRule()" style="padding: 8px 16px; font-size: 0.85rem; font-weight: 600;"><i class="fas fa-plus"></i> Add Rule</button>
      </div>
    </div>
  `;
}

// ─── Render RBAC Tab ───
function renderRbacTab(container) {
  container.innerHTML = `
    <div class="security-card glass-card">
      <h3 style="color: var(--sky-600);"><i class="fas fa-users-cog"></i> Role-Based Access Control (RBAC) Simulator</h3>
      <p style="font-size: 0.88rem; color: var(--gray-600); line-height: 1.6; margin-bottom: 12px;">
        To demonstrate the principle of **least privilege**, switch your simulated authorization role below. Switch to <strong>Guest</strong> or <strong>Student</strong>, and click any navigation button in the left sidebar (such as "Security" or "Calendar") to witness active application-level RBAC policy restriction.
      </p>

      <div style="display: flex; align-items: center; gap: 14px; background: rgba(14, 165, 233, 0.05); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 20px; border: 1px solid rgba(14, 165, 233, 0.1);">
        <span style="font-weight: 700; font-size: 0.9rem; color: var(--gray-800);"><i class="fas fa-user-shield"></i> Active Simulated Role:</span>
        <select id="rbac-role-select" onchange="simulateRoleChange(this.value)" style="padding: 8px 16px; font-weight: 600; font-size: 0.9rem; border: 2px solid var(--sky-400); border-radius: var(--radius-xs); background: var(--input-bg); color: var(--sky-600); cursor: pointer; outline: none;">
          <option value="Admin" ${SecurityPortalState.currentRole === 'Admin' ? 'selected' : ''}>Admin (Full Access)</option>
          <option value="Student" ${SecurityPortalState.currentRole === 'Student' ? 'selected' : ''}>Student (Partial Access)</option>
          <option value="Guest" ${SecurityPortalState.currentRole === 'Guest' ? 'selected' : ''}>Guest (Least Privilege / Focus Only)</option>
        </select>
      </div>

      <h4 style="margin-bottom: 8px; color: var(--gray-700);">Active Privilege Matrix:</h4>
      <table class="fw-table" style="margin-top: 0;">
        <thead>
          <tr>
            <th>Module Name</th>
            <th>Required Role</th>
            <th>Access Status for ${SecurityPortalState.currentRole}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Home / Dashboard</strong></td>
            <td>Guest, Student, Admin</td>
            <td><span class="badge-allow">GRANTED</span></td>
          </tr>
          <tr>
            <td><strong>Pomodoro Timer</strong></td>
            <td>Guest, Student, Admin</td>
            <td><span class="badge-allow">GRANTED</span></td>
          </tr>
          <tr>
            <td><strong>Tasks, Notes, Flashcards, Calendar</strong></td>
            <td>Student, Admin</td>
            <td>${['Student', 'Admin'].includes(SecurityPortalState.currentRole) ? '<span class="badge-allow">GRANTED</span>' : '<span class="badge-deny">DENIED (Guest Restricted)</span>'}</td>
          </tr>
          <tr>
            <td><strong>Quizzes</strong></td>
            <td>Student, Admin</td>
            <td>${['Student', 'Admin'].includes(SecurityPortalState.currentRole) ? '<span class="badge-allow">GRANTED</span>' : '<span class="badge-deny">DENIED (Guest Restricted)</span>'}</td>
          </tr>
          <tr>
            <td><strong>Security Portal</strong></td>
            <td>Admin</td>
            <td>${SecurityPortalState.currentRole === 'Admin' ? '<span class="badge-allow">GRANTED</span>' : '<span class="badge-deny">DENIED (Admin Required)</span>'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// ─── Render Compliance Audit Tab ───
window.runComplianceAudit = function() {
  if (SecurityPortalState.auditRunning) return;
  SecurityPortalState.auditRunning = true;
  
  const scanBtn = document.getElementById('btn-run-audit');
  const progressTrack = document.getElementById('audit-progress-track');
  const progressBar = document.getElementById('audit-progress-bar');
  const resultsDiv = document.getElementById('audit-results');
  
  if (scanBtn) { scanBtn.disabled = true; scanBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Auditing...`; }
  if (progressTrack) progressTrack.style.display = 'block';
  if (resultsDiv) resultsDiv.innerHTML = '';
  
  logSecurityEvent('AUDIT', 'Security Compliance Audit initiated.');
  
  let percent = 0;
  const interval = setInterval(() => {
    percent += 10;
    if (progressBar) progressBar.style.width = percent + '%';
    
    if (percent === 30) logSecurityEvent('AUDIT', 'Scanning active network interfaces and local firewall config...');
    if (percent === 60) logSecurityEvent('AUDIT', 'Analyzing active session token structure and MFA flags...');
    if (percent === 80) logSecurityEvent('AUDIT', 'Testing local storage databases for active encryption layers...');

    if (percent >= 100) {
      clearInterval(interval);
      SecurityPortalState.auditRunning = false;
      if (scanBtn) { scanBtn.disabled = false; scanBtn.innerHTML = `<i class="fas fa-clipboard-check"></i> Run Compliance Audit`; }
      renderAuditResults(resultsDiv);
      logSecurityEvent('AUDIT', 'Audit complete. Policy compliance checklist compiled.');
    }
  }, 200);
};

function renderAuditResults(container) {
  const isMfaActive = SecureAuth.SessionManager.isMFAVerified();
  const isAesActive = SecurityPortalState.policies.enforceAESGCM;
  const isSpecialRequired = SecurityPortalState.policies.requireSpecialChars;

  let passedCount = 3; // Basic HTTPS, Timeout, and rate limiter always pass here
  if (isMfaActive) passedCount++;
  if (isAesActive) passedCount++;
  if (isSpecialRequired) passedCount++;
  
  const score = Math.round((passedCount / 6) * 100);

  container.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; padding: 16px; background: rgba(14, 165, 233, 0.05); border-radius: var(--radius-sm); border: 1px solid rgba(14, 165, 233, 0.1); margin-top: 20px;">
      <div style="font-size: 2.2rem; font-weight: 800; color: ${score >= 80 ? '#16a34a' : 'var(--danger)'};">${score}%</div>
      <div>
        <h4 style="color: var(--gray-800);">System Security Score (OpenVAS Standard)</h4>
        <p style="font-size: 0.8rem; color: var(--gray-500);">${passedCount} of 6 essential compliance policies actively passing.</p>
      </div>
    </div>

    <!-- Audited Items Checklist -->
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 18px;">
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;"><i class="fas fa-shield-alt" style="color: #16a34a; margin-right: 6px;"></i> In-Transit Security: Local HTTPS/SSL Enforced</span>
        <span class="badge-allow">PASSED</span>
      </div>
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;"><i class="fas fa-shield-alt" style="color: #16a34a; margin-right: 6px;"></i> Session Handling: 30-Min Idle Auto-Logout Enabled</span>
        <span class="badge-allow">PASSED</span>
      </div>
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;"><i class="fas fa-shield-alt" style="color: #16a34a; margin-right: 6px;"></i> Brute-Force Shield: Lockout Policy Enforced</span>
        <span class="badge-allow">PASSED</span>
      </div>
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;">
          <i class="${isMfaActive ? 'fas fa-shield-alt' : 'fas fa-exclamation-triangle'}" style="color: ${isMfaActive ? '#16a34a' : 'var(--danger)'}; margin-right: 6px;"></i> 
          MFA Authentication Policy (Two-Factor OTP)
        </span>
        <span>${isMfaActive ? '<span class="badge-allow">PASSED</span>' : '<span class="badge-deny">WARNING (MFA BYPASS DETECTED)</span>'}</span>
      </div>
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;">
          <i class="${isAesActive ? 'fas fa-shield-alt' : 'fas fa-exclamation-triangle'}" style="color: ${isAesActive ? '#16a34a' : 'var(--danger)'}; margin-right: 6px;"></i> 
          Cryptographic Protection: AES-GCM Encrypted Notes Storage
        </span>
        <span>${isAesActive ? '<span class="badge-allow">PASSED</span>' : '<span class="badge-deny">WARNING (PLAINTEXT STORAGE RISK)</span>'}</span>
      </div>
      <div class="policy-toggle-item">
        <span style="font-size: 0.88rem; font-weight: 500;">
          <i class="${isSpecialRequired ? 'fas fa-shield-alt' : 'fas fa-exclamation-triangle'}" style="color: ${isSpecialRequired ? '#16a34a' : 'var(--danger)'}; margin-right: 6px;"></i> 
          Complexity Controls: Require Special Characters in passwords
        </span>
        <span>${isSpecialRequired ? '<span class="badge-allow">PASSED</span>' : '<span class="badge-deny">WARNING (WEAK COMPLEXITY POLICY)</span>'}</span>
      </div>
    </div>

    <!-- Suggested Improvements -->
    <div style="margin-top: 18px; padding: 14px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-sm);">
      <h4 style="color: var(--gold-500); margin-bottom: 6px;"><i class="fas fa-lightbulb"></i> Recommended Security Policy Adjustments</h4>
      <ul style="font-size: 0.8rem; color: var(--gray-600); display: flex; flex-direction: column; gap: 6px; padding-left: 14px; list-style-type: disc;">
        ${!isMfaActive ? '<li><strong>Enforce Mandatory MFA:</strong> Switch verification on inside security options to mitigate account takeover attacks.</li>' : ''}
        ${!isAesActive ? '<li><strong>Enable AES-GCM Encryption:</strong> Plaintext notes are susceptible to direct database scanning. Toggle Encryption on.</li>' : ''}
        <li><strong>Credential Rotation:</strong> Establish an organizational policy forcing a password update every 90 days.</li>
      </ul>
    </div>
  `;
}

function renderAuditTab(container) {
  container.innerHTML = `
    <div class="security-card glass-card">
      <h3 style="color: var(--sky-600);"><i class="fas fa-clipboard-check"></i> Security Compliance Auditing</h3>
      <p style="font-size: 0.88rem; color: var(--gray-600); line-height: 1.6; margin-bottom: 12px;">
        Conduct deep automated compliance assessments aligned with HIPAA, GDPR, and localized workstation security guidelines.
      </p>

      <button id="btn-run-audit" class="btn btn-primary" onclick="runComplianceAudit()" style="padding: 10px 20px; font-weight: 600;"><i class="fas fa-clipboard-check"></i> Run Compliance Audit</button>

      <!-- Progress Track -->
      <div id="audit-progress-track" class="audit-progress-track" style="display: none;">
        <div id="audit-progress-bar" class="audit-progress-bar"></div>
      </div>

      <!-- Audit Results Container -->
      <div id="audit-results">
        <!-- Rendered after audit -->
        <p style="text-align: center; color: var(--gray-400); font-size: 0.85rem; margin-top: 30px;">Click the button above to run an active security scan.</p>
      </div>
    </div>
  `;
}

// ─── Render Incident Response Tab ───
function renderIncidentTab(container) {
  container.innerHTML = `
    <div class="security-grid">
      <!-- Breach Simulator Console -->
      <div class="security-card glass-card" style="flex: 2;">
        <h3 style="color: var(--sky-600);"><i class="fas fa-terminal"></i> Security Events Console (Logs)</h3>
        <p style="font-size: 0.82rem; color: var(--gray-500); margin-bottom: 6px;">Real-time event logging capturing authorization requests, breaches, and automatic blocks.</p>
        
        <div id="security-console" class="security-console">
          <!-- Live events populate here -->
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
          <button class="btn btn-danger" onclick="simulateBreach('bruteforce')" style="font-size: 0.82rem; padding: 8px 12px;"><i class="fas fa-fire"></i> Simulate Brute Force Attack</button>
          <button class="btn btn-accent" onclick="simulateBreach('intrusion')" style="font-size: 0.82rem; padding: 8px 12px;"><i class="fas fa-shield-virus"></i> Simulate DB Intrusion Attempt</button>
          <button class="btn" onclick="clearSecurityConsole()" style="font-size: 0.82rem; padding: 8px 12px; border: 1px solid var(--gray-300);"><i class="fas fa-trash"></i> Clear Console</button>
        </div>
      </div>

      <!-- Playbook Info -->
      <div class="security-card glass-card" style="flex: 1.5;">
        <h3 style="color: var(--sky-600);"><i class="fas fa-shield-alt"></i> Incident Response Playbook</h3>
        <div style="font-size: 0.82rem; color: var(--gray-600); display: flex; flex-direction: column; gap: 10px; line-height: 1.5;">
          <div><strong>1. Preparation:</strong> Enforce rate-limits and password policies before an attack occurs.</div>
          <div><strong>2. Identification:</strong> Actively monitoring logs in the Events Console to detect abnormal behavior (e.g. 5+ failed attempts).</div>
          <div><strong>3. Containment:</strong> Automatically blacklist the source host (updating Firewall rules dynamically) and terminate the compromised session.</div>
          <div><strong>4. Eradication:</strong> Clean security keys, remove infected inputs, and patch the exploit.</div>
          <div><strong>5. Recovery:</strong> Re-establish operations and restore encrypted data layers.</div>
          <div><strong>6. Lessons Learned:</strong> Refine rules (e.g., adding rules permanently).</div>
        </div>
      </div>
    </div>
  `;
  updateSecurityConsoleUI();
}

// ─── Toggles & Controls ───
window.togglePolicy = function(policyKey, isChecked) {
  SecurityPortalState.policies[policyKey] = isChecked;
  logSecurityEvent('POLICY', `Configuration rule changed: ${policyKey} set to ${isChecked}.`);
  
  // If toggled AES GCM, hook encryption warning
  if (policyKey === 'enforceAESGCM') {
    if (isChecked) {
      logSecurityEvent('ENCRYPTION', 'AES-GCM WebCrypto 128-bit key verified. Data writing marked secure.');
    } else {
      logSecurityEvent('ENCRYPTION', 'WARNING: Cryptographic protections disabled! Notes saving in plaintext format.');
    }
  }
};

window.addFirewallRule = function() {
  const ip = document.getElementById('fw-ip')?.value.trim();
  const port = document.getElementById('fw-port')?.value.trim() || 'ANY';
  const proto = document.getElementById('fw-proto')?.value;
  const action = document.getElementById('fw-action')?.value;

  if (!ip) return;

  SecurityPortalState.firewallRules.push({
    ip, port, protocol: proto, action, description: 'Custom User Configured ACL'
  });

  logSecurityEvent('FIREWALL', `ACL Rule dynamically inserted: ${action} ${proto} traffic on Port ${port} for IP ${ip}.`);
  renderSecurityPortal();
};

// ─── RBAC Controls ───
window.simulateRoleChange = function(newRole) {
  SecurityPortalState.currentRole = newRole;
  logSecurityEvent('RBAC', `Authorization context switched to role: ${newRole}.`);
  
  applyRBACRestrictions();
  renderSecurityPortal();
};

function applyRBACRestrictions() {
  const role = SecurityPortalState.currentRole;
  
  // Define menu items
  const menuHome = document.getElementById('nav-home');
  const menuPomo = document.getElementById('nav-pomodoro');
  const menuTasks = document.getElementById('nav-tasks');
  const menuNotes = document.getElementById('nav-notes');
  const menuCards = document.getElementById('nav-flashcards');
  const menuQuiz = document.getElementById('nav-quizzes');
  const menuCal = document.getElementById('nav-calendar');
  const menuSec = document.getElementById('nav-security');

  // Helper to restrict/permit item
  const updateItem = (el, isPermitted) => {
    if (!el) return;
    if (isPermitted) {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.removeAttribute('title');
    } else {
      el.style.opacity = '0.4';
      // Hook action to show denied alert
      el.style.pointerEvents = 'auto'; 
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        SecureAuth.showSecurityBanner(`🚫 RBAC Access Denied: Role "${role}" lacks access permissions!`, 'error');
        logSecurityEvent('SECURITY VIOLATION', `Unauthorized navigation attempt to protected module blocked for role "${role}".`);
      };
    }
  };

  if (role === 'Admin') {
    // Admins can do everything
    updateItem(menuHome, true); menuHome.onclick = () => switchPanel('home');
    updateItem(menuPomo, true); menuPomo.onclick = () => switchPanel('pomodoro');
    updateItem(menuTasks, true); menuTasks.onclick = () => switchPanel('tasks');
    updateItem(menuNotes, true); menuNotes.onclick = () => switchPanel('notes');
    updateItem(menuCards, true); menuCards.onclick = () => switchPanel('flashcards');
    updateItem(menuQuiz, true); menuQuiz.onclick = () => switchPanel('quizzes');
    updateItem(menuCal, true); menuCal.onclick = () => switchPanel('calendar');
    updateItem(menuSec, true); menuSec.onclick = () => switchPanel('security');
  } 
  else if (role === 'Student') {
    // Students cannot access security page, but can access others
    updateItem(menuHome, true); menuHome.onclick = () => switchPanel('home');
    updateItem(menuPomo, true); menuPomo.onclick = () => switchPanel('pomodoro');
    updateItem(menuTasks, true); menuTasks.onclick = () => switchPanel('tasks');
    updateItem(menuNotes, true); menuNotes.onclick = () => switchPanel('notes');
    updateItem(menuCards, true); menuCards.onclick = () => switchPanel('flashcards');
    updateItem(menuQuiz, true); menuQuiz.onclick = () => switchPanel('quizzes');
    updateItem(menuCal, true); menuCal.onclick = () => switchPanel('calendar');
    
    // Lock Security
    updateItem(menuSec, false);
    
    // Force home if currently on locked page
    const activePanel = document.querySelector('.panel.active');
    if (activePanel && activePanel.id === 'panel-security') {
      switchPanel('home');
    }
  } 
  else if (role === 'Guest') {
    // Guests can ONLY access Home and Pomodoro
    updateItem(menuHome, true); menuHome.onclick = () => switchPanel('home');
    updateItem(menuPomo, true); menuPomo.onclick = () => switchPanel('pomodoro');
    
    updateItem(menuTasks, false);
    updateItem(menuNotes, false);
    updateItem(menuCards, false);
    updateItem(menuQuiz, false);
    updateItem(menuCal, false);
    updateItem(menuSec, false);

    // Force home if currently on locked page
    const activePanel = document.querySelector('.panel.active');
    if (activePanel && !['panel-home', 'panel-pomodoro'].includes(activePanel.id)) {
      switchPanel('home');
    }
  }
}

// ─── Logs & Incident Simulator ───
function logSecurityEvent(type, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const logStr = `[${timestamp}] [${type}] ${message}`;
  SecurityPortalState.logs.unshift(logStr); // newest first
  updateSecurityConsoleUI();
}

window.clearSecurityConsole = function() {
  SecurityPortalState.logs = [];
  logSecurityEvent('SYSTEM', 'Console cleared.');
};

function updateSecurityConsoleUI() {
  const consoleEl = document.getElementById('security-console');
  if (!consoleEl) return;
  consoleEl.innerHTML = SecurityPortalState.logs.map(log => {
    let color = '#38bdf8'; // sky blue
    if (log.includes('denied') || log.includes('ATTACK') || log.includes('VIOLATION')) color = '#f87171'; // red
    if (log.includes('SUCCESS') || log.includes('PASSED')) color = '#4ade80'; // green
    if (log.includes('POLICY')) color = '#eab308'; // gold
    return `<div style="color: ${color};">${log}</div>`;
  }).join('');
  consoleEl.scrollTop = 0; // newest at top
}

window.simulateBreach = function(type) {
  if (type === 'bruteforce') {
    logSecurityEvent('ATTACK_DETECTION', 'SSH/Web Authentication Failure anomaly detected from host IP 192.168.1.105.');
    let count = 1;
    const interval = setInterval(() => {
      logSecurityEvent('ATTACK_DETECTION', `Invalid Login Credentials attempted from 192.168.1.105 (Attempt ${count}/5).`);
      count++;
      if (count > 5) {
        clearInterval(interval);
        // Automated mitigation steps
        logSecurityEvent('AUTOMATED_RESPONSE', 'ALERT: 5 failed attempts reached from IP 192.168.1.105.');
        logSecurityEvent('AUTOMATED_RESPONSE', 'INCIDENT CONTAINMENT: Temporarily blacklisting source IP address.');
        
        // Push firewall deny rule
        SecurityPortalState.firewallRules.push({
          ip: '192.168.1.105', port: 'ANY', protocol: 'ANY', action: 'DENY', description: 'AUTOMATED CONTAINMENT: Brute-Force Block'
        });
        
        logSecurityEvent('AUTOMATED_RESPONSE', 'INCIDENT ERADICATION: Rule actively pushed into system firewall tables.');
        SecureAuth.showSecurityBanner('⚠️ INTRUSION CONTAINED: Malicious host 192.168.1.105 actively blocked!', 'error', 8000);
      }
    }, 400);
  } 
  else if (type === 'intrusion') {
    logSecurityEvent('ATTACK_DETECTION', 'CRITICAL ALERT: SQL Injection pattern matched on notes retrieval pipeline!');
    setTimeout(() => {
      logSecurityEvent('AUTOMATED_RESPONSE', 'AUTOMATED MITIGATION: Terminating active session immediately to isolate environment.');
      SecureAuth.showSecurityBanner('🚨 CRITICAL INTRUSION THREAT DETECTED: Auto-Isolating Workspace Session!', 'error', 6000);
      
      setTimeout(() => {
        // Force manual logout
        SecureAuth.performSecureLogout('timeout');
      }, 3000);
    }, 1500);
  }
};
