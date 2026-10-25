# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 4.6.0 · run from the **HCL Domino Administrator client on Windows** · Domino 14.x
**Full step-by-step guide (start here):** `docs/BulkReg_Admin_Guide.html`, same version as the kit (4.4.0). It assumes nothing exists and walks through every click: directory roles, CA/RA, ID Vault, Security Settings, explicit policy, folders, config, bulkreg.nsf, library, agents, signing, then each batch.

## What changed in 4.6.0: 12 - Remove Duplicates and 13 - Recover Users
- **One agent that checks everything against the Domino Directory and the mail servers and repairs it in one run:** removes unregistered duplicates, creates missing mail files, replaces cut-off ones, closes stale batch files that make 02 build nothing, verifies and requests cluster replicas. Mail servers are read from CSV lists (`scripts/linux/bulkreg_list_mailfiles.sh`, `scripts/windows/BulkReg_ListMailFiles.ps1`). Safe to run again after any stop or hang; works the same for users registered by 4.5 or older. Several machines: `PartitionCount`/`PartitionIndex` + a log-database guard. Procedure: **`SOP-recover-failed-users.md`** (HTML: `docs/BulkReg_SOP_Recover_Failed_Users.html`). Library `lotusscript/BulkRegRecover.lss`, agent `lotusscript/Agent13_Recover.lss`. Agents 00-11 unchanged (12 is new in this release too). Upgrade: `DEPLOY-4.6.0.md`. Git helpers: `scripts/mac/sync_to_github.sh`, `scripts/windows/BulkReg_SyncFromGitHub.ps1`. Not compiled or run against Domino.

## What changed in 4.5.0
- **Several machines in parallel:** `PartitionCount=2` on both machines, `PartitionIndex=1` on one and `2` on the other. Every user belongs to exactly one partition (hash of the Person UNID); 01/02 build only this machine's users, 08 repairs only them, 03 refuses a batch with users of another partition (`PartitionOverride=1` = deliberate take-over). Batch IDs carry the machine tag (`BATCH-<run>-<MachineId>-01`). No shared folder needed. Procedure: `PLAYBOOK-post-deploy-4.5.0.md` (HTML: `docs/BulkReg_PostDeploy_Playbook_4.5.0.html`), including the data to collect from each machine and how to copy it. Upgrade: `DEPLOY-4.5.0.md` (HTML: `docs/BulkReg_Deploy_4.5.0.html`). Helpers: `scripts/windows/BulkReg_CollectEvidence.ps1` and `BulkReg_CompareMachines.ps1` (read-only). HTML is rebuilt from the Markdown with `python3 scripts/build_docs_html.py`. Not compiled or run against Domino; the helpers were not run either.

## What changed in 4.4.0
- **bulkreg.ini upgrades are incremental:** `scripts\windows\bulkreg.cmd IniCompare` shows what your file lacks (with the release that added each key), what is unknown or retired, which `<PLACEHOLDER>`s remain and which values differ from the template; `IniUpgrade` previews and `IniUpgrade -Yes` adds only the missing keys with their comments (backup, read-back check, diff). Your values are never changed. No administrator rights needed.
- **Duplicate users by mail file, ID file and ID vault:** `DuplicateCheckMailFile`, `DuplicateCheckIDFile`, `DuplicateCheckVault` (own switches; guard on). 01/02 flag `ERROR:DUPLICATE_MAILFILE / _IDFILE / _VAULT`, 03 skips the user (`SKIPPED_DUPLICATE`); 09 adds `_duplicate_ids.csv`. Nothing is deleted.
- Upgrade: `DEPLOY-4.4.0.md`. Not compiled or run against Domino.

