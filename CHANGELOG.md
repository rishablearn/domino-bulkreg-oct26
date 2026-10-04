# BulkReg – Changelog

All components carry the same release number (see `VERSION`). The guide's document version is the major.minor of the release.

| Release | Guide | Date | Changes |
|---|---|---|---|
| **3.2.4** | 3.2 | 2026-10-04 | Compile fix: `UBound(Split(...))` is a Type mismatch in LotusScript (UBound needs an array variable). New `BR_ListCount`; used in `BR_CheckMailFolderConfig` and Agent 03 (dry-run replica count). No other UBound/LBound on an expression remains. |
| 3.2.3 | 3.2 | 2026-10-04 | Full syntax review of all 6 code files. **Fixed:** variable `base` renamed `fbase` (`Base` is a LotusScript reserved word, used by `Option Base`); Type assignment `u = blank` replaced by new `BR_ClearUser` (library + Agent 03); **`IsIDInVault` arguments were reversed** (HCL syntax is `IsIDInVault(username, servername)`) - the vault check would always have reported NOT_IN_VAULT; Agent 05 message points to Appendix A. Checks now run: string/quote lexer, block balance, reserved-word identifiers, undeclared identifiers (Option Declare), argument counts and ByRef type matches for all 77 procedures. |
| 3.2.2 | 3.2 | 2026-10-04 | **Compile fixes in BulkRegCommon:** `BR_SelectionFormula` used `|…|` string delimiters around a formula that itself contains the `|` (OR) operator, so the string ended early ("Unexpected: @"); now `{…}`. Two missing quotes from 3.2.0 fixed in `BR_AllocMailFile` ("…) on") and `BR_Audit` (" | vault "). Kit now passes a string/quote lexer check in addition to the block-balance check. |
| 3.2.1 | 3.2 | 2026-10-04 | Database placement re-validated: `bulkreg.nsf` local (code only), `bulkreg_log.nsf` on a server. Preflight checks that the tool database is local and that your access to the log database is Author + Create documents (warns about Editor/Manager or Delete documents). Guide B13–B15: why local vs server, local encryption + consistent ACL for the tool database, tightened log ACL (separation of duties), Template Server tip, backup and size; D7 rows. |
| 3.2.0 | 3.2 | 2026-10-04 | **Mail cluster replicas:** new `MailClusterServers` and `CreateClusterReplicas`; Agent 03 posts an AdminP Create Replica request per other cluster member after each registration; Agent 04 verifies replicas (REPLICAS_OK / REPLICAS_MISSING); Preflight checks every member and lists the folders for all members. Mail file names and numbered folders allocated once per cluster (no clashes between home servers). Mapping column 8 `ClusterReplicas` (empty = automatic, `-` = none). Batch file, audit, results and Audit Viewer gain `ClusterReplicas` / `ReplicaStatus`. **BatchSize default 1000.** Worked example for 2 DC home servers + 2 DR servers (guide B12.7). Pattern ranges `[a-l]*` documented. Rebuild batches that are still OPEN from 3.1. |
| 3.1.0 | 3.1 | 2026-10-04 | server_mapping.csv fully documented (guide B12.1–B12.9) with a self-explaining template (one active catch-all, commented examples). Preflight writes a mapping test (`_mapping.txt`, users per rule). Agents stop if a mapping rule still contains a `<placeholder>`; warning without catch-all. Library header names corrected. Full consistency check of settings, names and versions. |
| 3.0.0 | 3.0 | 2026-10-04 | One version number across the kit: library and all 5 agents, `bulkreg.ini`, `server_mapping.csv`, PowerShell helper, Audit Viewer, README, guide. `VERSION` and `CHANGELOG.md` added. No functional change from 1.8.0. |
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
