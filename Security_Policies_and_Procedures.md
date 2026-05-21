# Liwanag Organization: Information Security Policies & Procedures
**Document Version:** 1.0  
**Effective Date:** May 21, 2026  
**Regulatory Alignment:** GDPR (EU 2016/679) & HIPAA (45 CFR Part 160/164)

---

## 1. Document Objectives & Scope
This document defines the core security policies and technical procedures for the **Liwanag Student Workstation** environment. The objective is to protect user data (tasks, schedule, notes, credentials) against unauthorized access, integrity violations, and system vulnerabilities, ensuring compliance with global data protection standard frameworks.

---

## 2. Password Management & Authentication Policy
### 2.1 Password Complexity Requirements
* All local and cloud user accounts must adhere to strict complexity requirements:
  * Minimum password length of **8 characters**.
  * Must contain at least **one uppercase letter**, **one lowercase letter**, **one numeric character**, and **one special character** (`!@#$%^&*`).
* Plaintext storage of credentials is strictly prohibited. All passwords must be cryptographically hashed using industry-standard hashing algorithms (e.g., PBKDF2, bcrypt, or managed via Firebase Authentication securely).

### 2.2 Account Lockout & Brute-Force Protection
* **Policy:** The workstation must actively prevent brute-force attacks by limiting authentication attempts.
* **Procedure:** 
  * After **5 consecutive failed login attempts**, the system must temporarily lock the target email address for a duration of **15 minutes**.
  * Lockout metrics must be calculated locally using persistent storage identifiers (`localStorage`) and validated before routing to identity providers.

---

## 3. Data Protection & Cryptographic Policy (Data at Rest & Transit)
### 3.1 Data in Transit
* **Policy:** All data transmitted between the client application and cloud services (Firebase Auth/Firestore) must be encrypted.
* **Procedure:** 
  * Enforce transport-layer security using **HTTPS (TLS 1.3)** for all communication channels.
  * Explicitly block plaintext HTTP (Port 80) access at the hosting and gateway level.

### 3.2 Data at Rest
* **Policy:** Highly sensitive workspace records (such as student notes, files, or academic credentials) must be encrypted before persistence.
* **Procedure:**
  * Implement client-side authenticated symmetric encryption using the **Web Crypto API (AES-GCM 128-bit/256-bit)**.
  * Unique, cryptographically strong Initialization Vectors (IV) must be generated for each block of ciphertext to prevent pattern analysis.

---

## 4. Role-Based Access Control (RBAC) & Least Privilege Policy
### 4.1 Role Definitions
Access permissions to workstation sub-modules are governed strictly by three operational roles:
1. **Admin:** Full access to all components, including system configurations, firewall definitions, compliance audits, and security incident logs.
2. **Student:** Permission to access core learning workflows (Dashboard, Pomodoro timer, Tasks, Calendar, Notes, Flashcards, and Quizzes). Explicitly denied access to administrative and network security controls.
3. **Guest (Focus Mode Only):** Heavily restricted access level. Permitted to access the basic Dashboard and the Pomodoro timer. Access to notes, schedule records, testing suites, and configurations is blocked.

### 4.2 Least Privilege Enforcement
* Access tokens (JWT or Firebase Session tokens) must securely encapsulate the authorization role.
* Client-side routing and UI navigation menus must dynamically lock and enforce boundaries based on this role context, displaying access authorization banners for denied attempts.

---

## 5. Compliance Audits
* The workstation must undergo automated compliance scanning using auditing systems aligned with security standards (e.g., OpenVAS/Nessus principles).
* System-wide audits must verify the active configuration of:
  * SSL/TLS encryption.
  * MFA status for active sessions.
  * Cryptographic hashing and AES-GCM data storage layers.
  * Active firewall filters.
* Detailed compliance reports must compile violations and offer actionable remediation strategies.
