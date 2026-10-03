// BulkReg guide v1.4 — single source for Word + Web.
// Operating model: Windows Domino Administrator client; reviewed batches (build → review → register).
const META = {
  title: "BulkReg Framework",
  subtitle: "Bulk Registration of Directory Sync (Active Directory) Users in HCL Domino with ID Vault – reviewed batches across multiple servers, run from the Windows Domino Administrator Client",
  docType: "Administrator, Operations & Audit Guide",
  version: "1.4",
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
  ["Framework version", "BulkReg 1.3.0 (BulkRegCommon library, Agents 01–05, optional PowerShell helper)"],
], [2400, 6960]);
h3("Revision history");
tbl(["Version", "Change"], [
  ["1.0 – 1.2", "First release, multi-OS trial, step-by-step runbook"],
  ["1.3", "Windows Domino Administrator client only"],
  ["1.4", "**Reviewed batch workflow:** Agent 02 builds a batch file (default 500 users) that you review and approve, and Agent 03 registers only the approved rows. Adds multi-server guidance, a per-user vault server, and batch-scoped verification. Agents renumbered in run order."],
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
p("Directory Sync (DirSync) copies Active Directory users into the Domino Directory as Person documents. These users have **no Notes ID**, no certificate and no mail file (Mail system: *Other Internet Mail*). BulkReg registers them **in reviewed batches**. Every user gets a certified Notes ID, the ID is placed in the **ID Vault**, and the user is assigned to the right **home server** among your Domino servers. Every action is logged and auditable.");
p("BulkReg uses HCL's documented API for this case, `NotesRegistration.ContactNoteID`: *“Used to register users who have existing Person documents created by syncing Active Directory users into the Domino directory.”* The existing Person document is upgraded in place.");
h2("1.2 You always know who will be registered");
p("Registration never selects users on its own. It is a three-stage process:");
tbl(["Stage", "Agent", "What happens", "Changes data?"], [
  ["1 Build", "02 | Build Batch", "Selects the next batch (default 500) of unregistered DirSync users. Resolves each user's home server, OU, policy, groups and vault. Validates them and writes **BATCH-<id>.csv** plus a summary per server.", "No"],
  ["2 Review", "You (Excel)", "Check the list. Set Include=N to leave someone out, or correct HomeServer / OrgUnit / Policy / Groups / VaultServer.", "No"],
  ["3 Register", "03 | Register Batch", "Loads the batch file you choose. Shows the totals per home server. In LIVE mode you must **type the batch ID** to approve. It registers only rows with Include=Y, and only if the document's objectGUID still matches.", "**Yes**"],
], [1100, 1900, 5060, 1300]);
h2("1.3 Where it runs");
tbl(["Item", "Value"], [
  ["Operator workstation", "Windows PC with the **HCL Domino Administrator client**, signed in with the admin ID that registers users"],
  ["How agents are started", "Open bulkreg.nsf → **Actions** menu → choose the agent"],
  ["Domino servers", "Any supported OS. The registration server, the home servers and the vault servers are reached over the network from the client."],
  ["Local files", "`C:\\BulkReg\\`: config, batch files, ID files, initial passwords, audit logs"],
], [2500, 6860]);
note("The library refuses to run on a server or in a non-Windows client. It stops with a message and changes nothing.");
h2("1.4 The path you will follow");
tbl(["Step", "What you do", "Agent", "Changes anything?"], [
  ["1", "Confirm prerequisites", "–", "No"],
  ["2", "Prepare C:\\BulkReg folders", "–", "Local folders"],
  ["3", "Configure bulkreg.ini and server_mapping.csv (your servers)", "–", "Config files"],
  ["4", "Build bulkreg.nsf (library + 5 agents)", "–", "New tool database"],
  ["5", "Preflight: the whole picture, per home server", "01", "No"],
  ["6", "Build a batch and review it", "02", "No (writes a batch file)"],
  ["7", "Dry-run the batch", "03 (DryRun=1)", "No"],
  ["8", "Pilot batch: 2 users", "02 → 03 → 04", "**Yes** – 2 users"],
  ["9", "Register the reviewed batch", "03 (LIVE)", "**Yes**"],
  ["10", "Verify the batch and close it. **Repeat 6–10** for the next batch.", "04", "Deletes temporary secrets"],
], [700, 4900, 1700, 2060]);

// ================================================================ 2 HOW IT WORKS
h1("2. How BulkReg Works");
h2("2.1 Components");
tbl(["Component", "What it is", "Required?"], [
  ["bulkreg.nsf", "Notes database you create. It holds the library and the agents.", "**Yes**"],
  ["BulkRegCommon", "LotusScript library: config, mapping, batch files, logging, audit, vault check", "**Yes**"],
  ["01 | Preflight Check", "Environment check, plus every candidate with a count per home server. Read-only.", "**Yes**"],
  ["02 | Build Batch", "Selects, validates and writes the batch file for review. Read-only on names.nsf.", "**Yes**"],
  ["03 | Register Batch", "Registers the approved rows of one batch file", "**Yes**"],
  ["04 | Verify Registration + Vault", "Registration and vault status, for one batch or for all users. Read-only.", "**Yes**"],
  ["05 | Export to Registration Text File", "HCL text-file format for the manual method (Appendix A)", "Optional"],
  ["bulkreg.ini, server_mapping.csv", "Settings and multi-server rules (no secrets)", "**Yes**"],
  ["bulkreg.ps1 / bulkreg.cmd", "PowerShell helper (chapter 15)", "Optional"],
  ["BulkReg_AuditViewer.html", "Offline viewer for audit and results CSVs", "Optional"],
], [3000, 4860, 1500]);
h2("2.2 What Agent 03 does for each approved row");
ol(
  "Loads the Person document by NoteID and checks that its `objectGUID` equals the value in the batch file. If not, the row is skipped.",
  "Re-checks that it has no Certificate. If it was registered in the meantime, the row is skipped (safe to re-run).",
  "Uses the reviewed **HomeServer, OrgUnit, Policy, Groups, VaultServer** from the batch file and validates them.",
  "Calls `RegisterNewUser` with `ContactNoteID`, passing the home server's canonical name. The explicit policy assigns the **ID Vault**, so the ID is deposited during registration.",
  "Confirms the Certificate now exists. Puts back the original Mail system (*Other Internet Mail*) if that is configured.",
  "Checks `IsIDInVault` on the row's vault server, then writes one row to `BATCH-<id>_results.csv` and to the audit log."
);
h2("2.3 Built-in safety controls");
tbl(["Control", "Effect"], [
  ["Reviewed batch only", "Agent 03 never searches names.nsf. It processes exactly the Include=Y rows of the batch file you choose."],
  ["Batch approval", "Yes/No summary with totals per home server, then type the **batch ID** for LIVE runs"],
  ["Identity check", "The objectGUID in the batch file must match the Person document, so an edited or stale row cannot hit the wrong user"],
  ["No double booking", "A user in an OPEN batch is not selected into another batch"],
  ["DryRun=1 by default", "Nothing changes until you deliberately set DryRun=0"],
  ["MaxBatchRows / MaxConsecutiveErrors", "Rejects oversized batch files; stops after repeated failures"],
  ["Idempotent", "The Certificate is re-checked per user, so a re-run never registers anyone twice"],
  ["Windows client only", "Refuses to run on a server or a non-Windows client"],
  ["No stored certifier password", "Masked prompt, held in memory only, never logged (or not needed with the CA)"],
], [3000, 6360]);
pb();

// ================================================================ STEP 1
h1("3. Step 1 – Confirm Prerequisites");
p("**Who:** Domino administrator. **Where:** Domino Administrator client. **Changes:** none.");
tbl(["#", "Check", "Why"], [
  ["1", "DirSync is running and AD users appear as Person documents with an `objectGUID` item", "These are the users BulkReg registers"],
  ["2", "Your admin ID has **Editor** access, or the [UserCreator] and [UserModifier] roles, in names.nsf on the **registration server**", "Needed to register users"],
  ["3", "**Domino CA:** your admin ID is a Registration Authority for the CA-enabled certifier, **or** you have the certifier ID file and its password", "One of the two is required"],
  ["4", "Every **home server** you will assign is in the domain and reachable from the admin workstation", "Users are spread across these servers"],
  ["5", "The ID Vault (or vaults) exist, with replicas on the vault servers", "Target for the IDs"],
  ["6", "One **explicit policy per target group** (for example per region) whose **Security Settings assign the right ID Vault**", "This is what puts each ID into the vault"],
  ["7", "Recommended: the same Security Settings force a password change at first use", "Initial passwords are temporary"],
  ["8", "Domino Administrator 14.x and Domino Designer are installed on the Windows workstation", "To build and run bulkreg.nsf"],
  ["9", "A backup of names.nsf and of the ID Vault is in place", "Rollback is limited (chapter 19)"],
], [500, 5800, 3060]);
done("All nine checks are confirmed and recorded in the change ticket.");

// ================================================================ STEP 2
h1("4. Step 2 – Prepare Working Folders");
p("**Who:** Windows administrator of the admin workstation. **Changes:** creates local folders.");
tbl(["Folder", "Holds", "Access"], [
  ["C:\\BulkReg\\config", "bulkreg.ini, server_mapping.csv", "Admins"],
  ["C:\\BulkReg\\batches", "Batch files, summaries, results (contain names and email addresses)", "**Restricted**"],
  ["C:\\BulkReg\\ids", "ID files created during registration", "**Restricted**"],
  ["C:\\BulkReg\\secure", "Initial-password files", "**Restricted**"],
  ["C:\\BulkReg\\audit", "Audit CSVs, debug logs", "Admins and auditors (read)"],
  ["C:\\BulkReg\\cert", "Certifier ID (only if you do not use the Domino CA)", "**Restricted**"],
], [2200, 4600, 2560]);
p("**Manual (elevated PowerShell):**");
code(`$b = 'C:\\BulkReg'
'config','batches','ids','secure','audit','cert' | ForEach-Object { New-Item -ItemType Directory -Force "$b\\$_" }
'batches','ids','secure','cert' | ForEach-Object {
  icacls "$b\\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "\${env:USERDOMAIN}\\\${env:USERNAME}:(OI)(CI)F"
}`);
p("**Or with the helper:** `.\\scripts\\windows\\bulkreg.cmd Init` (elevated). This also copies the config templates.");
done("All six folders exist, and batches, ids, secure and cert do not grant access to Everyone or Users.");

// ================================================================ STEP 3
h1("5. Step 3 – Configure (including your servers)");
p("**Who:** Domino administrator. **Changes:** config files only.");
ol(
  "Copy `bulkreg.ini` and `server_mapping.csv` to `C:\\BulkReg\\config\\` (Init does this).",
  "In bulkreg.ini replace every `<PLACEHOLDER>`: DirectoryServer, RegistrationServer, CertifierName (or CertifierIDFile), DefaultHomeServer, DefaultPolicy, VaultServer.",
  "Leave `DryRun=1` and `BatchSize=500` (or your preferred batch size).",
  "Describe your **server landscape** in server_mapping.csv (chapter 13): which users go to which home server, OU, policy and vault."
);
code(`MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer
Department;Finance*;Mail01/ORG;Finance;/ORG-DirSync-Vault;BR-Finance;
InternetAddress;*@emea.example.com;Mail02/ORG;EMEA;/ORG-DirSync-Vault-EMEA;BR-EMEA;VaultEMEA/ORG
InternetAddress;*@apac.example.com;Mail03/ORG;APAC;/ORG-DirSync-Vault-APAC;BR-APAC;VaultAPAC/ORG
*;*;Mail01/ORG;;;;`);
p("Optional: `bulkreg.cmd Check` reports leftover placeholders, a missing certifier and loose folder permissions.");
done("No `<PLACEHOLDER>` remains. Every server in server_mapping.csv exists. DryRun=1.");
pb();

// ================================================================ STEP 4
h1("6. Step 4 – Build the Tool Database (bulkreg.nsf)");
p("**Who:** Domino administrator with Domino Designer. **Changes:** creates one local database.");
ol(
  "Create a blank local database **bulkreg.nsf** on the admin workstation. Set its ACL to administrators only.",
  "Optional: create **bulkreg_log.nsf** from the Agent Log template (`alog4.ntf`) for central logging.",
  "In Designer create a **LotusScript library** named exactly `BulkRegCommon` and paste in `BulkRegCommon.lss`.",
  "Create five LotusScript agents and paste in the matching file. For each one set **Trigger: Action menu selection** and **Target: None**, and keep `Option Public`, `Option Declare` and `Use \"BulkRegCommon\"` in (Options)."
);
tbl(["Agent name (exactly)", "Source file"], [
  ["01 | Preflight Check", "Agent01_Preflight.lss"],
  ["02 | Build Batch", "Agent02_BuildBatch.lss"],
  ["03 | Register Batch", "Agent03_RegisterBatch.lss"],
  ["04 | Verify Registration + Vault", "Agent04_VerifyVaultStatus.lss"],
  ["05 | Export to Registration Text File", "Agent05_ExportToBatchRegFile.lss (optional)"],
], [4200, 5160]);
p("Save, check for compile errors, and sign the database with the admin ID. **To start an agent:** open bulkreg.nsf → **Actions** → choose the agent. The first time, enter `C:\\BulkReg\\config\\bulkreg.ini`; the path is remembered.");
done("The library and all five agents compile, the database is signed, and they appear in the Actions menu.");

// ================================================================ STEP 5
h1("7. Step 5 – Preflight (Agent 01)");
p("**Changes:** none. Gives you the whole picture before you build any batch.");
ol(
  "Run **01 | Preflight Check**.",
  "Read the summary: environment PASS/FAIL, OK / WARN / ERROR per user, and **candidates per home server**.",
  "Open `C:\\BulkReg\\audit\\BulkReg_Preflight_<run>_audit.csv`. Fix data ERRORs in AD and let DirSync re-sync. Correct server_mapping.csv if users land on the wrong server.",
  "Use the per-server counts to plan batches: for example, one wave per home server (BatchServerFilter) or mixed batches of 500."
);
done("Environment errors = 0. You know how many users go to each home server, and you have a batch plan.");

// ================================================================ STEP 6
h1("8. Step 6 – Build a Batch and Review It (Agent 02)");
p("**Changes:** none in Domino. Writes the batch file you will approve.");
ol(
  "Optional: set `BatchServerFilter=Mail02/ORG` to build a batch for one home server only, or use `ExtraSelection` to limit it to a department or wave.",
  "Run **02 | Build Batch**. It reports the batch ID, for example `BATCH-20261005-093000`.",
  "Open `C:\\BulkReg\\batches\\BATCH-<id>_summary.txt`: rows, Include=Y, ERRORs, users per home server and per policy, and how many users are left for the next batch.",
  "Open `BATCH-<id>.csv` in Excel and review it (chapter 14 explains every column):",
  "Leave a user out by setting **Include=N**. Change **HomeServer / OrgUnit / Policy / Groups / VaultServer** if needed. Do **not** change NoteID or objectGUID.",
  "Save as **CSV UTF-8 (Comma delimited)**, keeping the same file name. Attach the reviewed file to the change ticket as the approval record."
);
note("Rows with Check=ERROR are written with Include=N. Users in this batch will not be picked by the next Build Batch until this batch is DONE. To discard a batch you will not run, move its file out of the batches folder.");
done("You have reviewed every Include=Y row, and the reviewed BATCH-<id>.csv is approved in the change ticket.");

// ================================================================ STEP 7
h1("9. Step 7 – Dry-Run the Batch (Agent 03, DryRun=1)");
p("**Changes:** none.");
ol(
  "Confirm `DryRun=1`. Run **03 | Register Batch** and accept the proposed batch file (the newest open batch) or enter another path.",
  "Check the dialog: number of users, number excluded, and **users per home server**. Answer **Yes**.",
  "Open `BATCH-<id>_dryrun_<run>.csv`. Every approved user shows **WOULD_REGISTER**. Any SKIPPED or FAILED_VALIDATION rows need fixing (edit the batch file, or rebuild it)."
);
done("All approved rows show WOULD_REGISTER. The batch is still OPEN.");

// ================================================================ STEP 8
h1("10. Step 8 – Pilot Batch (2 Users)");
p("**Changes:** registers 2 users. Do this once, before the first real batch.");
ol(
  "Set `ExtraSelection=ShortName = \"pilot1\" : \"pilot2\"` and run **02 | Build Batch**. Alternatively, set Include=N on all rows except two in a normal batch.",
  "Set `DryRun=0`. Run **03 | Register Batch**, answer Yes, type the **batch ID**, and enter the certifier password if UseCA=0.",
  "Check both users by hand: Certificate and hierarchical name, correct home server, Mail system still Other Internet Mail. The user can download the ID from the vault and log in.",
  "Run **04 | Verify** and choose the pilot batch file. Then clear ExtraSelection and set DryRun=1 again."
);
done("Both pilot users are REGISTERED and IN_VAULT, and the manual checks pass.");

// ================================================================ STEP 9
h1("11. Step 9 – Register the Reviewed Batch (Agent 03, LIVE)");
p("**Changes:** registers the approved users.");
ol(
  "Set `DryRun=0`. Run **03 | Register Batch** and choose the reviewed BATCH-<id>.csv.",
  "Check the totals per home server. Answer **Yes** and type the **batch ID** exactly.",
  "Watch progress in the status bar, or with `bulkreg.cmd Tail`. Keep the client open and the PC awake.",
  "At the end, read the summary: ok / failed / skipped. Results are in `BATCH-<id>_results.csv`, and the batch is now **DONE**.",
  "Set `DryRun=1` again."
);
note("If the circuit breaker stops the run, the remaining rows are recorded as NOT_PROCESSED and the batch is still marked DONE. Those users (and any FAILED ones) are offered again by the next Build Batch once the cause is fixed.");
done("The batch is DONE, and every row in BATCH-<id>_results.csv has a result.");

// ================================================================ STEP 10
h1("12. Step 10 – Verify the Batch and Close (Agent 04)");
ol(
  "Run **04 | Verify Registration + Vault** and choose the batch file (the default is the newest batch). The report is `BATCH-<id>_verify_<run>.csv`.",
  "Every row should be REGISTERED with IN_VAULT. For NOT_IN_VAULT, check the policy and vault, then run Verify again later (replication).",
  "Hand over initial passwords (`C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<batch>_<run>.csv`) through an approved secure channel.",
  "Delete secrets **only after** Verify shows IN_VAULT: `bulkreg.cmd PurgeSecrets -IncludeIds -Yes`, or delete the files manually.",
  "Archive the batch, results, verify and audit files with the change record.",
  "**Next batch:** go back to Step 6."
);
done("The batch's users are IN_VAULT, the secrets are deleted, and the records are archived.");
pb();

// ================================================================ 13 MULTI-SERVER
h1("13. Registering Across Multiple Servers");
h2("13.1 How the servers fit together");
tbl(["Role", "How many", "What BulkReg does with it"], [
  ["Registration server", "One per Domino domain (normally the admin server, which holds the Domino Directory master)", "All registrations run against it (`RegistrationServer`). The Person documents are updated there and replicate to the other servers."],
  ["Home servers", "Any number", "Each user gets one, from server_mapping.csv, reviewable in the batch file. It is passed to RegisterNewUser as the canonical name and becomes the user's home/mail server."],
  ["ID Vault servers", "One or more vaults, each with replicas", "The **policy** decides which vault receives the ID. `VaultServer` (default or per mapping rule) is only where BulkReg *checks* IsIDInVault."],
  ["Policies", "One per target group", "Map users to the explicit policy whose Security Settings assign the right vault (and other settings for that group)"],
], [2000, 2700, 4660]);
h2("13.2 Plan the mapping");
ol(
  "List your home servers and which users belong on each (by department, email domain, location or company).",
  "Write one rule per group in server_mapping.csv, most specific first, with the catch-all last.",
  "Run Preflight (01). Check the *candidates per home server* counts and the MapRule column in the audit CSV.",
  "Adjust the rules until every user lands on the intended server, OU and policy."
);
h2("13.3 Batch strategies");
tbl(["Strategy", "How", "When to use"], [
  ["Mixed batches", "BatchSize=500, no BatchServerFilter. Agent 03 shows users per server before you approve.", "Servers are similar and all are ready"],
  ["One server per wave", "`BatchServerFilter=Mail02/ORG`, then Build → Review → Register. Repeat per server.", "Servers go live on different dates, or are owned by different teams"],
  ["Department or region waves", "`ExtraSelection=Department = \"Sales\"` (any @formula)", "Business-driven rollout"],
  ["Per-row override", "Edit HomeServer / Policy / VaultServer in the batch file", "Exceptions: individual users who need a different server"],
], [2200, 4300, 2860]);
h2("13.4 Multiple Domino domains or directories");
p("BulkReg works within **one Domino Directory** per configuration. If you have several domains, use one config file per domain (`DirectoryServer`, `RegistrationServer`, certifier, mapping). Keep them as separate files, for example `bulkreg-emea.ini`, and enter the matching path when an agent starts.");
pb();

// ================================================================ 14 BATCH FILE
h1("14. Batch File Reference");
h2("14.1 Files in C:\\BulkReg\\batches");
tbl(["File", "Written by", "Purpose"], [
  ["BATCH-<id>.csv", "02 Build Batch", "The list you review and approve. Edit only Include, HomeServer, OrgUnit, Policy, Groups, VaultServer."],
  ["BATCH-<id>_summary.txt", "02", "Totals: rows, Include=Y, ERRORs, per home server, per policy, users left for the next batch"],
  ["BATCH-<id>_dryrun_<run>.csv", "03 (DryRun=1)", "Simulation result. The batch stays OPEN."],
  ["BATCH-<id>_results.csv", "03 (LIVE)", "One row per approved user. Its existence marks the batch **DONE**."],
  ["BATCH-<id>_verify_<run>.csv", "04", "Registration and vault status of the batch's users"],
], [3200, 1700, 4460]);
h2("14.2 Batch states");
tbl(["State", "Meaning", "Effect"], [
  ["OPEN", "No _results.csv yet", "Its users are not selected into new batches. Agent 03 offers the newest open batch by default."],
  ["DONE", "_results.csv exists (LIVE run finished or stopped)", "Agent 03 refuses to run it again. Unregistered users from it are offered by the next Build Batch."],
], [1300, 3600, 4460]);
p("`bulkreg.cmd Batches` lists every batch file with its rows, Include=Y count and state.");
h2("14.3 Columns");
tbl(["Column", "Editable?", "Meaning"], [
  ["Include", "**Yes** (Y/N)", "Only Y rows are registered"],
  ["BatchID, Seq", "No", "Batch identifier and row number"],
  ["NoteID, UNID, objectGUID", "**No**", "Identify the Person document and the AD user. Agent 03 checks that the objectGUID still matches."],
  ["FullName, FirstName, LastName, ShortName, InternetAddress", "No (fix in AD)", "User data from the Person document"],
  ["HomeServer", "**Yes**", "Target home server (abbreviated form, for example Mail02/ORG)"],
  ["OrgUnit, Policy, Groups", "**Yes**", "OU for the Notes name, explicit policy (assigns the vault), comma-separated groups"],
  ["VaultServer", "**Yes**", "Vault server used for the IsIDInVault check (empty = default)"],
  ["MapRule", "No", "The mapping rule that produced the values"],
  ["Check, Issues", "No", "OK / WARN / ERROR and the reasons"],
], [3700, 1500, 4160]);
warn("Excel: save as **CSV UTF-8 (Comma delimited)**. Semicolon-delimited files from some locales are also accepted. Do not sort away or delete the header row. Do not add rows by hand; build a new batch instead.");
pb();

// ================================================================ 15 HELPER
h1("15. PowerShell Helper (optional)");
p("You do not need it to register users. `scripts\\windows\\bulkreg.cmd` (which runs bulkreg.ps1) speeds up the Windows file tasks around a run, and never touches names.nsf.");
tbl(["Command", "Does", "Manual equivalent"], [
  ["Init", "Creates C:\\BulkReg folders including batches, restricts access, copies templates", "Step 2 commands"],
  ["Check", "Flags placeholders, a missing certifier, loose ACLs, whether the client is running", "Read bulkreg.ini, check permissions"],
  ["Batches", "Lists batch files with rows, Include=Y and state (OPEN / DONE)", "Look in C:\\BulkReg\\batches"],
  ["DryRun On|Off", "Sets DryRun=1/0, keeps a .bak copy and shows the diff", "Edit bulkreg.ini"],
  ["Status [file]", "Totals by Result plus rows that need attention (audit or _results.csv)", "Audit Viewer or Excel"],
  ["Tail", "Follows the newest debug log during a run", "Open the .log in Notepad"],
  ["PurgeSecrets [-IncludeIds] [-Yes]", "Lists, then (with -Yes) deletes password files and ID files", "Delete the files in secure and ids"],
], [2600, 4200, 2560]);

// ================================================================ 16 CONFIG
h1("16. Configuration Reference (bulkreg.ini)");
tbl(["Key", "Default", "Meaning"], [
  ["BaseDir", "C:\\BulkReg\\", "Base for default paths"],
  ["DirectoryServer / DirectoryFile", "– / names.nsf", "Directory that DirSync writes into"],
  ["RegistrationServer / RegistrationLog", "– / log.nsf", "Server that performs registration; Domino registration log"],
  ["UseCA / CertifierName / CertifierIDFile", "1 / – / –", "Domino CA (recommended) or a certifier ID file (password prompted)"],
  ["DefaultHomeServer / DefaultOrgUnit / DefaultPolicy / DefaultGroups", "–", "Used when no mapping rule overrides them"],
  ["VaultServer", "–", "Default vault server for IsIDInVault (overridable per mapping rule or batch row)"],
  ["MappingFile", "C:\\BulkReg\\config\\server_mapping.csv", "Multi-server rules"],
  ["ExtraSelection", "(empty)", "Extra @formula for Build Batch (pilot, waves)"],
  ["BatchSize", "500", "Rows per batch built by Agent 02"],
  ["BatchServerFilter", "(empty)", "Build a batch only for users mapped to this home server"],
  ["BatchDir", "C:\\BulkReg\\batches\\", "Batch, summary, results, dry-run and verify files"],
  ["MaxBatchRows", "1000", "Agent 03 refuses larger batch files"],
  ["MaxScan", "5000", "Maximum directory search results (0 = no limit)"],
  ["PauseMs / MaxConsecutiveErrors", "500 / 5", "Pause between users; circuit breaker"],
  ["DryRun", "1", "1 = simulate, 0 = live"],
  ["ExpirationDays / MinPasswordLength / InitialPasswordLength", "730 / 8 / 16", "Certificate validity; ID password strength; initial password length"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1", "No mail file; restore Other Internet Mail after registration"],
  ["IDFileDir / PasswordDir / AuditDir / WritePasswordFile", "C:\\BulkReg\\… / 1", "Output folders; write initial passwords to the restricted file"],
  ["IsNorthAmerican / EnforceUniqueShortName / StoreIDInAddressBook / SyncInternetPassword", "1 / 1 / 0 / 0", "NotesRegistration options"],
  ["VaultCheckAfterReg / LogLevel / LogServer / LogDb", "1 / INFO / – / –", "Vault check after each user; logging"],
], [3800, 2200, 3360]);

// ================================================================ 17 AUDIT
h1("17. Audit and Logging");
tbl(["Output", "Location", "Contains"], [
  ["Batch files", "C:\\BulkReg\\batches\\", "Who was selected, reviewed values, results per batch (chapter 14)"],
  ["Audit CSV", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<RunID>_audit.csv", "One row per user per action, including BatchID. **No passwords.**"],
  ["Debug log", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<RunID>_debug.log", "Timestamped events, approvals, batch file size and time"],
  ["Helper actions log", "C:\\BulkReg\\audit\\bulkreg_admin_actions.log", "PowerShell helper changes"],
  ["Agent Log database", "LogServer!!LogDb (optional)", "The same events, stored centrally"],
  ["Domino registration log", "log.nsf on the registration server", "Domino's own registration records"],
  ["Password file", "C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<batch>_<run>.csv", "Initial passwords. Restricted; delete after hand-off."],
], [2200, 4000, 3160]);
h2("17.1 Result codes");
tbl(["Result", "Meaning", "Action"], [
  ["OK / WARN / ERROR", "Preflight or Build Batch check", "Fix ERROR rows (they are excluded)"],
  ["WOULD_REGISTER", "Dry-run result", "Review"],
  ["REGISTERED", "ID created and certified, in the vault", "None"],
  ["REGISTERED_VAULT_PENDING", "Registered, but the ID was not found in the vault yet", "Check the policy, re-run Verify"],
  ["FAILED_VALIDATION", "Batch row values invalid, not attempted", "Fix and rebuild"],
  ["FAILED", "Registration error (see Message: stage + error)", "Chapter 18"],
  ["SKIPPED", "Already registered, document gone, or objectGUID mismatch", "None, or rebuild"],
  ["NOT_PROCESSED", "Not reached because the circuit breaker stopped the run", "Next batch"],
  ["UNREGISTERED / NOT_FOUND", "Verify: no Notes ID yet, or the document no longer exists", "Next batch, or investigate"],
], [2900, 3700, 2760]);
p("Open any audit or results CSV in `tools\\BulkReg_AuditViewer.html` (offline), in Excel, or with `bulkreg.cmd Status <file>`.");

// ================================================================ 18 TROUBLESHOOTING
h1("18. Troubleshooting");
p("To debug: set `LogLevel=DEBUG`, rebuild a small batch (for example ExtraSelection on one user), dry-run it, and read the debug log. FAILED rows show the **stage** (load, validate, configure, RegisterNewUser, verify, preserveMail, vault), the Notes error number and the code line.");
tbl(["Symptom", "Likely cause", "Fix"], [
  ["Build Batch selects 0 users", "All users registered, already in OPEN batches, filtered by BatchServerFilter or ExtraSelection", "Check the summary's 'Not selected' line; finish or remove the open batches"],
  ["\"There is no open batch file\"", "No batch built, or all batches are DONE", "Run 02 | Build Batch"],
  ["\"already DONE\"", "The batch already ran LIVE", "Build a new batch; unregistered users are picked again"],
  ["\"header is missing … columns\"", "The CSV was re-saved without its header, or with a different layout", "Rebuild the batch; save as CSV UTF-8"],
  ["Rows SKIPPED: objectGUID mismatch", "The Person document was recreated, or the row was edited", "Rebuild the batch"],
  ["FAILED_VALIDATION: HomeServer", "Edited HomeServer is empty or unreachable", "Fix the batch row or the server"],
  ["FAILED stage=RegisterNewUser", "Not an RA, wrong certifier or password, missing rights, unknown server", "Read the debug log message; fix the CA/RA, certifier, rights or server name"],
  ["REGISTERED_VAULT_PENDING", "Policy has no vault, wrong VaultServer for that vault, or replication delay", "Check the policy synopsis and the mapping VaultServer; re-run Verify later"],
  ["MailSystem changes after the next sync", "DirSync attribute mapping", "Adjust the DirSync mapping, or set PreserveMailSystem=0"],
  ["Agent not in the Actions menu / refuses to run", "Wrong trigger, not signed, or not in the Windows client", "Step 4 settings; run from the Windows admin workstation"],
], [2700, 3300, 3360]);
p("Escalate to the platform owner if failures affect more than one batch. Escalate immediately to the security owner if a password file, ID file or certifier may have been exposed.");
pb();

// ================================================================ 19 SECURITY
h1("19. Security, Change Control and Rollback");
h2("19.1 Controls and evidence");
tbl(["Risk", "Control", "Evidence"], [
  ["Unknown users registered", "Only the reviewed Include=Y rows of an approved batch file are processed", "BATCH-<id>.csv in the change ticket, plus _results.csv"],
  ["Wrong user hit", "objectGUID in the batch must match the Person document", "SKIPPED rows with reason"],
  ["Unintended mass change", "DryRun default, per-server summary, typed batch ID, MaxBatchRows, circuit breaker", "Debug log approval line, audit Mode column"],
  ["Same user in two batches", "Users in OPEN batches are excluded from new batches", "Build Batch summary"],
  ["Double registration", "Certificate re-check per user", "SKIPPED rows"],
  ["Certifier password exposure", "Masked prompt, memory only, never stored or logged; CA recommended", "Code review, logs"],
  ["Personal data and ID exposure", "Restricted batches, ids and secure folders; secrets deleted after Verify; .gitignore blocks batch, ID and password files", "Folder ACLs, helper actions log"],
  ["Weak initial passwords", "Random 16-character password plus a policy-forced change (LotusScript Rnd is not cryptographic)", "Security Settings policy"],
], [2400, 4500, 2460]);
h2("19.2 Change checklist (per batch)");
tbl(["When", "Item"], [
  ["Before", "Steps 1–5 done once; batch built; BATCH-<id>.csv and _summary.txt reviewed and attached; dry run clean"],
  ["Go / no-go", "Pilot passed (first time); target servers healthy; DryRun=0 set deliberately"],
  ["After", "_results.csv and the Verify report attached; secrets deleted; DryRun=1"],
], [1500, 7860]);
h2("19.3 Rollback");
p("Registration certifies the existing Person document and creates an ID. It **cannot be cleanly undone**. To reverse users, take them from `BATCH-<id>_results.csv` and use your standard deletion process (AdminP Delete Person) and vault clean-up. HCL notes that users registered through user registration are **not** removed by a DirSync full resync. To recover from an interrupted run, build a new batch: the unregistered users are offered again.");

// ================================================================ 20 LIMITATIONS
h1("20. Known Limitations and Items to Verify");
tbl(["#", "Item", "Action"], [
  ["1", "The code has not been compiled or run against a live Domino environment", "Steps 7–8 (dry run and pilot) are mandatory before production"],
  ["2", "The RegisterNewUser parameter order follows HCL's ContactNoteID example and the 14.5 syntax", "Confirm when you compile in Designer"],
  ["3", "UseCA=1 passes an empty certifier password", "Confirm in the pilot"],
  ["4", "PreserveMailSystem behaviour with your DirSync mapping", "Check in the pilot and after the next sync"],
  ["5", "Batch files edited in Excel must stay CSV with the original header", "Save as CSV UTF-8; rebuild if in doubt"],
  ["6", "One Domino Directory per config file", "Use one config per domain (13.4)"],
  ["7", "bulkreg.ps1 was reviewed but not executed", "Run Help and Check once before relying on it"],
  ["8", "Large batches depend on the admin workstation staying on and connected", "Keep batches at 500 or fewer; re-runs are safe"],
], [500, 5600, 3260]);

// ================================================================ APPENDICES
h1("Appendix A – Alternative Methods (Manual)");
h2("A.1 Register Selected Person (small numbers)");
p("Domino Administrator → People & Groups → select DirSync users → right-click **Register Selected Person** → choose the certifier and the ID-Vault policy. You are prompted per user.");
h2("A.2 Registration text file (Agent 05 + Import)");
p("Agent 05 writes `C:\\BulkReg\\secure\\BatchReg_DirSync_<run>.txt` (HCL's 20-field format, UTF-8 BOM, contains passwords). Import it with People → Register → Import Text File. HCL documents this for new users, so test 1–2 DirSync users first.");

h1("Appendix B – Agent Reference");
tbl(["Agent", "Reads", "Writes", "Prompts"], [
  ["01 Preflight", "names.nsf, servers", "Audit, debug log", "Config path"],
  ["02 Build Batch", "names.nsf, open batch files, servers", "BATCH-<id>.csv, _summary.txt, audit", "Config path"],
  ["03 Register Batch", "One batch file, names.nsf", "names.nsf (LIVE), ID files, _results.csv / _dryrun.csv, password file, audit", "Config path, batch file, Yes/No, batch ID (LIVE), certifier password if UseCA=0"],
  ["04 Verify", "A batch file (or all users), names.nsf, ID Vault", "_verify.csv, audit", "Config path, batch file or empty"],
  ["05 Export (optional)", "names.nsf", "Text file (secure), audit", "Config path, password Yes/No"],
], [1700, 2400, 2900, 2360]);

h1("Appendix C – References (HCL documentation)");
C.push({ t: "refs", items: [
  ["Registering Active Directory users in Domino (Directory Sync)", "https://help.hcl-software.com/domino/14.0.0/admin/conf_adsync_registering_ad_users.html"],
  ["Registering users from a text file (14.5.1)", "https://help.hcl-software.com/domino/14.5.1/admin/conf_registeringusersfromatextfile_t.html"],
  ["NotesRegistration class", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESREGISTRATION_CLASS.html"],
  ["ContactNoteID property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_CONTACTNOTEID_PROPERTY_NOTESREGISTRATION.html"],
  ["RegisterNewUser method (mail server: canonical name)", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_REGISTERNEWUSER_METHOD.html"],
  ["UseCertificateAuthority property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_USECERTIFICATEAUTHORITY_PROPERTY_REG.html"],
  ["PolicyName property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_POLICYNAME_PROPERTY_REG.html"],
  ["NotesIDVault class", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESIDVAULT_CLASS.html"],
  ["Installing the Domino Administrator client (Windows)", "https://help.hcl-software.com/domino/14.0.0/admin/admn_installingthedominoadministratorclient_c.html"],
]});

module.exports = { META, C };
