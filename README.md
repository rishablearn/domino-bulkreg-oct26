# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 3.9.4 · run from the **HCL Domino Administrator client on Windows** · Domino 14.x
**Full step-by-step guide (start here):** `docs/BulkReg_Admin_Guide.docx` (or `.html`), same version as the kit (3.9.4). It assumes nothing exists and walks through every click: directory roles, CA/RA, ID Vault, Security Settings, explicit policy, folders, config, bulkreg.nsf, library, agents, signing, then each batch.

## What changed in 3.9.4
Preflight checks all users (`PreflightScope=ALL`, `_batchplan.txt` shows the split); Build Batch writes all batch files in one run (`BATCH-<run>-01.csv`, `-02.csv` ...); the registration last name is the Person item `JobTitle` as it is (`LastNameField`; no name is constructed); users are filled into the `HomeServers` pool (`HomeServerAssignment=FILL`: first server up to 2500, then the next; mapping rule `AUTO`); the short name comes from the AD samaccountname item (`ShortNameFields`), never the FullName; a missing Internet address is constructed as `<shortname>@<InternetDomain>`; Domino on Linux (`ServerOS=LINUX`, `/local/notesdata`, paths sent as `mail1/smith.nsf`). The audit and batch files carry `FullNameAfter` (the Person name after registration); the Person item `JobTitle` (rank, first, last from AD) is registered as the last name. Details: `CHANGELOG.md`. Upgrade steps: `DEPLOY-3.9.4.md`.

## Welcome page (3.9.4)
bulkreg.nsf opens on a branded start page with the short procedure instead of an empty view. One time, after the libraries are installed: create the agent `BulkReg\06 - Install Welcome Page` (`lotusscript/Agent06_InstallWelcomePage.lss`, Shared, Action menu selection, Target None), run it from **Actions > BulkReg**, then in Designer set **Database Properties > Launch > On Database Open: Open designated Page > BulkReg Welcome** (guide B18a). Re-run the agent after a release that changes the page.

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
| 4 | Build bulkreg.nsf: libraries `BulkRegCommon` then `BulkRegAgents` (all code), + 6 one-line agents named `BulkReg\00 - Set Up Log Database`, `BulkReg\01 - Preflight Check` … `BulkReg\05 - Export to Registration Text File` (Shared, On event > Action menu selection, Target None; each contains `Use "BulkRegAgents"` and `Call BR_Run…()`). Do **not** use `\|` in agent names: it is the Notes alias separator. | Compiles, signed |
| 5 | `01 - Preflight Check`: environment + candidates per home server | 0 environment errors; batch plan |
| 6 | `02 - Build Batch` → review `BATCH-<id>.csv` + summary | Reviewed file approved |
| 7 | `03 - Register Batch` with DryRun=1 | All rows WOULD_REGISTER |
| 8 | Pilot batch of 2 users (once) | REGISTERED + IN_VAULT |
| 9 | `03 - Register Batch` with DryRun=0, type the batch ID | Batch DONE |
| 10 | `04 - Verify Registration and Vault` (choose the batch); hand over passwords; `PurgeSecrets` | All IN_VAULT, MAILFILE_OK, REPLICAS_OK. **Repeat 6–10.** |

## PowerShell helper (optional)
`scripts\windows\bulkreg.cmd` with these commands: `Init`, `Check`, `Batches` (list OPEN/DONE batches), `DryRun On|Off`, `Status [file]`, `Tail`, `PurgeSecrets [-IncludeIds] [-Yes]`, `Versions` (checks that every kit file carries the number in `VERSION`). Registration doesn't need it.

## Kit contents
```
VERSION      current release (3.9.4)   ·   CHANGELOG.md   release history
config/      bulkreg.ini, server_mapping.csv                 (templates – no secrets)
lotusscript/ BulkRegCommon.lss + BulkRegAgents.lss    (ALL code - the two script libraries)
             Agent00_SetUpLogDatabase, Agent01_Preflight ... Agent05_ExportToBatchRegFile,
             Agent06_InstallWelcomePage (.lss)
                                                 (3 + 3 lines each: Use + Call BR_Run...)
scripts/     windows/bulkreg.ps1 + bulkreg.cmd                 (optional helper)
tools/       BulkReg_AuditViewer.html                          (optional, offline)
docs/        BulkReg_Admin_Guide.docx/.html + build sources
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
