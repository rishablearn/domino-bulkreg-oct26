// BulkReg guide v1.2 — single source for Word + Web.
// Structure: Understand (1–2) → Do, in order (Steps 1–9) → Reference (12–17) → Appendices
// Block types: h1 h2 h3 p bullets numbers table code note warn done pagebreak refs
const META = {
  title: "BulkReg Framework",
  subtitle: "Bulk Registration of Directory Sync (Active Directory) Users in HCL Domino with ID Vault – Windows and Linux / RHEL",
  docType: "Administrator, Operations & Audit Guide",
  version: "1.2",
  date: "October 2026",
  author: "Rishab Sharma",
  classification: "HCL Confidential – Internal Use",
  status: "Draft for review",
};

const C = [];
const h1 = (t) => C.push({ t: "h1", text: t });
const h2 = (t) => C.push({ t: "h2", text: t });
const h3 = (t) => C.push({ t: "h3", text: t });
const p = (t) => C.push({ t: "p", text: t });
const ul = (...items) => C.push({ t: "bullets", items });
const ol = (...items) => C.push({ t: "numbers", items });
const tbl = (head, rows, widths) => C.push({ t: "table", head, rows, widths });
const code = (text) => C.push({ t: "code", text });
const note = (text) => C.push({ t: "note", text });
const warn = (text) => C.push({ t: "warn", text });
const done = (text) => C.push({ t: "done", text });
const pb = () => C.push({ t: "pagebreak" });

// ================================================================ DOCUMENT CONTROL
h1("Document Control");
tbl(["Item", "Value"], [
  ["Document", META.title + " – " + META.docType],
  ["Version", META.version + " (" + META.status + ")"],
  ["Date / Author", META.date + " / " + META.author],
  ["Classification", META.classification],
  ["Applies to", "HCL Domino 14.x on Windows and Linux (RHEL). Domino Administrator 14.x client (Windows only)."],
  ["Framework version", "BulkReg 1.1.0 (BulkRegCommon library, Agents 01–04, helper scripts)"],
], [2400, 6960]);
h3("Revision history");
tbl(["Version", "Change"], [
  ["1.0", "First release: framework, Windows client mode"],
  ["1.1", "Windows + Linux/RHEL server (headless) mode, helper scripts"],
  ["1.2", "Guide restructured into a step-by-step runbook. Helper scripts explained, with manual equivalents."],
], [1200, 8160]);
h3("Review and approval");
tbl(["Role", "Name", "Decision / Date"], [
  ["Domino platform owner", "", ""],
  ["Security / IAM owner", "", ""],
  ["Change manager (CAB)", "", ""],
  ["Audit / compliance reviewer", "", ""],
], [3400, 3200, 2760]);
pb();

// ================================================================ 1 OVERVIEW
h1("1. Overview");
h2("1.1 What BulkReg does");
p("Directory Sync (DirSync) copies Active Directory users into the Domino Directory as Person documents. These users have **no Notes ID**, no certificate and no mail file (Mail system: *Other Internet Mail*). BulkReg registers them **in bulk**. Every user gets a certified Notes ID, the ID is placed in the **ID Vault**, and each user is assigned to the right home server. Every action is logged and auditable.");
p("BulkReg uses HCL's documented API for exactly this case, `NotesRegistration.ContactNoteID`: *“Used to register users who have existing Person documents created by syncing Active Directory users into the Domino directory.”* The existing Person document is upgraded in place, so no duplicate entry is created and users keep their Other Internet Mail setting.");
h2("1.2 Choose how you will run it");
tbl(["", "Mode A – Windows client (interactive)", "Mode B – Domino server (headless)"], [
  ["Runs on", "Domino Administrator / Notes client on Windows", "Domino server on **Windows or Linux / RHEL**"],
  ["Start an agent", "Open bulkreg.nsf → Actions menu", "Server console: `tell amgr run \"bulkreg.nsf\" '<agent>'`"],
  ["Certifier", "Domino CA **or** certifier ID file (password prompted)", "Domino CA only. The server must be a Registration Authority."],
  ["Confirmation", "On-screen Yes/No, then type REGISTER", "`ServerRunEnabled=1` + `ServerConfirm=REGISTER-<today>` in config"],
  ["Choose it when", "You administer from Windows. Simplest option.", "Your Domino servers run on RHEL, or you want runs without a desktop session"],
], [1700, 3830, 3830]);
note("HCL provides the Domino Administrator client for Windows only. On Linux/RHEL, BulkReg therefore runs inside the Domino server (Mode B). The same agents support both modes and detect which one applies automatically.");
h2("1.3 The path you will follow");
tbl(["Step", "What you do", "Changes anything?"], [
  ["1", "Confirm prerequisites (rights, CA, ID Vault policy)", "No"],
  ["2", "Prepare working folders", "Creates local folders"],
  ["3", "Configure bulkreg.ini and server_mapping.csv", "Config files"],
  ["4", "Build bulkreg.nsf (library + 4 agents)", "New tool database"],
  ["5", "Run Preflight (Agent 01)", "No – read-only"],
  ["6", "Dry run (Agent 03, DryRun=1)", "No – simulation"],
  ["7", "Pilot: register 2 users", "**Yes** – 2 users"],
  ["8", "Register in batches", "**Yes**"],
  ["9", "Verify (Agent 04) and close", "Deletes temporary secrets"],
], [800, 5700, 2860]);
h2("1.4 Who reads what");
tbl(["Reader", "Read"], [
  ["Domino administrator", "1–2, then Steps 1–9. Use 12–15 as reference."],
  ["Linux / Windows server administrator", "Step 2, chapter 12"],
  ["CAB / security / audit reviewer", "1, 2.3, 14, 16, 17"],
], [3600, 5760]);

