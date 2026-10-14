# BulkReg AutoSync – automatic registration of new Active Directory users

BulkReg 4.0.1 · agent `BulkReg\07 - AutoSync` · library `BulkRegAuto` · config `config/bulkreg_auto.ini`

AutoSync registers users that DirSync adds to the Domino Directory **after the initial bulk load**, with the same code and the same configuration keys as the manual agents (home-server pool, mail-file naming, policy/ID Vault, cluster replicas, short name, Internet address). The operator's review of a batch is replaced by safety gates. It runs as a **scheduled agent on a Domino server** and needs no workstation and no operator.

> **Status – read first.** The kit has never been compiled or run against a live Domino server (see README, "Verify before production"); AutoSync is no exception. Two checks (block balance, undeclared variables) were run on the source here; nothing was executed. Section 9 lists what is **unverified** and must be proven in the SHADOW and pilot phases before `AutoMode=LIVE`.

## 1. What one run does

| Step | What | Same code as |
|---|---|---|
| 0 Gates | `AutoMode`, STOP file, `AutoInitialLoadDone`, run-as identity, single-instance lock, self-pause, environment check (servers, folders, vault policy, `UseCA=1`, placeholders), selection-formula test | – (new) |
| 1 Clean-up | Open batches left by an earlier run are abandoned (renamed `ABANDONED-…`) so their users are offered again | – |
| 2 Build | Unregistered DirSync users that are **settled** (`AutoMinAgeMinutes`) and **not held back**, up to `AutoMaxUsersPerRun` | Agent 02 (`BR_RunBuildBatch`) |
| 3 Gates | Capacity (no free home server / mail folder), backlog size, error ratio | – |
| 4 Register | LIVE: registers the batch. SHADOW: dry run, changes nothing | Agent 03 (`BR_RunRegisterBatch`, `BR_RegisterOne`) |
| 5 Verify | Every user AutoSync registered is re-verified each run until vault, mail file, ACL, Notes name and **all replicas** are OK (title/ACL fixed automatically if `AutoFixMailTitleAcl=1`) | Agent 04 (`BR_VerifyDoc`) |
| 6 Report | State files, quarantine list, Run/Entry/Audit documents in `bulkreg_log.nsf`, Domino mail | Log database as manual |

Nothing in the manual workflow changes: `gAuto` and `gEmbedded` are `False` for agents 00–06.

## 2. Safety gates and checks (internal checks and balances)

