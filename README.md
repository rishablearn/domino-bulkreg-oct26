# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 1.2.0 · run from the **HCL Domino Administrator client on Windows** · Domino 14.x
Full guide: `docs/BulkReg_Admin_Guide.docx` (or `.html`). This README is the short version.

## What it does
DirSync creates Person documents for AD users, but those users have no Notes ID. BulkReg registers them in bulk using HCL's `NotesRegistration.ContactNoteID`, which upgrades the existing Person document in place. The ID is deposited in the **ID Vault** through an explicit policy. Each user gets a home server from a mapping file, and every action is audited.

**Where it runs:** everything is started from bulkreg.nsf → **Actions** in the Domino Administrator client on a Windows admin workstation. The library refuses to run on a server or a non-Windows client. Local files live in `C:\BulkReg\`.

## Steps (do them in order)
| Step | Do | Done when |
|---|---|---|
| 1 Prerequisites | Directory rights; CA (you are a Registration Authority) or certifier ID; explicit policy that assigns the ID Vault; Admin client + Designer installed; backups | All confirmed in the change ticket |
| 2 Folders | Create `C:\BulkReg\{config,ids,secure,audit,cert}`; lock down ids/secure/cert | Folders exist and are restricted |
| 3 Configure | Fill in `C:\BulkReg\config\bulkreg.ini` and `server_mapping.csv` | No `<PLACEHOLDER>` left; DryRun=1 |
| 4 Build | bulkreg.nsf: library `BulkRegCommon` + 4 agents (Action menu selection, Target None) | Compiles, signed, admin-only ACL |
| 5 Preflight | Actions → 01 Preflight Check | 0 environment errors, 0 user ERRORs |
| 6 Dry run | Actions → 03 Bulk Register with DryRun=1 | WOULD_REGISTER rows look right |
| 7 Pilot | 2 users: `ExtraSelection`, `BatchSize=2`, `DryRun=0`, type REGISTER; then 04 Verify | Both REGISTERED and IN_VAULT |
| 8 Batches | Clear ExtraSelection and run 03 repeatedly | Everyone in scope REGISTERED |
| 9 Close | 04 Verify; hand over passwords; delete secrets; DryRun=1 | All IN_VAULT; secrets gone |

Step 2 in an elevated PowerShell:
```powershell
$b='C:\BulkReg'; 'config','ids','secure','audit','cert' | % { New-Item -ItemType Directory -Force "$b\$_" }
'ids','secure','cert' | % { icacls "$b\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)F" }
```

## PowerShell helper (optional)
Registration doesn't need it. `scripts\windows\bulkreg.cmd` only speeds up the Windows file tasks:

- `Init`: creates the folders, locks down permissions and copies the templates
- `Check`: validates folders, permissions and config values
- `DryRun On|Off`: switches dry run on or off
- `Status`: summarises the newest audit CSV
- `Tail`: follows the debug log during a run
- `PurgeSecrets [-IncludeIds] [-Yes]`: deletes initial-password files and local ID files

Each command has a manual equivalent (guide chapter 12).

## Kit contents
```
config/      bulkreg.ini, server_mapping.csv                 (templates – no secrets)
lotusscript/ BulkRegCommon.lss, Agent01..04 (.lss)            (paste into bulkreg.nsf)
scripts/     windows/bulkreg.ps1 + bulkreg.cmd                 (optional helper)
tools/       BulkReg_AuditViewer.html                          (optional, offline)
docs/        BulkReg_Admin_Guide.docx/.html + build sources
archive/     linux-server-mode/  (retired server/Linux design, not used)
```

## Sync with GitHub (private repo)

**One-time: create the private repo and push.** Run in the repo folder.

macOS Terminal:
```bash
cd ~/CascadeProjects/"Domino Bulk user Registration - Oct 26"
gh auth login                                   # once, if not signed in
gh repo create <org-or-user>/domino-bulkreg --private --source=. --remote=origin --push
```

Without the GitHub CLI: create an **empty private** repo at github.com/new (no README or .gitignore), then:
```bash
git remote add origin https://github.com/<org-or-user>/domino-bulkreg.git
git push -u origin main
```

**Every time you change something:**
```bash
git status                                      # review what changed
git add -A
git commit -m "Short description of the change"
git push
```

**Get the kit on the Windows admin workstation** (Git for Windows, PowerShell):
```powershell
cd C:\
git clone https://github.com/<org-or-user>/domino-bulkreg.git C:\BulkReg-kit
# later, to pick up changes:
cd C:\BulkReg-kit; git pull
```
Keep the kit (`C:\BulkReg-kit`) separate from the working folder (`C:\BulkReg`). Real configs, ID files, passwords and audit logs must never go into Git; `.gitignore` already blocks them.

## Verify before production
The code is written against the HCL 14.5 documentation but has **not been compiled or run** on a live server, so Steps 5–7 are mandatory. `bulkreg.ps1` was reviewed but not executed. See guide chapter 17.