## What changed in 4.2.0 - 4.3.0
- **Names with extra blanks:** one blank between the words whatever AD delivers (`FLT  LT ABC   XYZ 1000ops` -> `FLT LT ABC XYZ 1000OPS`). The "common name differs" check ignores blanks and case and only WARNS about a really different name (`CnMismatchAction`), so one odd user no longer stops the run.
- **Chunked registration:** 03 registers in chunks (`RegisterChunkSize=10`), pauses between them, stops cleanly on `<BatchDir>\STOP.txt` and **resumes** a half-done batch (`<id>_inprogress.flag`).
- **08 - Repair Missing Mail Files** replaces the retired 07: works from the directory (no batch file needed), per mail server in parallel, finds missing and incomplete mail files, never overwrites a file with data.
- **09 - Reconcile:** CSV files (`RECON_<run>_all / _missing_users / _missing_mail / _orphan_mail / _gaps / _duplicates`) for missing users, registered-but-no-mailbox, orphan mail files and stray blanks in names.
- **10 - Audit Log Maintenance:** archive to CSV, verify, then purge old log documents; deletes old debug logs. `LogDbLevel=WARN` / `LogDbAudit=CHANGES` stop the log database growing. Retention periods are defaults: agree them with audit/compliance.
- **11 - Batch Manager (4.3.0):** state of every batch, resume stopped or hung runs (run 03 again; RESUME / REMAINDER / CLOSE for batches that finished incomplete), CSV report. `bulkreg Stop` / `Unstop` for a clean stop. The `FullNameAfter` of the reviewed batch row is the name the user is created with.
- **12 - Remove Duplicates (since 4.6.0):** removes unregistered Person documents that are full duplicates (name, ops number / short name, Internet address, first and last name) of a registered user. Input: `RECON_<run>_duplicates.csv` of 09 (only `DO_NOT_REGISTER` rows). DryRun first (`DEDUP_DRYRUN_<run>.csv`), then DryRun=0 and type `REMOVE`; method `DuplicateDeleteMethod` = ADMINP / DIRECT / AUTO; DXL snapshot before each removal; never deletes mail files, ID files or the keeper. Run 09 again afterwards.
- **4.3.0 - gaps, duplicates, aborted batches:** 09 writes `_gaps.csv` (not registered / no mail / no vault / duplicate) that 08 accepts as scope; `DuplicateGuard=1` stops a second identity being registered (`SKIPPED_DUPLICATE`), `_duplicates.csv` lists them for manual resolution; Agent 11 `RECOVER <batch id>` analyses an aborted batch (read-only).

## What changed in 4.1.0
- **Name separator:** `LastNameSeparator=SPACE` (or `BLANK`) gives `CN=SGT ABC XXZ 11100OPS/O=Demo` (JobTitle + one blank + short name). A plain blank in bulkreg.ini would be trimmed, hence the keyword.
- **Fast registration:** `MailFileDeferred=1` registers users **without** creating the mail file; the agent `BulkReg\08 - Repair Missing Mail Files` (was 07 in 4.1.0) creates the missing files afterwards from `MailTemplate` (title, ACL, cluster replicas; `MailCreateMaxPerRun`; honors `DryRun`). Run it right after each live batch: until then mail for those users cannot be delivered. Several Notes clients can run 07 on different batch files in parallel. `MailFileDeferred=0` keeps the old behaviour.
- **Clean-up:** the unused AutoSync hooks were removed from both libraries (re-paste both).

## What changed in 3.9.x (still valid in 4.4.0)
Preflight checks all users (`PreflightScope=ALL`, `_batchplan.txt` shows the split); Build Batch writes all batch files in one run (`BATCH-<run>-01.csv`, `-02.csv` ...); the registration last name is built from `LastNameField` (JobTitle) + separator + short name and upper-cased (e.g. `SGT ABC XXZ 11100OPS`, see 'Unique last name' below); users are filled into the `HomeServers` pool (`HomeServerAssignment=FILL`: first server up to 2500, then the next; mapping rule `AUTO`); the short name comes from the AD samaccountname item (`ShortNameFields`), never the FullName; a missing Internet address is constructed as `<shortname>@<InternetDomain>`; Domino on Linux (`ServerOS=LINUX`, `/local/notesdata`, paths sent as `mail1/smith.nsf`). The audit and batch files carry `FullNameAfter` (the Person name after registration); the Person item `JobTitle` (rank, first, last from AD) is registered as the last name. Details: `CHANGELOG.md`. Upgrade steps: `DEPLOY-4.0.1.md`.