| Gate / check | Key | When it trips | Result |
|---|---|---|---|
| Mode | `AutoMode` = OFF / **SHADOW** / LIVE | OFF: nothing runs. SHADOW (default): builds + dry-runs, **changes nothing in Domino** | – |
| Initial load | `AutoInitialLoadDone` | `0` (default) | HALT: would race the manual batches |
| STOP file | `<AutoStateDir>/STOP` | file exists (written by an admin or by self-pause) | HALT until deleted |
| Identity | `AutoExpectedUser` | `NotesSession.EffectiveUserName` is a different signer / run-on-behalf identity (both names are logged) | HALT |
| Single instance | `AutoLockStaleMin` | younger lock file = a run is active | run skipped silently; older lock = crashed run, replaced with a WARN |
| Environment | `UseCA`, policy, `VaultServer`, folders, servers, lock timing, `BatchDir` marker | `UseCA=0`; no vault policy; no `VaultServer`; `<PLACEHOLDER>` left; registration / home / vault server unreachable; the vault cannot be queried from the agent (LIVE; a warning in SHADOW); ID, password, batch dir not writable; `BatchDir` holds batch files but no `AUTOSYNC_OWNED.txt` (it may be the manual folder); `AutoLockStaleMin` ≤ 2 × `AutoMaxRuntimeMin` + 5 | HALT with the list |
| Selection test | `AutoMinAgeMinutes` | the server rejects the age formula | HALT with the formula |
| Settling time | `AutoMinAgeMinutes` (60) | a Person document changed less than N minutes ago | user waits (DirSync still filling name, short name, address) |
| Per-run cap | `AutoMaxUsersPerRun` (50, ≤ `MaxBatchRows`) | more eligible users | the rest wait for the next run |
| Capacity | `HomeServerMaxUsers`, `MailFolderMax` | all home servers or all pre-created folders full | HALT + ALERT (not blamed on the user) |
| Backlog | `AutoMaxBacklog` (200) | more eligible users than this | HALT: bulk import or unfinished initial load |
| Error ratio | `AutoErrorGateMin` (5), `AutoMaxErrorPct` (25) | ≥ 5 rows with `Check=ERROR` **and** more than 25 % of the batch | HALT: systematic problem. One bad user never blocks the others |
| Per-user checks | (code of agents 02/03) | objectGUID must match, certificate re-checked (idempotent), name/short name/address/mail-file validation, mail file must not exist | row excluded or skipped |
| Wrong Notes name | (agent 03) | registered name is not `First Last/OU/Org` | run stops at the first one |
| Circuit breaker | `MaxConsecutiveErrors` (5) | consecutive failures | run stops |
| Run-time budget | `AutoMaxRuntimeMin` (8) | budget used up | stops between two users; rest offered again |
| Backoff / quarantine | `AutoRetryBackoffMin` (30), `AutoMaxAttempts` (3), `AutoQuarantineHours` (168) | a user fails (validation ERROR in Build, FAILED in Register) – counted only after every gate has passed; a full server or an unreachable server is not the user's fault and is not counted | retried after 30, 60 … min, then held 7 days, then tried once more. A failure **at** `RegisterNewUser` goes straight to the 7-day hold (an ID or mail file may exist). A failure **after** it worked goes to verification instead |
| Self-pause | `AutoMaxFailedRuns` (3) | 3 failed runs in a row | writes the STOP file, ALERT |
| Verification | `AutoVerifyDays` (3) | a user is still not fully OK after N days | reported (ALERT), dropped from the list |
| Heartbeat | `AutoHeartbeatHour` (7) | – | one status mail a day; **no mail = the agent is not running** |

State files are read again under the lock; an unreadable state, quarantine or pending file halts the run instead of being overwritten. State files are replaced with a `.bak` copy kept.

Registration itself is not retried inside a run: a repeated `RegisterNewUser` can leave an orphaned ID or mail file. A user whose registration fails half-way becomes a `Check=ERROR` row next time (mail file already exists / ID file exists) and goes to quarantine for a human to inspect.

## 3. Architecture

```
 Domino server (one, e.g. the directory master)                         Windows admin PC (unchanged)
 +------------------------------------------------------+               +--------------------------+
 | bulkreg_auto.nsf  agent 07 (schedule: every 60 min)  |               | bulkreg.nsf  agents 00-06|
 |   BulkRegAuto -> BulkRegAgents -> BulkRegCommon      |               | initial load, ad-hoc use |
 | bulkreg_auto.ini (notes.ini: BulkRegAutoConfig=)     |               +--------------------------+
 | /local/notesdata/bulkreg/{ids,secure,batches,audit,state}
 +------------------------------------------------------+
       | reads names.nsf (DirSync users)  | writes Run/Audit docs  | Domino mail
       v                                  v                        v
   registration via CA + AdminP     bulkreg_log.nsf            AutoNotifyTo group
```

The two databases are separate: `bulkreg.nsf` (workstation, manual) and `bulkreg_auto.nsf` (server, unattended). They use separate config files, so paths (`C:\BulkReg` vs `/local/notesdata/bulkreg`) never mix.

## 4. Prerequisites (do once)

