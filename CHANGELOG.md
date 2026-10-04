# BulkReg – Changelog

All components carry the same release number (see `VERSION`). The guide's document version is the major.minor of the release.

| Release | Guide | Date | Changes |
|---|---|---|---|
| **3.0.0** | 3.0 | 2026-10-04 | One version number across the kit: library and all 5 agents, `bulkreg.ini`, `server_mapping.csv`, PowerShell helper, Audit Viewer, README, guide. `VERSION` and `CHANGELOG.md` added. No functional change from 1.8.0. |
| 1.8.0 | 2.9 | 2026-10-04 | Central log database (Agent Log template) **required**: agents stop if it can't be opened; one AUDIT entry per user. DryRun explained (guide D3b); Agent 03 dialog shows DRY RUN / LIVE; dry run checks home server reachability. |
| 1.7.0 | 2.8 | 2026-10-04 | Numbered mail folders directly under the Domino data directory; `MailExistingFolders`; startup check rejects `MailFolderPrefix` with a number or path. |
| – | 2.7 | 2026-10-04 | One-page Agent Run Order. |
| – | 2.6 | 2026-10-04 | `RegistrationLog=certlog.nsf` (Certification Log). |
| 1.6.0 | 2.5 | 2026-10-03 | Prerequisite: pre-create mail1…mailN (1 per 1000 users); Preflight lists folders; `MailFolderMax`. |
| 1.5.0 | 2.4 | 2026-10-03 | Mail file name = last name; uniqueness per home server; numbered folders (max 1000 each); `MailFileNote`. |
| 1.4.0 | 2.3 | 2026-10-03 | Every user gets a Domino mail file; `CreateMailDb`/`PreserveMailSystem` removed. |
| – | 2.1–2.2 | 2026-10-03 | Canonical/abbreviated server names; organizational policies; mail settings text. |
| – | 2.0 | 2026-10-03 | Guide rewritten as a from-scratch, step-by-step manual; agent names `BulkReg\NN - Name`. |
| 1.3.0 | 1.4 | 2026-10-03 | Reviewed batch workflow (Build → Review → Register); multi-server mapping; Verify per batch. |
| 1.2.0 | 1.3 | 2026-10-03 | Windows Domino Administrator client only (Linux/server mode archived). |
| 1.1.0 | 1.1 | 2026-10-03 | First release (incl. multi-OS trial). |