## Unique last name (since 4.0.1; separator SPACE since 4.1.0)
`LastName = <LastNameField> + <LastNameSeparator> + <ShortName | sAMAccountName>`, upper case, e.g. JobTitle `analyst` + short name `jdoe` -> **`ANALYST-JDOE`** -> Notes name `ANALYST-JDOE/Demo` (first name stays empty). Keys in `bulkreg.ini`: `LastNameField`, `LastNameSuffixFields` (default `ShortName,sAMAccountName`, empty = no suffix), `LastNameSeparator` (`SPACE` = one blank, or any text such as `-`), `LastNameUppercase` (`1`), `LastNameBackupField` (`Location`, empty = off), `LastNameBackupOverwrite` (`1`). After the name is verified the generated value is copied to the Person item `Location`. `FullNameAfter` shows the same value with the organization once. ERRORs: empty source item, no usable suffix, `OrgUnit` equal to the organization. Mail file stays `<shortname>.nsf`. Users registered earlier (e.g. with `LastName=JobTitle`) are never renamed: for a registered Person document the last name is read as it is, and Verify only reads. `Location` is not allowed as a MatchField in `server_mapping.csv`. Not compiled or run against Domino.

## Welcome screens (3.9.9)
bulkreg.nsf and bulkreg_log.nsf open on a branded welcome screen instead of an empty view. In the Notes client this is the **About This Database** document (the "open designated Page" launch option exists for the web only). bulkreg.nsf: create the agent `BulkReg\06 - Install Welcome Page` (`lotusscript/Agent06_InstallWelcomePage.lss`, Shared, Action menu selection, Target None) and run it once from **Actions > BulkReg** (guide B18a). bulkreg_log.nsf: `00 - Set Up Log Database` creates it together with the views (guide B20a). Both also set the launch option *Show About Application document*; if it does not open by itself, set it in Database Properties > Launch tab. The screen is native Notes rich text (tables, fonts, colours); the Notes client does not render pass-through HTML. The agents report the import result, including an error text if the import fails.

## Updating to a new release
A release only changes the two script libraries. In Designer replace the whole content of **BulkRegCommon**, then **BulkRegAgents**: click in the editor, Ctrl+A, paste the whole .lss file (Designer puts Options, Declarations and every Sub/Function in place automatically), Ctrl+S, run **Tools > Recompile All LotusScript** and re-sign the database (guide B17a). The agents stay as they are.

## Agent run order (per batch)
All agents run from bulkreg.nsf > **Actions > BulkReg** in the Windows Domino Administrator client.

| # | Agent / action | DryRun | Result |
|---|---|---|---|
| 1 | **01 - Preflight Check** | any | Fix ERRORs; create the mail folders listed in `_mailfolders.txt` |
| 2 | **02 - Build Batch** | any | `BATCH-<id>.csv` + `_summary.txt` (nothing registered) |
| 3 | **You review** `BATCH-<id>.csv` | – | Include Y/N, server, mail file checked |
| 4 | **03 - Register Batch** | **1** | `BATCH-<id>_dryrun_<run>.csv`: every row WOULD_REGISTER |
| 5 | set `DryRun=0` | 0 | – |
| 6 | **03 - Register Batch** (type the batch ID) | **0** | `BATCH-<id>_results.csv`, batch DONE |
| 7 | set `DryRun=1` | 1 | – |
| 8 | **04 - Verify Registration and Vault** (choose the batch; repeat later until all replicas are OK) | any | REGISTERED + IN_VAULT + MAILFILE_OK + REPLICAS_OK |
| 9 | Hand over passwords, delete secrets | 1 | Next batch: back to 1 (or 2) |