| # | Step | Detail |
|---|---|---|
| S1 | Initial load finished | All initial users registered and verified with agents 01–04. Keep `AutoInitialLoadDone=0` until then. |
| S2 | Service identity | Create a dedicated administrator ID for AutoSync (not a person). It **signs** the agent. In the Server document of the server that runs the agent, add it under *Security > Programmability Restrictions > Run unrestricted methods and operations* (file I/O and `NotesRegistration` are unrestricted operations). Add *Sign agents to run on behalf of someone else* only if you use "Run on behalf of". |
| S3 | Registration authority | The identity the agent executes as must be allowed to register users with `CertifierName` in the CA, exactly as your admin ID is in the manual run, and must have the Domino Directory rights registration needs. **How the effective identity is evaluated for a server-side registration is not stated in the HCL documentation – this is verified in the pilot (section 9, item 1).** `AutoExpectedUser` makes the agent refuse any other identity. |
| S4 | Database | Create `bulkreg_auto.nsf` on the server (template *-Blank-*). Script libraries in this order: `BulkRegCommon`, `BulkRegAgents`, `BulkRegAuto` (paste each `.lss`, Ctrl+A first, as in the guide B16/B17); agent `BulkReg\07 - AutoSync` from `Agent07_AutoSync.lss`. Sign the database with the service ID (guide B17a). ACL: administrators Manager, the executing identity Author. Only agent 07 is needed here; do not create agents 00–06 on the server. |
| S5 | Log database | The existing `bulkreg_log.nsf` is reused. The executing identity (usually the server) needs **Author + Create documents**, no Delete. |
| S6 | Folders on the server | `/local/notesdata/bulkreg/{config,ids,secure,audit,batches,state}`. Owner: the Domino service account. `ids` and `secure` mode `700`; `config` readable by the service account and admins. Windows server: use `C:\BulkReg\...` paths in the ini and set `BulkRegAutoConfig` in notes.ini (no default on Windows). |
| S7 | Config | Copy `config/bulkreg_auto.ini` and `config/server_mapping.csv` to `.../config/`. `BatchDir` must be a folder of its own: the first run writes the marker `AUTOSYNC_OWNED.txt` into an empty folder and refuses a folder that already holds `BATCH-*.csv` files without the marker (open batches in an AutoSync folder are abandoned automatically). Replace every `<PLACEHOLDER>` (the agent refuses to run otherwise). Start from your manual `bulkreg.ini` values for all registration keys. Set `MailACLManager` explicitly (otherwise the server identity is the only mail-file Manager). |
| S8 | notes.ini | `BulkRegAutoConfig=/local/notesdata/bulkreg/config/bulkreg_auto.ini` (Linux default if missing). |
| S9 | Capacity | Defaults (2500 per server, `MailFolderMax=3`) are **full after the 5000 initial users**. Raise `HomeServerMaxUsers` and `MailFolderMax` for the growth you expect and create `mail4`, `mail5` … on every home server and mail-cluster member (the manual Preflight lists the commands). |
| S10 | Agent schedule | Agent Properties > Schedule: *More frequently than daily*, every 60 minutes, **run on one named server**. Check the Server document's Agent Manager execution-time limits and keep `AutoMaxRuntimeMin` below them. |
| S11 | Notification | A mail-in group or group of administrators in `AutoNotifyTo`. |

## 5. Go-live ladder (do not skip a step)

| Phase | Setting | Do | Move on when |
|---|---|---|---|
| 0 | `AutoMode=SHADOW`, `AutoInitialLoadDone=1` | Run the agent once by hand from the Notes client (**Actions > Run**, "Run on server") or wait for the schedule. Read the run folder under `audit/` and the daily mail. | Environment gates pass; log database shows a FINISHED SHADOW run; a mail arrives (proves mail send works). |
| 1 | SHADOW for 3–5 days | Each run lists who would be registered (`SHADOW-…` batch + `_dryrun_` CSV). Compare with AD: right users, right home server, `NotesName`, `MailFile`, Internet address, policy. Check that `AutoMinAgeMinutes` keeps the count sensible. | Lists are correct and gates did not trip unexpectedly. |
| 2 | `AutoMode=LIVE`, `AutoMaxUsersPerRun=1` | Let 2–3 users through. For each: Person document (`MailServer`, `MailFile`, `ShortName`, `InternetAddress`), ID in the vault, mail file on the home server, replicas, ACL, title – or run agent 04 on the workstation for those users. | Everything OK for several users; `autosync_pending.csv` empties by itself. |
| 3 | `AutoMaxUsersPerRun=10`, then 50 | Watch the daily mails for a week. | Stable. |

