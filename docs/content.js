// BulkReg guide v1.3 — single source for Word + Web.
// Operating model: everything is run from the HCL Domino Administrator client on Windows.
// Structure: Understand (1–2) → Do, in order (Steps 1–9) → Reference (12–17) → Appendices
const META = {
  title: "BulkReg Framework",
  subtitle: "Bulk Registration of Directory Sync (Active Directory) Users in HCL Domino with ID Vault – run from the Windows Domino Administrator Client",
  docType: "Administrator, Operations & Audit Guide",
  version: "1.3",
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
  ["Applies to", "HCL Domino 14.x servers (any supported OS). All BulkReg operations run from the **HCL Domino Administrator 14.x client on Windows**."],
  ["Framework version", "BulkReg 1.2.0 (BulkRegCommon library, Agents 01–04, optional PowerShell helper)"],
], [2400, 6960]);
h3("Revision history");
tbl(["Version", "Change"], [
  ["1.0", "First release: framework and guide"],
  ["1.1", "Added Windows + Linux/RHEL server (headless) mode"],
  ["1.2", "Guide restructured into a step-by-step runbook"],
  ["1.3", "Operating model fixed to the Windows Domino Administrator client only. Server/Linux mode removed (archived in archive/linux-server-mode)."],
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
h2("1.2 Where it runs");
tbl(["Item", "Value"], [
  ["Operator workstation", "Windows PC with the **HCL Domino Administrator client**, signed in with the admin ID that registers users"],
  ["How agents are started", "Open bulkreg.nsf → **Actions** menu → choose the agent"],
  ["Domino servers", "Any supported OS. The registration, mail and vault servers are reached over the network from the client."],
  ["Certification", "Domino server-based CA (your ID is a Registration Authority) **or** a certifier ID file (its password is prompted at run time, never stored)"],
  ["Local files", "`C:\\BulkReg\\` on the admin workstation: config, ID files, initial passwords, audit logs"],
], [2500, 6860]);
note("The library refuses to run anywhere else. If an agent is started on a server, or in a non-Windows client, it stops with a message and changes nothing.");
h2("1.3 The path you will follow");
tbl(["Step", "What you do", "Changes anything?"], [
  ["1", "Confirm prerequisites (rights, CA/certifier, ID Vault policy)", "No"],
  ["2", "Prepare C:\\BulkReg folders", "Creates local folders"],
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
  ["bulkreg.ini", "Settings (no secrets)", "**Yes**"],
  ["server_mapping.csv", "Rules: which home server, OU, policy and groups each user gets", "**Yes** (one line minimum)"],
  ["bulkreg.ps1 / bulkreg.cmd", "PowerShell helper for folder setup, checks and reporting (chapter 12)", "Optional"],
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
  ["Windows client only", "Refuses to run on a server or a non-Windows client"],
  ["DryRun=1 by default", "Nothing changes until you deliberately set DryRun=0"],
  ["Two-step confirmation", "Yes/No summary dialog, then type REGISTER for LIVE runs"],
  ["BatchSize / MaxConsecutiveErrors", "Limits each run, and stops automatically after repeated failures"],
  ["Idempotent", "The certificate is re-checked before each user, so a re-run never registers anyone twice"],
  ["No stored certifier password", "Masked prompt, held in memory only, never logged (or not needed with the CA)"],
  ["Full audit trail", "One CSV row per user per action, a debug log, and an optional central Agent Log"],
], [3000, 6360]);
pb();

// ================================================================ STEP 1
h1("3. Step 1 – Confirm Prerequisites");
p("**Who:** Domino administrator. **Where:** Domino Administrator client. **Changes:** none.");
tbl(["#", "Check", "Why"], [
  ["1", "DirSync is running and AD users appear as Person documents (the document properties show an `objectGUID` item)", "These are the users BulkReg registers"],
  ["2", "Your admin ID has **Editor** access, or the [UserCreator] and [UserModifier] roles, in names.nsf on the registration server", "Needed to register users"],
  ["3", "Certification is ready. **Domino CA:** your admin ID is a Registration Authority for the CA-enabled certifier. **Or** you have the certifier ID file and its password.", "One of the two is required"],
  ["4", "The ID Vault exists, with replicas on your vault servers", "Target for the IDs"],
  ["5", "An **explicit policy** exists whose **Security Settings assign the ID Vault** (one per region if needed)", "This is what puts each ID into the vault"],
  ["6", "Recommended: the same Security Settings force a password change at first use", "Initial passwords are temporary"],
  ["7", "Domino Administrator 14.x and Domino Designer are installed on the Windows admin workstation", "To build and run bulkreg.nsf"],
  ["8", "A backup of names.nsf and of the ID Vault is in place", "Rollback is limited (chapter 16)"],
], [500, 5800, 3060]);
done("All eight checks are confirmed and recorded in the change ticket.");

// ================================================================ STEP 2
h1("4. Step 2 – Prepare Working Folders");
p("**Who:** the Windows administrator of the admin workstation. **Changes:** creates local folders. BulkReg writes ID files, initial passwords and audit logs to disk, so these folders must exist and three of them must be locked down.");
tbl(["Folder", "Holds", "Access"], [
  ["C:\\BulkReg\\config", "bulkreg.ini, server_mapping.csv", "Admins"],
  ["C:\\BulkReg\\ids", "ID files created during registration", "**Restricted** – Administrators, SYSTEM, the registering admin"],
  ["C:\\BulkReg\\secure", "Initial-password file, registration text file", "**Restricted** – same as ids"],
  ["C:\\BulkReg\\audit", "Audit CSVs, debug logs", "Admins and auditors (read)"],
  ["C:\\BulkReg\\cert", "Certifier ID (only if you do not use the Domino CA)", "**Restricted**"],
], [2100, 3700, 3560]);
h3("Option 1 – manual (elevated PowerShell)");
code(`$b = 'C:\\BulkReg'
'config','ids','secure','audit','cert' | ForEach-Object { New-Item -ItemType Directory -Force "$b\\$_" }
'ids','secure','cert' | ForEach-Object {
  icacls "$b\\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "\${env:USERDOMAIN}\\\${env:USERNAME}:(OI)(CI)F"
}`);
p("You can also create the folders in Explorer and remove inherited permissions on ids, secure and cert (Properties → Security → Advanced → Disable inheritance).");
h3("Option 2 – helper script (same result, and also copies the config templates)");
code(`.\\scripts\\windows\\bulkreg.cmd Init        (from an elevated prompt in the kit folder)`);
done("The five folders exist, and ids, secure and cert do not grant access to Everyone or Users.");

// ================================================================ STEP 3
h1("5. Step 3 – Configure");
p("**Who:** Domino administrator. **Changes:** config files only.");
ol(
  "Copy `config\\bulkreg.ini` and `config\\server_mapping.csv` from the kit to `C:\\BulkReg\\config\\` (Init does this for you).",
  "Replace every `<PLACEHOLDER>`. The minimum set is in the table below.",
  "Leave `DryRun=1`.",
  "Edit server_mapping.csv. Rules are checked top-down, the **first match wins**, and the last line `*;*;…` is the catch-all."
);
tbl(["Key", "Set to"], [
  ["DirectoryServer, RegistrationServer", "Your admin server, for example Admin01/ORG"],
  ["UseCA, CertifierName", "1 and the CA-enabled certifier (recommended)"],
  ["CertifierIDFile", "Only when UseCA=0, for example C:\\BulkReg\\cert\\users.id"],
  ["DefaultHomeServer, DefaultPolicy", "Fallback home server and the ID-Vault explicit policy"],
  ["VaultServer", "A vault server, used for the IsIDInVault check"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1 – keeps users on Other Internet Mail with no mail file"],
], [3600, 5760]);
code(`# server_mapping.csv  (MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups)
Department;Finance*;Mail01/ORG;Finance;/ORG-DirSync-Vault;BR-Finance
InternetAddress;*@emea.example.com;Mail02/ORG;EMEA;/ORG-DirSync-Vault-EMEA;BR-EMEA
*;*;Mail01/ORG;;;`);
p("Optional check: `bulkreg.cmd Check` reports leftover placeholders, a missing certifier and loose folder permissions.");
done("No `<PLACEHOLDER>` remains and DryRun=1.");
pb();

// ================================================================ STEP 4
h1("6. Step 4 – Build the Tool Database (bulkreg.nsf)");
p("**Who:** Domino administrator with Domino Designer. **Changes:** creates one new database.");
ol(
  "Create a blank local database **bulkreg.nsf** on the admin workstation. Set its ACL to administrators only.",
  "Optional: create **bulkreg_log.nsf** from the Agent Log template (`alog4.ntf`) for central logging.",
  "In Designer create a **LotusScript library** named exactly `BulkRegCommon`, then paste in `BulkRegCommon.lss`.",
  "Create four **LotusScript agents** and paste in the matching .lss file. Names: `01 | Preflight Check`, `02 | Export to Registration Text File`, `03 | Bulk Register (ID Vault)`, `04 | Verify Registration + Vault`.",
  "For every agent set **Trigger: On event → Action menu selection** and **Target: None**. In (Options), keep `Option Public`, `Option Declare` and `Use \"BulkRegCommon\"`.",
  "Save, check for compile errors, and sign the database with the admin ID."
);
p("**To start an agent (Steps 5–9):** open bulkreg.nsf in the Domino Administrator client → **Actions** → choose the agent. On the first run, enter the path `C:\\BulkReg\\config\\bulkreg.ini`; it is remembered after that.");
done("The library and all four agents compile, the database is signed, and they appear in the Actions menu.");

// ================================================================ STEP 5
h1("7. Step 5 – Run Preflight (Agent 01)");
p("**Changes:** none (read-only).");
ol(
  "Start **01 | Preflight Check**.",
  "Read the summary: *Environment errors*, and *OK / WARN / ERROR* per user.",
  "Open the newest `C:\\BulkReg\\audit\\BulkReg_Preflight_<run>_audit.csv` (Audit Viewer, Excel, or `bulkreg.cmd Status`).",
  "Fix every **ERROR**. Typical causes are a missing LastName, an unreachable home server, or a duplicate ShortName or InternetAddress. Fix the data in AD and let DirSync re-sync, then run Preflight again."
);
done("Environment errors = 0 and user ERROR = 0. Every WARN has been reviewed and accepted.");

// ================================================================ STEP 6
h1("8. Step 6 – Dry Run (Agent 03, DryRun=1)");
p("**Changes:** none (simulation).");
ol(
  "Confirm `DryRun=1`. Start **03 | Bulk Register (ID Vault)** and answer **Yes** to the summary.",
  "Open `BulkReg_Register_<run>_audit.csv`. Every user shows **WOULD_REGISTER**, with the HomeServer, OrgUnit and Policy they would get.",
  "Check the mapping result for a sample of users in each region or department."
);
done("Every WOULD_REGISTER row has the intended server, OU and policy. The dry-run CSV is attached to the change ticket.");

// ================================================================ STEP 7
h1("9. Step 7 – Pilot: Register 2 Users");
p("**Changes:** registers 2 users.");
ol(
  "In bulkreg.ini set `ExtraSelection=ShortName = \"pilot1\" : \"pilot2\"`, `BatchSize=2` and `DryRun=0`.",
  "Start Agent 03, answer **Yes**, type **REGISTER**, and enter the certifier password if UseCA=0.",
  "Check both users by hand. The Person document has a Certificate and a hierarchical name. Mail system is still Other Internet Mail. The user can download the ID from the vault and log in.",
  "Start **04 | Verify Registration + Vault**."
);
done("Both pilot users show **REGISTERED** with vault status **IN_VAULT**, and the manual checks pass.");

// ================================================================ STEP 8
h1("10. Step 8 – Register in Batches");
p("**Changes:** registers users.");
ol(
  "Clear `ExtraSelection` (or set it to a department/region wave). Set `BatchSize` (start with 25–50 and increase after clean runs).",
  "Start Agent 03 and confirm with REGISTER. Each run takes only users who are still unregistered.",
  "After each run, review the totals: REGISTERED, FAILED, REGISTERED_VAULT_PENDING. Fix the causes (chapter 15) before the next batch.",
  "Repeat until Verify shows no UNREGISTERED users in scope.",
  "If the run stops with *Circuit breaker*, the same error repeated. Fix it, then simply run again."
);
note("Keep the Domino Administrator client open and the workstation awake while a batch runs. Allow time for directory and vault replication between batches.");
done("All in-scope users are REGISTERED, or listed as accepted exceptions.");

// ================================================================ STEP 9
h1("11. Step 9 – Verify and Close");
ol(
  "Start **04 | Verify Registration + Vault**. To confirm vault replication, change `VaultServer` to another vault replica and run it again.",
  "Hand over initial passwords through an approved secure channel. Users must change them at first use.",
  "Delete temporary secrets **only after** Verify shows IN_VAULT: the password file and registration text file in `secure`, and the ID files in `ids`.",
  "Set `DryRun=1` and clear `ExtraSelection`.",
  "Archive the audit CSVs and debug logs with the change record and close the change, including totals by result."
);
code(`Manual:  Remove-Item C:\\BulkReg\\secure\\BulkReg_InitialPasswords_*.csv, C:\\BulkReg\\secure\\BatchReg_DirSync_*.txt
         Remove-Item C:\\BulkReg\\ids\\*.id
Helper:  .\\scripts\\windows\\bulkreg.cmd PurgeSecrets -IncludeIds          (lists only)
         .\\scripts\\windows\\bulkreg.cmd PurgeSecrets -IncludeIds -Yes     (deletes)`);
done("Verify shows every in-scope user IN_VAULT. Secrets are deleted, DryRun=1, and the change is closed.");
pb();

// ================================================================ 12 HELPER SCRIPT
h1("12. PowerShell Helper: Optional");
p("**You do not need it to register users.** Registration happens entirely in the Domino Administrator client. The helper (`scripts\\windows\\bulkreg.cmd`, which runs `bulkreg.ps1`) only speeds up the Windows file tasks around a run, and it never touches names.nsf.");
tbl(["Command", "Does", "Manual equivalent"], [
  ["Init", "Creates C:\\BulkReg folders, locks down ids/secure/cert, copies the templates", "Step 2 commands or Explorer"],
  ["Check", "Flags placeholders, a missing certifier, loose ACLs, and whether the Admin client is running", "Read bulkreg.ini, check the folder permissions"],
  ["DryRun On|Off", "Sets DryRun=1/0, keeps a .bak copy and shows the diff", "Edit bulkreg.ini"],
  ["Status [file]", "Totals by Result plus the rows that need attention", "Audit Viewer or Excel"],
  ["Tail", "Follows the newest debug log during a run", "Open the .log in Notepad"],
  ["PurgeSecrets [-IncludeIds] [-Yes]", "Lists, then (with -Yes) deletes password files, text files and ID files", "Step 9 Remove-Item commands"],
], [2600, 4200, 2560]);
p("Each state-changing command is logged to `C:\\BulkReg\\audit\\bulkreg_admin_actions.log` (time, Windows user, PC, action). `bulkreg.cmd` starts PowerShell with `-ExecutionPolicy Bypass` for that one call only, so the machine's policy is not changed.");

// ================================================================ 13 CONFIG REFERENCE
h1("13. Configuration Reference (bulkreg.ini)");
p("Format: `key=value`; `#` starts a comment. Empty path keys default to `BaseDir` + config / ids / secure / audit / cert.");
tbl(["Key", "Default", "Meaning"], [
  ["BaseDir", "C:\\BulkReg\\", "Base for default paths"],
  ["DirectoryServer / DirectoryFile", "– / names.nsf", "Directory that DirSync writes into"],
  ["RegistrationServer / RegistrationLog", "– / log.nsf", "Server that performs registration; Domino registration log"],
  ["UseCA / CertifierName", "1 / –", "Use the Domino CA, and which CA-enabled certifier"],
  ["CertifierIDFile", "–", "Only when UseCA=0. The password is prompted, never stored."],
  ["DefaultHomeServer / DefaultOrgUnit / DefaultPolicy / DefaultGroups", "–", "Used when no mapping rule overrides them"],
  ["MappingFile", "C:\\BulkReg\\config\\server_mapping.csv", "Mapping rules"],
  ["ExpirationDays / MinPasswordLength", "730 / 8", "Certificate validity; ID password strength (0–16)"],
  ["IsNorthAmerican / EnforceUniqueShortName", "1 / 1", "NotesRegistration options"],
  ["StoreIDInAddressBook / SyncInternetPassword", "0 / 0", "Attach the ID to the Person document; set the Internet password too"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1", "No mail file; restore Other Internet Mail after registration"],
  ["IDFileDir / PasswordDir / AuditDir", "C:\\BulkReg\\ids, secure, audit", "Output folders"],
  ["InitialPasswordLength / WritePasswordFile", "16 / 1", "Initial password length; write passwords to the restricted file"],
  ["VaultServer / VaultCheckAfterReg", "– / 1", "Vault verification"],
  ["ExtraSelection", "(empty)", "Extra @formula to narrow a run (pilot, waves)"],
  ["MaxScan / BatchSize / PauseMs / MaxConsecutiveErrors", "5000 / 25 / 500 / 5", "Search limit, users per run, pause between users, circuit breaker"],
  ["DryRun", "1", "1 = simulate, 0 = live"],
  ["LogLevel / LogServer / LogDb", "INFO / – / bulkreg_log.nsf", "Log detail; optional central Agent Log (leave LogDb empty to disable)"],
], [3600, 2300, 3460]);

// ================================================================ 14 AUDIT
h1("14. Audit and Logging");
tbl(["Output", "Location", "Contains"], [
  ["Audit CSV", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<RunID>_audit.csv", "One row per user per action. **No passwords.**"],
  ["Debug log", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<RunID>_debug.log", "Timestamped events; set LogLevel=DEBUG for full detail"],
  ["Helper actions log", "C:\\BulkReg\\audit\\bulkreg_admin_actions.log", "PowerShell helper changes (who, when, PC, what)"],
  ["Agent Log database", "LogServer!!LogDb (optional)", "The same events, stored centrally"],
  ["Domino registration log", "log.nsf on the registration server", "Domino's own registration records"],
  ["Password file", "C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<RunID>.csv", "Initial passwords. Restricted; delete in Step 9."],
], [2200, 3900, 3260]);
h2("14.1 Audit CSV columns");
tbl(["Columns", "Meaning"], [
  ["RunID, Timestamp, Tool, Operator, Mode", "Which run, when, which agent, who (Notes user), and DRYRUN/LIVE/PREFLIGHT/EXPORT/VERIFY"],
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
p("To review results, open any audit CSV in `tools\\BulkReg_AuditViewer.html` (offline in any browser; totals, filter, search, export), in Excel, or with `bulkreg.cmd Status`.");

// ================================================================ 15 TROUBLESHOOTING
h1("15. Troubleshooting");
p("To debug: set `LogLevel=DEBUG`, repeat with DryRun=1 or a 1-user ExtraSelection, then read the debug log. Each FAILED line shows the **stage** (load, validate, configure, RegisterNewUser, verify, preserveMail, vault), the Notes error number and the code line.");
tbl(["Symptom", "Likely cause", "Fix"], [
  ["Agent not in the Actions menu", "Trigger is not 'Action menu selection', or the database is not signed", "Fix the agent properties (Step 4)"],
  ["\"supported only in the Domino Administrator client on Windows\"", "Agent started in a non-Windows client", "Run it from the Windows admin workstation"],
  ["Nothing happens; console says 'not on a server'", "The agent was run on a server (scheduled trigger)", "Set the trigger back to Action menu selection"],
  ["Audit folder not writable", "Folder missing, or wrong permissions for your Windows user", "Redo Step 2 / bulkreg.cmd Check"],
  ["Preflight finds 0 users", "No objectGUID, already registered, or ExtraSelection too narrow", "Check a Person document's properties; clear ExtraSelection"],
  ["FAILED stage=RegisterNewUser", "Not an RA, wrong CertifierName or password, or missing rights", "Debug log message; fix the CA/RA, certifier or rights"],
  ["REGISTERED_VAULT_PENDING", "Policy has no vault, wrong policy name, or replication delay", "Check the policy synopsis; re-run Agent 04 later"],
  ["Duplicate ShortName / InternetAddress", "Collision in AD or the directory", "Fix in AD, re-sync"],
  ["MailSystem changes after the next sync", "DirSync attribute mapping", "Adjust the DirSync mapping, or set PreserveMailSystem=0"],
  ["Run stops: Circuit breaker", "The same error repeated", "Fix the cause and re-run (safe)"],
  ["bulkreg.cmd: 'Init must run elevated'", "PowerShell not run as Administrator", "Right-click → Run as administrator"],
], [2800, 3400, 3160]);
p("Escalate to the platform owner if failures affect more than one batch. Escalate immediately to the security owner if a password file, ID file or certifier may have been exposed. Do not try to fix that yourself.");
pb();

// ================================================================ 16 SECURITY / CHANGE / ROLLBACK
h1("16. Security, Change Control and Rollback");
h2("16.1 Controls and evidence");
tbl(["Risk", "Control", "Evidence"], [
  ["Unintended mass change", "DryRun default, Yes/No + typed REGISTER, BatchSize, circuit breaker", "Audit Mode column, debug log"],
  ["Run outside the approved workstation", "Library refuses server and non-Windows execution", "Code review (BR_Init)"],
  ["Double registration", "Certificate re-check before every user", "SKIPPED rows"],
  ["Certifier password exposure", "Masked prompt, memory only, never stored or logged; CA recommended", "Code review, logs"],
  ["Initial password / ID exposure", "Restricted folders (Step 2), separate file, deleted in Step 9", "Folder ACLs, helper actions log"],
  ["Weak initial passwords", "16-character random password plus a policy-forced change. LotusScript Rnd is not cryptographic, so the forced change is a required compensating control.", "Security Settings policy"],
  ["Unauthorized use", "bulkreg.nsf ACL limited to admins; agents run with the operator's own rights", "ACL, Operator column"],
  ["Traceability", "RunID in every file; one audit row per user", "Audit CSV, logs"],
], [2300, 4600, 2460]);
h2("16.2 Change checklist");
tbl(["When", "Item"], [
  ["Before", "Change approved; backups (names.nsf, ID Vault); Steps 1–4 done; Preflight and dry-run CSVs attached"],
  ["Go / no-go", "Pilot (Step 7) passed; servers healthy; replication current; DryRun=0 set deliberately"],
  ["After", "Verify shows IN_VAULT; secrets deleted; DryRun=1; logs archived; totals in the change record"],
], [1500, 7860]);
h2("16.3 Rollback");
p("Registration certifies the existing Person document and creates an ID. It **cannot be cleanly undone**, which is why Steps 5–7 exist. To reverse a user, identify them from the audit CSV and use your standard deletion process (AdminP Delete Person) and vault clean-up. HCL notes that users registered through user registration are **not** removed by a DirSync full resync. To recover from an interrupted run, just run it again.");

// ================================================================ 17 LIMITATIONS
h1("17. Known Limitations and Items to Verify");
tbl(["#", "Item", "Action"], [
  ["1", "The code has not been compiled or run against a live Domino environment", "Steps 5–7 are mandatory before production"],
  ["2", "The RegisterNewUser parameter order follows HCL's ContactNoteID example and the 14.5 syntax", "Confirm when you compile in Designer"],
  ["3", "UseCA=1 passes an empty certifier password", "Confirm in the pilot"],
  ["4", "PreserveMailSystem behaviour with your DirSync mapping", "Check in the pilot and after the next sync"],
  ["5", "bulkreg.ps1 was reviewed but not executed (no PowerShell in the build environment)", "Run Help and Check once before relying on it"],
  ["6", "The text-file import (Appendix A) with existing DirSync Person documents is not explicitly documented", "Pilot it before any bulk import"],
  ["7", "Long batches depend on the admin workstation staying on and connected", "Use modest BatchSize; re-run is safe"],
], [500, 5600, 3260]);

// ================================================================ APPENDICES
h1("Appendix A – Alternative Methods (Manual)");
h2("A.1 Register Selected Person (small numbers)");
p("Domino Administrator → People & Groups → select DirSync users → right-click **Register Selected Person** → choose the certifier and the ID-Vault policy. You are prompted once per user. Run Agent 04 afterwards.");
h2("A.2 Registration text file (Agent 02 + Import)");
ol(
  "Run Agent 02. It writes `C:\\BulkReg\\secure\\BatchReg_DirSync_<run>.txt` (UTF-8 with BOM, `;`-separated). The file **contains passwords**.",
  "Domino Administrator → People → Register → choose the ID-Vault policy → **Import Text File** → Register All.",
  "Run Agent 04, then delete the file."
);
warn("HCL documents the text-file import for new users. Test 1–2 DirSync users first. If you get duplicate entries, use the main method (Agent 03).");
tbl(["#", "Field (HCL order)", "Agent 02 fills with"], [
  ["1–3", "Last name (required), First name, Middle initial", "Person document values"],
  ["4", "Organizational unit", "Mapped OrgUnit"],
  ["5", "Password (required)", "Random initial password"],
  ["6–7", "ID file directory, ID file name", "IDFileDir; <ShortName>_<NoteID>.id"],
  ["8", "Mail server name", "Mapped HomeServer"],
  ["9–11", "Mail file directory, Mail file name, Location", "(empty)"],
  ["12", "Comment", "DirSync objectGUID <guid>"],
  ["13–15", "Forwarding address, Profile, Local administrator", "(empty)"],
  ["16–17", "Internet address, Short name", "Person document values"],
  ["18–20", "Alternate name, Alternate org unit, Mail template", "(empty)"],
], [900, 4600, 3860]);

h1("Appendix B – Agent and Library Reference");
tbl(["Agent", "Reads", "Writes", "Prompts"], [
  ["01 Preflight", "names.nsf, servers", "Audit, debug log", "Config path"],
  ["02 Export", "names.nsf", "Text file (secure), audit", "Config path, password Yes/No"],
  ["03 Bulk Register", "names.nsf", "names.nsf (LIVE), ID files, audit, password file", "Config path, Yes/No, REGISTER, certifier password if UseCA=0"],
  ["04 Verify", "names.nsf, ID Vault", "Audit, debug log", "Config path"],
], [1800, 2000, 2900, 2660]);
tbl(["Library function", "Purpose"], [
  ["BR_Init", "Windows-client guard, config prompt, logs, mapping"],
  ["BR_Path, BR_Dir, BR_CfgDir, BR_CfgFile", "Normalise Windows paths; resolve config paths with defaults"],
  ["BR_Msg", "Message box plus a debug-log entry"],
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
  ["UseCertificateAuthority property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_USECERTIFICATEAUTHORITY_PROPERTY_REG.html"],
  ["PolicyName property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_POLICYNAME_PROPERTY_REG.html"],
  ["NotesIDVault class", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESIDVAULT_CLASS.html"],
  ["NotesSession.Platform / IsOnServer", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_PLATFORM_PROPERTY.html"],
  ["Installing the Domino Administrator client (Windows)", "https://help.hcl-software.com/domino/14.0.0/admin/admn_installingthedominoadministratorclient_c.html"],
]});

module.exports = { META, C };