- **First time only:** run steps 2–8 once with a 2-user pilot batch.
- **Agent 05** (text-file export) is **not** part of this sequence.
- **DryRun** only affects agent 03. `1` = simulate everything and change nothing (the batch stays open). `0` = register for real (the batch is closed). Always dry-run first, then run live on the same batch file, then set it back to `1`.
- **Where the databases live:** `bulkreg.nsf` (code only) is **local** on the admin workstation, locally encrypted (guide B13–B14). `bulkreg_log.nsf` is on a **server** (guide B15): operators get Author + Create documents, no Delete. Preflight checks both.
- **Central log database is required:** create `bulkreg_log.nsf` (template -Blank-) on a server and set `LogServer` / `LogDb`. BulkReg writes structured Run, Entry and Audit documents; the database owner runs **00 - Set Up Log Database** once to create 8 categorized views (runs by date, batches, users, results, home servers, problems, skipped users, full log - guide B20a, D4a). If the database can't be opened, the agents stop before doing anything.
- **Users without an Internet address are skipped and flagged** (`SkipNoInternetAddress=1`): not put into a batch, listed in `BATCH-<id>_skipped_no_internet_address.csv` and in log view 7. They are picked up automatically once AD/DirSync provides the address.
- **03 cannot run without a batch file from 02**, and each batch can be registered live only once.

## What it does
DirSync creates Person documents for AD users, but those users have no Notes ID and no Domino mail file. BulkReg turns them into **full Domino users** in **reviewed batches**, using HCL's `NotesRegistration.ContactNoteID`, which upgrades the existing Person document in place. For each user it:

- creates a **Notes ID**, deposited in the **ID Vault** through the policy;
- creates a **Domino mail file** on the user's **home server** (for example `mail1\smith.nsf`), and points the Person document at it;
- requests a **replica of the mail file on every other member of the mail cluster** (AdminP "Create Replica", same path).

Every action is audited.

**Mail files (`bulkreg.ini`, guide D3a):**
- **Name = last name** (`MailFileNaming=LASTNAME` → `smith.nsf`; `Müller` → `mueller.nsf`).
- **Unique per home server.** A name is checked against all mail folders on the server, Person documents, open batches and the batch itself. A clash becomes `smith2.nsf` (`MailFileCollision=SUFFIX`), or the row is excluded (`ERROR`).
- **Numbered folders** `mail1`, `mail2` … **directly under the Domino data directory** (next to the existing `mail` folder, not inside it), with at most `MailFilesPerFolder=1000` files each, counting files already there. `MailFolderPrefix=mail` is the name **without** the number; BulkReg rejects `mail1` or `mail\mail`. Existing folders in `MailExistingFolders` (default `mail`) are only checked for duplicate names and never written to.
  ```
  <Domino data directory>   D:\Domino\Data  or  /local/notesdata
    |-- mail\     existing mail files (names checked, untouched)
    |-- mail1\    new mail files    1-1000
    |-- mail2\    new mail files 1001-2000
  ```
- **Prerequisite: pre-create the folders on every home server**, one per 1000 users: 5,000 users → `mail1`–`mail5`, 10,000 → `mail1`–`mail10`. Set `MailFolderMax` to the number you created; Build Batch never assigns a higher folder. Preflight writes the exact folders and commands per server to `C:\BulkReg\audit\BulkReg_Preflight_<run>_mailfolders.txt`.
- **Recorded everywhere:** every decision is written to the batch file (`MailFile`, `MailFileNote`), the batch summary (folder fill), and the audit and results CSVs (`MailFile`, `MailFileStatus`, `MailFileNote`).
- **Mail file ACL:** your admin ID (or the names in `MailACLManager`) gets **Manager**; the user (owner) gets **Editor + Delete documents** (`MailOwnerAccess=EDITOR`). Verify reports and corrects deviations.
- **Optional settings:** `MailTemplate`, `MailACLManager`, `MailQuotaSizeLimit`, `MailCreateFTIndex`.