Back to safe at any time: `AutoMode=OFF` (quiet), or create the `STOP` file.

## 6. State files (`AutoStateDir`)

| File | Content | Admin action |
|---|---|---|
| `STOP` | Written by self-pause, or by you to pause | Delete to resume (failed-run counter is reset) |
| `autosync.lock` | The running run | Removed by the run; one older than `AutoLockStaleMin` is replaced |
| `autosync_state.txt` | `FailedRuns`, last run, last alert, last heartbeat | Do not edit while a run is active |
| `autosync_quarantine.csv` | Users held back: GUID, name, attempts, NextTry, last reason | Delete a line to retry that user now |
| `autosync_pending.csv` | Registered users still being verified | Informational |

Batches and results of AutoSync are in `BatchDir` (`BATCH-<id>-01.csv`, `_results.csv`, `SHADOW-…`, `ABANDONED-…`, `AUTO_verify_<run>.csv`); the run folder under `AuditDir` has `RUN_INFO.txt`, the audit CSV, the debug log and a copy of the results. Everything is also in `bulkreg_log.nsf` (view 6 *Problems* lists runs whose status is not FINISHED).

`scripts/linux/autosync_ctl.sh` shows the state, pauses, resumes and releases a quarantined user.

## 7. Mail

Mail kinds: **ALERT** (gate stop, failed run, self-pause – an alert of the same type is repeated only every `AutoAlertRepeatHours`; failed users and "verification gave up" are mailed on the run in which they happen), **ACTIVITY** (LIVE: users registered, backoff, verification finished), **DAILY** (status once a day). Content: counts, user names, reasons, run folder. Never passwords, ID files or tokens. User names are personal data: use a restricted group in `AutoNotifyTo`.

## 8. Operations – what to do on an ALERT

| Alert text | Likely cause | Verify | Fix |
|---|---|---|---|
| `HALTED - environment check failed: …` | Server down, folder not writable, placeholder in the ini, no vault policy | Read the list in the mail; debug log in the run folder | Fix the named item; the next run continues |
| `HALTED - CAPACITY` | Home servers or mail folders full | Preflight `_mailfolders.txt`, `HomeServerMaxUsers`, `MailFolderMax` | Raise the limits, create folders |
| `HALTED - backlog …` | Bulk import in AD, or initial load not finished | Directory count vs expectation | Confirm it is legitimate, raise `AutoMaxBacklog` or run manual batches |
| `HALTED - n of m rows … Check=ERROR` | Mapping/short-name/attribute problem for many users | `BATCH…`/`ABANDONED-…` file, `Issues` column | Fix AD/mapping; next run retries |
| `HALTED - STOP file present` | Self-pause or manual stop | Read the STOP file text and the last runs | Fix the cause, delete `STOP` |
| `FAILED - … RegisterNewUser …` | CA/RA rights of the executing identity, certifier, policy, mail template, folder rights | `parameters:` text in the debug log (it lists every value passed) | Fix; after 3 failed runs the agent pauses itself |
| `VERIFICATION GAVE UP on …` | Replica or vault not completed within `AutoVerifyDays` | AdminP (`admin4.nsf`), vault, replica servers | Fix; run agent 04 on the workstation for the user |
| `Backoff … quarantine` listed | Individual user problem | `autosync_quarantine.csv` reason | Fix the user in AD or delete his line |
| No daily mail | Agent not running, disabled, or the server is down | Agent Manager, `show tasks`, agent log | Re-enable the agent |

## 9. What is NOT verified – must be proven in the pilot