// ================================================================ 2 HOW IT WORKS
h1("2. How BulkReg Works");
h2("2.1 Components");
tbl(["Component", "What it is", "Required?"], [
  ["bulkreg.nsf", "Small Notes database you create. It holds the library and four agents.", "**Yes**"],
  ["BulkRegCommon", "LotusScript library: config, mapping, logging, audit, vault check", "**Yes**"],
  ["Agent 01 – Preflight", "Checks the environment and every candidate. Read-only.", "**Yes**"],
  ["Agent 02 – Export", "Writes HCL's registration text file (Appendix A method only)", "Optional"],
  ["Agent 03 – Bulk Register", "Registers users", "**Yes**"],
  ["Agent 04 – Verify", "Reports registration and ID Vault status. Read-only.", "**Yes**"],
  ["bulkreg.ini / bulkreg.linux.ini", "Settings (no secrets)", "**Yes**"],
  ["server_mapping.csv", "Rules: which home server, OU, policy and groups each user gets", "**Yes** (one line minimum)"],
  ["bulkreg.sh / bulkreg.ps1", "Helper scripts for folder setup, checks and reporting (chapter 12)", "Optional"],
  ["BulkReg_AuditViewer.html", "Offline viewer for the audit CSV files", "Optional"],
], [2500, 5260, 1600]);
h2("2.2 What happens to each user (Agent 03)");
ol(
  "Selects Person documents that **have** `objectGUID` and **have no** `Certificate`. This is HCL's documented rule for DirSync users.",
  "Applies the first matching rule in server_mapping.csv to get home server, OU, explicit policy and groups.",
  "Re-reads the document. If it was registered in the meantime, it is skipped (safe to re-run).",
  "Validates the data. Bad records are logged and skipped.",
  "Calls `RegisterNewUser` with `ContactNoteID`. The explicit policy assigns the **ID Vault**, so the ID is deposited during registration.",
  "Confirms the Certificate now exists. Puts back the original Mail system (*Other Internet Mail*) if that is configured.",
  "Checks `IsIDInVault`, then writes one audit row. If enabled, the initial password goes to a separate restricted file."
);
h2("2.3 Built-in safety controls");
tbl(["Control", "Effect"], [
  ["DryRun=1 by default", "Nothing changes until you deliberately set DryRun=0"],
  ["Confirmation", "Mode A: Yes/No dialog, then type REGISTER. Mode B: ServerRunEnabled=1 **and** today's ServerConfirm token."],
  ["BatchSize / MaxConsecutiveErrors", "Limits each run, and stops automatically after repeated failures"],
  ["Idempotent", "The certificate is re-checked before each user, so a re-run never registers anyone twice"],
  ["No stored certifier password", "Prompted (Mode A) or not needed (CA, Mode B). Never logged."],
  ["Full audit trail", "One CSV row per user per action, a debug log, and an optional central Agent Log"],
], [3000, 6360]);
pb();

// ================================================================ STEP 1
h1("3. Step 1 – Confirm Prerequisites");
p("**Who:** Domino administrator. **Where:** Domino Administrator. **Changes:** none.");
tbl(["#", "Check", "Why"], [
  ["1", "DirSync is running and AD users appear as Person documents (the document properties show an `objectGUID` item)", "These are the users BulkReg registers"],
  ["2", "Your ID (Mode A) or the agent signer (Mode B) has **Editor** access, or the [UserCreator] and [UserModifier] roles, in names.nsf on the registration server", "Needed to register users"],
  ["3", "Certification is ready. **Domino CA:** your ID (Mode A) or the **registration server** (Mode B) is listed as a Registration Authority. **Certifier ID:** the file and its password are available (Mode A only).", "HCL: for code run on the server, *“the server … must be listed as an RA to use the CA”*"],
  ["4", "The ID Vault exists, with replicas on your vault servers", "Target for the IDs"],
  ["5", "An **explicit policy** exists whose **Security Settings assign the ID Vault** (one per region if needed)", "This is what puts each ID into the vault"],
  ["6", "Recommended: the same Security Settings force a password change at first use", "Initial passwords are temporary"],
  ["7", "A backup of names.nsf and of the ID Vault is in place", "Rollback is limited (chapter 16)"],
], [500, 5800, 3060]);
done("All seven checks are confirmed and recorded in the change ticket.");

