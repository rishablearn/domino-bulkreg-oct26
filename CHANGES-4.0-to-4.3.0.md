# BulkReg: changes from 4.0.0 to 4.3.0 (porting list for the separate rename agent)

Source: `CHANGELOG.md` and the code in `lotusscript/BulkRegCommon.lss` and `BulkRegAgents.lss`. I have not seen the rename agent, so the items are grouped by how likely they are to matter to it. Nothing here has been compiled or run against Domino.

## A. Name handling (most likely relevant to a rename agent)

| Release | Change | Where (function / key) |
|---|---|---|
| 4.0.1 | Last name is built as `<LastNameField><LastNameSeparator><ShortName or sAMAccountName>`, upper-cased, e.g. `ANALYST-JDOE`. Keys: `LastNameSuffixFields`, `LastNameSeparator`, `LastNameUppercase`, `LastNameBackupField` (default `Location`), `LastNameBackupOverwrite`. | `BR_BuildLastName`, `BR_ReadUser` |
| 4.0.1 | Characters `/ \ = , +` in the source value become `-`. | `BR_Clean`, `BR_BuildLastName` |
| 4.0.1 | Already-registered users are never renamed: `BR_ReadUser` keeps the existing last name of a registered Person document. | `BR_ReadUser` |
| 4.0.1 | Only the generated last name is written, and only to the backup item. `BR_IsProtectedItem` refuses a protected backup field. | `BR_IsProtectedItem` |
| 4.0.1 | New checks: no usable suffix is an ERROR; OrgUnit equal to the organization is an ERROR (`/Demo/Demo`); after registration the common name must equal the generated one. | `BR_Validate`, `BR_CnProblem` |
| 4.1.0 | `LastNameSeparator=SPACE` (or `BLANK`): one blank between source and suffix, e.g. `CN=SGT ABC XXZ 11100OPS/O=Demo`. Needed because ini values are trimmed. | `BR_LastNameSep` |
| 4.2.0 | `BR_NormSpaces`: exactly one blank between words. Tabs, non-breaking (160, 12288, 8192-8202), zero-width (8203, 65279), leading and trailing blanks are normalised. Used by `BR_Clean`, `BR_BuildLastName`, `BR_CommonName`, `BR_MailTitle`. | `BulkRegCommon.lss` |
| 4.2.0 | `BR_NormKey`: lower case, all blanks removed. Used to compare names. | `BulkRegCommon.lss` |
| 4.2.0 | `BR_CnProblem` ignores blanks and case. A really different common name is a WARN (`CnMismatchAction=WARN`, default) instead of stopping the run (`STOP` = old behaviour). | `BR_CnProblem`, `BR_RegisterOne` |
| 4.2.0 | `BR_RegisteredName(doc, u)`: picks the FullName value whose common name equals the generated one (exact, then by `BR_NormKey`), else the first value. DirSync Person documents can still carry the AD cn (e.g. `FLT LT  VINAY TALWAR 99202OPS`, two blanks). Used for the vault check, mail ACL owner, mail title and audit. | `BR_RegisteredName` |
| 4.2.1 | Name precedence: the `FullNameAfter` (else `NotesName`) of the reviewed batch row is the name the user is created with. The regenerated name is used only if both are empty. An organization/OU mismatch fails validation. | `BR_ApplyBatchName`, `BR_RegisterOne` |
| 4.2.1 | `04 - Verify` compares the registered name, not the first FullName value. | `BR_VerifyDoc` |

## B. Safety and duplicates (relevant if the rename agent changes Person documents)

| Release | Change |
|---|---|
| 4.2.1 | Initial-password row is written immediately after `RegisterNewUser`. |
| 4.3.0 | Duplicate guard (`DuplicateGuard=1`): `BR_DupIndexLoad`, `BR_DupIndexAdd`, `BR_DupCheck`. A user whose Internet address, short name, objectGUID or common name belongs to a different registered Person document is flagged `ERROR:DUPLICATE_REGISTERED` (01/02) or skipped as `SKIPPED_DUPLICATE` (03). Nothing is deleted automatically. |
| 4.3.0 | 09 - Reconcile: `_duplicates.csv` (KEEP / DO_NOT_REGISTER / REVIEW) and `_gaps.csv`. |

## C. Registration, mail files and operations (only if the rename agent shares code)

| Release | Change |
|---|---|
| 4.0.1 | AutoSync removed (`BulkRegAuto.lss`, `Agent07_AutoSync.lss`, `bulkreg_auto.ini`). BulkReg runs only from the Windows Notes client. |
| 4.1.0 | `MailFileDeferred=1`: 03 registers without creating the mail file (status `MAILFILE_DEFERRED`). The 4.1.0 agent 07 is retired in 4.2.0. |
| 4.1.0 | Unused AutoSync hooks removed from both libraries. |
| 4.2.0 | Chunked registration (`RegisterChunkSize=10`, `ChunkPauseSec`, `ChunkSlowSec`), `STOP.txt`, `<batch>_inprogress.flag`, resume. |
| 4.2.0 | Agent 07 retired. New 08 Repair Missing Mail Files, 09 Reconcile, 10 Audit Log Maintenance. |
| 4.2.0 | `LogDbLevel=WARN`, `LogDbAudit=CHANGES`, `MailInheritTemplate`, `BR_MailPathNorm`. |
| 4.2.1 | Agent 11 Batch Manager (RESUME / REMAINDER / CLOSE), `StaleRunMinutes`, heartbeat, `bulkreg Stop` / `Unstop`. |
| 4.2.1 | Folder fill counts deferred mail files; a resumed batch does not double-count users in the server load. |
| 4.3.0 | Batch Manager `RECOVER <batch id>` (read-only analysis of an aborted batch). 08 accepts `RECON_<run>_gaps.csv` as scope. |

## D. New ini keys since 4.0.0

`LastNameSuffixFields`, `LastNameSeparator`, `LastNameUppercase`, `LastNameBackupField`, `LastNameBackupOverwrite` (4.0.1); `MailFileDeferred`, `MailCreateMaxPerRun` (4.1.0); `RegisterChunkSize`, `ChunkPauseSec`, `ChunkSlowSec`, `CnMismatchAction`, `MailRepairChunkSize`, `RepairCheckExisting`, `RepairRemoveEmptyShells`, `MailInheritTemplate`, `LogDbLevel`, `LogDbAudit`, `LogEntryRetentionDays`, `LogAuditRetentionDays`, `AuditFolderRetentionDays`, `AuditArchiveDir`, `ReconcileDir`, `ReconcileExpectedList`, `ReconcileConfirmMissing`, `ReconcileCheckHealth` (4.2.0); `StaleRunMinutes` (4.2.1); `DuplicateGuard`, `ReconcileCheckVault` (4.3.0).

## E. Suggested porting order for the rename agent

1. Copy `BR_NormSpaces` and `BR_NormKey`, and compare names with `BR_NormKey` (4.2.0).
2. Use `BR_RegisteredName` instead of the first FullName value wherever the agent reads the current name (4.2.0).
3. Apply the "reviewed value wins" rule if the rename agent works from a reviewed CSV (4.2.1).
4. Add the duplicate check before any rename that could collide with an existing registered document (4.3.0).
5. Keep the protected-item rule: write only to the backup item, never to the AD-sourced items (4.0.1).

## F. Not verified

- None of this code has been compiled or run against Domino.
- The list is based on the changelog and BulkReg's code. Whether each item applies to the rename agent depends on how it works, which I haven't seen.
- The ini defaults for log retention need sign-off from your audit or compliance owner.
