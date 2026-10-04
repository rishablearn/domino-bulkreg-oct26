# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 1.3.0 · run from the **HCL Domino Administrator client on Windows** · Domino 14.x
**Full step-by-step guide (start here):** `docs/BulkReg_Admin_Guide.docx` (or `.html`), v2.5. It assumes nothing exists and walks through every click: directory roles, CA/RA, ID Vault, Security Settings, explicit policy, folders, config, bulkreg.nsf, library, agents, signing, then each batch.

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
| 8 | **04 - Verify Registration and Vault** (choose the batch) | any | REGISTERED + IN_VAULT + MAILFILE_OK |
| 9 | Hand over passwords, delete secrets | 1 | Next batch: back to 1 (or 2) |

- **First time only:** run steps 2–8 once with a 2-user pilot batch.
- **Agent 05** (text-file export) is **not** part of this sequence.
- **03 cannot run without a batch file from 02**, and each batch can be registered live only once.

## What it does
DirSync creates Person documents for AD users, but those users have no Notes ID and no Domino mail file. BulkReg turns them into **full Domino users** in **reviewed batches**, using HCL's `NotesRegistration.ContactNoteID`, which upgrades the existing Person document in place. For each user it:

- creates a **Notes ID**, deposited in the **ID Vault** through the policy;
- creates a **Domino mail file** on the user's **home server** (for example `mail\jsmith.nsf`), and points the Person document at it.

Every action is audited.

**Mail files (`bulkreg.ini`, guide D3a):**
- **Name = last name** (`MailFileNaming=LASTNAME` → `smith.nsf`; `Müller` → `mueller.nsf`).
- **Unique per home server.** A name is checked against all mail folders on the server, Person documents, open batches and the batch itself. A clash becomes `smith2.nsf` (`MailFileCollision=SUFFIX`), or the row is excluded (`ERROR`).
- **Numbered folders** `mail1`, `mail2` … with at most `MailFilesPerFolder=1000` files each, counting files already there.
- **Prerequisite: pre-create the folders on every home server**, one per 1000 users: 5,000 users → `mail1`–`mail5`, 10,000 → `mail1`–`mail10`. Set `MailFolderMax` to the number you created; Build Batch never assigns a higher folder. Preflight writes the exact folders and commands per server to `C:\BulkReg\audit\BulkReg_Preflight_<run>_mailfolders.txt`.
- **Recorded everywhere:** every decision is written to the batch file (`MailFile`, `MailFileNote`), the batch summary (folder fill), and the audit and results CSVs (`MailFile`, `MailFileStatus`, `MailFileNote`).
- **Optional settings:** `MailTemplate`, `MailACLManager`, `MailQuotaSizeLimit`, `MailCreateFTIndex`.

## You always know who is registered
| Stage | Agent | Result |
|---|---|---|
| 1 Build | `BulkReg\02 - Build Batch` | `C:\BulkReg\batches\BATCH-<id>.csv` (default 500 users) + `_summary.txt` (counts per home server and policy). Read-only. |
| 2 Review | You, in Excel | Set `Include=N` to skip users; correct HomeServer / MailFile / OrgUnit / Policy / Groups / VaultServer. Save as CSV UTF-8. |
| 3 Register | `BulkReg\03 - Register Batch` | Registers **only** the Include=Y rows of the file you choose, after a per-server summary and you typing the **batch ID**. Writes `BATCH-<id>_results.csv`. |
| 4 Verify | `BulkReg\04 - Verify Registration and Vault` | Registration, vault and mail file status for that batch (`_verify_<run>.csv`). |

Explicit policy names are written as Domino stores them: `*/PolicyName`. Agent 03 never searches names.nsf by itself. Each row's `objectGUID` must still match the Person document. A user in an OPEN batch is never selected into another batch.

