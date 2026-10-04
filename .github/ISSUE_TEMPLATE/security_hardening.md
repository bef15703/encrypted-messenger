---
name: Security / Cryptography Hardening
about: Propose a protocol upgrade, threat mitigation, or cryptographic fix
title: 'sec: '
labels: ['security', 'cryptography']
---

### Threat and Vulnerability Description
<!-- What is the current architectural or cryptographic flaw? -->
<!-- What could an attacker do? -->

### Threat Actor and Attack Surface
- **Attacker Capability:** [ ] Passive Eavesdropper [ ] Malicious Relay / MITM [ ] Local Device Access (XSS/Storage)
- **Component Affected:** [ ] Key Exchange [ ] Symmetric Cipher (AES-GCM) [ ] Client Storage (IndexedDB) [ ] Wire Protocol

### Cryptographic Specifications and Standards
<!-- What standard or best practice applies? -->

### Proposed Technical Solutions
<!-- What code changes need to be made (in specific files) -->

### Acceptance Criteria
- [ ] No regression to existing message schemas
- [ ] Cryptographic specifications adhered to
- [ ] Tested locally between two clients