**Mail cluster (`MailClusterServers`, guide B12.7 and D3c):** list all cluster members once in `bulkreg.ini`. For every user whose home server is a member:
- Agent 03 posts an AdminP **Create Replica** request for each other member right after registration (`CreateClusterReplicas=1`); Agent 04 checks each replica by replica ID (`REPLICAS_OK 3/3`).
- Names and folders are allocated **once for the whole cluster**: `smith.nsf` is unique on every member and `mail1`…`mailN` hold max 1000 files everywhere. Create the folders on **every** cluster member.

Example: one cluster of 4 servers (2 DC, 2 DR), 2500 users on each of the two DC home servers:
```
MailClusterServers=DominoADMail/Demo,DominoADMail2/Demo,DominoADMailDR1/Demo,DominoADMailDR2/Demo
BatchSize=1000   MailFolderMax=5   (5000 users -> mail1..mail5 on all 4 servers)
Wave 1  server_mapping.csv:  *;*;DominoADMail/Demo;;;;;    -> 3 batches (1000+1000+500)
Wave 2  server_mapping.csv:  *;*;DominoADMail2/Demo;;;;;   -> 3 batches (1000+1000+500)
```

## You always know who is registered
| Stage | Agent | Result |
|---|---|---|
| 1 Build | `BulkReg\02 - Build Batch` | `C:\BulkReg\batches\BATCH-<id>.csv` (default 1000 users) + `_summary.txt` (counts per home server and policy). Read-only. |
| 2 Review | You, in Excel | Set `Include=N` to skip users; correct HomeServer / MailFile / OrgUnit / Policy / Groups / VaultServer / ClusterReplicas. Save as CSV UTF-8. |
| 3 Register | `BulkReg\03 - Register Batch` | Registers **only** the Include=Y rows of the file you choose, after a per-server summary and you typing the **batch ID**. Writes `BATCH-<id>_results.csv`. |
| 4 Verify | `BulkReg\04 - Verify Registration and Vault` | Registration, vault, mail file and replica status for that batch (`_verify_<run>.csv`). |

**Notes names:** with `CertifierName=/Demo` users become `Neha Arora/Demo` (with OrgUnit Sales: `Neha Arora/Sales/Demo`). The batch file shows each user's `NotesName` before registration, and 03 stops at the first wrong name. Every new mail file gets the user's name as its database title (`MailFileTitle={CN}`).

Explicit policy names are written as Domino stores them: `*/PolicyName`. Agent 03 never searches names.nsf by itself. Each row's `objectGUID` must still match the Person document. A user in an OPEN batch is never selected into another batch.

## Names and policies (examples use the organization Demo)
| Object | Accepted forms |
|---|---|
| Servers (registration, home, vault) | `CN=DominoADMail/O=Demo` **or** `DominoADMail/Demo` (also with an OU: `CN=DominoADMail/OU=EMEA/O=Demo`) |
| CA certifier (`CertifierName`) | `/Demo` (users become `Neha Arora/Demo`) or `/Sales/Demo`; `Demo` and `O=Demo` are accepted and converted to `/Demo` |
| **Organizational policy** | `*/Demo`, `*/Sales/Demo`. Domino applies it **automatically** at registration. Leave Policy empty (`-` in the mapping) and set `OrgPolicyAssignsVault=1`. |
| **Explicit policy** | `*/DirSync-Vault`. Name it in `DefaultPolicy` or in the mapping's Policy column. |

Mapping columns: empty = use the default from bulkreg.ini; `-` = explicitly none.