## Names and policies (examples use the organization Demo)
| Object | Accepted forms |
|---|---|
| Servers (registration, home, vault) | `CN=DominoADMail/O=Demo` **or** `DominoADMail/Demo` (also with an OU: `CN=DominoADMail/OU=EMEA/O=Demo`) |
| CA certifier (`CertifierName`) | `O=Demo` or `OU=Sales/O=Demo` |
| **Organizational policy** | `*/Demo`, `*/Sales/Demo`. Domino applies it **automatically** at registration. Leave Policy empty (`-` in the mapping) and set `OrgPolicyAssignsVault=1`. |
| **Explicit policy** | `*/DirSync-Vault`. Name it in `DefaultPolicy` or in the mapping's Policy column. |

Mapping columns: empty = use the default from bulkreg.ini; `-` = explicitly none.

## Multiple servers
- **Registration server:** one per Domino domain (the directory master). All registrations run against it.
- **Home servers:** any number. They're assigned per user by `config\server_mapping.csv` (first matching rule wins), reviewable per row, and passed to `RegisterNewUser` in canonical form.
- **ID Vault:** chosen by the **explicit policy** of each rule. The optional `VaultServer` column is where BulkReg checks `IsIDInVault`.
- **Waves:**
  - Mixed batches of 500.
  - `BatchServerFilter=DominoADMail2/Demo` for one server per wave.
  - `ExtraSelection` for department or region waves.

```
MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer
InternetAddress;*@emea.demo.com;CN=DominoADMail2/O=Demo;EMEA;*/DirSync-Vault-EMEA;BR-EMEA;DominoVaultEMEA/Demo
Department;Sales*;DominoADMail/Demo;Sales;-;BR-Sales;
*;*;DominoADMail/Demo;;;;
```

## Steps
| Step | Do | Done when |
|---|---|---|
| 1 | Prerequisites: rights on the registration server; numbered mail folders pre-created on every home server (1 per 1000 users); CA (you are an RA) or certifier ID; every home server reachable; one explicit policy per group that assigns the vault; backups | Confirmed in the change ticket |
| 2 | Folders `C:\BulkReg\{config,batches,ids,secure,audit,cert}`; restrict batches/ids/secure/cert (`bulkreg.cmd Init`) | Restricted |
| 3 | Configure `bulkreg.ini` + `server_mapping.csv` | No `<PLACEHOLDER>`; DryRun=1 |
| 4 | Build bulkreg.nsf: library `BulkRegCommon` + 5 agents named `BulkReg\01 - Preflight Check` … `BulkReg\05 - Export to Registration Text File` (Shared, On event > Action menu selection, Target None). Do **not** use `\|` in agent names: it is the Notes alias separator. | Compiles, signed |
| 5 | `01 - Preflight Check`: environment + candidates per home server | 0 environment errors; batch plan |
| 6 | `02 - Build Batch` → review `BATCH-<id>.csv` + summary | Reviewed file approved |
| 7 | `03 - Register Batch` with DryRun=1 | All rows WOULD_REGISTER |
| 8 | Pilot batch of 2 users (once) | REGISTERED + IN_VAULT |
| 9 | `03 - Register Batch` with DryRun=0, type the batch ID | Batch DONE |
| 10 | `04 - Verify Registration and Vault` (choose the batch); hand over passwords; `PurgeSecrets` | All IN_VAULT. **Repeat 6–10.** |

## PowerShell helper (optional)
`scripts\windows\bulkreg.cmd` with these commands: `Init`, `Check`, `Batches` (list OPEN/DONE batches), `DryRun On|Off`, `Status [file]`, `Tail`, `PurgeSecrets [-IncludeIds] [-Yes]`. Registration doesn't need it.

## Kit contents
```
config/      bulkreg.ini, server_mapping.csv                 (templates – no secrets)
lotusscript/ BulkRegCommon.lss, Agent01_Preflight, Agent02_BuildBatch, Agent03_RegisterBatch,
             Agent04_VerifyVaultStatus, Agent05_ExportToBatchRegFile (.lss)
scripts/     windows/bulkreg.ps1 + bulkreg.cmd                 (optional helper)
tools/       BulkReg_AuditViewer.html                          (optional, offline)
docs/        BulkReg_Admin_Guide.docx/.html + build sources
archive/     linux-server-mode/                                (retired, not used)
```
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