1. **Registration from a server agent.** The HCL documentation for `ContactNoteID` and `RegisterNewUser` does not say whether they are supported from a scheduled server agent, nor which identity is checked for a CA registration there. Phase 2 (`AutoMaxUsersPerRun=1`) is the proof. If the first LIVE run fails at stage `RegisterNewUser`, the debug log shows the error and the full parameter list; the agent pauses itself after three failed runs. Fallback if it cannot work: a Windows host that runs the existing client-based agents under a scheduler (more code change: client agents need a headless runner).
2. **`@Modified` in the selection** (settling time). The run tests the formula and halts with the formula text if it is rejected; `AutoMinAgeMinutes=0` turns it off.
3. **Mail sent from the agent** (`NotesDocument.Send`). SHADOW phase 0 proves it (the DAILY mail).
4. **Libraries that contain UI code** (`NotesUIWorkspace` in the manual prompts) loading on a server. The UI code is never executed in AutoSync, but this load has not been tested.
5. **Agent Manager limits** on execution time and the effect of `Print` output; `AutoMaxRuntimeMin` must be below the limit of your Server document (the verification step has a second budget of the same length).
6. **Scan cost.** Each run reads the mail folders of the home servers to allocate names; with thousands of mail files the first runs show how long this takes (debug log timestamps).
7. **Vault query from a server agent** (`GetIDVault` / `IsIDInVault`). The environment check probes it and halts LIVE (warns in SHADOW) when it fails.
8. **Identity.** Which name the agent runs under (`UserName` vs `EffectiveUserName`) is logged on every run (`Identity:` line); set `AutoExpectedUser` after you have seen it.
9. Compilation. Two constructs are new in this kit: `Erase list(tag)` (removes one list element) and `Exit ForAll`; report the first compiler message and line if one is rejected. Compile with *Tools > Recompile All LotusScript* and report the first error message and line before changing anything (as for every earlier release).

## 10. Security and data handling

- `bulkreg_auto.ini` contains no secrets. The certifier password is never used (`UseCA=1` is mandatory).
- The registration writes **user ID files and initial passwords on the server** (`IDFileDir`, `PasswordDir`, `WritePasswordFile=1`). AutoSync **does not delete them** (deleting is irreversible and the hand-over process is yours). Restrict both folders to the service account, hand over, then purge as for the manual process (`PurgeSecrets` logic) and back them up securely or not at all. If IDs live in the vault only, set `WritePasswordFile=0` and reset passwords through the vault.
- Audit CSVs, batch files and the log database hold personal data (names, addresses). Keep the same restrictions as for the manual kit.
- The service ID is a high-privilege identity: protect the ID file, limit who can edit `bulkreg_auto.nsf` (a changed agent runs with the signer's rights), and re-sign only from a trusted workstation.
- Do not run manual batches against the same directory while AutoSync is LIVE; the two do not see each other's open batches. Pause AutoSync (`AutoMode=OFF`) first.

## 11. Updating

A release changes the libraries. Replace `BulkRegCommon`, `BulkRegAgents` and `BulkRegAuto` in `bulkreg_auto.nsf`, and `BulkRegCommon` and `BulkRegAgents` in the workstation `bulkreg.nsf`; recompile all LotusScript; re-sign both databases. Add the new keys from `config/bulkreg_auto.ini` to your server ini. Run the manual **01 – Preflight Check** once after updating the workstation database to confirm the manual path still works (the shared libraries changed in 4.0.1).

## 12. Limits of this version

- SHADOW builds the first `AutoMaxUsersPerRun` users every run and records no backoff, so with a large backlog it shows the same first users each time; raise the cap for the SHADOW phase.
- The initial-password hand-over, deprovisioning and attribute changes are out of scope (below).


AutoSync registers **new** users only. It does not handle disabled or deleted AD users, renames, or attribute changes after registration, and it does not hand IDs or passwords to users. Several Domino domains, or several registration servers, are not supported (same as the manual kit).