## Multiple servers: `config\server_mapping.csv`
- **Registration server:** one per Domino domain (the directory master). All registrations run against it.
- **Home servers:** any number. Each user's home server (where the mail file is created) comes from the mapping file and can be reviewed per row in the batch file.
- **Mail cluster:** replica servers come from `MailClusterServers` in bulkreg.ini (all members except the home server), not from the mapping. Column 8 only overrides it for special cases.
- **ID Vault:** decided by the user's policy (explicit policy from the mapping or `DefaultPolicy`, or an organizational policy). The optional `VaultServer` column is only where BulkReg checks `IsIDInVault`.

**How the mapping file works** (full instructions and examples: guide **B12**):
- **One line per rule.** Each rule has 8 columns separated by `;` (7-column rules from 3.1 still work):

  `MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer;ClusterReplicas`
- **First match wins.** For every user the rules are read **top to bottom**. If the Person document field `MatchField` matches `MatchPattern` (not case-sensitive; `*` = any text, `?` = one character, `[a-l]` = one character from a range), that rule decides the user's home server, OU, explicit policy, groups and vault check server.
- **Empty and `-` columns.** An empty column means "use the default from bulkreg.ini". A hyphen `-` means "none" (OrgUnit, Policy, Groups and ClusterReplicas).
- **Catch-all last.** The last rule `*;*;<server>;;;;;` catches everyone else. **With only one home server, that single line is all you need.**
- **No placeholders.** Any rule still containing `<…>` stops the agents.
- **Test it before any batch.** `01 - Preflight Check` writes `BulkReg_Preflight_<run>_mapping.txt` with the number of users per rule.

```
MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer;ClusterReplicas
InternetAddress;*@emea.demo.com;DominoADMail2/Demo;EMEA;*/DirSync-Vault-EMEA;BR-EMEA;DominoVaultEMEA/Demo;
Department;Sales*;DominoADMail/Demo;Sales;-;BR-Sales;;
*;*;DominoADMail/Demo;;;;;
```

**Waves:**
- batches of 1000 (`BatchSize=1000`, one numbered mail folder per batch);
- one home server per wave: change the catch-all line between waves (see the mail cluster example above);
- `BatchServerFilter=DominoADMail2/Demo` for one server per wave;
- `ExtraSelection` for a department or region.

## Steps
| Step | Do | Done when |
|---|---|---|
| 1 | Prerequisites: rights on the registration server; numbered mail folders pre-created on every home server **and every cluster member** (1 per 1000 users); AdminP may create replicas on the cluster members; CA (you are an RA) or certifier ID; every home server reachable; one explicit policy per group that assigns the vault; backups | Confirmed in the change ticket |
| 2 | Folders `C:\BulkReg\{config,batches,ids,secure,audit,cert}`; restrict batches/ids/secure/cert (`bulkreg.cmd Init`) | Restricted |
| 3 | Configure `bulkreg.ini` + `server_mapping.csv` | No `<PLACEHOLDER>`; DryRun=1 |
| 4 | Build bulkreg.nsf: libraries `BulkRegCommon` then `BulkRegAgents` (all code), + 6 one-line agents named `BulkReg\00 - Set Up Log Database`, `BulkReg\01 - Preflight Check` … `BulkReg\05 - Export to Registration Text File` (+ `BulkReg\08 - Repair Missing Mail Files`, `BulkReg\09 - Reconcile`, `BulkReg\10 - Audit Log Maintenance`, `BulkReg\11 - Batch Manager`) (Shared, On event > Action menu selection, Target None; each contains `Use "BulkRegAgents"` and `Call BR_Run…()`). Do **not** use `\|` in agent names: it is the Notes alias separator. | Compiles, signed |
| 5 | `01 - Preflight Check`: environment + candidates per home server | 0 environment errors; batch plan |
| 6 | `02 - Build Batch` → review `BATCH-<id>.csv` + summary | Reviewed file approved |
| 7 | `03 - Register Batch` with DryRun=1 | All rows WOULD_REGISTER |
| 8 | Pilot batch of 2 users (once) | REGISTERED + IN_VAULT |
| 9 | `03 - Register Batch` with DryRun=0, type the batch ID | Batch DONE |
| 9b | Only with `MailFileDeferred=1` (or to repair): `08 - Repair Missing Mail Files` (batch, server or empty) | MAIL_CREATED for every user; also accepts `RECON_<run>_gaps.csv` as scope; then `09 - Reconcile` shows nothing missing |
| 10 | `04 - Verify Registration and Vault` (choose the batch); hand over passwords; `PurgeSecrets` | All IN_VAULT, MAILFILE_OK, REPLICAS_OK. **Repeat 6–10.** |