// ================================================================ STEP 2
h1("4. Step 2 – Prepare Working Folders");
p("**Who:** Windows or Linux administrator. **Changes:** creates local folders. BulkReg writes ID files, initial passwords and audit logs to disk, so these folders must exist and two of them must be locked down.");
tbl(["Folder", "Holds", "Access"], [
  ["config", "bulkreg.ini, server_mapping.csv", "Admins"],
  ["ids", "ID files created during registration", "**Restricted** – admin (Mode A) or Domino service account (Mode B)"],
  ["secure", "Initial-password file, registration text file", "**Restricted** – same as ids"],
  ["audit", "Audit CSVs, debug logs", "Admins and auditors (read)"],
  ["cert", "Certifier ID (Mode A with UseCA=0 only)", "**Restricted**"],
], [1500, 4000, 3860]);
p("Default base folder: `C:\\BulkReg\\` on Windows and `/local/bulkreg/` on Linux. **Where:** Mode A on the admin workstation; Mode B on the Domino server.");
h3("Option 1 – manual commands");
p("**Windows (elevated PowerShell):**");
code(`$b = 'C:\\BulkReg'
'config','ids','secure','audit','cert' | ForEach-Object { New-Item -ItemType Directory -Force "$b\\$_" }
'ids','secure','cert' | ForEach-Object {
  icacls "$b\\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "\${env:USERDOMAIN}\\\${env:USERNAME}:(OI)(CI)F"
}
# Mode B on a Windows Domino server: also grant the Domino service account, e.g.
# icacls "$b\\ids" /grant 'DOMAIN\\svc-domino:(OI)(CI)M'   (same for secure, audit)`);
p("**Linux / RHEL (as root; `notes` = the OS account that runs Domino):**");
code(`mkdir -p /local/bulkreg/{config,ids,secure,audit,cert}
chown -R notes:notes /local/bulkreg
chmod 750 /local/bulkreg /local/bulkreg/config /local/bulkreg/audit
chmod 700 /local/bulkreg/ids /local/bulkreg/secure /local/bulkreg/cert
# If SELinux is Enforcing and Domino runs confined, check: ls -Z /local/bulkreg ; ausearch -m avc -ts recent`);
h3("Option 2 – helper script (does the same, and also copies the config templates)");
code(`Windows:  .\\scripts\\windows\\bulkreg.cmd Init            (add -ServiceAccount DOMAIN\\svc-domino for Mode B)
Linux:    sudo DOMINO_USER=notes DOMINO_GROUP=notes ./scripts/linux/bulkreg.sh init`);
done("The five folders exist. ids, secure and cert are not readable by Everyone/Users (Windows) or by other users (Linux: mode 700).");

