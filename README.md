# BulkReg – Bulk registration of DirSync users in HCL Domino (ID Vault)

BulkReg 1.1.0 · HCL Domino 14.x on Windows and Linux/RHEL
Full guide: `docs/BulkReg_Admin_Guide.docx` (or `.html`). This README is the short version, in the same order.

## What it does
DirSync creates Person documents for AD users, but those users have no Notes ID. BulkReg registers them in bulk using HCL's `NotesRegistration.ContactNoteID`, which upgrades the existing Person document in place. The ID is deposited in the **ID Vault** through an explicit policy. Each user gets a home server from a mapping file, and every action is audited.

## Pick a mode
| | Mode A – Windows client | Mode B – Domino server (Windows or **Linux/RHEL**) |
|---|---|---|
| Start an agent | bulkreg.nsf → Actions | Console: `tell amgr run "bulkreg.nsf" '<agent>'` |
| Certifier | Domino CA or certifier ID (password prompted) | Domino CA only; the server must be a Registration Authority |
| LIVE confirmation | Yes/No dialog, then type `REGISTER` | `ServerRunEnabled=1` + `ServerConfirm=REGISTER-<today>` |

HCL provides the Domino Administrator client for Windows only, so on RHEL use Mode B.

## Steps (do them in order)
| Step | Do | Done when |
|---|---|---|
| 1 Prerequisites | Directory rights; CA/RA (Mode B: the server is the RA); explicit policy that assigns the ID Vault; backups | All confirmed in the change ticket |
| 2 Folders | Create `config ids secure audit cert` under `C:\BulkReg\` or `/local/bulkreg/`; lock down ids/secure/cert (commands below) | Folders exist; ids/secure/cert restricted |
| 3 Configure | Fill in `bulkreg.ini` (Windows) or `bulkreg.linux.ini` saved as `bulkreg.ini`, plus `server_mapping.csv`. Mode B: `set config BulkRegConfigPath=<path>` | No `<PLACEHOLDER>` left; DryRun=1 |
| 4 Build | bulkreg.nsf: library `BulkRegCommon` + 4 agents (Mode B: On schedule, *Allow restricted operations*) | Compiles, signed, admin-only ACL |
| 5 Preflight | Run Agent 01 | 0 environment errors, 0 user ERRORs |
| 6 Dry run | Run Agent 03 with DryRun=1 | WOULD_REGISTER rows look right |
| 7 Pilot | 2 users: `ExtraSelection`, `BatchSize=2`, `DryRun=0` (Mode B also: today's ServerConfirm). Then run Agent 04. | Both REGISTERED and IN_VAULT |
| 8 Batches | Clear ExtraSelection and run Agent 03 repeatedly | Everyone in scope REGISTERED |
| 9 Close | Agent 04; hand over passwords; delete secrets; DryRun=1, ServerRunEnabled=0 | All IN_VAULT; secrets gone |

### Step 2 commands
Linux/RHEL (root; `notes` = the Domino OS account):
```bash
mkdir -p /local/bulkreg/{config,ids,secure,audit,cert}
chown -R notes:notes /local/bulkreg
chmod 750 /local/bulkreg /local/bulkreg/config /local/bulkreg/audit
chmod 700 /local/bulkreg/ids /local/bulkreg/secure /local/bulkreg/cert
```
Windows (elevated PowerShell):
```powershell
$b='C:\BulkReg'; 'config','ids','secure','audit','cert' | % { New-Item -ItemType Directory -Force "$b\$_" }
'ids','secure','cert' | % { icacls "$b\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)F" }
```

## Do I need the PowerShell / Linux scripts?
**No, they are optional.** Registration happens entirely inside Domino. The scripts only automate operating-system chores around a run:

| Task | Manual way | Script |
|---|---|---|
| Folders + permissions | Step 2 commands | `init` / `Init` |
| Validate config (placeholders, wrong-OS paths, UseCA on server, permissions) | Read the file | `check` / `Check` |
| Arm/disarm Mode B, set today's LIVE token, toggle DryRun | Edit bulkreg.ini | `arm` `disarm` `confirm-today` `dryrun on/off` |
| Console commands | Copy from guide | `console`, `run NN` |
| Results summary / follow log | Audit Viewer, Excel, `tail -F` | `status`, `tail` |
| Delete passwords / local IDs | `shred -u` / `Remove-Item` | `purge-secrets [--include-ids] --yes` |

- **Recommended on Linux/RHEL**, where there is no desktop.
- **Optional on a Windows client.**
- On a Windows Domino server, `Init -ServiceAccount DOMAIN\svc` sets the correct ACLs.
- The scripts keep a `.bak` copy of the config and show a diff on every change, and log their actions to `<AuditDir>/bulkreg_admin_actions.log`.

Run them with `./scripts/linux/bulkreg.sh help` or `.\scripts\windows\bulkreg.cmd Help`.

## Kit contents
```
config/      bulkreg.ini (Windows), bulkreg.linux.ini, server_mapping.csv
lotusscript/ BulkRegCommon.lss, Agent01..04 (.lss)
scripts/     linux/bulkreg.sh, windows/bulkreg.ps1 + bulkreg.cmd   (optional)
tools/       BulkReg_AuditViewer.html                               (optional, offline)
docs/        BulkReg_Admin_Guide.docx/.html + build sources (content.js)
```

## Verify before production
- The code is written against the HCL 14.5 documentation but has **not been compiled or run** on a live server, so Steps 5–7 are mandatory.
- `bulkreg.sh` was tested on a mock Linux layout only. `bulkreg.ps1` was reviewed but not executed.
- See guide chapter 17 for the full list.