## PowerShell helper (optional)
`scripts\windows\bulkreg.cmd` with these commands: `Init`, `Check`, `Batches` (list OPEN/DONE batches), `DryRun On|Off`, `Status [file]`, `Tail`, `PurgeSecrets [-IncludeIds] [-Yes]`, `Versions` (checks that every kit file carries the number in `VERSION`). Registration doesn't need it.

## Kit contents
```
VERSION      current release (4.6.0)   ·   CHANGELOG.md   release history
config/      bulkreg.ini, server_mapping.csv (templates – no secrets)
lotusscript/ BulkRegCommon.lss + BulkRegAgents.lss    (the code of the manual agents)
             Agent00_SetUpLogDatabase, Agent01_Preflight ... Agent05_ExportToBatchRegFile,
             Agent06_InstallWelcomePage, Agent08_RepairMailFiles, Agent09_Reconcile,
             Agent10_AuditMaintenance, Agent11_BatchManager, Agent12_RemoveDuplicates (.lss)
                                                 (3 + 3 lines each: Use + Call BR_Run...)
scripts/     windows/bulkreg.ps1 + bulkreg.cmd                 (optional helper)
tools/       BulkReg_AuditViewer.html                          (optional, offline)
docs/        BulkReg_Admin_Guide.html + build sources (content.js, build_html.js)
archive/     linux-server-mode/                                (retired, not used)
```
**Audit folders:** every run writes into its own folder `C:\BulkReg\audit\<date>_<time>_<NN-Agent>_<MODE>` - for 03 the MODE is `DRYRUN` or `LIVE-PRODUCTION`, so simulations and production runs are never mixed up. Each folder has a `RUN_INFO.txt`.

Batch files, ID files, passwords and audit logs contain personal data or secrets. They live in `C:\BulkReg\` and are blocked by `.gitignore`. Never commit them.

## Push updates to your existing GitHub repo
Run in Terminal from the project folder. Replace `<org-or-user>/<repo>` with your repo.

**First time only (connect this folder to the repo you created):**
```bash
cd ~/CascadeProjects/"Domino Bulk user Registration - Oct 26"
git remote -v                                          # empty = no remote yet
git remote add origin https://github.com/<org-or-user>/<repo>.git
git fetch origin
git branch -a                                          # does remotes/origin/main exist?
```
- **If the GitHub repo is empty**, push:
  ```bash
  git push -u origin main
  ```
- **If it already has commits** (for example a README or LICENSE created on github.com), merge them, keep your local version of any conflicting file, then push:
  ```bash
  git pull origin main --allow-unrelated-histories --no-rebase -X ours -m "Merge GitHub initial commit"
  git push -u origin main
  ```

**Every update afterwards:**
```bash
git status                       # review changes
git add -A
git commit -m "Describe the change"
git pull --rebase                # pick up changes made elsewhere
git push
```

**Useful checks:**
```bash
git log --oneline -5             # recent commits
git remote -v                    # which repo you push to
git diff --stat HEAD~1           # what the last commit changed
```

## Verify before production
The code is written against the HCL 14.5 documentation but has **not been compiled or run** on a live server. Run Steps 7–8 (dry run and pilot) first. See guide chapter 20.
