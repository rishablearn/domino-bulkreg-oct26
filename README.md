# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 1.3.0 · run from the **HCL Domino Administrator client on Windows** · Domino 14.x
Full guide: `docs/BulkReg_Admin_Guide.docx` (or `.html`), v1.4.

## What it does
DirSync creates Person documents for AD users, but those users have no Notes ID. BulkReg registers them in **reviewed batches** using HCL's `NotesRegistration.ContactNoteID`, which upgrades the existing Person document in place. The ID is deposited in the **ID Vault** through an explicit policy. Each user is assigned to a **home server** across your Domino servers, and every action is audited.

## You always know who is registered
| Stage | Agent | Result |
|---|---|---|
| 1 Build | `02 \| Build Batch` | `C:\BulkReg\batches\BATCH-<id>.csv` (default 500 users) + `_summary.txt` (counts per home server and policy). Read-only. |
| 2 Review | You, in Excel | Set `Include=N` to skip users; correct HomeServer / OrgUnit / Policy / Groups / VaultServer. Save as CSV UTF-8. |
| 3 Register | `03 \| Register Batch` | Registers **only** the Include=Y rows of the file you choose, after a per-server summary and you typing the **batch ID**. Writes `BATCH-<id>_results.csv`. |
| 4 Verify | `04 \| Verify` | Registration and vault status for that batch (`_verify_<run>.csv`). |

Agent 03 never searches names.nsf by itself. Each row's `objectGUID` must still match the Person document. A user in an OPEN batch is never selected into another batch.

## Multiple servers
- **Registration server:** one per Domino domain (the directory master). All registrations run against it.
- **Home servers:** any number. They're assigned per user by `config\server_mapping.csv` (first matching rule wins), reviewable per row, and passed to `RegisterNewUser` in canonical form.
- **ID Vault:** chosen by the **explicit policy** of each rule. The optional `VaultServer` column is where BulkReg checks `IsIDInVault`.
- **Waves:**
  - Mixed batches of 500.
  - `BatchServerFilter=Mail02/ORG` for one server per wave.
  - `ExtraSelection` for department or region waves.

```
MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer
InternetAddress;*@emea.example.com;Mail02/ORG;EMEA;/ORG-DirSync-Vault-EMEA;BR-EMEA;VaultEMEA/ORG
*;*;Mail01/ORG;;;;
```

## Steps
| Step | Do | Done when |
|---|---|---|
| 1 | Prerequisites: rights on the registration server; CA (you are an RA) or certifier ID; every home server reachable; one explicit policy per group that assigns the vault; backups | Confirmed in the change ticket |
| 2 | Folders `C:\BulkReg\{config,batches,ids,secure,audit,cert}`; restrict batches/ids/secure/cert (`bulkreg.cmd Init`) | Restricted |
| 3 | Configure `bulkreg.ini` + `server_mapping.csv` | No `<PLACEHOLDER>`; DryRun=1 |
| 4 | Build bulkreg.nsf: library + agents 01–05 (Action menu selection, Target None) | Compiles, signed |
| 5 | `01 Preflight`: environment + candidates per home server | 0 environment errors; batch plan |
| 6 | `02 Build Batch` → review `BATCH-<id>.csv` + summary | Reviewed file approved |
| 7 | `03 Register Batch` with DryRun=1 | All rows WOULD_REGISTER |
| 8 | Pilot batch of 2 users (once) | REGISTERED + IN_VAULT |
| 9 | `03 Register Batch` with DryRun=0, type the batch ID | Batch DONE |
| 10 | `04 Verify` (choose the batch); hand over passwords; `PurgeSecrets` | All IN_VAULT. **Repeat 6–10.** |

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