// ================================================================ STEP 3
h1("5. Step 3 – Configure");
p("**Who:** Domino administrator. **Changes:** config files only.");
ol(
  "Copy the template into `config`: **bulkreg.ini** (Windows) or **bulkreg.linux.ini** saved as `bulkreg.ini` (Linux). Copy **server_mapping.csv** as well.",
  "Replace every `<PLACEHOLDER>`. The minimum set is in the table below.",
  "Leave `DryRun=1` and `ServerRunEnabled=0`.",
  "Edit server_mapping.csv. Rules are checked top-down, the **first match wins**, and the last line `*;*;…` is the catch-all."
);
tbl(["Key", "Set to"], [
  ["DirectoryServer, RegistrationServer", "Your admin server, for example Admin01/ORG"],
  ["UseCA, CertifierName", "1 and the CA-enabled certifier (Mode B **must** use UseCA=1)"],
  ["CertifierIDFile", "Only for Mode A with UseCA=0"],
  ["DefaultHomeServer, DefaultPolicy", "Fallback home server and the ID-Vault explicit policy"],
  ["VaultServer", "A vault server, used for the IsIDInVault check"],
  ["BaseDir or the individual *Dir keys", "The folders from Step 2"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1 – keeps users on Other Internet Mail with no mail file"],
], [3600, 5760]);
code(`# server_mapping.csv  (MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups)
Department;Finance*;Mail01/ORG;Finance;/ORG-DirSync-Vault;BR-Finance
InternetAddress;*@emea.example.com;Mail02/ORG;EMEA;/ORG-DirSync-Vault-EMEA;BR-EMEA
*;*;Mail01/ORG;;;`);
p("**Mode B only:** tell the server where the config file is. On the Domino console:");
code(`set config BulkRegConfigPath=/local/bulkreg/config/bulkreg.ini        (Linux)
set config BulkRegConfigPath=C:\\BulkReg\\config\\bulkreg.ini          (Windows server)`);
p("Optional check: `bulkreg.sh check` or `bulkreg.cmd Check` reports leftover placeholders, wrong paths, permissions and unsafe values.");
done("No `<PLACEHOLDER>` remains. DryRun=1 and ServerRunEnabled=0. For Mode B, BulkRegConfigPath is set on the server.");
pb();

// ================================================================ STEP 4
h1("6. Step 4 – Build the Tool Database (bulkreg.nsf)");
p("**Who:** Domino administrator with Domino Designer. **Changes:** creates one new database.");
ol(
  "Create a blank database **bulkreg.nsf**: on the admin workstation (Mode A) or on the registration server (Mode B). Set its ACL to administrators only.",
  "Optional: create **bulkreg_log.nsf** from the Agent Log template (`alog4.ntf`) for central logging.",
  "In Designer create a **LotusScript library** named exactly `BulkRegCommon`, then paste in `BulkRegCommon.lss`.",
  "Create four **LotusScript agents** and paste in the matching .lss file. Names must match exactly: `01 | Preflight Check`, `02 | Export to Registration Text File`, `03 | Bulk Register (ID Vault)`, `04 | Verify Registration + Vault`.",
  "In each agent's (Options) section, keep `Option Public`, `Option Declare` and `Use \"BulkRegCommon\"`.",
  "Set the agent properties for your mode (table below), save, check for compile errors, and sign with the admin ID."
);
tbl(["Agent property", "Mode A – Windows client", "Mode B – Domino server (Windows / Linux)"], [
  ["Trigger", "On event → Action menu selection", "On schedule (for example Daily). Run on: the registration server."],
  ["Target", "None", "None"],
  ["Runtime security", "–", "**Allow restricted operations** (needed for file I/O and notes.ini)"],
  ["Run on behalf of", "–", "Admin identity with directory rights. The signer needs unrestricted agent rights in the Server document."],
], [2200, 3100, 4060]);
h3("How to start an agent (used in Steps 5–9)");
tbl(["Mode", "Action"], [
  ["A – Windows client", "Open bulkreg.nsf → **Actions** → choose the agent. Enter the config path when asked (it is remembered)."],
  ["B – Domino server", "Server console: `tell amgr run \"bulkreg.nsf\" '01 | Preflight Check'`. Use the same pattern for 02/03/04. The agent refuses to start while ServerRunEnabled=0, so set it to 1 before the run and back to 0 after."],
], [2200, 7160]);
done("The library and all four agents compile without errors, the database is signed, and the ACL is limited to admins.");

// ================================================================ STEP 5
h1("7. Step 5 – Run Preflight (Agent 01)");
p("**Changes:** none (read-only). Mode B: set `ServerRunEnabled=1` first.");
ol(
  "Start **01 | Preflight Check**.",
  "Read the summary: *Environment errors*, and *OK / WARN / ERROR* per user.",
  "Open the newest `BulkReg_Preflight_<run>_audit.csv` from the audit folder (Audit Viewer, Excel, or `status` helper).",
  "Fix every **ERROR**. Typical causes are a missing LastName, an unreachable home server, or a duplicate ShortName or InternetAddress. Fix the data in AD and let DirSync re-sync, then run Preflight again."
);
done("Environment errors = 0 and user ERROR = 0. Every WARN has been reviewed and accepted.");

// ================================================================ STEP 6
h1("8. Step 6 – Dry Run (Agent 03, DryRun=1)");
p("**Changes:** none (simulation).");
ol(
  "Confirm `DryRun=1`. Start **03 | Bulk Register (ID Vault)**. In Mode A, answer **Yes** to the summary.",
  "Open the `BulkReg_Register_<run>_audit.csv`. Every user shows **WOULD_REGISTER**, with the HomeServer, OrgUnit and Policy they would get.",
  "Check the mapping result for a sample of users in each region or department."
);
done("Every WOULD_REGISTER row has the intended server, OU and policy. The dry-run audit CSV is attached to the change ticket.");

// ================================================================ STEP 7
h1("9. Step 7 – Pilot: Register 2 Users");
p("**Changes:** registers 2 users.");
ol(
  "In bulkreg.ini set `ExtraSelection=ShortName = \"pilot1\" : \"pilot2\"`, `BatchSize=2` and `DryRun=0`.",
  "**Mode A:** start Agent 03, answer **Yes**, then type **REGISTER**. Enter the certifier password if UseCA=0.",
  "**Mode B:** set `ServerConfirm=REGISTER-<yyyymmdd>` (today's date on the server), then `tell amgr run \"bulkreg.nsf\" '03 | Bulk Register (ID Vault)'`.",
  "Check both users by hand. The Person document has a Certificate and a hierarchical name. Mail system is still Other Internet Mail. The user can download the ID from the vault and log in.",
  "Start **04 | Verify Registration + Vault**."
);
done("Both pilot users show **REGISTERED** with vault status **IN_VAULT**, and the manual checks pass.");

// ================================================================ STEP 8
h1("10. Step 8 – Register in Batches");
p("**Changes:** registers users.");
ol(
  "Clear `ExtraSelection` (or set it to a department/region wave). Set `BatchSize` (start with 25–50 and increase after clean runs).",
  "Start Agent 03 (Mode B: today's `ServerConfirm` is required). Each run takes only users who are still unregistered.",
  "After each run, review the totals: REGISTERED, FAILED, REGISTERED_VAULT_PENDING. Fix the causes (chapter 15) before the next batch.",
  "Repeat until Preflight or Verify shows no UNREGISTERED users in scope.",
  "If the run stops with *Circuit breaker*, the same error repeated. Fix it, then simply run again."
);
note("Keep each batch short enough to finish within the Agent Manager maximum execution time (Server document) in Mode B. Allow time for directory and vault replication between batches.");
done("All in-scope users are REGISTERED, or listed as accepted exceptions.");

// ================================================================ STEP 9
h1("11. Step 9 – Verify and Close");
ol(
  "Start **04 | Verify Registration + Vault**. Re-run it against another vault replica by changing `VaultServer` if you need to confirm replication.",
  "Hand over initial passwords through an approved secure channel. Users must change them at first use.",
  "Delete temporary secrets **only after** Verify shows IN_VAULT: the password file and registration text file in `secure`, and the local ID files in `ids`.",
  "Set `DryRun=1`, `ServerRunEnabled=0` and clear `ServerConfirm`.",
  "Archive the audit CSVs and debug logs with the change record and close the change, including totals by result."
);
p("Delete secrets manually, or with the helper (it lists the files first and deletes only with --yes / -Yes):");
code(`Linux:    shred -u /local/bulkreg/secure/BulkReg_InitialPasswords_*.csv /local/bulkreg/secure/BatchReg_DirSync_*.txt
          shred -u /local/bulkreg/ids/*.id
Windows:  Remove-Item C:\\BulkReg\\secure\\BulkReg_InitialPasswords_*.csv, C:\\BulkReg\\secure\\BatchReg_DirSync_*.txt
          Remove-Item C:\\BulkReg\\ids\\*.id
Helper:   bulkreg.sh purge-secrets --include-ids --yes     |   bulkreg.cmd PurgeSecrets -IncludeIds -Yes`);
done("Verify shows every in-scope user IN_VAULT. Secrets are deleted, the config is back to safe values, and the change is closed.");
pb();

// ================================================================ 12 HELPER SCRIPTS
h1("12. Helper Scripts: Why They Exist and When You Need Them");
p("**Short answer: they are optional.** All registration work runs inside Domino (the agents in bulkreg.nsf). The scripts never register users and never touch names.nsf. They automate the few **operating-system tasks** around a run, which matter most on a Linux server with no desktop.");
tbl(["Task", "Why it matters", "Without the script", "With the script (Linux / Windows)"], [
  ["Create folders + permissions", "ID files and passwords must not be readable by others", "Commands in Step 2", "`init` / `Init`"],
  ["Validate config", "Catches leftover placeholders, wrong-OS paths, UseCA=0 on a server, loose permissions", "Read the file and check by eye", "`check` / `Check`"],
  ["Arm / disarm server runs", "Server agents run only while ServerRunEnabled=1", "Edit bulkreg.ini", "`arm`, `disarm` / `Arm`, `Disarm`"],
  ["Today's LIVE token", "Mode B LIVE needs ServerConfirm=REGISTER-<today>", "Edit bulkreg.ini", "`confirm-today` / `ConfirmToday`"],
  ["Toggle dry run", "Safe default is DryRun=1", "Edit bulkreg.ini", "`dryrun on|off` / `DryRun On|Off`"],
  ["Console commands", "Exact `set config` and `tell amgr run` lines", "Copy from this guide", "`console`, `run NN` / `Console`, `Run NN`"],
  ["Read results", "Totals by result and the failures, on a server with no GUI", "Audit Viewer (browser) or Excel", "`status` / `Status`"],
  ["Follow progress", "Watch a running batch", "`tail -F` / `Get-Content -Wait` on the debug log", "`tail` / `Tail`"],
  ["Delete secrets", "Passwords and local IDs must not linger", "Commands in Step 9", "`purge-secrets` / `PurgeSecrets`"],
], [1900, 2700, 2300, 2460]);
h2("12.1 Recommendation by mode");
tbl(["Mode", "Do you need the scripts?"], [
  ["A – Windows client", "**Not really.** Create the folders once (Step 2) and use the Audit Viewer. The PowerShell script is a convenience."],
  ["B – Linux / RHEL server", "**Recommended.** Without a desktop, `init`, `check`, `status`, `tail` and `purge-secrets` save time and avoid permission mistakes."],
  ["B – Windows server", "Useful for `Init -ServiceAccount` (correct ACLs for the Domino service account), plus `Check` and `Status`."],
], [2400, 6960]);
h2("12.2 What the scripts add");
ul(
  "Every config change creates a timestamped `.bak` copy and prints a diff.",
  "Every state-changing command is logged to `<AuditDir>/bulkreg_admin_actions.log` (time, OS user, host, action).",
  "`purge-secrets` only lists files unless you add `--yes` / `-Yes`. ID files are included only with `--include-ids` / `-IncludeIds`.",
  "`run` prints the documented console command. It sends the command itself only if you set `BULKREG_CONSOLE_CMD` to a console wrapper you have verified. HCL 14.x does not document sending console commands from the OS shell."
);
h2("12.3 Usage");
code(`Linux / RHEL:   ./scripts/linux/bulkreg.sh help
                env: BULKREG_BASE (/local/bulkreg)  BULKREG_CONFIG  DOMINO_USER (notes)  DOMINO_GROUP
Windows:        .\\scripts\\windows\\bulkreg.cmd Help      (runs bulkreg.ps1, no execution-policy change)
                params: -Base C:\\BulkReg  -Config <path>  -ServiceAccount DOMAIN\\svc  -Yes  -IncludeIds`);

// ================================================================ 13 CONFIG REFERENCE
h1("13. Configuration Reference");
p("Format: `key=value`; `#` starts a comment. Paths may use `\\` or `/` and are converted for the running OS. Empty path keys default to BaseDir + config / ids / secure / audit / cert.");
tbl(["Key", "Default", "Meaning"], [
  ["BaseDir", "C:\\BulkReg\\ or /local/bulkreg/", "Base for default paths"],
  ["DirectoryServer / DirectoryFile", "– / names.nsf", "Directory that DirSync writes into"],
  ["RegistrationServer / RegistrationLog", "– / log.nsf", "Server that performs registration; Domino registration log"],
  ["UseCA / CertifierName", "1 / –", "Domino CA (required in Mode B) and the CA-enabled certifier"],
  ["CertifierIDFile", "–", "Mode A with UseCA=0 only. The password is prompted, never stored."],
  ["DefaultHomeServer / DefaultOrgUnit / DefaultPolicy / DefaultGroups", "–", "Used when no mapping rule overrides them"],
  ["MappingFile", "<BaseDir>/config/server_mapping.csv", "Mapping rules"],
  ["ExpirationDays / MinPasswordLength", "730 / 8", "Certificate validity; ID password strength (0–16)"],
  ["IsNorthAmerican / EnforceUniqueShortName", "1 / 1", "NotesRegistration options"],
  ["StoreIDInAddressBook / SyncInternetPassword", "0 / 0", "Attach the ID to the Person document; set the Internet password too"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1", "No mail file; restore Other Internet Mail after registration"],
  ["IDFileDir / PasswordDir / AuditDir", "<BaseDir>/ids, secure, audit", "Output folders"],
  ["InitialPasswordLength / WritePasswordFile", "16 / 1", "Initial password length; write passwords to the restricted file"],
  ["VaultServer / VaultCheckAfterReg", "– / 1", "Vault verification"],
  ["ExtraSelection", "(empty)", "Extra @formula to narrow a run (pilot, waves)"],
  ["MaxScan / BatchSize / PauseMs / MaxConsecutiveErrors", "5000 / 25 / 500 / 5", "Search limit, users per run, pause between users, circuit breaker"],
  ["DryRun", "1", "1 = simulate, 0 = live"],
  ["ServerRunEnabled", "0", "Mode B kill switch"],
  ["ServerConfirm", "(empty)", "Mode B LIVE: must equal REGISTER-<yyyymmdd> for today"],
  ["ExportGeneratePasswords / ImportIDFileDir", "1 / (IDFileDir)", "Agent 02 in Mode B; ID folder as seen by the Windows client that imports the file"],
  ["LogLevel / LogServer / LogDb", "INFO / – / bulkreg_log.nsf", "Log detail; optional central Agent Log (leave LogDb empty to disable)"],
], [3600, 2300, 3460]);

// ================================================================ 14 AUDIT
h1("14. Audit and Logging");
tbl(["Output", "Location", "Contains"], [
  ["Audit CSV", "<AuditDir>/BulkReg_<Tool>_<RunID>_audit.csv", "One row per user per action. **No passwords.**"],
  ["Debug log", "<AuditDir>/BulkReg_<Tool>_<RunID>_debug.log", "Timestamped events; set LogLevel=DEBUG for full detail"],
  ["Admin actions log", "<AuditDir>/bulkreg_admin_actions.log", "Helper-script changes (who, when, host, what)"],
  ["Agent Log database", "LogServer!!LogDb (optional)", "The same events, stored centrally"],
  ["Domino registration log", "log.nsf", "Domino's own registration records"],
  ["Password file", "<PasswordDir>/BulkReg_InitialPasswords_<RunID>.csv", "Initial passwords. Restricted; delete in Step 9."],
], [2200, 3700, 3460]);
h2("14.1 Audit CSV columns");
tbl(["Columns", "Meaning"], [
  ["RunID, Timestamp, Tool, Operator, Mode", "Which run, when, which agent, who, and DRYRUN/LIVE/PREFLIGHT/EXPORT/VERIFY"],
  ["Action, Result, DurationSec", "What was attempted, the outcome code, how long it took"],
  ["NoteID, UNID, objectGUID", "Links the row to the Person document and the AD object"],
  ["FullNameBefore / FullNameAfter", "DirSync name → hierarchical Notes name"],
  ["InternetAddress, ShortName, HomeServer, OrgUnit, Policy, MapRule", "Identity and the resolved target settings"],
  ["MailSystemBefore / MailSystemAfter", "Evidence that the mail type was preserved"],
  ["VaultStatus, IDFile, Message", "IN_VAULT / NOT_IN_VAULT / CHECK_ERROR; ID file path; detail or error"],
], [3900, 5460]);
h2("14.2 Result codes");
tbl(["Result", "Meaning", "Action"], [
  ["OK / WARN / ERROR", "Preflight outcome", "Fix ERROR before registering"],
  ["WOULD_REGISTER", "Dry-run result", "Review the settings"],
  ["REGISTERED", "ID created and certified, in the vault", "None"],
  ["REGISTERED_VAULT_PENDING", "Registered, but the ID was not found in the vault yet", "Check the policy, re-run Agent 04"],
  ["FAILED_VALIDATION", "Bad data, not attempted", "Fix in AD, re-sync"],
  ["FAILED", "Registration error (see Message: stage + error)", "Chapter 15"],
  ["SKIPPED", "Already registered or the document is gone", "None"],
  ["EXPORTED", "Agent 02 wrote the user to the text file", "Appendix A"],
  ["UNREGISTERED", "Verify: no Notes ID yet", "Next batch"],
], [2900, 3700, 2760]);
p("To review results, open any audit CSV in `tools/BulkReg_AuditViewer.html` (offline; totals, filter, search, export), in Excel, or with `status`.");

// ================================================================ 15 TROUBLESHOOTING
h1("15. Troubleshooting");
p("To debug: set `LogLevel=DEBUG`, repeat with DryRun=1 or a 1-user ExtraSelection, then read the debug log. Each FAILED line shows the **stage** (load, validate, configure, RegisterNewUser, verify, preserveMail, vault), the Notes error number and the code line.");
tbl(["Symptom", "Likely cause", "Fix"], [
  ["Mode B agent does nothing", "ServerRunEnabled=0, or BulkRegConfigPath not set on the server", "`arm`, or `set config BulkRegConfigPath=…`. Check the server console/log."],
  ["Mode B LIVE refused", "ServerConfirm missing, or not today's date (server clock)", "Set ServerConfirm=REGISTER-<today>"],
  ["Mode B: 'requires UseCA=1'", "UseCA=0 on a server", "Use the Domino CA and list the server as an RA"],
  ["Audit folder not writable", "Folder missing, or permissions are wrong for the user/service account", "Redo Step 2; on Linux check the owner and SELinux"],
  ["Preflight finds 0 users", "No objectGUID, already registered, or ExtraSelection too narrow", "Check a Person document's properties; clear ExtraSelection"],
  ["FAILED stage=RegisterNewUser", "Not an RA, wrong CertifierName or password, or missing rights", "Debug log message; fix the CA/RA or the rights"],
  ["REGISTERED_VAULT_PENDING", "Policy has no vault, wrong policy name, or replication delay", "Check the policy synopsis; re-run Agent 04 later"],
  ["Duplicate ShortName / InternetAddress", "Collision in AD or the directory", "Fix in AD, re-sync"],
  ["MailSystem changes after the next sync", "DirSync attribute mapping", "Adjust the DirSync mapping, or set PreserveMailSystem=0"],
  ["Run stops: Circuit breaker", "The same error repeated", "Fix the cause and re-run (safe)"],
  ["Linux: config values ignored", "Windows CRLF line ends", "`sed -i 's/\\r$//' bulkreg.ini` (the `check` command detects this)"],
], [2600, 3400, 3360]);
p("Escalate to the platform owner if failures affect more than one batch. Escalate immediately to the security owner if a password file, ID file or certifier may have been exposed. Do not try to fix that yourself.");
pb();

// ================================================================ 16 SECURITY / CHANGE / ROLLBACK
h1("16. Security, Change Control and Rollback");
h2("16.1 Controls and evidence");
tbl(["Risk", "Control", "Evidence"], [
  ["Unintended mass change", "DryRun default, confirmation (Mode A REGISTER / Mode B dated token + kill switch), BatchSize, circuit breaker", "Audit Mode column, debug log"],
  ["Double registration", "Certificate re-check before every user", "SKIPPED rows"],
  ["Certifier password exposure", "Prompted only (Mode A), never stored or logged; CA-only in Mode B", "Code review, logs"],
  ["Initial password / ID exposure", "Restricted folders (Step 2), separate file, deleted in Step 9", "Permissions, admin actions log"],
  ["Weak initial passwords", "16-character random password plus a policy-forced change. LotusScript Rnd is not cryptographic, so the forced change is a required compensating control.", "Security Settings policy"],
  ["Unauthorized use", "bulkreg.nsf ACL limited to admins; agents run with the operator's or signer's rights", "ACL, Operator column"],
  ["Traceability", "RunID in every file; one audit row per user", "Audit CSV, logs"],
], [2300, 4600, 2460]);
h2("16.2 Change checklist");
tbl(["When", "Item"], [
  ["Before", "Change approved; backups (names.nsf, ID Vault); Steps 1–4 done; Preflight and dry-run CSVs attached"],
  ["Go / no-go", "Pilot (Step 7) passed; servers healthy; replication current; DryRun=0 set deliberately"],
  ["After", "Verify shows IN_VAULT; secrets deleted; config back to safe values; logs archived; totals in the change record"],
], [1500, 7860]);
h2("16.3 Rollback");
p("Registration certifies the existing Person document and creates an ID. It **cannot be cleanly undone**, which is why Steps 5–7 exist. To reverse a user, identify them from the audit CSV and use your standard deletion process (AdminP Delete Person) and vault clean-up. HCL notes that users registered through user registration are **not** removed by a DirSync full resync. To recover from an interrupted run, just run it again.");

// ================================================================ 17 LIMITATIONS
h1("17. Known Limitations and Items to Verify");
tbl(["#", "Item", "Action"], [
  ["1", "The code has not been compiled or run on a live Domino server", "Steps 5–7 are mandatory before production"],
  ["2", "The RegisterNewUser parameter order follows HCL's ContactNoteID example and the 14.5 syntax", "Confirm when you compile in Designer"],
  ["3", "UseCA=1 passes an empty certifier password", "Confirm in the pilot"],
  ["4", "PreserveMailSystem behaviour with your DirSync mapping", "Check in the pilot and after the next sync"],
  ["5", "Server-side registration is documented by HCL for the CA (server as RA), not for every NotesRegistration option", "Run the pilot in Mode B"],
  ["6", "bulkreg.ps1 was reviewed but not executed; bulkreg.sh was tested only on a mock Linux layout", "Run `check` on your own hosts"],
  ["7", "The text-file import (Appendix A) with existing DirSync Person documents is not explicitly documented", "Pilot it before any bulk import"],
], [500, 5600, 3260]);

// ================================================================ APPENDICES
h1("Appendix A – Alternative Methods (Manual)");
h2("A.1 Register Selected Person (small numbers)");
p("Domino Administrator → People & Groups → select DirSync users → right-click **Register Selected Person** → choose the certifier and the ID-Vault policy. You are prompted once per user. Run Agent 04 afterwards.");
h2("A.2 Registration text file (Agent 02 + Import)");
ol(
  "Run Agent 02. It writes `secure/BatchReg_DirSync_<run>.txt` (UTF-8 with BOM, `;`-separated, CRLF). The file **contains passwords**.",
  "Domino Administrator (Windows) → People → Register → choose the ID-Vault policy → **Import Text File** → Register All.",
  "Run Agent 04, then delete the file."
);
warn("HCL documents the text-file import for new users. Test 1–2 DirSync users first. If you get duplicate entries, use the main method (Agent 03).");
tbl(["#", "Field (HCL order)", "Agent 02 fills with"], [
  ["1–3", "Last name (required), First name, Middle initial", "Person document values"],
  ["4", "Organizational unit", "Mapped OrgUnit"],
  ["5", "Password (required)", "Random initial password"],
  ["6–7", "ID file directory, ID file name", "ImportIDFileDir (or IDFileDir); <ShortName>_<NoteID>.id"],
  ["8", "Mail server name", "Mapped HomeServer"],
  ["9–11", "Mail file directory, Mail file name, Location", "(empty)"],
  ["12", "Comment", "DirSync objectGUID <guid>"],
  ["13–15", "Forwarding address, Profile, Local administrator", "(empty)"],
  ["16–17", "Internet address, Short name", "Person document values"],
  ["18–20", "Alternate name, Alternate org unit, Mail template", "(empty)"],
], [900, 4600, 3860]);

h1("Appendix B – Agent and Library Reference");
tbl(["Agent", "Reads", "Writes", "Mode A prompts", "Mode B gate"], [
  ["01 Preflight", "names.nsf, servers", "Audit, debug log", "Config path", "ServerRunEnabled"],
  ["02 Export", "names.nsf", "Text file (secure), audit", "Config path, password Yes/No", "ServerRunEnabled"],
  ["03 Bulk Register", "names.nsf", "names.nsf (LIVE), ID files, audit, password file", "Config path, Yes/No, REGISTER, certifier password if UseCA=0", "ServerRunEnabled + ServerConfirm (LIVE)"],
  ["04 Verify", "names.nsf, ID Vault", "Audit, debug log", "Config path", "ServerRunEnabled"],
], [1500, 1700, 2400, 2100, 1660]);
tbl(["Library function", "Purpose"], [
  ["BR_Init, BR_DetectPlatform", "Start a run; detect the OS (NotesSession.Platform) and the mode (IsOnServer)"],
  ["BR_Path, BR_Dir, BR_CfgDir, BR_CfgFile", "Convert paths for the OS; resolve config paths with defaults"],
  ["BR_Msg", "Dialog (Mode A) or console/log line (Mode B)"],
  ["BR_LoadConfig, CfgS/CfgL/CfgB, BR_LoadMapping, BR_ResolveMapping", "Read config and mapping; apply the first matching rule"],
  ["BR_GetCandidates, BR_ReadUser, BR_Validate, BR_IsRegistered", "Select DirSync users, read and validate them"],
  ["BR_VaultStatus", "NotesIDVault.IsIDInVault wrapper"],
  ["BR_Log, BR_Audit, BR_AppendLine, BR_Close", "Logging, audit rows, crash-safe append"],
  ["BR_GenPassword, BR_SafeFile, BR_ServerReachable", "Initial password, safe ID file name, server check"],
], [4300, 5060]);

h1("Appendix C – References (HCL documentation)");
C.push({ t: "refs", items: [
  ["Registering Active Directory users in Domino (Directory Sync)", "https://help.hcl-software.com/domino/14.0.0/admin/conf_adsync_registering_ad_users.html"],
  ["Registering users from a text file (14.5.1)", "https://help.hcl-software.com/domino/14.5.1/admin/conf_registeringusersfromatextfile_t.html"],
  ["NotesRegistration class", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESREGISTRATION_CLASS.html"],
  ["ContactNoteID property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_CONTACTNOTEID_PROPERTY_NOTESREGISTRATION.html"],
  ["RegisterNewUser method", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_REGISTERNEWUSER_METHOD.html"],
  ["UseCertificateAuthority property (server as RA)", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_USECERTIFICATEAUTHORITY_PROPERTY_REG.html"],
  ["PolicyName property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_POLICYNAME_PROPERTY_REG.html"],
  ["NotesIDVault class", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESIDVAULT_CLASS.html"],
  ["NotesSession.Platform / IsOnServer", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_PLATFORM_PROPERTY.html"],
  ["Tell Amgr Run", "https://help.hcl-software.com/domino/14.0.0/admin/admn_agentmanagertellcommands_r.html"],
  ["Running restricted agents", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_ABOUT_RUNNING_RESTRICTED_AGENTS.html"],
  ["Domino Administrator client (Windows only)", "https://help.hcl-software.com/domino/14.0.0/admin/admn_installingthedominoadministratorclient_c.html"],
]});

module.exports = { META, C };
