// BulkReg Administrator Guide — single source for Word + Web.
// The version is read from the kit's VERSION file, so guide, code and config always carry the same number.
const fsV = require("fs"), pathV = require("path");
const KIT_VERSION = (() => {
  for (const p of [pathV.join(__dirname, "..", "VERSION"), pathV.join(__dirname, "VERSION")]) {
    try { return fsV.readFileSync(p, "utf8").trim(); } catch (e) { /* try next */ }
  }
  throw new Error("VERSION file not found next to the docs folder");
})();
// Assumes NOTHING exists yet. Every procedure: purpose, who/where, before you start,
// numbered single-action steps with expected results, and a "Done when" check.
const META = {
  title: "BulkReg Framework",
  subtitle: "Step-by-step guide: bulk registration of Directory Sync (Active Directory) users in HCL Domino – Notes ID, mail file and ID Vault – in reviewed batches across multiple servers, from the Windows Domino Administrator client",
  docType: "Administrator Setup, Operations & Audit Guide",
  version: KIT_VERSION,
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
let olCount = 0;
const ol = (...items) => { C.push({ t: "numbers", items }); olCount = items.length; };
const olc = (...items) => { C.push({ t: "numbers", items, start: olCount + 1 }); olCount += items.length; };  // continue numbering
const tbl = (head, rows, widths) => C.push({ t: "table", head, rows, widths });
const code = (text) => C.push({ t: "code", text });
const note = (text) => C.push({ t: "note", text });
const warn = (text) => C.push({ t: "warn", text });
const done = (text) => C.push({ t: "done", text });
const pb = () => C.push({ t: "pagebreak" });
// procedure header: who / where / changes
const meta = (who, where, changes) => p(`**Who:** ${who}   **Where:** ${where}   **Changes:** ${changes}`);

// ================================================================ DOCUMENT CONTROL
h1("Document Control");
tbl(["Item", "Value"], [
  ["Document", META.title + " – " + META.docType],
  ["Version", META.version + " (" + META.status + ")"],
  ["Date / Author", META.date + " / " + META.author],
  ["Classification", META.classification],
  ["Applies to", "HCL Domino 14.x servers (any supported OS). All BulkReg work is done from the **HCL Domino Administrator 14.x client on Windows**."],
  ["Framework version", "BulkReg " + KIT_VERSION + ": script libraries BulkRegCommon and BulkRegAgents, 6 one-line agents (00–05), config templates, optional PowerShell helper, Audit Viewer"],
], [2400, 6960]);
h3("Revision history");
tbl(["Version", "Change"], [
  ["1.0 – 2.9", "Guide-only versions before the kit had one version number (see below from 2.0)"],
  ["3.8.0", "**Release 3.8.0.** Fixes and features from the first 3.7.0 live pilot: compile fix (`List As Long`); full name from DisplayName, short name from the ShortName list; **server platform detected per server** (Linux, Windows or mixed; ServerOSDetect, ServerOSMap, ServerOS fallback) with the matching path form for registration and mail files; registration parameters in the debug log; dry run also checks the ID file folder and MailTemplate; new `RegisterCreateMailDb=0` (BulkReg creates the mail file itself). Re-paste both libraries and update bulkreg.ini (see DEPLOY-3.8.0.md)."],
  ["3.7.0", "**Release 3.7.0.** **Batch segregation in Preflight** (plans all candidates, checks one batch; PreflightScope / PreflightBatchNo; new `_batchplan.txt`). **Automatic distribution over two or more home servers** (HomeServers, HomeServerMaxUsers=2500, HomeServerAssignment; mapping column 3 `AUTO`). **Short name** read from the AD samaccountname item (ShortNameFields), never from the FullName; full-name-like values are an ERROR. **Internet address constructed** as `<shortname>@<InternetDomain>` when AD has none. **Domino on Linux**: ServerOS, ServerDataDir (/local/notesdata), mail paths sent as `mail1/smith.nsf`; MailFolderMax now per server. Re-paste both libraries and replace bulkreg.ini and server_mapping.csv (see DEPLOY-3.8.0.md)."],
  ["3.6.6", "**Release 3.6.6.** Compile fix in BulkRegCommon (BR_MailAclFix: Type mismatch on CanDeleteDocuments). Re-paste BulkRegCommon."],
  ["3.6.5", "**Release 3.6.5.** **Mail file owner = Editor + Delete documents** (new MailOwnerAccess=EDITOR) instead of Domino's default Manager; set at registration, corrected right after it, checked and correctable by Verify together with the managers. Re-paste both libraries."],
  ["3.6.4", "**Release 3.6.4.** **Mail file managers:** the admin ID running BulkReg (or the names in MailACLManager, comma separated) is added with Manager access to every new mail file after registration and before the replicas; Verify reports missing entries and can add them. Re-paste both libraries."],
  ["3.6.3", "**Release 3.6.3.** Log views: groups now have twisties and can be expanded/collapsed; view 1 opens by default. Re-paste BulkRegAgents and run 00 - Set Up Log Database again."],
  ["3.6.2", "**Release 3.6.2.** Fix in 00 - Set Up Log Database: the final dialog failed with *Object variable not set* after the views had been created. Re-paste BulkRegAgents."],
  ["3.6.1", "**Release 3.6.1.** Compile fix in BulkRegAgents: variable `imp` renamed (Imp is a LotusScript operator). Re-paste BulkRegAgents."],
  ["3.6.0", "**Release 3.6.0.** **One audit folder per run**, named `<date>_<time>_<NN-Agent>_<MODE>` with MODE **DRYRUN** or **LIVE-PRODUCTION** for 03 (READ-ONLY / VERIFY / SETUP for the other agents). File names carry the mode too; each folder has a RUN_INFO.txt and a copy of the batch results or dry-run report. The log database shows the mode in view 1 and in the run titles. PowerShell helper searches the run folders."],
  ["3.5.0", "**Release 3.5.0.** **Notes names fixed:** CertifierName is passed to the registration as `/Demo` (any of /Demo, Demo, O=Demo accepted), so users become **Neha Arora/Demo** instead of Neha Arora/O=Demo/Demo; OrgUnit values with `=` or `/` are rejected; the batch file shows the **NotesName** each user will get; 03 checks the name after every registration and **stops the run** at the first wrong name (REGISTERED_WRONG_NAME); Verify reports wrong names. **Mail file title:** set to the user's name right after registration (MailFileTitle={CN}); Verify reports empty titles and offers to set them. D6: how to correct users registered with a wrong name."],
  ["3.4.1", "**Release 3.4.1.** Guide only: B18 warns that Designer proposes Target *All selected documents*; D6 row for the message *to run this agent you must have at least one document selected* (set Target: None). Agent headers say the same. No code change."],
  ["3.4.0", "**Release 3.4.0.** **Users without an Internet address are skipped and flagged** (SkipNoInternetAddress=1): not put into a batch, listed in `BATCH-<id>_skipped_no_internet_address.csv`, result SKIPPED_NO_INET; 03 also skips them. **Structured log database:** BulkReg writes its own Run, Entry and Audit documents; new agent **00 - Set Up Log Database** creates a form and 8 categorized views (runs by date, batches, users, results, home servers, problems, skipped users, full log). B15 (blank template), new B20a and D4a."],
  ["3.3.2", "**Release 3.3.2.** Users without an Internet address are a **warning only**, never an error: they stay Include=Y and are registered. Preflight, the Build Batch dialog and the batch summary count them separately (`No Internet addr`). C3 and D6 explain what it means."],
  ["3.3.1", "**Release 3.3.1.** Installation simplified: Domino Designer distributes pasted LotusScript automatically, so B17, B17a and B18 now say **paste the whole file** (Ctrl+A, Ctrl+V) instead of pasting STEP blocks into each section. The STEP markers in the .lss files are replaced by `--- part …` labels and a HOW TO INSTALL note. No code change."],
  ["3.3.0", "**Release 3.3.0.** **All code moved into script libraries.** New library **BulkRegAgents** holds the code of the five agents (BR_RunPreflight … BR_RunExport); each agent now contains only `Use \"BulkRegAgents\"` and one `Call BR_Run…()` line, so future releases replace only the two libraries (B17a). B17 and B18 rewritten; Appendix B shows the Sub per agent. Library variables are reset at the start of every run. **One-time migration from 3.2: B17 (create BulkRegAgents) and B18 (reduce each agent to 3 + 3 lines).**"],
  ["3.2.7", "**Release 3.2.7.** Version numbers made fully consistent: the guide now carries the full release number (read from the VERSION file) instead of 3.2; revision history and CHANGELOG use full numbers; new helper command `bulkreg.cmd Versions` checks every file against VERSION. No change to the LotusScript logic (only the version lines)."],
  ["3.2.6", "**Release 3.2.6.** Review round: log database opened before the access check (Agent 01), MailSystem set to Notes explicitly (Agent 03), MaxScan default 0. New B17a: how to update the code to a new release."],
  ["3.2.5", "**Release 3.2.5.** Compile fix in Agent 01 (constants DBACL_CREATE_DOCUMENTS / DBACL_DELETE_DOCUMENTS); all Domino constants and NotesRegistration properties checked against the HCL reference."],
  ["3.2.4", "**Release 3.2.4.** Compile fix in BulkRegCommon and Agent 03: `UBound(Split(...))` replaced by the new helper BR_ListCount (Type mismatch)."],
  ["3.2.3", "**Release 3.2.3.** Full syntax review of the code: reserved word `base` renamed, Type assignment replaced by BR_ClearUser, **IsIDInVault arguments corrected** (username, servername). Re-paste the library and Agent 03 (and recompile all agents)."],
  ["3.2.2", "**Release 3.2.2.** Compile fixes in BulkRegCommon (B17): the selection formula string now uses `{…}` delimiters because the formula contains `|`; two missing quotes fixed. Re-paste the library (STEP C) and recompile all agents."],
  ["3.2.1", "**Release 3.2.1.** Database placement re-validated: tool database **local** (code only, client UI, your ID), log database on a **server** (shared audit record). B13 explains why; B14 adds local encryption and consistent ACL (a local ACL alone is not a boundary); B15 tightens the log ACL (operators Author + Create documents, no Delete; owner group separate), template-server tip, backup and size. Preflight checks both: tool database local, and your access to the log database."],
  ["3.2.0", "**Release 3.2.0.** **Mail cluster replicas:** list the cluster once (`MailClusterServers`); 03 requests a replica of every new mail file on each other member through AdminP (Create Replica), 04 verifies them (REPLICAS_OK). Mail file names and numbered folders are allocated once for the whole cluster. Mapping column 8 ClusterReplicas. **Batches of 1000** (BatchSize default). Worked example for one cluster of 4 servers (2 DC, 2 DR) with 2 × 2500 users (B12.7). New D3c; B4 cluster prerequisites; pattern ranges `[a-l]*` documented."],
  ["3.1.0", "**Release 3.1.0.** server_mapping.csv fully documented (B12.1–B12.9: format, matching, fields, order, step-by-step, worked examples, testing, common mistakes) and a self-explaining template. Preflight writes a **mapping test** (_mapping.txt: users per rule). Agents stop if a mapping rule still contains a <placeholder>; warning when no catch-all rule exists. Consistency check of all settings, names and versions."],
  ["3.0.0", "**Release 3.0.0.** One version number across the whole kit: guide, library and all agents 3.0.0, bulkreg.ini, server_mapping.csv, PowerShell helper, Audit Viewer, README, VERSION and CHANGELOG.md. Content as in 2.9."],
  ["2.9", "**DryRun explained** (D3b, bulkreg.ini). **Central BulkReg log database is now required** (B15): every run, every action and one AUDIT entry per user are written there; agents stop if it cannot be opened."],
  ["2.8", "Mail folder layout made explicit: mail1, mail2 … are created **directly under the Domino data directory**, next to the existing mail folder, not inside it. Folder diagram, plain explanation of MailFolderPrefix / MailFileDir / new MailExistingFolders. BulkReg rejects a prefix with a number (mail1) or a path (mail\\mail) at start-up."],
  ["2.7", "New one-page **Agent Run Order** at the front of the guide (flow, step table with DryRun setting, input/output and go/no-go per step, rules)."],
  ["2.6", "RegistrationLog corrected: registration is logged to the **Certification Log certlog.nsf** on the registration server (HCL: any non-empty value → CERTLOG.NSF; empty = no logging). log.nsf is the server's general log. Prerequisite check for certlog.nsf added (B4)."],
  ["2.5", "**Prerequisite: pre-create the numbered mail folders** (mail1…mailN, one per 1000 users) on every home server (B4). Preflight calculates the folders needed per server and writes the create commands. New `MailFolderMax`: Build Batch never assigns a folder above the number you created."],
  ["2.4", "Mail file **naming = last name** (configurable), **uniqueness** checked against all mail folders on the home server, Person documents, open batches and the batch itself (clash → smith2.nsf or ERROR), **numbered folders** mail1, mail2… with max 1000 mail files each. MailFileNote recorded in batch file, summary, results and audit."],
  ["2.3", "**Every registered user now gets a Domino mail file** on the home server (MailFile column in the batch, reviewable). CreateMailDb / PreserveMailSystem removed. Mail file settings (folder, template, ACL manager, quota, full-text index), existence checks before and after registration, and mail file status in Verify."],
  ["2.1", "Name formats: servers in canonical (CN=DominoADMail/O=Demo) or abbreviated (DominoADMail/Demo) form, both accepted by the code. **Organizational policies** (*/Demo, */Sales/Demo) supported alongside explicit policies (B8 Option B, OrgPolicyAssignsVault, '-' in the mapping). Consistent 'Demo' examples."],
  ["2.0", "Complete rewrite as a **from-scratch, step-by-step guide**. Every Domino object (vault, security settings, policy, roles, RA, tool database, agents) is created click by click. Agent names changed to `BulkReg\\NN - Name`, because `|` is the alias separator in Notes design names. Explicit policy names use the `*/name` form."],
], [1200, 8160]);
h3("Review and approval");
tbl(["Role", "Name", "Decision / Date"], [
  ["Domino platform owner", "", ""],
  ["Security / IAM owner", "", ""],
  ["Change manager (CAB)", "", ""],
  ["Audit / compliance reviewer", "", ""],
], [3400, 3200, 2760]);
pb();

// ================================================================ HOW TO USE
h1("How to Use This Guide");
p("This guide assumes **nothing has been created yet**: no folders, no tool database, no policy, no vault assignment. Follow it from top to bottom the first time. After that you only repeat Part C for each batch.");
tbl(["Part", "Contents", "When"], [
  ["A – Understand", "What BulkReg does, how a batch works, everything you will create", "Read once (10 minutes)"],
  ["B – One-time setup", "Procedures B1–B21: from an empty workstation to a tested tool", "Once"],
  ["Agent Run Order", "One page: which agent, in which order, with which DryRun setting", "Keep it next to you"],
  ["C – Run a batch", "Procedures C1–C9: build, review, dry-run, register, verify, close", "For every batch of users"],
  ["D – Reference", "Multi-server design, file formats, settings, results, troubleshooting, security, glossary", "Look up as needed"],
], [2000, 5000, 2360]);
h2("Conventions");
tbl(["You see", "Meaning"], [
  ["**Bold**", "A button, tab, menu item or field you click or fill in"],
  ["Menu > Item > Sub-item", "Click each item in turn"],
  ["`C:\\BulkReg\\config`", "Text to type, a path, a file or a value, exactly as shown"],
  ["`<DominoADMail/Demo>`", "A placeholder. Replace it, including the angle brackets, with your value from the worksheet (B1)."],
  ["Result:", "What you should see after a step. If you see something else, stop and use chapter D6 (Troubleshooting)."],
  ["Done when (green box)", "The check that the procedure is complete. Do not continue until it is true."],
], [2600, 6760]);
h2("Example names used in this guide");
p("All examples use the organization **Demo**. Replace them with your own names from the worksheet (B1).");
tbl(["Object", "Canonical form", "Abbreviated form", "Notes"], [
  ["Registration / admin server", "`CN=DominoAdmin/O=Demo`", "`DominoAdmin/Demo`", "Holds the master Domino Directory"],
  ["Home (mail) servers", "`CN=DominoADMail/O=Demo`, `CN=DominoADMail2/O=Demo`", "`DominoADMail/Demo`, `DominoADMail2/Demo`", "BulkReg accepts both forms anywhere a server is entered"],
  ["Server with an OU", "`CN=DominoADMail/OU=EMEA/O=Demo`", "`DominoADMail/EMEA/Demo`", "Same rule"],
  ["Mail cluster (4 servers)", "`CN=DominoADMail/O=Demo`, `CN=DominoADMail2/O=Demo` (DC); `CN=DominoADMailDR1/O=Demo`, `CN=DominoADMailDR2/O=Demo` (DR)", "`DominoADMail/Demo`, `DominoADMail2/Demo`, `DominoADMailDR1/Demo`, `DominoADMailDR2/Demo`", "Home servers in DC; every member holds a replica of every mail file"],
  ["Vault server", "`CN=DominoVault/O=Demo`", "`DominoVault/Demo`", "Use the name shown in the vault document"],
  ["Organization certifier", "`O=Demo`", "`/Demo`", "CertifierName for the Domino CA (enter `/Demo`; `Demo` and `O=Demo` are accepted)"],
  ["OU certifier", "`OU=Sales/O=Demo`", "`/Sales/Demo`", "Registers users as John Smith/Sales/Demo"],
  ["Registered user (no OU)", "`CN=Neha Arora/O=Demo`", "`Neha Arora/Demo`", "Result of registration with certifier /Demo and an empty OrgUnit. **Never** `Neha Arora/O=Demo/Demo`."],
  ["Registered user (OU Sales)", "`CN=John Smith/OU=Sales/O=Demo`", "`John Smith/Sales/Demo`", "Result of registration with OrgUnit Sales"],
  ["Organizational policy (whole org)", "`*/Demo`", "–", "Applied automatically to users under /Demo"],
  ["Organizational policy (one OU)", "`*/Sales/Demo`", "–", "Applied automatically to users under /Sales/Demo"],
  ["Explicit policy", "`*/DirSync-Vault`", "–", "Applied only when named at registration (Policy column)"],
], [2300, 2700, 2300, 2060]);
pb();

// ================================================================ RUN ORDER
h1("Agent Run Order (read this first)");
p("BulkReg has **six agents**. Agent **00** is run once by the log database owner (B20a). In every batch **four** are used, always in this order: **01 → 02 → (you review) → 03 dry run → 03 live → 04**. Agent **05 is not part of the process**; it is only for the manual alternative in Appendix A. Run every agent from bulkreg.nsf > **Actions > BulkReg**.");
code(`FOR EVERY BATCH:

 1. Actions > BulkReg > 01 - Preflight Check        (read-only)
         -> fix ERRORs, create the mail folders it lists
 2. Actions > BulkReg > 02 - Build Batch            (read-only)
         -> C:\\BulkReg\\batches\\BATCH-<id>.csv + BATCH-<id>_summary.txt
 3. YOU review BATCH-<id>.csv                        (Include Y/N, server, mail file)
 4. bulkreg.ini: DryRun=1
    Actions > BulkReg > 03 - Register Batch         (simulation)
         -> BATCH-<id>_dryrun_<run>.csv : every row WOULD_REGISTER ?
 5. bulkreg.ini: DryRun=0
 6. Actions > BulkReg > 03 - Register Batch         (LIVE - type the batch ID)
         -> BATCH-<id>_results.csv     (batch is now DONE)
 7. bulkreg.ini: DryRun=1
 8. Actions > BulkReg > 04 - Verify Registration and Vault   (choose the batch)
         -> BATCH-<id>_verify_<run>.csv : REGISTERED + IN_VAULT + MAILFILE_OK + REPLICAS_OK ?
         (cluster replicas are made by AdminP: run 04 again later until all are REPLICAS_OK)
 9. Hand over passwords, delete secrets, then the next batch: back to step 1 (or 2)

FIRST TIME ONLY : run steps 2-8 once with a 2-user pilot batch (C5).
NOT IN THE CYCLE: 05 - Export to Registration Text File (manual method only).`);
tbl(["#", "Do this", "Agent / action", "DryRun", "Input", "Output", "Go on only if"], [
  ["1", "Check environment and users", "**01 - Preflight Check**", "any", "bulkreg.ini, mapping, names.nsf", "Preflight audit CSV, _mailfolders.txt", "0 environment errors; mail folders exist"],
  ["2", "Select the next batch", "**02 - Build Batch**", "any", "names.nsf, open batches, servers", "BATCH-<id>.csv, _summary.txt", "Counts per server look right"],
  ["3", "Review the batch", "You (Excel as text / Notepad)", "–", "BATCH-<id>.csv", "Reviewed BATCH-<id>.csv", "Every Include=Y row checked; file saved"],
  ["4", "Simulate", "**03 - Register Batch**", "**1**", "BATCH-<id>.csv", "BATCH-<id>_dryrun_<run>.csv", "All rows WOULD_REGISTER"],
  ["5", "Switch to live", "Edit bulkreg.ini", "set **0**", "–", "–", "Change approved"],
  ["6", "Register", "**03 - Register Batch** (type the batch ID)", "**0**", "same BATCH-<id>.csv", "BATCH-<id>_results.csv (batch DONE), password file", "Run finished"],
  ["7", "Back to safe mode", "Edit bulkreg.ini", "set **1**", "–", "–", "–"],
  ["8", "Check the result", "**04 - Verify Registration and Vault** (choose the batch)", "any", "BATCH-<id>.csv", "BATCH-<id>_verify_<run>.csv", "REGISTERED + IN_VAULT + MAILFILE_OK + REPLICAS_OK (repeat later if replicas are still missing)"],
  ["9", "Close", "Hand over passwords; PurgeSecrets", "1", "password file, ids", "–", "Then start the next batch at step 1 (or 2)"],
], [400, 1500, 2000, 1000, 1500, 1700, 1260]);
h3("Rules");
ul(
  "**03 only accepts a batch file built by 02.** It never selects users by itself. There is no 03 without 02.",
  "**Always run 03 twice per batch:** first with DryRun=1, then with DryRun=0, on the **same** batch file.",
  "**One LIVE run per batch.** After it, the batch is DONE and 03 refuses it. Users not registered (FAILED, NOT_PROCESSED) are picked up again by the next 02.",
  "**01 before 02** the first time and whenever AD data, server_mapping.csv or servers changed. Otherwise it is recommended before each batch.",
  "**04 after every LIVE run**, and again later for users that were still pending (vault, mail file or cluster replicas).",
  "**Batch size 1000** (`BatchSize=1000`): one batch fills about one numbered mail folder. 2500 users = 3 batches (1000 + 1000 + 500).",
  "**Only one batch open at a time** is the simplest way to work. 02 never puts a user into two open batches.",
  "**05 is never part of this sequence.**",
  "**DryRun only affects 03** (D3b). Every agent writes to the central log database (B15)."
);
h3("Where each step is described in detail");
tbl(["Step", "Procedure"], [
  ["1", "C1 Preflight"], ["2", "C2 Build a batch"], ["3", "C3 Review the batch file"], ["4", "C4 Dry-run the batch"],
  ["First batch only", "C5 Pilot (2 users): steps 2–8 with two users"], ["5–7", "C6 Register the reviewed batch"], ["8", "C7 Verify"], ["9", "C8 Hand over and clean up, C9 Next batch"],
], [2400, 6960]);
pb();

// ================================================================ PART A
h1("Part A – Understand");
h2("A1 What BulkReg does");
p("Directory Sync (DirSync) copies Active Directory users into the Domino Directory (`names.nsf`) as **Person documents**. These users can be found in Domino, but they have **no Notes ID**, no certificate and no mail file (Mail system: *Other Internet Mail*).");
p("BulkReg turns them into **full Domino users**, in reviewed batches. Each user gets a certified **Notes ID**, which is stored in the **ID Vault**, and a **Domino mail file** on the right **home server**. The Person document then points to that mail file. If the home server belongs to a **mail cluster**, a **replica** of the mail file is created on every other cluster member (for example the DR servers). Every step is logged for audit.");
p("It uses HCL's documented API for this case, `NotesRegistration.ContactNoteID`: *“Used to register users who have existing Person documents created by syncing Active Directory users into the Domino directory.”* The existing Person document is upgraded in place, so no duplicate is created.");
h2("A2 How a batch works: you always see who is registered");
tbl(["Stage", "Tool", "What happens", "Changes Domino?"], [
  ["1 Build", "Agent 02", "Picks the next batch (default 1000) of unregistered DirSync users. Works out each user's home server, **mail file**, OU, policy, groups and vault. Validates them and writes a **batch file** (CSV) plus a summary.", "No"],
  ["2 Review", "You, in Excel or Notepad", "Read the list. Exclude users (Include=N) or correct their server, OU, policy, groups or vault. Save the file.", "No"],
  ["3 Dry run", "Agent 03, DryRun=1", "Simulates the batch and shows what would happen", "No"],
  ["4 Register", "Agent 03, DryRun=0", "Shows totals per server. You type the batch ID to approve. Only the approved rows are registered: Notes ID + mail file + vault, plus AdminP requests for the mail file replicas on the other cluster members.", "**Yes**"],
  ["5 Verify", "Agent 04", "Checks every user of the batch: registered? ID in the vault? Mail file present on the home server? Replica present on every other cluster member?", "No"],
], [1100, 1700, 5260, 1300]);
h2("A3 Everything you will create in Part B");
tbl(["Item", "Where", "Created in"], [
  ["Planning worksheet (your values)", "Paper or a file", "B1"],
  ["Directory roles for your admin ID", "names.nsf ACL on the registration server", "B4"],
  ["Registration Authority entry (if you use the Domino CA)", "CA-enabled certifier", "B5"],
  ["ID Vault (only if you do not have one yet)", "Vault server", "B6"],
  ["Security Settings document (assigns the vault, password rules)", "names.nsf > Settings", "B7"],
  ["Policy that assigns the vault: explicit (one per vault or region) or organizational", "names.nsf > Policies", "B8"],
  ["Working folders", "`C:\\BulkReg\\` on the admin workstation", "B9"],
  ["The BulkReg kit (code, templates, docs)", "`C:\\BulkReg-kit\\`", "B10"],
  ["Configuration: bulkreg.ini (incl. the mail cluster list), server_mapping.csv", "`C:\\BulkReg\\config\\`", "B11, B12"],
  ["Numbered mail folders and replica rights on every mail cluster member", "Domino data directory and Server documents", "B4"],
  ["Tool database bulkreg.nsf", "Local Notes data directory", "B13, B14"],
  ["Central log database bulkreg_log.nsf (required)", "A Domino server, e.g. the registration server", "B15"],
  ["Script libraries BulkRegCommon + BulkRegAgents, and 6 one-line agents", "Inside bulkreg.nsf", "B17, B18"],
  ["Categorized views in the log database", "bulkreg_log.nsf", "B20a"],
], [4300, 3200, 1860]);
h2("A4 Organizational or explicit policy: which one assigns the vault?");
p("The ID reaches the vault because the user's **effective policy** includes a Security Settings document that assigns the vault. HCL: *“If you create an organizational policy, it automatically applies when you register users. If you create an explicit policy, you assign it manually during user registration, in the Person document or by using the Policy Assignment tool.”*");
tbl(["", "Organizational policy", "Explicit policy"], [
  ["Name in the Policies view", "`*/Demo` (whole org), `*/Sales/Demo` (OU), `*` (everyone)", "`*/DirSync-Vault`"],
  ["Who gets it", "Every user whose Notes name is under that org / OU, **including existing users**", "Only users it is assigned to"],
  ["How BulkReg uses it", "Nothing to pass: Domino applies it at registration. Leave Policy empty (or `-` in the mapping) and set `OrgPolicyAssignsVault=1`.", "Passed per user (Policy column / DefaultPolicy) to NotesRegistration.PolicyName"],
  ["Use it when", "The whole org or OU should use the vault anyway", "Only the DirSync users should get these settings, or different groups need different vaults"],
], [2200, 3600, 3560]);
warn("Creating or changing an **organizational** policy affects **every user** under that org or OU, not only BulkReg users. Get the change approved by the platform and security owners.");
p("Both can apply at the same time: the effective policy combines the organizational policy for the user's OU with an explicit policy. BulkReg's pilot (C5) shows the result in the user's **Policy synopsis**.");
pb();

// ================================================================ PART B
h1("Part B – One-Time Setup (from nothing)");

// ---------- B1
h2("B1 Fill in the planning worksheet");
meta("Domino administrator", "Anywhere", "nothing");
p("Every later step uses these values. Collect them first and get the platform owner to confirm them.");
tbl(["#", "Item", "Example", "Your value"], [
  ["1", "Domino domain and organization", "Demo", ""],
  ["2", "Registration server (holds the master Domino Directory)", "DominoAdmin/Demo", ""],
  ["3", "Home servers users will be assigned to (canonical or abbreviated)", "CN=DominoADMail/O=Demo, DominoADMail2/Demo, DominoADMail3/Demo", ""],
  ["3a", "Mail cluster: ALL members (2–6 servers), or none", "DominoADMail/Demo, DominoADMail2/Demo (DC), DominoADMailDR1/Demo, DominoADMailDR2/Demo (DR)", ""],
  ["4", "How users are split across home servers (waves of N users, department, email domain, location…)", "2500 → DominoADMail/Demo, then 2500 → DominoADMail2/Demo", ""],
  ["5", "Certification method: Domino CA (recommended) or certifier ID file", "Domino CA", ""],
  ["6", "CA-enabled certifier name (CA) or certifier ID file path", "/Demo (users become Neha Arora/Demo) or /Sales/Demo", ""],
  ["7", "ID Vault name(s) and vault server(s)", "DemoVault on DominoVault/Demo (CN=DominoVault/O=Demo)", ""],
  ["8", "Security Settings document name(s)", "BulkReg-Vault-Security", ""],
  ["9", "Policy type (organizational or explicit, see A4) and exact name(s)", "Explicit: */DirSync-Vault, or organizational: */Demo, */Sales/Demo", ""],
  ["10", "Optional organizational unit (OU) per group of users", "EMEA", ""],
  ["11", "Optional groups to add new users to", "BR-EMEA", ""],
  ["11a", "Mail file naming and folders (D3a)", "last name; mail1, mail2 … max 1000 each → mail1\\smith.nsf", ""],
  ["11d", "Users per home server (or in the whole mail cluster) and number of mail folders to create (1 per 1000 users)", "Mail cluster: 2 × 2500 = 5000 users → 5 folders (mail1–mail5) on all 4 members", ""],
  ["11b", "Mail template available on every home server", "the template your mail users use (e.g. mail12.ntf)", ""],
  ["11c", "Optional: Manager of new mail files, quota (MB)", "LocalDomainAdmins, 2048", ""],
  ["12", "Admin ID that will run BulkReg", "Admin User/Demo", ""],
  ["13", "Windows admin workstation name", "ADMIN-PC01", ""],
  ["14", "Batch size", "1000", ""],
  ["15", "Change ticket number", "CHG000123", ""],
], [500, 4300, 2700, 1860]);
done("Every row has a confirmed value (rows 10 and 11 may be empty).");

// ---------- B2
h2("B2 Check the admin workstation");
meta("Windows administrator", "Admin workstation", "nothing");
ol(
  "Sign in to the Windows workstation from worksheet row 13.",
  "Open **HCL Domino Administrator** from the Start menu. *Result:* it opens and asks for your admin ID password (worksheet row 12).",
  "Click **Help > About HCL Domino Administrator**. *Result:* the version is 14.x.",
  "Open **HCL Domino Designer** from the Start menu. *Result:* it opens with the same ID. Close it again.",
  "Open **Windows PowerShell** and type `$PSVersionTable.PSVersion`, then press Enter. *Result:* version 5.1 or higher (only needed for the optional helper).",
  "Check that **Microsoft Excel** or **Notepad** is available for reviewing batch files.",
  "In Domino Administrator, click **File > Open Server**, type the registration server (worksheet row 2) and click **OK**. *Result:* the server opens without errors."
);
done("Domino Administrator 14.x and Designer open with the admin ID, and the registration server can be opened.");

// ---------- B3
h2("B3 Confirm that DirSync users exist");
meta("Domino administrator", "Domino Administrator", "nothing");
ol(
  "In Domino Administrator, select the registration server in the server pane.",
  "Click the **People & Groups** tab, then **Domino Directories > (your directory) > People**. *Result:* a list of Person documents.",
  "Select a user you know was synchronized from Active Directory.",
  "Click **File > Document Properties**, then the **Fields** tab (the second tab in the properties box).",
  "In the left column, scroll to **objectGUID** and click it. *Result:* a value is shown on the right. This marks a DirSync Person document.",
  "Scroll to **Certificate**. *Result:* the field is missing or empty. This means the user is not registered yet.",
  "Scroll to **MailSystem**, **MailFile** and **MailServer** and note their values. After registration they will point to the new Domino mail file."
);
done("At least one Person document has an objectGUID value and no Certificate.");

// ---------- B4
h2("B4 Give your admin ID directory access");
meta("Domino administrator with Manager access to names.nsf", "Domino Administrator", "the names.nsf ACL on the registration server");
p("HCL: UserCreator lets administrators create Person documents, and UserModifier lets them edit them. Editor access already allows editing.");
ol(
  "In Domino Administrator, select the **registration server** in the server pane.",
  "Click the **Files** tab and select **names.nsf** (the Domino Directory).",
  "In the Tools pane, choose **Database > Manage ACL**. *Result:* the Access Control List dialog opens.",
  "If your admin ID (or a group it belongs to) is not listed, click **Add**, enter the name and click **OK**.",
  "Select the entry and set **Access** to **Editor**.",
  "Make sure **Create documents** and **Delete documents** are ticked. Registration creates and updates documents.",
  "Click **Roles** and tick **[UserCreator]** and **[UserModifier]**. If you will create the policy yourself (B7, B8), also tick **[PolicyCreator]** and **[PolicyModifier]**.",
  "Click **OK** to save the ACL.",
  "Wait for the ACL change to reach the server you work on. It is immediate on the registration server itself."
);
h3("Create the numbered mail folders on every home server and every mail cluster member");
p("Create the numbered mail folders in advance on every home server **and, with a mail cluster, on every other cluster member** (the replicas use the same path), so registration never depends on Domino creating a folder. Create them **directly in the Domino data directory**, next to the existing `mail` folder, **not inside it**:");
code(`<Domino data directory>            e.g. D:\\Domino\\Data   or   /local/notesdata
  |-- names.nsf, log.nsf, certlog.nsf ...
  |-- mail\\       EXISTING mail files: left untouched; their names are checked for uniqueness
  |-- mail1\\      NEW mail files    1 - 1000
  |-- mail2\\      NEW mail files 1001 - 2000
  |-- mail3\\ ...  one folder per 1000 users, up to MailFolderMax

Person document after registration:  MailFile = mail1\\smith.nsf   (relative to the data directory)`);
p("You need **one folder per 1000 users** (`MailFilesPerFolder`) on each server. **Mail cluster:** add up the users of **all** home servers in the cluster, because every member holds every mail file (the primary on the home server, replicas on the others), and BulkReg fills the folders once for the whole cluster.");
tbl(["Users on that home server (or in the whole mail cluster)", "Folders to create", "Names"], [
  ["1 – 1,000", "1", "mail1"],
  ["5,000 (e.g. 2 home servers × 2,500 in one cluster)", "5 on **each** of the 4 cluster members", "mail1 … mail5"],
  ["10,000", "10", "mail1 … mail10"],
  ["N", "N ÷ 1000, rounded up", "mail1 … mailN"],
], [3200, 2600, 3560]);
note("If the folders already contain mail files, you may need more. After B11/B12, Preflight (C1) calculates the exact number per server, counting the existing files, and writes the commands to `C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mailfolders.txt`. Create any extra folders it lists.");
ol(
  "Find the Domino **data directory** of the home server. It is the `Directory=` setting in that server's notes.ini, for example `D:\\Domino\\Data` (Windows) or `/local/notesdata` (Linux). In Domino Administrator, select the server; the **Files** tab shows its contents.",
  "Sign in to the server's operating system as an administrator (Windows) or as root (Linux).",
  "Create the folders. Replace `<DataDir>` and the number (here 5):"
);
code(`Windows server (PowerShell as Administrator):
  1..5 | ForEach-Object { New-Item -ItemType Directory -Force "<DataDir>\\mail$_" }

Linux server (as root; notes = the OS account that runs Domino):
  for i in $(seq 1 5); do mkdir -p <DataDir>/mail$i; done
  chown notes:notes <DataDir>/mail*
  chmod 755 <DataDir>/mail*`);
olc(
  "On Windows, make sure the account that runs the Domino service has **Modify** rights on the new folders. They normally inherit from the data directory.",
  "In Domino Administrator, select the server and open the **Files** tab. Press **F9** to refresh. *Result:* mail1 … mail5 appear at the **same level as mail** in the folder list, not under it.",
  "Repeat for every home server **and every other mail cluster member** (worksheet row 3a). In a cluster, create the **same** folders on all members.",
  "Write the number of folders you created into the worksheet (row 11d). It goes into `MailFolderMax` in B11. Use the **lowest** number created on any server, or create the same number on all servers."
);
h3("Allow your admin ID to create mail files on every home server");
ol(
  "In Domino Administrator, click the **Configuration** tab and open **Server > All Server Documents**.",
  "Open the Server document of the first home server (worksheet row 3) and click **Edit Server**.",
  "Click the **Security** tab. In **Create databases & templates**, make sure your admin ID (or a group it belongs to) is listed, or that the field allows everyone your policy permits.",
  "Click **Save & Close**. Repeat for every home server.",
  "Check that the mail template from worksheet row 11b exists on every home server (**Files** tab of each server, filter on .ntf).",
  "On the **registration server**, check that the Certification Log `certlog.nsf` exists in the data directory (**Files** tab) and that your admin ID can write to it. If it is missing, create it with **File > Application > New** on that server from the **Certification Log** template (certlog.ntf, under **Show advanced templates**)."
);
h3("Mail cluster only: allow AdminP to create the mail file replicas");
p("Agent 03 asks the Administration Process (AdminP) to create a replica of each new mail file on every other cluster member (`NotesAdministrationProcess.CreateReplica`, the same request as **Database > Create Replica** in Domino Administrator). HCL: AdminP on the source server first checks that the **requester and the destination server have at least Reader access** to the database; for cluster mates it then creates the replica immediately (*Accelerated create replica*). If that is not possible, a *Create replica* request runs on the destination server, which needs the requester and the source server to have **Create Replica access** there.");
ol(
  "**Cluster:** click the **Configuration** tab > **Server > Clusters**. *Result:* one cluster lists all members from worksheet row 3a (for example the 2 DC and 2 DR servers). On a member's console, `show cluster` lists the same servers.",
  "**Create replica rights:** open each cluster member's Server document > **Edit Server** > **Security** tab. In **Create new replicas**, make sure your admin ID (or a group it is in, e.g. LocalDomainAdmins) **and** the other cluster members (e.g. LocalDomainServers) are listed. Also check **Create databases & templates**. Click **Save & Close**. Repeat for every member.",
  "**Access to the new mail files:** BulkReg adds your admin ID (or the names in `MailACLManager`) with **Manager** access to every new mail file right after registration, before the replicas are requested. Your admin ID therefore needs Manager access to new mail files at that moment: check the ACL of the mail template on the home servers (for example a `LocalDomainAdmins` entry with Manager access that contains your admin ID), or work with **Full Access Administration** enabled in Domino Administrator.",
  "**Connection documents:** HCL notes that AdminP assumes Connection documents exist to schedule replication between the source and destination servers. Check **Configuration > Server > Connections** for each home server ↔ each other member.",
  "**AdminP running:** on every member, `show tasks` lists the Administration Process. admin4.nsf replicates within the domain."
);
done("Your admin ID has Editor access with [UserCreator] and [UserModifier] (and the Policy roles if needed) in names.nsf. The numbered mail folders exist on every home server (and every cluster member). Your admin ID can create databases there, and the mail template exists on each of them. Mail cluster: all members are in one cluster, may create replicas for your admin ID and for each other, and MailACLManager is set.");

// ---------- B5
h2("B5 Set up certification");
p("Choose **one** option (worksheet row 5). Option 1 (Domino CA) is recommended: no certifier password is needed during a run.");
h3("Option 1 – Domino server-based CA: add your admin ID as a Registration Authority");
meta("CA administrator", "Domino Administrator + server console of the CA server", "the CA certifier (RA list)");
ol(
  "Open the console of the server that hosts the CA: in Domino Administrator, select that server, click the **Server** tab, then **Server Console**.",
  "Type `tell ca stat` and press Enter. *Result:* the CA process answers and lists its certifiers. If it is not running, type `load ca` first.",
  "Type `tell ca quit` and press Enter (required before modifying the certifier).",
  "Click the **Configuration** tab. In the Tools pane choose **Certification > Modify Certifier**.",
  "Select the server that hosts the CA, then select the certifier from worksheet row 6.",
  "In the Certifier dialog, add your admin ID (worksheet row 12) as a **Registration Authority (RA)** and click **OK**.",
  "On the console type `tell adminp process all`, then `load ca`, then `tell ca refresh`, then `tell ca stat`. *Result:* the certifier is listed, with your RA change in place."
);
note("HCL reference: “Modifying a server-based CA” (Appendix C). The CA process must be restarted after a server restart unless `ca` is in the ServerTasks setting.");
h3("Option 2 – Certifier ID file");
ol(
  "Obtain the certifier ID file and its password from the certifier owner, following your organisation's handover process.",
  "Copy the file into `C:\\BulkReg\\cert\\` after you create the folders in B9. Do not put it anywhere else.",
  "Write down its path for B11. **Never** write the password into a file. BulkReg asks for it in a masked dialog at run time."
);
done("Option 1: `tell ca stat` shows the certifier and your ID is an RA. Option 2: you have the certifier ID file and its owner has given you the password.");

// ---------- B6
h2("B6 Create the ID Vault (skip if you already have one)");
meta("Domino administrator with Create databases access on the vault server and Editor access to names.nsf", "Domino Administrator", "creates the vault database and vault document");
ol(
  "In Domino Administrator, click the **Configuration** tab.",
  "Choose **Tools > ID Vaults > Create**. *Result:* the ID vault wizard starts.",
  "Enter the **vault name** from worksheet row 7. HCL: it cannot be the same as an organization or OU name, and it cannot be changed later.",
  "Enter the **vault ID file location and password**. Back up this file and password according to your security policy.",
  "Select the **vault primary server** from worksheet row 7.",
  "Add at least one **vault administrator**.",
  "Finish the wizard. *Result:* the vault document appears under **Configuration > Security > ID Vaults**.",
  "If you need replicas on more vault servers, use **Tools > ID Vaults > Manage** as described in the HCL ID vault documentation."
);
done("The vault document exists, and the vault name and server are in the worksheet.");

// ---------- B7
h2("B7 Create the Security Settings document");
meta("Domino administrator with [PolicyCreator]", "Domino Administrator", "creates one settings document in names.nsf");
p("This document tells Domino to put each registered user's ID into the vault, and sets the password rules. Create one per vault if you have several.");
ol(
  "Click the **People & Groups** tab, then open the **Settings** view.",
  "Click **Add Settings** and choose **Security**. *Result:* a new Security Settings document opens.",
  "On the **Basics** tab, enter the **Name** from worksheet row 8 and a **Description**, for example: Assigns DirSync users to the ID vault.",
  "Click the **ID Vault** tab. In **Assigned vault**, select the vault from worksheet row 7.",
  "Leave **Enforce password change after password has been reset** set to **Yes** (default).",
  "Click the **Password Management** tab and set your organisation's password rules (for example Required change interval and Allowed grace period).",
  "To force a password change at first login: set **Use custom password policy for Notes clients** to **Yes**. Then, on the **Custom Password Policy** tab, enable **Change password on first Notes client use**. HCL: this works only if the policy is applied during user registration, which BulkReg does.",
  "Click **Save & Close**."
);
done("The Security Settings document is listed in the Settings view, and its ID Vault tab shows your vault.");

// ---------- B8
h2("B8 Create the policy that assigns the vault");
p("Choose **Option A (explicit)** or **Option B (organizational)** using A4. Write your choice in worksheet row 9.");
h3("Option A – Explicit policy (only the users BulkReg registers)");
meta("Domino administrator with [PolicyCreator]", "Domino Administrator", "creates one policy document in names.nsf");
ol(
  "Click the **People & Groups** tab, then open the **Policies** view.",
  "Click **Add Policy**. *Result:* a new Policy document opens.",
  "In **Policy name**, type the name from worksheet row 9 **without** `*/`, for example `DirSync-Vault`.",
  "Set **Policy type** to **Explicit**.",
  "Enter a **Description**, for example: BulkReg – DirSync users, ID vault DirSyncVault.",
  "In the **Security** settings field, select the Security Settings document from B7. Press **F9** if it is not listed.",
  "Leave the other settings types empty unless your organisation requires them.",
  "Click **Save & Close**.",
  "Look at the Policies view. HCL: Domino stores an explicit policy as `*/policyname`, so the policy is listed as `*/DirSync-Vault`. **Copy this exact name into the worksheet.** You will use it in bulkreg.ini and server_mapping.csv.",
  "Repeat B7 and B8 for every additional vault or region."
);
warn("BulkReg passes the policy name to `NotesRegistration.PolicyName`. Use the name exactly as the Policies view shows it (with `*/`). The pilot (C5) confirms it: Person document > **Policy synopsis** must show this policy.");
h3("Option B – Organizational policy (everyone under an org or OU)");
ol(
  "Click the **People & Groups** tab, then open the **Policies** view.",
  "Check whether a policy for your org or OU already exists (for example `*/Demo` or `*/Sales/Demo`). If it does, **edit** it in step 6 instead of creating a new one.",
  "Click **Add Policy**.",
  "In **Policy name**, type the organization or OU **without** `*/`, for example `Demo` or `Sales/Demo`.",
  "Set **Policy type** to **Organizational**.",
  "In the **Security** settings field, select the Security Settings document from B7. Press **F9** if it is not listed.",
  "Click **Save & Close**. *Result:* the Policies view lists `*/Demo` (or `*/Sales/Demo`).",
  "In bulkreg.ini set `OrgPolicyAssignsVault=1` and leave `DefaultPolicy=` empty (B11). In server_mapping.csv, put `-` in the Policy column of the rules that rely on it (B12).",
  "If you use an OU policy (`*/Sales/Demo`), make sure the mapping gives those users OrgUnit `Sales`, so they are registered as `John Smith/Sales/Demo`."
);
done("Option A: each explicit policy is listed, linked to a Security Settings document with the right vault, and its exact name is in the worksheet. Option B: the organizational policy is listed, linked to that Security Settings document, approved, and OrgPolicyAssignsVault=1.");
pb();

// ---------- B9
h2("B9 Create the working folders");
meta("Windows administrator", "Admin workstation", "creates C:\\BulkReg and six subfolders");
tbl(["Folder", "Holds", "Access"], [
  ["`C:\\BulkReg\\config`", "bulkreg.ini, server_mapping.csv", "Admins"],
  ["`C:\\BulkReg\\batches`", "Batch files, summaries, results (names and email addresses)", "**Restricted**"],
  ["`C:\\BulkReg\\ids`", "ID files created during registration", "**Restricted**"],
  ["`C:\\BulkReg\\secure`", "Initial-password files", "**Restricted**"],
  ["`C:\\BulkReg\\audit`", "One sub-folder per run, e.g. `2026-10-05_101500_03-RegisterBatch_LIVE-PRODUCTION`, with audit CSV, debug log and RUN_INFO.txt", "Admins and auditors (read)"],
  ["`C:\\BulkReg\\cert`", "Certifier ID (only with B5 Option 2)", "**Restricted**"],
], [2400, 4500, 2460]);
h3("Steps (PowerShell)");
ol(
  "Click **Start**, type `PowerShell`, right-click **Windows PowerShell** and choose **Run as administrator**.",
  "Copy the block below, paste it into the window and press **Enter**. *Result:* six `Directory` lines and `Successfully processed 1 files` four times."
);
code(`$b = 'C:\\BulkReg'
'config','batches','ids','secure','audit','cert' | ForEach-Object { New-Item -ItemType Directory -Force "$b\\$_" }
'batches','ids','secure','cert' | ForEach-Object {
  icacls "$b\\$_" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "\${env:USERDOMAIN}\\\${env:USERNAME}:(OI)(CI)F"
}`);
olc(
  "To check, type `icacls C:\\BulkReg\\ids` and press Enter. *Result:* only BUILTIN\\Administrators, NT AUTHORITY\\SYSTEM and your account are listed."
);
note("Explorer alternative: create the folders, then for batches, ids, secure and cert open **Properties > Security > Advanced > Disable inheritance > Remove all inherited permissions**, and add only Administrators, SYSTEM and your account. Helper alternative: `bulkreg.cmd Init` after B10.");
done("The six folders exist, and batches, ids, secure and cert list only Administrators, SYSTEM and your account.");

// ---------- B10
h2("B10 Put the BulkReg kit on the workstation");
meta("Domino administrator", "Admin workstation", "creates C:\\BulkReg-kit");
p("The **kit** (code, templates, documentation) lives in `C:\\BulkReg-kit`. It is kept separate from the working folder `C:\\BulkReg` so that data never ends up in Git.");
h3("Option 1 – from the GitHub repository (Git for Windows installed)");
ol(
  "Open PowerShell (normal, not elevated).",
  "Type `git clone https://github.com/<org-or-user>/<repo>.git C:\\BulkReg-kit` and press Enter. *Result:* `Cloning into 'C:\\BulkReg-kit'... done.`"
);
h3("Option 2 – from a ZIP or a share");
ol(
  "Copy the kit folder to `C:\\BulkReg-kit`.",
  "Check that it contains the folders `config`, `lotusscript`, `scripts`, `tools` and `docs`."
);
p("Then copy the two templates into the working folder:");
code(`Copy-Item C:\\BulkReg-kit\\config\\bulkreg.ini        C:\\BulkReg\\config\\
Copy-Item C:\\BulkReg-kit\\config\\server_mapping.csv C:\\BulkReg\\config\\`);
done("`C:\\BulkReg-kit\\lotusscript` contains 8 .lss files (2 libraries, 6 agents), and `C:\\BulkReg\\config` contains bulkreg.ini and server_mapping.csv.");

// ---------- B11
h2("B11 Fill in bulkreg.ini");
meta("Domino administrator", "Notepad", "C:\\BulkReg\\config\\bulkreg.ini");
ol(
  "Open **Notepad** and choose **File > Open**. Set the file type to **All files**, open `C:\\BulkReg\\config\\bulkreg.ini`.",
  "Change each line in the table below. Replace the whole placeholder, including `<` and `>`.",
  "Do not change any other line yet.",
  "Choose **File > Save**. Keep the encoding as **UTF-8**."
);
tbl(["Key", "Enter", "From"], [
  ["DirectoryServer", "The registration server: `DominoAdmin/Demo` or `CN=DominoAdmin/O=Demo`", "Worksheet 2"],
  ["RegistrationServer", "The same server", "Worksheet 2"],
  ["RegistrationLog", "Leave `certlog.nsf`. Registration records go to the Certification Log on the registration server.", "–"],
  ["UseCA", "`1` for the Domino CA, `0` for a certifier ID file", "Worksheet 5"],
  ["CertifierName", "With UseCA=1: the CA certifier, e.g. `/Demo` (users become **Neha Arora/Demo**) or `/Sales/Demo`. `Demo` and `O=Demo` are accepted and converted to `/Demo`.", "Worksheet 6"],
  ["DefaultOrgUnit", "**Empty** for Neha Arora/Demo. Only for an extra OU level: ONE plain name, e.g. `Sales` → Neha Arora/Sales/Demo. Never `O=Demo`, `OU=Sales` or `Sales/Demo`.", "Worksheet 10"],
  ["CertifierIDFile", "With UseCA=0: `C:\\BulkReg\\cert\\<file>.id`. With UseCA=1: leave the placeholder or clear it.", "B5 Option 2"],
  ["HomeServers / HomeServerMaxUsers / HomeServerAssignment", "The mail servers that receive the users, e.g. `DominoADMail/Demo,DominoADMail2/Demo`; max users per server (`2500`); `BALANCED` (fewest users first, default) or `FILL`. A mapping rule with `AUTO` as home server uses this pool.", "Worksheet 3"],
  ["ServerOS / ServerDataDir / ServerFileOwner", "`LINUX` (path separator `/`), `/local/notesdata`, and the Linux user:group of Domino for the chown line in the Preflight report", "–"],
  ["ShortNameFields", "Person item(s) with the AD samaccountname, first non-empty wins (default `ShortName`). The FullName/cn is never used.", "–"],
  ["ConstructInternetAddress / InternetDomain", "`1` and e.g. `demo.com`: users without an Internet address in AD get `<shortname>@demo.com`", "–"],
  ["PreflightScope / PreflightBatchNo", "`BATCH` (default) checks one batch in detail, `ALL` checks everybody; `1` = the next batch to be built", "–"],
  ["DefaultHomeServer", "Home server when `HomeServers` is empty (everybody on ONE server): `DominoADMail/Demo` or `CN=DominoADMail/O=Demo`", "Worksheet 3"],
  ["DefaultPolicy", "Explicit policy **exactly** as listed, e.g. `*/DirSync-Vault`. **Empty** with an organizational policy.", "Worksheet 9"],
  ["OrgPolicyAssignsVault", "`1` if an organizational policy (`*/Demo`, `*/Sales/Demo`) assigns the vault, otherwise `0`", "B8"],
  ["VaultServer", "The vault server, e.g. `DominoVault/Demo` (as shown in the vault document)", "Worksheet 7"],
  ["BatchSize", "`1000` (one numbered mail folder per batch)", "Worksheet 14"],
  ["MailClusterServers", "**All** members of the mail cluster, comma separated, e.g. `DominoADMail/Demo,DominoADMail2/Demo,DominoADMailDR1/Demo,DominoADMailDR2/Demo`. Empty = no cluster, no replicas.", "Worksheet 3a"],
  ["CreateClusterReplicas", "`1`: 03 requests the replicas through AdminP (`0` = you create them yourself)", "–"],
  ["MailFileNaming", "`LASTNAME` (smith.nsf), `FIRSTINITIAL_LASTNAME` (jsmith.nsf) or `SHORTNAME`", "Worksheet 11a"],
  ["MailFileCollision", "`SUFFIX` (smith2.nsf …) or `ERROR` (row excluded)", "Worksheet 11a"],
  ["MailFolderMode", "`NUMBERED` (new mail files in mail1, mail2 … under the data directory)", "Worksheet 11a"],
  ["MailFolderPrefix", "`mail`: the folder name **without** the number and **without** a path. BulkReg adds 1, 2, 3 … → `mail1`, `mail2`. Never `mail1` or `mail\\mail`.", "B4"],
  ["MailFilesPerFolder", "`1000`", "–"],
  ["MailExistingFolders", "`mail`: your existing mail folder(s). Their file names are checked so no duplicate is created; BulkReg never writes there.", "–"],
  ["MailFileDir", "Only used with `MailFolderMode=SINGLE`. Leave `mail`.", "–"],
  ["MailOwnerAccess", "Leave `EDITOR`: the user gets **Editor + Delete documents** in his/her own mail file (Domino's default would be Manager). DESIGNER or MANAGER only if your policy needs it.", "–"],
  ["MailFileTitle", "Leave `{CN}`: each new mail file gets the user's name as its database title (e.g. *Neha Arora*)", "–"],
  ["MailFolderMax", "The number of folders you created in B4, e.g. `5` for mail1–mail5 (mail cluster: users of all home servers together)", "Worksheet 11d"],
  ["MailTemplate", "Mail template file, e.g. `mail12.ntf` (empty = registration default)", "Worksheet 11b"],
  ["MailACLManager / MailQuotaSizeLimit", "Who gets **Manager** access to each new mail file: leave **empty** = your admin ID (the operator); or names separated by commas, e.g. `Admin User/Demo,LocalDomainAdmins`. Quota in MB (0 = none).", "Worksheet 11c"],
  ["LogServer / LogDb", "**Required.** The server and file of the central log database from B15, e.g. `DominoAdmin/Demo` and `bulkreg_log.nsf`", "B15"],
  ["DryRun", "Leave `1`", "–"],
], [2300, 5100, 1960]);
done("bulkreg.ini contains no `<` or `>` characters except in comment lines (starting with `#`), and DryRun=1.");

// ---------- B12
h2("B12 Fill in server_mapping.csv (which user goes to which server)");
meta("Domino administrator", "Notepad", "C:\\BulkReg\\config\\server_mapping.csv");
h3("B12.1 What the mapping file does");
p("BulkReg has to decide, for **every** DirSync user, which **home server** gets that user's mail file. server_mapping.csv holds that decision as a short list of **rules**. For each user BulkReg reads the rules **from top to bottom** and uses the **first rule that matches**. A user who matches no rule gets the `Default…` values from bulkreg.ini.");
tbl(["A matching rule decides", "Example value", "Effect"], [
  ["Home server", "DominoADMail2/Demo", "The server where the user's mail file is created (mail1\\smith.nsf on that server)"],
  ["OrgUnit", "EMEA", "The user's Notes name becomes John Smith/EMEA/Demo"],
  ["Policy", "*/DirSync-Vault-EMEA", "Explicit policy given at registration (assigns the ID Vault)"],
  ["Groups", "BR-EMEA", "The user is added to these groups"],
  ["VaultServer", "DominoVaultEMEA/Demo", "Where BulkReg checks that the ID arrived in the vault"],
  ["ClusterReplicas (rarely needed)", "empty", "Empty = automatic: a replica on every **other** member of the mail cluster (MailClusterServers in bulkreg.ini)"],
], [2300, 2500, 4560]);
note("**Cluster replicas are not set in the mapping.** You list the mail cluster **once** in bulkreg.ini (`MailClusterServers`, B11). Every user whose home server is in that list automatically gets a replica of the mail file on all the other members. The mapping only chooses the **home server**.");
note("**Only one home server at a time?** Then you need only one line, the catch-all: `*;*;DominoADMail/Demo;;;;;`. Everything else comes from bulkreg.ini. For two home servers filled one after the other, see **B12.7 Example 1**.");
h3("B12.2 The format of a rule");
p("One rule is one line with **8 columns separated by semicolons** (`;`). Keep all 7 semicolons, even when a column is empty. Rules with 7 columns (from release 3.1) still work; column 8 is then automatic. Lines starting with `#` are comments. Line 1, the header, must stay unchanged.");
code(`InternetAddress;*@emea.demo.com;DominoADMail2/Demo;EMEA;*/DirSync-Vault-EMEA;BR-EMEA;DominoVaultEMEA/Demo;

column 1  MatchField       InternetAddress
column 2  MatchPattern     *@emea.demo.com
column 3  HomeServer       DominoADMail2/Demo
column 4  OrgUnit          EMEA
column 5  Policy           */DirSync-Vault-EMEA
column 6  Groups           BR-EMEA
column 7  VaultServer      DominoVaultEMEA/Demo
column 8  ClusterReplicas  (empty = automatic: the other mail cluster members)`);
tbl(["#", "Column", "Required", "What to enter", "Empty means", "`-` means"], [
  ["1", "MatchField", "Yes", "Name of a Person document field to test (B12.4), or `*` for every user", "–", "–"],
  ["2", "MatchPattern", "Yes", "The value to compare with (B12.3)", "same as `*`", "–"],
  ["3", "HomeServer", "No", "Server name, abbreviated `DominoADMail2/Demo` or canonical `CN=DominoADMail2/O=Demo`", "DefaultHomeServer", "not allowed"],
  ["4", "OrgUnit", "No", "One OU name, e.g. `EMEA`", "DefaultOrgUnit", "no OU"],
  ["5", "Policy", "No", "Explicit policy exactly as listed in the Policies view, e.g. `*/DirSync-Vault-EMEA`", "DefaultPolicy", "no explicit policy (an organizational policy assigns the vault)"],
  ["6", "Groups", "No", "Group names separated by commas, e.g. `BR-EMEA,All-EMEA`", "DefaultGroups", "no groups"],
  ["7", "VaultServer", "No", "Vault server name, e.g. `DominoVaultEMEA/Demo`", "VaultServer from bulkreg.ini", "not allowed"],
  ["8", "ClusterReplicas", "No", "Only for exceptions: servers that get a replica, comma separated, e.g. `DominoADMail2/Demo`", "**automatic**: all other members of MailClusterServers", "no replicas"],
], [400, 1500, 900, 3400, 1500, 1660]);
h3("B12.3 How a rule matches");
ol(
  "BulkReg reads the field named in **MatchField** from the user's Person document. If the field has several values, the first one is used.",
  "Both the field value and the pattern are compared **without regard to upper/lower case**.",
  "The pattern may contain `*` (any text, also none), `?` (exactly one character), `#` (one digit) and `[a-l]` (one character from a range). Without these the value must match exactly.",
  "If it matches, this rule is used and the following rules are ignored for this user."
);
tbl(["MatchPattern", "Matches", "Does not match"], [
  ["`*@emea.demo.com`", "anna@emea.demo.com, JOHN@EMEA.DEMO.COM", "anna@demo.com, anna@emea.demo.com.au"],
  ["`Sales*`", "Sales, Sales EMEA, sales-uk", "Presales"],
  ["`*london*`", "London, Office London 2, london", "Londn"],
  ["`Finance`", "Finance, finance", "Finance EMEA"],
  ["`HR-??`", "HR-UK, HR-DE", "HR-USA, HR"],
  ["`[a-l]*`", "Adams, Brown, Lee (first letter a to l)", "Miller, Smith, Zhang"],
  ["`*`", "every value, also an empty field", "–"],
], [2200, 3700, 3460]);
note("To match `#`, `?`, `*` or `[` literally, put the character in brackets, for example `[#]`.");
h3("B12.4 Which fields can you use, and how to see their values");
ol(
  "In Domino Administrator, open **People & Groups > People** and select a DirSync user.",
  "Choose **File > Document Properties** and click the **Fields** tab (second tab).",
  "Click a field name on the left to see its value on the right. The name shown on the left (for example `InternetAddress`) is what you write in MatchField.",
  "Repeat for a few users of each group you want to split, so you know the real values."
);
tbl(["Typical field", "Typical use"], [
  ["InternetAddress", "Split by e-mail domain (*@emea.demo.com)"],
  ["Department", "Split by department (Sales*, Finance)"],
  ["CompanyName", "Split by company or subsidiary"],
  ["Location / OfficeCity / OfficeCountry", "Split by site or country"],
  ["LastName", "Split alphabetically ([a-l]*), roughly in halves"],
  ["ShortName or InternetAddress (exact value)", "Exceptions for single users"],
], [3800, 5560]);
note("Which fields contain data depends on your DirSync field mapping (Directory Sync configuration, Synchronization tab). Always check the Fields tab. If a field is empty for many users, a rule on it will not match them.");
h3("B12.5 Order, defaults and the catch-all");
ul(
  "**Order matters:** put exceptions and the most specific rules at the top, general rules below.",
  "**Catch-all last:** end with `*;*;<server>;;;;;` so that every user is mapped. Without it, unmatched users get the Default… values. Preflight warns about this.",
  "**Empty column:** use the default from bulkreg.ini (for ClusterReplicas: automatic). **Hyphen `-`:** explicitly none (OrgUnit, Policy, Groups, ClusterReplicas).",
  "**No placeholders:** a rule that still contains `<…>` stops every agent with a message naming the line."
);
h3("B12.6 Write the file, step by step");
ol(
  "Open **Notepad** and choose **File > Open**. Set the file type to **All files** and open `C:\\BulkReg\\config\\server_mapping.csv`.",
  "Read the comment block at the top. It summarises this procedure and contains your two-server, four-member cluster example.",
  "Go to the line `# ACTIVE RULES - edit below this line`.",
  "If users are split by a field (department, domain …): for each group of users from worksheet row 4, add one rule **above** the last line. Copy an example line, remove the leading `# ` and replace the example values with yours.",
  "Change the last line, the catch-all, to your (first) home server, for example `*;*;DominoADMail/Demo;;;;;`.",
  "Check every rule: 8 columns, 7 semicolons, no `<` or `>`, server and policy names exactly as in Domino.",
  "Choose **File > Save**, keeping the encoding **UTF-8**."
);
h3("B12.7 Worked examples");
p("**Example 1 (your set-up): one mail cluster of 4 servers, 2500 users on each of the 2 DC home servers.** Two servers in the data centre (DC) are home servers; two servers in the disaster-recovery site (DR) only hold replicas. Every mail file ends up on all 4 servers.");
code(`MAIL CLUSTER (4 members)
  DC  DominoADMail/Demo      home server of users    1 - 2500
  DC  DominoADMail2/Demo     home server of users 2501 - 5000
  DR  DominoADMailDR1/Demo   replicas only
  DR  DominoADMailDR2/Demo   replicas only
  At the end every server holds all 5000 mail files.

bulkreg.ini   (MailClusterServers is ONE line in the file)
  MailClusterServers=DominoADMail/Demo,DominoADMail2/Demo,
                     DominoADMailDR1/Demo,DominoADMailDR2/Demo
  CreateClusterReplicas=1
  MailACLManager=           (empty = your admin ID; or e.g. Admin User/Demo,LocalDomainAdmins)
  BatchSize=1000
  MailFilesPerFolder=1000
  MailFolderMax=5     (5000 users -> mail1..mail5 on ALL 4 servers)`);
p("The 2500/2500 split is done in **two waves**: one line in server_mapping.csv decides the home server, and you change it once, after the first 2500 users.");
ol(
  "**Wave 1.** The only active rule in server_mapping.csv is the catch-all for the first home server: `*;*;DominoADMail/Demo;;;;;`",
  "Run 01 - Preflight Check. The `_mapping.txt` file shows `DominoADMail/Demo -> replicas: DominoADMail2/Demo,DominoADMailDR1/Demo,DominoADMailDR2/Demo`, and `_mailfolders.txt` lists mail1 … mail5 on all 4 servers.",
  "Run the normal cycle (C2–C8) three times: 02 Build Batch → review → 03 dry run → 03 live → 04 Verify. The batches have 1000, 1000 and 500 users. After the third batch, 2500 users are registered on DominoADMail/Demo.",
  "**Wave 2.** Change the active rule to the second home server and save: `*;*;DominoADMail2/Demo;;;;;`",
  "Run 01 again, then the cycle three more times (1000 + 1000 + 500). Users registered in wave 1 are not picked again: they now have a Notes certificate.",
  "Run 04 for each batch until all users show REGISTERED, IN_VAULT, MAILFILE_OK and **REPLICAS_OK 3/3**."
);
tbl(["Batch", "Wave / home server", "Users", "Mail folders filled (on all 4 servers)", "Replicas requested on"], [
  ["1", "1 / DominoADMail", "1000", "mail1 (1000)", "DominoADMail2, DR1, DR2"],
  ["2", "1 / DominoADMail", "1000", "mail2 (1000)", "DominoADMail2, DR1, DR2"],
  ["3", "1 / DominoADMail", "500", "mail3 (500)", "DominoADMail2, DR1, DR2"],
  ["4", "2 / DominoADMail2", "1000", "mail3 (500 → 1000), mail4 (500)", "DominoADMail, DR1, DR2"],
  ["5", "2 / DominoADMail2", "1000", "mail4 (500 → 1000), mail5 (500)", "DominoADMail, DR1, DR2"],
  ["6", "2 / DominoADMail2", "500", "mail5 (500 → 1000)", "DominoADMail, DR1, DR2"],
], [800, 2000, 900, 3100, 2560]);
p("Because the cluster is treated as **one** mail namespace, `smith.nsf` can exist only once in the whole cluster: a second Smith on DominoADMail2 becomes `smith2.nsf`, so his replica never collides with the first Smith's file on DominoADMail. Each server holds 5000 mail files at the end: 2500 primaries (on the two DC servers) and the replicas.");
p("**Alternative without waves:** split by a field, for example by last name. The halves are not exactly 2500 each; check the counts in Preflight's `_mapping.txt` first.");
code(`LastName;[a-l]*;DominoADMail/Demo;;;;;
*;*;DominoADMail2/Demo;;;;;`);
p("**Example 2: three servers by e-mail domain.** EMEA and APAC users get their own server, OU, explicit vault policy, group and vault; everyone else goes to DominoADMail/Demo with the defaults.");
code(`InternetAddress;*@emea.demo.com;DominoADMail2/Demo;EMEA;*/DirSync-Vault-EMEA;BR-EMEA;DominoVaultEMEA/Demo;
InternetAddress;*@apac.demo.com;DominoADMail3/Demo;APAC;*/DirSync-Vault-APAC;BR-APAC;DominoVaultAPAC/Demo;
*;*;DominoADMail/Demo;;;;;`);
p("**Example 3: by department, with an organizational policy.** Sales users get the OU Sales (John Smith/Sales/Demo). The organizational policy `*/Sales/Demo` assigns their vault, so Policy is `-`.");
code(`Department;Sales*;DominoADMail/Demo;Sales;-;BR-Sales;;
Department;Finance;DominoADMail2/Demo;Finance;*/DirSync-Vault;BR-Finance;;
*;*;DominoADMail/Demo;;;;;`);
p("**Example 4: exceptions.** The CEO's mail file is replicated only within DC; IT test users get no replicas at all. Exceptions must come before the general rule that would otherwise catch the user.");
code(`InternetAddress;ceo@demo.com;DominoADMail/Demo;-;*/DirSync-Vault;VIP;;DominoADMail2/Demo
Department;IT-Test;DominoADMail/Demo;;;;;-
*;*;DominoADMail/Demo;;;;;`);
tbl(["User", "Example 2 result", "Why"], [
  ["anna@emea.demo.com", "DominoADMail2/Demo, Anna …/EMEA/Demo, */DirSync-Vault-EMEA, BR-EMEA", "Rule 1 matches first"],
  ["li@apac.demo.com", "DominoADMail3/Demo, …/APAC/Demo, */DirSync-Vault-APAC", "Rule 2"],
  ["tom@demo.com", "DominoADMail/Demo with the bulkreg.ini defaults", "Only the catch-all matches"],
], [2200, 4800, 2360]);
h3("B12.8 Test the mapping before any batch");
ol(
  "Run **01 - Preflight Check** (C1).",
  "Open `C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mapping.txt`. For every rule it shows **how many users matched** and the values the rule gives. A rule with **0 users** usually means a wrong field name or pattern. At the end, **Result per home server** shows the users per home server and the servers that will receive their replicas.",
  "For individual users, open the Preflight audit CSV. The **MapRule** column shows which rule each user matched, and HomeServer / OrgUnit / Policy / ClusterReplicas show the result.",
  "Correct server_mapping.csv (or MailClusterServers) and run Preflight again until every group lands where intended."
);
h3("B12.9 Common mistakes");
tbl(["Symptom", "Cause", "Fix"], [
  ["Agents stop: 'still contains a <placeholder>'", "A `<…>` value was not replaced", "Replace it with your real value, or delete the rule"],
  ["A rule matches 0 users", "Wrong field name, pattern without `*`, or field empty in DirSync", "Check the Fields tab (B12.4); use `*` where needed"],
  ["Everybody lands on the catch-all", "The catch-all is at the top", "Move `*;*;…` to the last line"],
  ["Wrong OU / policy for some users", "An earlier, more general rule catches them", "Move the specific rule above it"],
  ["'-> replicas: none' although you have a cluster", "The home server is not in MailClusterServers (typo, or a different name form), or column 8 is `-`", "List every member in MailClusterServers (B11); leave column 8 empty"],
  ["Wave 2 users still go to the first server", "The catch-all line was not changed, or the file was not saved", "Change and save the line, then rebuild the batch (C2)"],
  ["'Mapping line ignored (needs >= 3 columns)' in the log", "Missing semicolons", "Use 8 columns / 7 semicolons"],
  ["Strange characters in names", "File saved in another encoding", "Save as UTF-8 in Notepad"],
], [3000, 3200, 3160]);
done("Every rule has real values, the catch-all is last, and the Preflight mapping test shows each group of users on the intended home server, with the intended replica servers.");

// ---------- B13
h2("B13 Create the tool database bulkreg.nsf");
meta("Domino administrator", "Domino Administrator (or Notes client)", "creates a local database");
p("bulkreg.nsf only **holds the code** (library and agents). It is created **locally** on the admin workstation on purpose: the agents use the Notes client user interface (dialogs, prompts), run with **your** admin ID and rights, and refuse to run on a server. They never store documents in bulkreg.nsf; everything they produce goes to `C:\\BulkReg\\…` and to the central log database on the server (B15).");
tbl(["Database", "Where", "Why there", "Contains"], [
  ["bulkreg.nsf (tool)", "**Local**, admin workstation", "Agents need the client UI and your ID; NotesRegistration runs from the client", "Code only (2 libraries + 6 one-line agents)"],
  ["bulkreg_log.nsf (log)", "**Server**, e.g. the registration server", "Shared, permanent, backed-up record for all administrators and auditors", "One entry per run, action and user"],
], [2200, 2300, 2900, 1960]);
ol(
  "Choose **File > Application > New**. *Result:* the New Application dialog opens.",
  "In **Server**, keep **Local**.",
  "In **Title**, type `BulkReg Tool`.",
  "In **File Name**, type `bulkreg.nsf`.",
  "In the template list, select **-Blank-**.",
  "Click **OK**. *Result:* an empty database opens. Close it."
);
done("bulkreg.nsf exists in your local Notes data directory.");
note("**Several administrators:** each one creates their own local bulkreg.nsf from the kit (B13–B19), or copies a finished one and re-signs it with their own ID (B19). The code comes from Git, so a lost local copy is rebuilt in minutes.");

// ---------- B14
h2("B14 Restrict access to bulkreg.nsf");
p("A **local** database is not protected by its ACL alone: whoever can copy the file can open it locally, where the ACL is not a security boundary. Only **local encryption** ties the file to your ID. Protect it in three layers:");
ol(
  "**ACL:** select the bulkreg.nsf icon (or open the database) and choose **File > Application > Access Control**. Set **-Default-** to **No Access** and **Anonymous** to **No Access** (add it if missing). Make sure your admin ID has **Manager** access.",
  "In the same dialog click **Advanced** and tick **Enforce a consistent Access Control List across all replicas**. Click **OK**.",
  "**Local encryption:** choose **File > Application > Properties**, click **Encryption Settings**, select **Locally encrypt this database using** your ID and **Strong encryption**, and click **OK**. Close the database and open it again. *Result:* only your ID can open the file, even if it is copied.",
  "**Windows:** the local Notes data directory is in your Windows user profile. Do not share it, and do not copy bulkreg.nsf to a shared drive."
);
done("bulkreg.nsf has -Default- and Anonymous = No Access, consistent ACL enforced, and is locally encrypted for your ID.");

// ---------- B15
h2("B15 Create the central BulkReg log database (required)");
meta("Domino administrator", "Domino Administrator", "creates one database on a server");
p("This Notes database is the **shared, permanent record** of everything BulkReg does. Every run of every agent writes structured documents to it: one **Run** document (agent, operator, batch, DryRun, start, end, status, summary), one **Entry** per log line, and one **Audit** document per user and action (result, home server, mail file, vault, replicas, batch). Agent 00 creates **categorized views** over them (B20a, D4a). The CSV and .log files on the admin PC are local working copies; this database is what other administrators and auditors use. If it cannot be opened, every agent stops **before** reading or changing anything.");
ol(
  "Choose **File > Application > New**.",
  "In **Server**, select the server that will hold the log, for example the registration server `DominoAdmin/Demo`. Do not keep Local.",
  "In **Title**, type `BulkReg Log`. In **File Name**, type `bulkreg_log.nsf`.",
  "Select the template **-Blank-**. Click **OK**. *Result:* the empty log database opens. (A log database created earlier from the Agent Log template alog4.ntf also works: its old entries stay in its own views, new documents appear in the BulkReg views.)",
  "Choose **File > Application > Access Control** and set the entries below. Click **OK**."
);
tbl(["ACL entry", "Access", "Why"], [
  ["-Default-, Anonymous", "No Access", "Nobody else reads the audit trail"],
  ["BulkReg operators (your admin ID or their group)", "**Author**, **Create documents** ticked, **Delete documents** NOT ticked", "Agents can add documents but cannot change or delete earlier ones (each Run document lists its operator in an Authors field so the run can be closed)"],
  ["Auditors / reviewers", "Reader", "Read the record"],
  ["LocalDomainServers", "Manager", "Replication and server tasks"],
  ["Database owner (a group the operators are NOT in, e.g. the platform owner)", "Manager", "Separation of duties: the people who run BulkReg cannot alter its log. The owner creates the views (B20a)."],
], [3400, 3100, 2860]);
note("When you create the database you become its Manager. After setting the owner entry, lower your own entry to Author. If your ID is still Manager or Editor (for example through LocalDomainAdmins), Preflight shows a **warning**, not an error: decide with your auditor whether that is acceptable.");
olc(
  "In bulkreg.ini set `LogServer=DominoAdmin/Demo` (your server) and `LogDb=bulkreg_log.nsf`. Save.",
  "Include the database in the server backup. Optional: replicate it to a second server (for example in DR) for resilience.",
  "Size: every run writes one entry per action and per user (at LogLevel=INFO, roughly 3–8 entries per registered user, more with DEBUG). For 5000 users expect tens of thousands of entries; keep LogLevel=INFO for normal batches and archive the database when the project is closed."
);
done("bulkreg_log.nsf exists on the server, its ACL is set, and bulkreg.ini names it. The views are created in B20a; the smoke test (B21) creates the first documents.");

// ---------- B16 / B17
h2("B16 Open bulkreg.nsf in Domino Designer");
ol(
  "Start **HCL Domino Designer**.",
  "Choose **File > Open > HCL Notes Application**, select **Local**, choose `bulkreg.nsf` and click **Open**. *Result:* BulkReg Tool appears in the **Applications Navigator** on the left.",
  "Expand **BulkReg Tool**, then expand **Code**."
);
h2("B17 Create the two script libraries");
meta("Domino administrator", "Domino Designer", "adds 2 script libraries to bulkreg.nsf");
p("All BulkReg code lives in **two script libraries**. The six agents (B18) contain only one line that calls the library, so they never change between releases.");
tbl(["Library (type the name exactly)", "Source file in C:\\BulkReg-kit\\lotusscript", "Contains"], [
  ["`BulkRegCommon`", "BulkRegCommon.lss", "Shared functions: configuration, mapping, mail files, cluster replicas, logging, audit, batch files"],
  ["`BulkRegAgents`", "BulkRegAgents.lss", "The code of the six agents: BR_RunSetupLog, BR_RunPreflight, BR_RunBuildBatch, BR_RunRegisterBatch, BR_RunVerify, BR_RunExport. It uses BulkRegCommon."],
], [2400, 2600, 4360]);
note("**Paste the whole file.** When you paste LotusScript into the editor, Domino Designer puts each part in its place automatically: `Option` and `Use` lines into **(Options)**, constants, types and variables into **(Declarations)**, and every Sub and Function into its own entry. The `--- part …` comment lines in the files only show where each part begins.");
warn("Create and save **BulkRegCommon first**. BulkRegAgents contains `Use \"BulkRegCommon\"` and does not compile until BulkRegCommon exists.");
p("Do the following for **each** library, BulkRegCommon first:");
ol(
  "Under **Code**, double-click **Script Libraries**. Click **New LotusScript Library**.",
  "Type the library name from the table exactly (no spaces) and click **OK**. *Result:* the LotusScript editor opens, with **(Options)**, **(Declarations)**, **Initialize** and **Terminate** in the outline.",
  "Open the source file in **Notepad**, press **Ctrl+A** and **Ctrl+C** to copy the whole file.",
  "In Designer, click anywhere in the LotusScript editor, press **Ctrl+A**, then **Ctrl+V**. *Result:* the outline shows (Options), (Declarations) and the functions (BR_Init, BR_Log … or BR_RunPreflight …) as separate entries.",
  "Press **Ctrl+S** to save. *Result:* no error dialog. If a compile error appears, note the library, the line and the message (D6)."
);
done("Both libraries save without errors. BulkRegCommon's outline shows the BR_… functions; BulkRegAgents' outline shows BR_RunPreflight, BR_RunBuildBatch, BR_RunRegisterBatch, BR_RunVerify and BR_RunExport.");

h3("B17a Updating the code to a new release (every time the kit changes)");
p("A new release changes **only the two libraries**. The agents stay as they are, because they only call `BR_Run…`. Replace the **whole** content of each library; never paste single functions on top of old ones (a function that exists twice gives **Duplicate procedure**, a missing one gives **Not declared**).");
ol(
  "In Designer, open the library **BulkRegCommon**.",
  "Click in the LotusScript editor, press **Ctrl+A**, then **Delete**. Check the outline: (Options) and (Declarations) are empty and Initialize contains only `Sub Initialize` / `End Sub`.",
  "Paste the **whole** new BulkRegCommon.lss (Notepad: Ctrl+A, Ctrl+C; Designer: Ctrl+V). Press **Ctrl+S**.",
  "Repeat steps 1–3 for **BulkRegAgents** with the whole new BulkRegAgents.lss.",
  "Choose **Tools > Recompile All LotusScript**, so the agents load the new libraries.",
  "Re-sign the database (B19).",
  "Only if the release notes say so (rare: a new agent or a renamed BR_Run… Sub), update the agents as in B18."
);
done("Both libraries save without errors, Recompile All finishes without errors, and the first line of the next debug log shows the new version (`==== BulkReg <version> | tool=…`).");

// ---------- B18
h2("B18 Create the six agents");
meta("Domino administrator", "Domino Designer", "adds 6 agents to bulkreg.nsf");
warn("Type the names exactly as shown. The backslash `\\` creates the **Actions > BulkReg** submenu. Do **not** use `|` in agent names: Notes treats it as the separator between a name and its alias.");
p("Every agent has the same two parts: three lines in **(Options)** and three lines in **Initialize**. Only the name of the `BR_Run…` Sub differs.");
tbl(["Agent name (type exactly)", "Line in Initialize", "Source file (same content)"], [
  ["`BulkReg\\00 - Set Up Log Database`", "`Call BR_RunSetupLog()`", "Agent00_SetUpLogDatabase.lss (run by the log database owner, B20a)"],
  ["`BulkReg\\01 - Preflight Check`", "`Call BR_RunPreflight()`", "Agent01_Preflight.lss"],
  ["`BulkReg\\02 - Build Batch`", "`Call BR_RunBuildBatch()`", "Agent02_BuildBatch.lss"],
  ["`BulkReg\\03 - Register Batch`", "`Call BR_RunRegisterBatch()`", "Agent03_RegisterBatch.lss"],
  ["`BulkReg\\04 - Verify Registration and Vault`", "`Call BR_RunVerify()`", "Agent04_VerifyVaultStatus.lss"],
  ["`BulkReg\\05 - Export to Registration Text File`", "`Call BR_RunExport()`", "Agent05_ExportToBatchRegFile.lss (optional)"],
], [3600, 2800, 2960]);
p("Do the following for **each** agent in the table:");
ol(
  "Under **Code**, double-click **Agents**, then click **New Agent**.",
  "In **Name**, type the agent name from the table.",
  "Under **Type**, select **LotusScript**. Make sure the agent is **Shared** (HCL: private agents do not appear on the Actions menu). Click **OK**. *Result:* the agent's properties box and the LotusScript editor open.",
  "In the properties box, **Basics** tab: under **Runtime**, choose **On event** and then **Action menu selection**. Set **Target** to **None**. Designer proposes *All selected documents*: change it, otherwise the agent stops with *\"to run this agent you must have at least one document selected\"* (bulkreg.nsf contains no documents).",
  "Open the agent's source file from the table in **Notepad**, press **Ctrl+A** and **Ctrl+C**.",
  "In Designer, click in the agent's LotusScript editor, press **Ctrl+A**, then **Ctrl+V**. *Result:* (Options) contains the three lines below and Initialize contains the call, for example:"
);
code(`(Options)      Option Public
               Option Declare
               Use "BulkRegAgents"

Initialize     Sub Initialize
                   Call BR_RunPreflight()
               End Sub`);
olc(
  "Press **Ctrl+S**. *Result:* it saves without a compile error. HCL: saving also signs the agent with your current ID.",
  "Close the agent and repeat for the next row."
);
note("The agent files contain only these lines plus a description in comments. **(Declarations)** of an agent stays empty. You can also type the 3 + 3 lines by hand instead of pasting.");
done("All six agents are listed under Code > Agents with the exact names, trigger 'Action menu selection', target 'None', each contains `Use \"BulkRegAgents\"` and one `Call BR_Run…()` line, and they save without errors.");
pb();

// ---------- B19
h2("B19 Sign the whole database");
meta("Domino administrator", "Domino Administrator", "re-signs every design element with your admin ID");
ol(
  "In Domino Administrator, select **Local** in the server pane.",
  "Click the **Files** tab and select `bulkreg.nsf`.",
  "In the Tools pane choose **Database > Sign**.",
  "Select **Active User's ID** and **All design documents**.",
  "Click **OK**. *Result:* a confirmation that the database was signed."
);
done("bulkreg.nsf is signed with the admin ID that will run it.");

// ---------- B20
h2("B20 First start and the security alert");
ol(
  "In Domino Administrator (or Notes), open `bulkreg.nsf` (**File > Open > HCL Notes Application > Local > bulkreg.nsf**).",
  "Click **Actions > BulkReg**. *Result:* the six agents appear in the submenu, in number order (00 … 05).",
  "Click **01 - Preflight Check**.",
  "If an **Execution Security Alert** appears, read the signer. It must be your admin ID. Choose **Execute the action this one time**, or trust the signer if your ECL policy allows it.",
  "When asked for the **Path to bulkreg.ini**, type `C:\\BulkReg\\config\\bulkreg.ini` and click **OK**. The path is remembered for later runs."
);
done("Preflight starts without a security block and accepts the config path.");

// ---------- B20a
h2("B20a Set up the log database views (database owner, once)");
meta("Owner of the log database (Designer or Manager access to bulkreg_log.nsf)", "bulkreg.nsf", "creates a form and 8 views in bulkreg_log.nsf; no documents are changed");
p("The views are design elements, so they are created by the **owner** of the log database, not by the operators (Author). The owner needs bulkreg.nsf too (a copy with the same libraries and agents is enough) and a bulkreg.ini with the same LogServer / LogDb.");
ol(
  "Open bulkreg.nsf and click **Actions > BulkReg > 00 - Set Up Log Database**. Confirm the config path.",
  "Read the question (database name, 8 views) and click **Yes**.",
  "Read the result: one line per view, each **OK**. *Result:* the form BRLogEntry and the views exist.",
  "Open bulkreg_log.nsf. In the navigator, expand **BulkReg**: the views 1–8 are listed (D4a).",
  "Run 00 again after a release whose notes say that the views changed. It replaces only its own views; your other views are kept."
);
note("If the form import reports an error, the views still work; documents then open without the BulkReg form. Send the message from the result dialog.");
done("bulkreg_log.nsf shows the view folder BulkReg with the 8 views, and Preflight shows **PASS Log database views present**.");

// ---------- B21
h2("B21 Smoke test");
ol(
  "Let Preflight finish. *Result:* a dialog showing Environment errors, candidate counts (OK / WARN / ERROR) and **candidates per home server**.",
  "Open `C:\\BulkReg\\audit`. *Result:* a new folder `<date>_<time>_01-Preflight_READ-ONLY` containing RUN_INFO.txt, `BulkReg_Preflight_READ-ONLY_<run>_audit.csv`, the `_debug.log`, `_mapping.txt` and `_mailfolders.txt`.",
  "Open **bulkreg_log.nsf** on the log server. *Result:* a new entry for `BulkReg Preflight <date-time> by <your name>` containing the run's actions.",
  "In the debug log, check the lines **PASS Tool database is local** and **PASS Log database: Author with Create documents (or higher)**. A warning about Editor/Manager or Delete documents on the log database means your ACL entry is higher than B15 recommends.",
  "If Environment errors is not 0, open the debug log, find the lines marked `FAIL`, fix the cause (D6), and run Preflight again."
);
done("Preflight reports 0 environment errors. **Setup is complete.** Continue with Part C.");
pb();

// ================================================================ PART C
h1("Part C – Run a Batch (repeat for every batch)");
p("Do C1–C9 in order. This is the **Agent Run Order** page in detail: 01 → 02 → review → 03 (DryRun=1) → 03 (DryRun=0) → 04. Record each batch in the batch log (C9). The first time, include C5 (pilot).");

h2("C1 Preflight: see the whole picture");
meta("Domino administrator", "bulkreg.nsf", "nothing");
ol(
  "Open `bulkreg.nsf` and click **Actions > BulkReg > 01 - Preflight Check**. Confirm the config path.",
  "Note the totals: candidates, OK / WARN / ERROR, and **candidates per home server**.",
  "Open the newest run folder `C:\\BulkReg\\audit\\<date>_<time>_01-Preflight_READ-ONLY` and its `…_audit.csv` (D4 lists the columns).",
  "For each **ERROR** row, read the Message column. Fix the cause in Active Directory, for example a missing last name or a duplicate email address, and let DirSync synchronise.",
  "Open `C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mapping.txt` (the mapping test): users per rule and the values each rule gives. If a group lands on the wrong server (also visible in the HomeServer / MapRule columns of the audit CSV), correct server_mapping.csv (B12) and run Preflight again.",
  "Open `C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mailfolders.txt`. For each home server, or for the whole **mail cluster**, it lists the users, the folders needed (for example `mail1 .. mail5`) and **the servers to create them on** (with a cluster: all members), with the create commands. Create any folder that does not exist yet (B4), and make sure `MailFolderMax` is high enough. Preflight warns if it is too low.",
  "With a mail cluster, check the environment lines in the debug log: every member **reachable**, and the line *Mail file managers …* names your admin ID."
);
done("0 environment errors, every user lands on the intended home server (with the intended replica servers), and every mail folder listed in the _mailfolders.txt file exists on every server named there.");

h2("C2 Build a batch");
meta("Domino administrator", "bulkreg.nsf", "writes a batch file; nothing in Domino");
ol(
  "For a wave: make sure server_mapping.csv sends this wave to the right home server (B12.7 Example 1: change the catch-all line between waves). Alternatives: `BatchServerFilter=<home server>` or `ExtraSelection=<formula>`, for example `Department = \"Sales\"` in bulkreg.ini. Save.",
  "Click **Actions > BulkReg > 02 - Build Batch**.",
  "Read the dialog: **Batch ID** (for example `BATCH-20261005-093000`), rows, Include=Y, WARN, ERROR, and users left for the next batch. Write the batch ID in the batch log (C9).",
  "Open `C:\\BulkReg\\batches\\BATCH-<id>_summary.txt` in Notepad. Check the counts **per home server**, **per policy**, the **cluster replicas per home server**, the **new mail files per server (or mail cluster) and folder**, and the **folder fill** (for example `mail cluster : mail2 : 412`)."
);
done("BATCH-<id>.csv and BATCH-<id>_summary.txt exist, and the counts look as expected.");

h2("C3 Review the batch file");
meta("Domino administrator (and a second reviewer if your change process requires one)", "Excel or Notepad", "the batch file only");
warn("Excel can change values. It may turn a NoteID such as `1E2` into a number. Always open the file as **text**, as described below, or use Notepad. BulkReg also re-checks every user's objectGUID and falls back to the UNID, so a damaged NoteID cannot hit the wrong user.");
h3("Open in Excel as text");
ol(
  "Start Excel with a blank workbook. Choose **Data > Get Data > From File > From Text/CSV**.",
  "Select `C:\\BulkReg\\batches\\BATCH-<id>.csv` and click **Import**.",
  "Set **File Origin** to **65001: Unicode (UTF-8)** and **Delimiter** to **Comma**. Click **Transform Data**.",
  "In the editor, press **Ctrl+A** to select all columns, then choose **Data Type > Text** (**Replace current** if asked). Click **Close & Load**."
);
h3("Check every row");
tbl(["Check", "How", "If wrong"], [
  ["Right people", "Read FullName and InternetAddress", "Set Include to `N`"],
  ["Right Notes name", "Read **NotesName**: the name the user will get, e.g. `Neha Arora/Demo` (or `…/Sales/Demo` with an OU). It must never contain `=` or an extra level such as `/O=Demo/Demo`.", "Do not register: correct CertifierName / DefaultOrgUnit / mapping OrgUnit and rebuild (C2)"],
  ["Right home server", "Read HomeServer (and MapRule)", "Correct HomeServer, or fix the mapping and rebuild"],
  ["Right mail file name and folder", "Read MailFile (e.g. `mail2\\smith.nsf`) and MailFileNote (why: naming rule, renamed because the name was taken, folder fill). Renamed rows show **WARN: mail file renamed**.", "Accept, or edit MailFile to a free name in a mail folder (Register Batch re-checks it)"],
  ["Right OU / policy / vault", "Read OrgUnit, Policy and VaultServer", "Correct the value in the row"],
  ["Right replica servers", "Read ClusterReplicas: all other cluster members, comma separated (e.g. `DominoADMail2/Demo,DominoADMailDR1/Demo,DominoADMailDR2/Demo`)", "Correct MailClusterServers and rebuild, or edit the row (empty = no replicas)"],
  ["Warnings", "Filter Check = WARN and read Issues", "Accept them, or set Include to `N`"],
  ["No Internet address", "These users are **not in the batch** (SkipNoInternetAddress=1). The summary shows `No Internet addr: N SKIPPED` and the list `BATCH-<id>_skipped_no_internet_address.csv`; the log view **7. Skipped - no Internet address** shows them too.", "Add the address in AD. After DirSync has written it, the next Build Batch offers the user again. Never an error."],
  ["Errors", "Check = ERROR rows already have Include=N", "Fix in AD and include them in a later batch"],
], [2200, 3700, 3460]);
h3("Save");
ol(
  "Choose **File > Save As**, select **CSV UTF-8 (Comma delimited) (*.csv)**, keep the **same file name** and folder, and click **Save**. Confirm **Replace**.",
  "Close Excel. Do not keep the file open while Agent 03 runs.",
  "Attach the reviewed `BATCH-<id>.csv` and `_summary.txt` to the change ticket (worksheet row 15) as the approval record."
);
note("Notepad alternative for small edits: open the CSV in Notepad and change only the first value of a line, `\"Y\"` to `\"N\"`. Never add or remove columns or rows.");
done("Every Include=Y row has been reviewed, the file is saved under its original name, and it is attached to the change ticket.");
pb();

h2("C4 Dry-run the batch");
meta("Domino administrator", "bulkreg.nsf", "nothing in Domino (writes a dry-run report)");
ol(
  "Confirm `DryRun=1` in bulkreg.ini.",
  "Click **Actions > BulkReg > 03 - Register Batch**.",
  "In **Batch file to register**, accept the proposed path (the newest open batch) or type the path of your batch. Click **OK**.",
  "Read the summary: users to register, users excluded, **users per home server**, **cluster replicas per home server**, registration server, certification. Click **Yes**.",
  "Wait for the end dialog. Open `C:\\BulkReg\\batches\\BATCH-<id>_dryrun_<run>.csv` (a copy is in the run folder `C:\\BulkReg\\audit\\<date>_<time>_03-RegisterBatch_DRYRUN`).",
  "Check that every row shows **WOULD_REGISTER**, that the Message column shows the right **Notes name** (e.g. `Notes name: Neha Arora/Demo`) and **mail file title**, and with a cluster that ReplicaStatus shows **WOULD_REQUEST 3** (one per other member). For SKIPPED or FAILED_VALIDATION rows, read the Message column, then correct the batch row or rebuild the batch (C2)."
);
done("All approved rows show WOULD_REGISTER. The batch is still OPEN.");

h2("C5 Pilot: 2 users (first batch only)");
meta("Domino administrator", "bulkreg.nsf + Domino Administrator", "**registers 2 users**");
ol(
  "In bulkreg.ini set `ExtraSelection=ShortName = \"<pilot1>\" : \"<pilot2>\"`, using two real test users. Save.",
  "Run **02 - Build Batch**. *Result:* a batch with 2 rows. Review it (C3).",
  "Set `DryRun=0` in bulkreg.ini. Save.",
  "Run **03 - Register Batch**, choose the pilot batch, click **Yes**, type the **batch ID** exactly when asked, and enter the certifier password if UseCA=0.",
  "Read the end dialog: ok=2. Open `BATCH-<id>_results.csv`. *Result:* both rows REGISTERED with VaultStatus IN_VAULT.",
  "In Domino Administrator, open each pilot Person document. Check: **Certificate** present (Document Properties > Fields), full name **Neha Arora/Demo** (First Last/Demo, or First Last/OU/Demo - never with `O=` in it), **MailServer** = the intended home server, **MailFile** = the path from the batch, **MailSystem** = Notes, and **Policy synopsis** showing the policy with the vault. Then open the home server's **Files** tab and confirm the mail file exists. With a mail cluster, open the **Files** tab of each other member after a few minutes: the same path (e.g. `mail1\\smith.nsf`) must exist there too, and admin4.nsf shows the Create Replica requests as processed.",
  "On a test PC, set up Notes for one pilot user: the ID must download from the vault, the user must be asked to change the password, and the mail file must open. Send a test mail to the user's Internet address and confirm it arrives in the Domino mail file.",
  "Open the pilot user's mail file (Files tab of the home server): its **Title** is the user's name (e.g. *Neha Arora*), not empty, and its **ACL** (Database > Manage ACL) lists your admin ID (or the MailACLManager names) with **Manager** access and the user himself with **Editor** access and **Delete documents** ticked.",
  "Run **04 - Verify Registration and Vault** and choose the pilot batch. *Result:* 2 × REGISTERED, IN_VAULT, MAILFILE_OK, wrong Notes name = 0, mail file title empty = 0 and (with a cluster) REPLICAS_OK 3/3.",
  "Set `DryRun=1` and clear `ExtraSelection=` in bulkreg.ini. Save."
);
done("Both pilot users pass every check. Record the result in the change ticket. You may now run real batches.");

h2("C6 Register the reviewed batch (LIVE)");
meta("Domino administrator", "bulkreg.nsf", "**registers the approved users**");
ol(
  "Confirm that C3 (review) and C4 (dry run) are done for this batch.",
  "Set `DryRun=0` in bulkreg.ini. Save.",
  "Click **Actions > BulkReg > 03 - Register Batch** and choose the reviewed batch file.",
  "Check the summary per home server against the batch summary. Click **Yes**.",
  "Type the **batch ID** exactly (for example `BATCH-20261005-093000`) and click **OK**. Enter the certifier password if UseCA=0.",
  "Keep Domino Administrator open and the PC awake while it runs. The status bar shows progress (`ok / fail / skip`). The optional `bulkreg.cmd Tail` shows the log live.",
  "Read the end dialog: ok / failed / skipped, plus the paths of the results file and the password file. The ReplicaStatus column of the results file shows **REQUESTED 3/3** per user: the requests are posted; AdminP creates the replicas in the next minutes (longer for large batches).",
  "Set `DryRun=1` in bulkreg.ini. Save."
);
note("If it stops with **Circuit breaker**, the remaining rows are recorded as NOT_PROCESSED and the batch is DONE. Fix the cause (D6). The unregistered users are offered again by the next Build Batch.");
done("BATCH-<id>_results.csv exists and has one row per approved user. DryRun is back to 1.");

h2("C7 Verify the batch");
meta("Domino administrator", "bulkreg.nsf", "nothing");
ol(
  "Click **Actions > BulkReg > 04 - Verify Registration and Vault**.",
  "Accept the proposed batch file (the newest batch) or type the batch path. Leave it empty to verify all DirSync users.",
  "Read the summary and open `BATCH-<id>_verify_<run>.csv`.",
  "**REGISTERED + IN_VAULT + MAILFILE_OK + REPLICAS_OK:** done. **REPLICAS_MISSING k/3 (missing: …):** AdminP is still working or a request failed: wait, run 04 again, then see D3c and D6. **MAILFILE_MISSING:** see D6. **NOT_IN_VAULT:** check the user's policy synopsis and vault, then run Verify again later (replication). **UNREGISTERED** or **NOT_FOUND:** see D6."
);
done("Every registered user of the batch is IN_VAULT, MAILFILE_OK and (with a cluster) REPLICAS_OK, or the exceptions are logged in the change ticket.");

h2("C8 Hand over and clean up");
meta("Domino administrator", "Admin workstation", "**deletes temporary secrets**");
ol(
  "Open `C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<batch>_<run>.csv`. Deliver each user's initial password through your approved secure channel. Users must change it at first use (B7).",
  "Only after C7 shows IN_VAULT for these users: delete the password file and the ID files of the batch.",
  "With the helper: `C:\\BulkReg-kit\\scripts\\windows\\bulkreg.cmd PurgeSecrets -IncludeIds` lists the files; add `-Yes` to delete them.",
  "Manually: delete `C:\\BulkReg\\secure\\BulkReg_InitialPasswords_*.csv` and `C:\\BulkReg\\ids\\*.id`, then empty the Recycle Bin.",
  "Attach `BATCH-<id>_results.csv` and `_verify_*.csv` to the change ticket.",
  "Check that bulkreg.ini has `DryRun=1`."
);
done("The users have their passwords, the secrets are deleted, the evidence is in the ticket, and DryRun=1.");

h2("C9 Next batch and the batch log");
p("Go back to **C1** (or straight to C2 if nothing changed). Keep a log like this in the change ticket:");
tbl(["Batch ID", "Home server", "Include=Y", "Dry run OK", "Registered", "Failed", "In vault", "Replicas OK", "Secrets deleted"], [
  ["BATCH-…", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", ""],
], [1600, 1300, 900, 900, 1000, 800, 900, 1000, 960]);
p("`bulkreg.cmd Batches` lists all batch files with their state (OPEN / DONE).");
pb();

// ================================================================ PART D
h1("Part D – Reference");

h2("D1 Registering across multiple servers");
tbl(["Role", "How many", "What BulkReg does with it"], [
  ["Registration server", "One per Domino domain (holds the master Domino Directory)", "All registrations run against it (`RegistrationServer`). Person documents are updated there and replicate to all servers."],
  ["Home servers", "Any number", "Assigned per user by server_mapping.csv, reviewable per row in the batch. Passed to RegisterNewUser in canonical form (CN=…/O=…); this becomes the user's home/mail server."],
  ["ID Vault(s)", "One or more, each with replicas", "The user's **effective policy** (explicit and/or organizational, through its Security Settings) decides which vault receives the ID. `VaultServer` is only where BulkReg checks IsIDInVault."],
  ["Policies", "One per vault or group", "Map each user group to the policy for its vault and settings"],
  ["Mail cluster", "One list per config (MailClusterServers, 2–6 members)", "Every mail file of a member's users gets a replica on all other members (AdminP). Names and folders are allocated once for the whole cluster (D3c)."],
], [2000, 2600, 4760]);
h3("Batch strategies");
tbl(["Strategy", "Setting", "Use when"], [
  ["Mixed batches", "BatchSize=1000, mapping by field, no filter", "All servers are ready"],
  ["Fill one home server, then the next", "Catch-all line `*;*;DominoADMail/Demo;;;;;`, changed between waves (B12.7 Example 1)", "A fixed number of users per home server, no AD field to split on"],
  ["One server per wave", "`BatchServerFilter=DominoADMail2/Demo`", "Mapping by field, but servers go live on different dates"],
  ["Department or region waves", "`ExtraSelection=Department = \"Sales\"`", "Business-driven rollout"],
  ["Individual exceptions", "Edit HomeServer / Policy / VaultServer in the batch row", "A few users need a different server"],
], [2400, 3500, 3460]);
p("**Several Domino domains:** use one config file per domain (for example `bulkreg-emea.ini`), each with its own servers, certifier and mapping, and enter the matching path when an agent starts.");

h2("D2 Batch files and states");
tbl(["File in C:\\BulkReg\\batches", "Written by", "Purpose"], [
  ["BATCH-<id>.csv", "02", "The list you review and approve"],
  ["BATCH-<id>_summary.txt", "02", "Totals per home server and policy; users left for later"],
  ["BATCH-<id>_dryrun_<run>.csv", "03 (DryRun=1)", "Simulation; the batch stays OPEN"],
  ["BATCH-<id>_results.csv", "03 (LIVE)", "One row per approved user; marks the batch **DONE**"],
  ["BATCH-<id>_verify_<run>.csv", "04", "Registration, vault, mail file and replica status"],
], [3200, 1700, 4460]);
tbl(["State", "Meaning", "Effect"], [
  ["OPEN", "No _results.csv yet", "Its users are not picked by new batches. Agent 03 proposes the newest open batch."],
  ["DONE", "_results.csv exists", "Cannot be run again. Its unregistered users are picked by the next batch."],
], [1300, 3200, 4860]);
h3("Batch file columns");
tbl(["Column", "Edit?", "Meaning"], [
  ["Include", "**Yes**", "Y = register, N = skip"],
  ["BatchID, Seq", "No", "Batch identifier, row number"],
  ["NoteID, UNID, objectGUID", "**Never**", "Identify the Person document and the AD user; checked by Agent 03"],
  ["FullName, FirstName, LastName, ShortName, InternetAddress", "No (fix in AD)", "User data"],
  ["NotesName", "No", "The Notes name the user will get, e.g. Neha Arora/Demo (from first/last name, OrgUnit and CertifierName)"],
  ["MailFileNote", "No", "How the mail file name and folder were chosen"],
  ["HomeServer, MailFile, OrgUnit, Policy, Groups, VaultServer", "**Yes**", "Values used for registration (MailFile is relative to the server data directory, e.g. mail1\\smith.nsf)"],
  ["ClusterReplicas", "**Yes**", "Servers that get a replica of the mail file, comma separated (empty = none)"],
  ["MapRule, Check, Issues", "No", "Where the values came from, and the validation result"],
], [3900, 1500, 3960]);

h2("D3 bulkreg.ini – all settings");
tbl(["Key", "Default", "Meaning"], [
  ["BaseDir", "C:\\BulkReg\\", "Base for default paths"],
  ["DirectoryServer / DirectoryFile", "– / names.nsf", "Directory that DirSync writes into"],
  ["RegistrationServer / RegistrationLog", "– / certlog.nsf", "Server that registers. RegistrationLog: HCL logs to **CERTLOG.NSF** on the registration server when the value is not empty (empty = no certification logging). Keep certlog.nsf."],
  ["UseCA / CertifierName / CertifierIDFile", "1 / – / –", "Domino CA or certifier ID (password prompted, never stored). CertifierName `/Demo` (or Demo, O=Demo) - passed as /Demo; users become First Last/Demo."],
  ["DefaultHomeServer / DefaultOrgUnit / DefaultPolicy / DefaultGroups", "–", "Defaults when no mapping rule sets a value. Servers: canonical or abbreviated."],
  ["OrgPolicyAssignsVault", "0", "1 = an organizational policy (*/Demo, */OU/Demo) assigns the vault; no explicit policy needed"],
  ["VaultServer / VaultCheckAfterReg", "– / 1", "Default vault server for the check; check after each user"],
  ["MappingFile", "C:\\BulkReg\\config\\server_mapping.csv", "Multi-server rules"],
  ["ExtraSelection / BatchServerFilter", "(empty)", "Narrow a batch: formula / one home server"],
  ["SkipNoInternetAddress", "1", "1 = users without an Internet address are skipped and flagged (SKIPPED_NO_INET, own list and log view); 0 = registered without an address (WARN)"],
  ["BatchSize / MaxScan", "1000 / 0", "Rows per batch; directory search limit (0 = no limit; keep 0 for 5000+ users)"],
  ["BatchDir / MaxBatchRows", "C:\\BulkReg\\batches\\ / 1000", "Batch folder; largest accepted batch"],
  ["PauseMs / MaxConsecutiveErrors", "500 / 5", "Pause between users; circuit breaker"],
  ["DryRun", "1", "1 = simulate, 0 = live"],
  ["ExpirationDays / MinPasswordLength / InitialPasswordLength", "730 / 8 / 16", "Certificate validity; password strength (0–16); initial password length"],
  ["MailFileNaming / MailFileCollision", "LASTNAME / SUFFIX", "Mail file name rule; what to do when the name is taken"],
  ["MailFolderMode", "NUMBERED", "NUMBERED: new mail files in <prefix>1, <prefix>2 … directly under the data directory. SINGLE: all in MailFileDir."],
  ["MailFolderPrefix", "mail", "Folder name without number and without path. mail → mail1, mail2 … (mail1 or mail\\mail are rejected at start-up)"],
  ["MailFilesPerFolder", "1000", "Maximum mail files per numbered folder"],
  ["MailExistingFolders", "mail", "Existing mail folder(s), comma separated, checked for duplicate names; never written to"],
  ["MailFileDir", "mail", "Only for MailFolderMode=SINGLE"],
  ["MailFolderMax", "5", "Number of pre-created folders (B4); no folder above it is assigned (0 = no limit)"],
  ["MailTemplate", "(empty)", "Mail template (empty = registration default)"],
  ["MailOwnerAccess", "EDITOR", "Access of the user in his/her own mail file: EDITOR (with Delete documents), DESIGNER or MANAGER. Set at registration and corrected right after it; Verify reports and can correct it. With EDITOR the user cannot change the ACL (Access & Delegation) himself."],
  ["MailFileTitle / MailFileTitleOverwrite", "{CN} / 0", "Database title of each new mail file ({CN} = Neha Arora; also {FirstName} {LastName} {ShortName} {InternetAddress}); set right after registration, before the cluster replicas. 1 = replace a title that is already set."],
  ["MailACLManager / MailCreateFTIndex / MailQuotaSizeLimit / MailQuotaWarningThreshold", "– / 0 / 0 / 0", "Mail file settings (quota in MB). MailACLManager: empty = the operator's admin ID; comma separated names allowed; all of them get Manager access in every new mail file. MailCreateFTIndex also applies to the replicas."],
  ["CheckMailFileExists", "1", "Refuse users whose mail file already exists on the home server or a replica server"],
  ["MailClusterServers", "(empty)", "All members of the mail cluster, comma separated (2–6). Members' users get replicas on the other members; names and folders are allocated cluster-wide (D3c)."],
  ["CreateClusterReplicas", "1", "1 = 03 posts AdminP Create Replica requests; 0 = you create the replicas (04 still checks them)"],
  ["IDFileDir / PasswordDir / AuditDir / WritePasswordFile", "C:\\BulkReg\\… / 1", "Output folders; write passwords to a restricted file"],
  ["IsNorthAmerican / EnforceUniqueShortName / StoreIDInAddressBook / SyncInternetPassword", "1 / 1 / 0 / 0", "NotesRegistration options"],
  ["LogServer / LogDb", "– / bulkreg_log.nsf", "**Required** central log database (B15) with its views (B20a). Agents stop if it cannot be opened."],
  ["LogLevel", "INFO", "Detail written to the debug log and the log database (DEBUG / INFO / WARN / ERROR)"],
], [3900, 2200, 3260]);

h2("D3b DryRun explained");
p("`DryRun` in bulkreg.ini decides whether **03 - Register Batch** really registers users or only simulates. It is the safety switch between *checking a batch* and *changing Domino*.");
tbl(["", "DryRun=1 (DRY RUN, default)", "DryRun=0 (LIVE)"], [
  ["What 03 does", "Goes through every approved row and checks it exactly as for a real run: Person document found, objectGUID matches, data valid, mail file name free, folder available, home server reachable", "The same checks, then **registers** each user: Notes ID, mail file on the home server, ID Vault deposit, Person document updated"],
  ["Changes in Domino", "**None.** No ID, no mail file, no change in names.nsf, nothing in the vault", "Yes: names.nsf, mail files, ID Vault, certlog.nsf"],
  ["Files written", "BATCH-<id>_dryrun_<run>.csv (every row WOULD_REGISTER, SKIPPED or FAILED_VALIDATION), audit CSV, debug log, log database", "BATCH-<id>_results.csv, password file, ID files, audit CSV, debug log, log database"],
  ["Confirmation", "Yes/No summary", "Yes/No summary, then **type the batch ID**"],
  ["Batch state after the run", "Stays **OPEN**: you can dry-run it again, as often as you like", "**DONE**: it cannot be run again"],
], [2000, 3700, 3660]);
ul(
  "**Only agent 03 uses DryRun.** Agents 01, 02, 04 and 05 never change Domino, whatever DryRun is set to.",
  "**Normal cycle:** DryRun=1 → run 03 → check the _dryrun file → DryRun=0 → run 03 on the **same** batch file → DryRun=1 again.",
  "**Why it matters:** a dry run catches problems (missing data, a mail file name taken in the meantime, an unreachable server) **before** anything is created, so the live run is predictable.",
  "**Where to see the mode:** the 03 dialog says *DRY RUN – nothing will be changed* or *LIVE – users WILL be registered*, and every audit row has Mode = DRYRUN or LIVE."
);

h2("D3a Mail files: naming, uniqueness and folders");
p("Every user BulkReg registers becomes a **Domino mail user**: registration creates a mail file on the user's **home server** and the Person document points to it (MailServer, MailFile, Mail system = Notes). Agent 02 decides each mail file's **name** and **folder** while it builds the batch, and records the decision so you can review it before anything is created.");
h3("1. Name = last name");
tbl(["MailFileNaming", "John Smith", "Anna Müller", "Seán O'Brien"], [
  ["`LASTNAME` (default)", "smith.nsf", "mueller.nsf", "obrien.nsf"],
  ["`FIRSTINITIAL_LASTNAME`", "jsmith.nsf", "amueller.nsf", "sobrien.nsf"],
  ["`SHORTNAME`", "<ShortName>.nsf (last name if empty)", "", ""],
], [2600, 2300, 2200, 2260]);
p("Names are lower case. Accents are converted (ä→ae, ö→oe, ü→ue, é→e, ß→ss…), and only a–z, 0–9, _ and - are kept.");
h3("2. Uniqueness on each home server (or in the whole mail cluster)");
p("A name counts as **taken** on a home server if it is found in any of these, checked in this order:");
tbl(["Source", "How it is checked"], [
  ["Files on the server", "Agent 02 reads the server's database list once per run and records the files in the numbered folders (mail1, mail2 …) and in MailExistingFolders (mail)"],
  ["Person documents", "Every Person document with a MailFile (and its MailServer) in the Domino Directory"],
  ["Open batches", "Mail files reserved by other OPEN batch files"],
  ["This batch", "Rows already allocated earlier in the same batch"],
], [2400, 6960]);
p("If the name is taken: with `MailFileCollision=SUFFIX` (default) the next free name is used (smith2.nsf, smith3.nsf …) and the row is marked **WARN: mail file renamed**. With `ERROR` the row gets Check=ERROR and Include=N. Uniqueness is per home server and across **all** its mail folders, so the same name is never used twice on one server. **Mail cluster:** all members count as one server here: a name used on any member is used for the whole cluster (D3c). Agent 03 checks again just before registering that the exact file does not exist, so an existing mail file is never overwritten.");
h3("3. Numbered folders: mail1, mail2 … directly under the data directory");
code(`<Domino data directory>            e.g. D:\\Domino\\Data   or   /local/notesdata
  |-- names.nsf, log.nsf, certlog.nsf ...
  |-- mail\\       EXISTING mail files: left untouched; their names are checked for uniqueness
  |-- mail1\\      NEW mail files    1 - 1000
  |-- mail2\\      NEW mail files 1001 - 2000
  |-- mail3\\ ...  one folder per 1000 users, up to MailFolderMax

Person document after registration:  MailFile = mail1\\smith.nsf   (relative to the data directory)`);
tbl(["Setting", "Value", "Meaning"], [
  ["MailFolderPrefix", "mail", "Name of the numbered folders **without** the number: BulkReg uses mail1, mail2, mail3 …"],
  ["MailFilesPerFolder", "1000", "A folder is filled up to 1000 mail files, then the next one is used"],
  ["MailFolderMax", "5", "Number of folders you created (B4); nothing goes above mail5"],
  ["MailExistingFolders", "mail", "Existing folder whose names are checked for duplicates; BulkReg never writes there"],
  ["MailFileDir", "mail", "Only with MailFolderMode=SINGLE (then all new mail files go into this one folder)"],
], [2400, 1100, 5860]);
p("With `MailFolderMode=NUMBERED` (default), each numbered folder holds at most `MailFilesPerFolder` (default **1000**). Files already in those folders are counted, per home server, and so are open batches. A folder is filled before the next one is used.");
tbl(["Situation on DominoADMail/Demo (or in its mail cluster)", "Batch of 1000 users gets"], [
  ["mail1 has 980 mail files", "20 users → mail1 (now 1000), 980 users → mail2"],
  ["mail1 and mail2 full, mail3 has 300", "700 users → mail3 (now 1000), 300 users → mail4"],
  ["No mail files in the numbered folders yet", "1000 users → mail1"],
], [4200, 5160]);
p("The folders must already exist on the servers (prerequisite B4). `MailFolderMax` is the number of folders you created. If a user would need a folder above it (for example mail6 when you created mail1–mail5), Build Batch marks the row **ERROR: all pre-created mail folders are full** instead of creating a new folder. Create the next folder, raise MailFolderMax and rebuild.");
p("With `MailFolderMode=SINGLE`, all mail files go into `MailFileDir` (for example `mail`).");
h3("4. Where every decision is recorded");
tbl(["Record", "Content"], [
  ["Batch file (MailFile, MailFileNote)", "Path, plus e.g. `smith.nsf already used (file mail1\\smith.nsf) -> smith2.nsf; naming LASTNAME; folder mail2 412/1000`"],
  ["Batch summary", "Naming and folder settings, new mail files per server and folder, folder fill after the batch"],
  ["Build audit CSV / debug log", "One row per user (MailFile, MailFileNote), plus a server scan line (number of mail databases found)"],
  ["Results and audit CSV of Register Batch", "MailFile, MailFileStatus (MAILFILE_OK / MAILFILE_PENDING), MailFileNote, ClusterReplicas, ReplicaStatus"],
  ["Verify report", "MailFileStatus from the Person document and the server (MAILFILE_OK / MAILFILE_MISSING), ReplicaStatus (REPLICAS_OK / REPLICAS_MISSING)"],
], [3000, 6360]);
h3("5. Other mail file settings");
tbl(["Setting", "Effect"], [
  ["MailTemplate", "Template for new mail files (empty = registration default). Must exist on every home server (B4)."],
  ["MailACLManager", "Names with Manager access (and Delete documents) in every new mail file; empty = the admin ID running BulkReg. Set after registration and checked by Verify (MailFileNote: ACL_OK / ACL_SET)."],
  ["MailQuotaSizeLimit / MailQuotaWarningThreshold", "Quota and warning threshold in MB (0 = none)"],
  ["MailCreateFTIndex", "Create a full-text index for new mail files"],
  ["CheckMailFileExists", "Direct check of the exact path (Build and Register Batch)"],
], [3500, 5860]);
h3("Example: one user before and after registration");
tbl(["Person document field", "Before (DirSync)", "After BulkReg"], [
  ["Full name", "John Smith", "John Smith/Sales/Demo"],
  ["Certificate", "(empty)", "(present)"],
  ["Mail system", "Other Internet Mail", "Notes"],
  ["Mail server", "(empty or other)", "CN=DominoADMail/O=Demo"],
  ["Mail file", "(empty)", "mail2\\smith.nsf"],
  ["Internet address", "john.smith@demo.com", "john.smith@demo.com"],
], [2600, 3200, 3560]);
warn("From now on, Domino delivers mail for these users to their **Domino mail file**. Before the first live batch, agree with the mail team how inbound Internet mail (MX / routing) reaches Domino for these addresses, and whether any existing mailbox content must be migrated. That is outside BulkReg. Also check that the DirSync field mapping (Directory Sync configuration, Synchronization tab) does not overwrite MailSystem, MailServer or MailFile after registration.");

h2("D3c Mail cluster replicas");
p("With `MailClusterServers` set, every user whose home server is a cluster member gets a **replica of the mail file on every other member**, at the same path. Example (B12.7): a user on DominoADMail/Demo (DC) gets `mail1\\smith.nsf` on DominoADMail/Demo and replicas on DominoADMail2/Demo (DC), DominoADMailDR1/Demo and DominoADMailDR2/Demo (DR).");
h3("How it works");
tbl(["Step", "Agent", "What happens", "Recorded as"], [
  ["1 Plan", "02 Build Batch", "Lists the replica servers per user in the batch column **ClusterReplicas**; allocates the mail file name and folder for the **whole cluster** (all members are scanned); warns if a replica server is unreachable", "Batch file, summary (replicas per home server)"],
  ["2 Simulate", "03, DryRun=1", "Checks the path is free on the home server **and** every replica server", "ReplicaStatus `WOULD_REQUEST 3 (…)`"],
  ["3 Request", "03, DryRun=0", "After registration, when the mail file exists on the home server: one AdminP **Create Replica** request per replica server (`NotesAdministrationProcess.CreateReplica`, same path, ACL copied, full-text index if MailCreateFTIndex=1)", "ReplicaStatus `REQUESTED 3/3`; one debug-log line per request with the request note ID"],
  ["4 Create", "AdminP on the servers", "HCL: *Check access* on the source server, then for cluster mates *Accelerated create replica* (immediate); otherwise *Create replica* on the destination server and the next replication fills it", "admin4.nsf (Administration Requests), log.nsf"],
  ["5 Verify", "04", "Opens the mail file on the home server, reads its replica ID and looks for that replica on every replica server", "ReplicaStatus `REPLICAS_OK 3/3` or `REPLICAS_MISSING 1/3 (missing: …)`"],
], [1100, 1600, 4500, 2160]);
h3("Why names and folders are shared by the whole cluster");
p("Each member holds every mail file, so `mail1\\smith.nsf` must mean the same user on all four servers. BulkReg therefore treats the cluster as **one** mail namespace: a name taken on any member (or by a Person document whose mail server is a member, or by an open batch) is taken for the whole cluster, and the numbered folders are filled once (a replica is counted once). Users of the second home server simply continue in the next free folder (B12.7 table).");
h3("ReplicaStatus values");
tbl(["Value", "Meaning", "Action"], [
  ["NONE", "Home server not in a cluster, or ClusterReplicas `-`", "None"],
  ["WOULD_REQUEST n (…)", "Dry run: n requests would be posted", "None"],
  ["REQUESTED n/n", "All requests posted", "Run 04 later"],
  ["REQUESTED k/n FAILED: …", "Some requests could not be posted (message per server)", "Create the missing replicas manually (below)"],
  ["REQUEST_FAILED (…)", "No AdminP request could be created (registration server, rights)", "D6; create the replicas manually"],
  ["NOT_REQUESTED (mail file not yet on home server …)", "The mail file did not exist yet when 03 finished", "When 04 shows MAILFILE_OK, create the replicas manually"],
  ["NOT_REQUESTED (CreateClusterReplicas=0)", "Switched off", "Create them yourself"],
  ["REPLICAS_OK n/n", "04: every replica server has the replica", "Done"],
  ["REPLICAS_MISSING k/n (missing: …)", "04: not (yet) on the servers listed", "Wait and re-run 04; then check admin4.nsf (D6)"],
], [3100, 3700, 2560]);
h3("Create missing replicas manually");
ol(
  "Open the `_verify_<run>.csv` file and filter ReplicaStatus = REPLICAS_MISSING. The missing servers are listed per user.",
  "In Domino Administrator, open the home server's **Files** tab and select those users' mail files (Ctrl+click).",
  "In the Tools pane choose **Database > Create Replica(s)**, add the missing servers, keep the same file path, and click **OK**. This posts the same AdminP requests.",
  "Run 04 again later. *Result:* REPLICAS_OK."
);

h2("D4 Outputs, audit and result codes");
tbl(["Output", "Location", "Content"], [
  ["**Central log database (required)**", "LogServer!!bulkreg_log.nsf", "Structured Run, Entry and Audit documents in 8 categorized views (D4a). The shared record for administrators and auditors."],
  ["Skipped users list", "C:\\BulkReg\\batches\\BATCH-<id>_skipped_no_internet_address.csv", "Users left out of the batch because the InternetAddress is empty (SKIPPED_NO_INET)"],
  ["Preflight mapping test", "C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mapping.txt", "Users matched by each mapping rule, and the values per rule (B12.8)"],
  ["Preflight mail folders", "C:\\BulkReg\\audit\\<run folder>\\BulkReg_Preflight_<run>_mailfolders.txt", "Mail folders needed per home server or mail cluster, the servers to create them on, and the create commands (B4)"],
  ["Batch files", "C:\\BulkReg\\batches\\", "D2"],
  ["Run folder (one per run)", "C:\\BulkReg\\audit\\<yyyy-mm-dd>_<hhnnss>_<NN-Agent>_<MODE>\\", "All files of one run, plus RUN_INFO.txt (agent, mode, operator, config, start, end, batch, result) and a copy of the batch results or dry-run report. MODE shows at a glance what the run did: **DRYRUN** or **LIVE-PRODUCTION** (03 only), READ-ONLY (01, 02, 05), VERIFY (04), SETUP (00). Example: `2026-10-05_101500_03-RegisterBatch_LIVE-PRODUCTION`."],
  ["Audit CSV", "<run folder>\\BulkReg_<Tool>_<MODE>_<run>_audit.csv", "One row per user per action, including BatchID, MailFile, MailFileStatus, MailFileNote, ClusterReplicas and ReplicaStatus. **No passwords.**"],
  ["Debug log", "<run folder>\\BulkReg_<Tool>_<MODE>_<run>_debug.log", "Every step, the approval line, and the batch file size and time"],
  ["Password file", "C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<batch>_<run>.csv", "Initial passwords (delete in C8)"],
  ["Certification Log", "certlog.nsf on the registration server", "Domino's record of every certification and registration (written because RegistrationLog is not empty)"],
  ["Administration Requests", "admin4.nsf (any server in the domain)", "The AdminP Create Replica requests posted by 03 and their results (D3c)"],
  ["Domino server log", "log.nsf on the registration and home servers", "General server events, e.g. mail file creation and Administration Process messages; useful for troubleshooting"],
  ["Helper actions log", "C:\\BulkReg\\audit\\bulkreg_admin_actions.log", "PowerShell helper changes"],
], [2000, 4300, 3060]);
tbl(["Result", "Meaning", "Action"], [
  ["OK / WARN / ERROR", "Preflight or Build Batch check", "Fix ERROR (those rows are excluded)"],
  ["WOULD_REGISTER", "Dry run", "Review"],
  ["REGISTERED", "Registered, ID in vault, mail file present, replica requests posted (if any)", "Run 04 for the replicas"],
  ["REGISTERED_WRONG_NAME", "Registered, but the Notes name is not First Last/(OU/)Demo. 03 **stops the run** at the first such user.", "Fix CertifierName / OrgUnit; correct the user (D6)"],
  ["REGISTERED_PENDING", "Registered, but the ID is not in the vault yet, the mail file is not there yet, and/or replica requests failed or were not posted", "Re-run Verify; see D3c and D6"],
  ["ReplicaStatus values", "WOULD_REQUEST, REQUESTED, REPLICAS_OK, REPLICAS_MISSING …", "D3c"],
  ["FAILED_VALIDATION", "Row values invalid; not attempted", "Fix the row or rebuild"],
  ["FAILED", "Registration error (Message: stage + error)", "D6"],
  ["SKIPPED", "Already registered, document gone, or objectGUID mismatch", "None, or rebuild"],
  ["NOT_PROCESSED", "Stopped by the circuit breaker", "Next batch"],
  ["SKIPPED_NO_INET", "No Internet address: left out of the batch (Build), not registered (Register), flagged in log view 7", "Add the address in AD; the next batch picks the user up"],
  ["UNREGISTERED / NOT_FOUND", "Verify: no ID yet / document missing", "Next batch / investigate"],
], [2900, 3800, 2660]);
p("To read the results, open any audit or results CSV in `C:\\BulkReg-kit\\tools\\BulkReg_AuditViewer.html` (offline), in Excel (as text), or with `bulkreg.cmd Status <file>`.");

h2("D4a Log database views");
p("Agent 00 (B20a) creates these views in bulkreg_log.nsf, in the view folder **BulkReg**; view 1 opens by default. Every group has a **twistie**: click it to open or close the group, or use **View > Expand All / Collapse All** (Ctrl + / Ctrl -). Newest dates and batches are at the top.");
tbl(["View", "Shows", "Grouped by", "Use it to"], [
  ["1. Runs - by date", "One line per agent run: start time, agent, DryRun, batch, operator, status (RUNNING / FINISHED / CANCELLED / ABORTED), summary", "Date", "See what was run, when and by whom; spot runs that did not finish"],
  ["2. Batches - by batch, tool, result", "One line per user and action", "Batch > agent > result", "Follow one batch from Build through dry run, live run and Verify; count results per step"],
  ["3. Users - by name", "Every action for a user, oldest first", "User", "Answer \"what happened to John Smith?\" in one place"],
  ["4. Results - by result, batch", "Users per result", "Result > batch", "List all REGISTERED, FAILED, SKIPPED_NO_INET … users"],
  ["5. Home servers - by server, batch", "Users per home server with mail file and replica status", "Home server > batch", "Check the load per server and the cluster replicas"],
  ["6. Problems - errors, failures, skipped", "ERROR/WARN log lines, failed/skipped/pending users, missing or failed replicas, runs not FINISHED", "Date > agent", "Daily check: everything that needs attention"],
  ["7. Skipped - no Internet address", "Users skipped because the InternetAddress is empty, with Person NoteID and objectGUID", "User", "Hand the list to the AD team; once fixed, the users are picked up by the next batch"],
  ["8. Full log - by run", "Every log line of a run, in time order", "Run (date, agent, DryRun, operator)", "Read a complete run like the debug log, for troubleshooting"],
], [2300, 3300, 1700, 2060]);
p("Every document can be opened (form **BRLogEntry**) and shows all its fields. Documents are written as: **Run** (one per run, closed at the end with status and summary), **Entry** (one per log line) and **Audit** (one per user and action, with the same columns as the audit CSV).");

h2("D5 PowerShell helper (optional)");
p("Run it from `C:\\BulkReg-kit\\scripts\\windows\\`. Registration does not need it.");
tbl(["Command", "Does"], [
  ["`bulkreg.cmd Init` (elevated)", "Creates the C:\\BulkReg folders, restricts access, copies the templates (B9, B10)"],
  ["`bulkreg.cmd Check`", "Flags placeholders, a missing certifier, loose permissions, and whether the client is running"],
  ["`bulkreg.cmd Batches`", "Lists batch files: rows, Include=Y, state"],
  ["`bulkreg.cmd DryRun On|Off`", "Sets DryRun with a .bak copy and a diff"],
  ["`bulkreg.cmd Status [file]`", "Totals by result and the rows that need attention"],
  ["`bulkreg.cmd Tail`", "Follows the newest debug log"],
  ["`bulkreg.cmd PurgeSecrets [-IncludeIds] [-Yes]`", "Lists, then deletes, password files and ID files"],
  ["`bulkreg.cmd Versions`", "Checks that every kit file (library, agents, config, helper, Audit Viewer, README, CHANGELOG, guide) carries the release number in VERSION"],
], [3800, 5560]);

h2("D6 Troubleshooting");
p("General method: set `LogLevel=DEBUG`, rebuild a 1-user batch (ExtraSelection), dry-run it, and read the debug log. FAILED rows show the stage (load, validate, configure, RegisterNewUser, verify, mailfile, replicas, vault) and the Notes error. Cross-check the same time in **certlog.nsf** on the registration server (certification and registration records) and in **log.nsf** on the registration and home servers (server events, mail file creation, Administration Process).");
tbl(["Symptom", "Likely cause", "Fix"], [
  ["Actions menu shows only \"01\", \"02\"…", "`|` used in the agent names (alias separator)", "Rename the agents exactly as in B18"],
  ["Agents not in the Actions menu", "Private agent, or wrong trigger", "B18: Shared, On event > Action menu selection"],
  ["\"To run this agent you must have at least one document selected\"", "The agent's **Target** is *All selected documents* (Designer's default); bulkreg.nsf has no documents", "Designer > agent properties > Basics > Runtime: **Target: None**, Ctrl+S. Check all six agents."],
  ["Execution Security Alert every time", "Signer not trusted in the ECL", "B19 sign; trust the signer if your policy allows"],
  ["Compile error when saving", "Old code was not removed before pasting, or only part of the file was copied", "Ctrl+A, Delete, then paste the whole file again (B17, B18)"],
  ["\"Error loading USE or USELSX module: BulkRegCommon/BulkRegAgents\"", "Library missing, misspelt, or not saved yet; BulkRegAgents saved before BulkRegCommon", "Check the names exactly (B17); save BulkRegCommon, then BulkRegAgents, then Tools > Recompile All LotusScript"],
  ["Duplicate procedure … / Not declared …", "A new release was pasted on top of the old code, so functions exist twice or are missing; or an agent from release 3.2 still contains its old code", "Replace the whole library as in B17a; reduce every agent to the 3 + 3 lines of B18"],
  ["Unexpected / Type mismatch / Variable not declared in BulkReg code", "A defect in the kit", "Note element, line and message and report it; do not edit the code by hand"],
  ["\"supported only in the Domino Administrator client on Windows\"", "Run outside the Windows client", "Run from the admin workstation"],
  ["Audit folder not writable", "B9 not done, or wrong permissions", "Redo B9; `bulkreg.cmd Check`"],
  ["Build Batch selects 0 users", "All registered, in OPEN batches, or filtered", "Read the summary's 'Not selected' line"],
  ["\"no open batch\" / \"already DONE\"", "No batch, or it has already run", "Build a new batch (C2)"],
  ["\"header is missing … columns\"", "File saved without its header, or the layout changed", "Rebuild; save as CSV UTF-8 (C3)"],
  ["SKIPPED: objectGUID mismatch", "Document recreated, or the row was edited", "Rebuild the batch"],
  ["FAILED stage=RegisterNewUser", "Not an RA, wrong certifier or password, missing roles, unknown server or policy", "B4, B5, B8; check the names in bulkreg.ini and the mapping"],
  ["REGISTERED_PENDING (vault)", "Policy without a vault, wrong policy name, wrong VaultServer, replication, or the user's OU does not match the organizational policy", "B7/B8; Policy synopsis; re-run Verify later"],
  ["WARN: No explicit policy", "Policy empty and OrgPolicyAssignsVault=0", "Set the explicit policy, or OrgPolicyAssignsVault=1 if an organizational policy assigns the vault"],
  ["ERROR: Policy looks like a server/canonical name", "A server name (CN=…/O=…) was put in the Policy column", "Put the policy name (*/Name) or `-`"],
  ["ERROR: Policy '*'", "The organization-wide policy was entered", "Leave Policy empty: `*` applies automatically"],
  ["ERROR: MailFile … already exists on …", "A mail file with that name is on the home server (another user, or a leftover)", "Edit MailFile in the batch (e.g. mail\\jsmith2.nsf), or remove the old file after checking it"],
  ["\"LogServer and LogDb are required\"", "Log database not configured", "Do B15 and set LogServer / LogDb"],
  ["\"Cannot open the BulkReg log database\"", "Wrong server or file name, database missing, or no Author/Create documents access", "Check B15 (ACL) and bulkreg.ini; nothing was changed"],
  ["\"Mail folder setting error\" at start-up", "MailFolderPrefix written with a number (mail1) or a path (mail\\mail)", "Set MailFolderPrefix=mail. The folders mail1, mail2 … sit directly in the data directory."],
  ["ERROR: All pre-created mail folders … are full", "More users than the folders you created can hold", "Create the next folder(s) on that server (B4), raise MailFolderMax, rebuild the batch"],
  ["Preflight: MailFolderMax too low", "The users need more folders than MailFolderMax", "Create the folders listed in _mailfolders.txt and raise MailFolderMax"],
  ["Users named like **Neha Arora/O=Demo/Demo** (REGISTERED_WRONG_NAME, Verify: wrong Notes name)", "Release 3.4 and earlier passed CertifierName `O=Demo` unchanged to the registration, or `O=Demo` / `OU=…` / `x/y` was entered as OrgUnit. The registration then added `O=Demo` as an extra OU.", "1) Install 3.5.0 (CertifierName is converted to `/Demo`; OrgUnit with `=` or `/` is rejected). 2) Set `CertifierName=/Demo`, leave DefaultOrgUnit empty, check the OrgUnit column of server_mapping.csv. 3) Correct the users already registered: see **Correcting wrongly named users** below this table. 4) Dry-run again: the Message column must show `Notes name: Neha Arora/Demo`."],
  ["Mail file has no title (Verify: mail file title empty)", "Release 3.4 and earlier did not set it", "Run 04 - Verify on the batch and answer **Yes** to 'Set the title now' - only the titles are set. New registrations set it automatically (MailFileTitle)."],
  ["SKIPPED_NO_INET / users missing from the batch", "The AD user has no e-mail address, so the DirSync Person document has no InternetAddress (SkipNoInternetAddress=1)", "Add the address in AD; after DirSync the next Build Batch includes the user. To register such users without an address, set SkipNoInternetAddress=0 (they are then flagged WARN)."],
  ["Preflight: 'The log database has no BulkReg views yet'", "B20a not done", "The log database owner runs 00 - Set Up Log Database"],
  ["00 - Set Up Log Database: 'needs Designer or Manager access'", "Run by an operator (Author)", "The database owner runs it (B20a)"],
  ["WARN: mail file renamed", "The last-name file already exists on that server, in the directory or in an open batch", "Normal with SUFFIX. Review the new name, or edit MailFile"],
  ["\"Could not scan <server>\" in the debug log", "No access to the server's database list", "Uniqueness then uses the directory and the direct file check. Fix access and rebuild for full checking."],
  ["MAILFILE_PENDING / MAILFILE_MISSING", "Mail file creation queued (Administration Process) or failed: template missing, no Create databases right, server unreachable", "Check admin4.nsf on the home server, B4 rights and template; re-run Verify"],
  ["REPLICAS_MISSING after several hours", "AdminP request failed: requester or destination server has no Reader access to the mail file, no 'Create new replicas' right, no Connection document, or AdminP not running", "Open admin4.nsf > All Requests by Action, find Create Replica for the user and read the response document; fix B4 (cluster section); create the replicas manually (D3c)"],
  ["REQUEST_FAILED / REQUESTED k/n FAILED", "AdminP request could not be created (RegistrationServer unreachable, no rights to admin4.nsf, unrestricted methods not allowed)", "Check the message; create the replicas manually (D3c); confirm in the pilot (D9)"],
  ["NOT_REQUESTED (mail file not yet on home server)", "The mail file was created in the background after 03 finished", "When 04 shows MAILFILE_OK, create the replicas manually (D3c)"],
  ["User is Manager of his own mail file", "Domino's registration default (Manager); releases before 3.6.5 kept it", "3.6.5 registers the owner with Editor + Delete documents (MailOwnerAccess=EDITOR) and corrects it after registration. For existing mail files run 04 - Verify and answer **Yes** to 'Correct these ACL entries now'."],
  ["Admin ID is not Manager of the new mail files (MailFileNote / Verify: ACL_MISSING or ACL_ERROR)", "Releases before 3.6.4 relied only on the registration option, which did not add the entry; ACL_ERROR means your ID could not change the ACL", "3.6.4 adds the entry after registration. For existing mail files run 04 - Verify and answer **Yes** to 'Add them to the ACL now'. For ACL_ERROR give your admin ID Manager access through the mail template ACL (e.g. LocalDomainAdmins) or enable Full Access Administration, then run Verify again."],
  ["\"MailClusterServers lists only one server / more than 6\" at start-up", "Incomplete or wrong cluster list", "List all 2–6 members, comma separated"],
  ["WARN: Replica server … unreachable", "A cluster member is down or not reachable from the workstation", "AdminP creates the replica when it is back; or exclude the server for this batch by editing ClusterReplicas"],
  ["Mail fields change after the next DirSync", "DirSync attribute mapping overwrites MailSystem / MailServer / MailFile", "Remove those fields from the DirSync mapping (Directory Sync configuration, Synchronization tab)"],
], [2900, 3300, 3160]);
h3("Correcting wrongly named users (e.g. Neha Arora/O=Demo/Demo)");
p("A Notes name cannot simply be edited: it is inside the ID, the certificate, the vault and the mail file ACL. For the few users registered before 3.5.0 with a wrong name, remove the registration and register them again with the fixed release. Do it for one user first and check the result.");
ol(
  "List the users: log view **3. Users - by name** or Verify (*wrong Notes name*), or `BATCH-<id>_results.csv`.",
  "Check your Directory Sync configuration (Directory Sync document, direction of synchronization): it must **not** delete the AD account when the Domino Person document is deleted. If it synchronizes from Domino to AD, stop and ask the DirSync owner first.",
  "In Domino Administrator, **People & Groups > People**, select the wrongly named user(s) and choose **Tools > People > Delete**. In the Delete Person dialog choose to delete the **mail file and all its replicas**. Confirm. *Result:* AdminP removes the Person document, the name from groups, and the mail file and its replicas (check admin4.nsf until the requests are processed).",
  "Check the ID Vault: once AdminP has processed the deletion, the wrongly named ID must no longer be in the vault (as vault administrator, open the vault database from **Configuration > Security > ID Vaults**). Remove it there if it is still listed. Delete the user's ID file from `C:\\BulkReg\\ids` and the line from the password file.",
  "Wait for the next Directory Sync cycle (or start it). *Result:* the user's Person document is created again from AD, with objectGUID and without Certificate.",
  "With release 3.5.0 installed and `CertifierName=/Demo`: run 02 - Build Batch for these users (ExtraSelection), check the **NotesName** column (`Neha Arora/Demo`), dry-run, then register."
);
note("Mail sent to the wrongly named user's mail file is lost with step 3. These were pilot users; if mail must be kept, copy it first or ask HCL support about a rename (Rename Person / Move to another certifier) instead.");
p("Escalate to the platform owner if failures affect more than one batch. Escalate immediately to the security owner if a password file, ID file or certifier may have been exposed.");

h2("D7 Security controls and change checklist");
tbl(["Risk", "Control", "Evidence"], [
  ["Unknown users registered", "Only reviewed Include=Y rows of an approved batch file", "Batch file in the ticket; _results.csv"],
  ["Wrong user", "objectGUID must match; NoteID/UNID cross-check", "SKIPPED rows"],
  ["Mass change by mistake", "DryRun default, per-server summary, typed batch ID, MaxBatchRows, circuit breaker", "Debug log approval line"],
  ["Same user in two batches", "OPEN batches are excluded from new batches", "Build summary"],
  ["Certifier password exposure", "Masked prompt, memory only, never stored or logged; CA recommended", "Code, logs"],
  ["Personal data or IDs exposed", "Restricted folders; secrets deleted after Verify; .gitignore blocks batch, ID and password files", "ACLs, helper log"],
  ["Weak initial passwords", "Random 16 characters plus a forced change at first use (B7). LotusScript Rnd is not cryptographic.", "Security Settings"],
  ["Unauthorized tool use", "bulkreg.nsf ACL limited to admins; signed design", "B14, B19"],
  ["Missing audit trail", "Central log database is mandatory; agents refuse to run without it; one AUDIT entry per user", "bulkreg_log.nsf (B15)"],
  ["Audit trail altered", "Operators are Author without Delete documents on the log database; owner is a separate group; Preflight warns about higher access", "Log database ACL, Preflight debug log"],
  ["Tool database copied or changed", "Local, ACL enforced, locally encrypted; code kept in Git and signed", "B14, B19"],
], [2300, 4600, 2460]);
tbl(["When", "Check"], [
  ["Before each batch", "Preflight clean; batch built, reviewed and attached; dry run clean"],
  ["Go / no-go", "Pilot passed (first time); servers healthy; DryRun=0 set deliberately"],
  ["After each batch", "Results and Verify attached; secrets deleted; DryRun=1; batch log updated"],
], [1800, 7560]);

h2("D8 Rollback");
p("Registration certifies the existing Person document and creates an ID. It **cannot be cleanly undone**, which is why the dry run and the pilot exist. To reverse users, take them from `BATCH-<id>_results.csv` and use your standard deletion process (AdminP Delete Person) and vault clean-up. HCL notes that users registered through user registration are not removed by a DirSync full resync. To recover from an interrupted run, build a new batch: the unregistered users are offered again.");

h2("D9 Known limitations – confirm during the pilot");
tbl(["#", "Item", "How to confirm"], [
  ["1", "The code has not been compiled or run against a live Domino environment", "B17–B21 and C4–C5"],
  ["2", "RegisterNewUser parameters follow HCL's ContactNoteID example and the 14.5 syntax", "Compiles and the pilot passes"],
  ["3", "UseCA=1 passes an empty certifier password", "The pilot registers successfully"],
  ["4", "PolicyName is passed as stored (`*/name`)", "Policy synopsis of the pilot users (C5)"],
  ["5a", "Numbered mail folders must exist before registration", "Pre-created in B4 and enforced by MailFolderMax; Preflight lists what is needed"],
  ["5", "Mail file creation through NotesRegistration (immediate or via the Administration Process) and the DirSync mapping of mail fields", "Mail file present after the pilot and Person document unchanged after the next DirSync"],
  ["5b", "Cluster replicas through `NotesAdministrationProcess.CreateReplica` (HCL: requires unrestricted rights; accelerated for cluster mates)", "Pilot: REPLICAS_OK 3/3, replicas at the same path on every member (C5)"],
  ["6", "Views are created with NotesDatabase.CreateView / NotesView.CreateColumn and the form with NotesDXLImporter", "B20a: all lines OK, views open with categories"],
  ["7", "bulkreg.ps1 was reviewed but not executed", "Run `bulkreg.cmd Check` once"],
  ["8", "One Domino Directory per config file", "D1"],
], [500, 5600, 3260]);

h2("D10 Glossary");
tbl(["Term", "Meaning"], [
  ["DirSync", "Domino Directory Sync: copies AD users and groups into the Domino Directory"],
  ["Person document", "A user's entry in the Domino Directory (names.nsf)"],
  ["objectGUID", "The AD user's unique ID, stored in the DirSync Person document"],
  ["Registration", "Creating a certified Notes ID for a user"],
  ["Registration server", "The server whose Domino Directory receives the registrations"],
  ["Home server", "The user's Domino server (MailServer field), where the mail file is created"],
  ["Mail file", "The user's Domino mailbox database, e.g. mail\\jsmith.nsf"],
  ["ID Vault", "Server-side store for Notes IDs; assigned through Security Settings in a policy"],
  ["Explicit policy", "A policy assigned to specific users (stored as */name)"],
  ["Organizational policy", "A policy applied automatically to everyone under an org or OU (*/Demo, */Sales/Demo)"],
  ["Canonical / abbreviated name", "CN=DominoADMail/O=Demo / DominoADMail/Demo: the same name in two formats"],
  ["RA", "Registration Authority: may register users through the Domino CA"],
  ["Batch / Batch ID", "A reviewed list of users / its name BATCH-yyyymmdd-hhnnss"],
  ["Include=Y", "The row will be registered"],
  ["DryRun", "Simulation mode; nothing is changed"],
  ["Mail cluster", "Domino servers that hold replicas of the same mail files for failover (e.g. 2 in DC, 2 in DR); listed in MailClusterServers"],
  ["Cluster replica", "A copy of a mail file with the same replica ID on another cluster member, kept in sync by cluster replication"],
  ["AdminP", "The Domino Administration Process; carries out requests such as Create Replica (admin4.nsf)"],
], [2600, 6760]);
pb();

// ================================================================ APPENDICES
h1("Appendices");
h2("Appendix A – Manual alternatives");
p("**Register Selected Person:** in Domino Administrator, People & Groups > select DirSync users > right-click **Register Selected Person**. You are prompted per user. Choose the explicit policy if you use one.");
p("**Registration text file:** Agent 05 writes `C:\\BulkReg\\secure\\BatchReg_DirSync_<run>.txt` (HCL 20-field format, UTF-8 BOM, contains passwords). Import it with **People > Register > Import Text File**. HCL documents this for new users, so test 1–2 DirSync users first.");

h2("Appendix B – Agent reference");
tbl(["Agent (code in BulkRegAgents)", "Reads", "Writes", "Asks for"], [
  ["00 - Set Up Log Database (BR_RunSetupLog)", "bulkreg.ini, log database", "Form and 8 views in the log database", "Config path, Yes/No; Designer access"],
  ["01 - Preflight Check (BR_RunPreflight)", "names.nsf, servers", "Audit, debug log", "Config path"],
  ["02 - Build Batch (BR_RunBuildBatch)", "names.nsf, open batches, servers", "BATCH-<id>.csv, _summary.txt, audit", "Config path"],
  ["03 - Register Batch (BR_RunRegisterBatch)", "One batch file, names.nsf", "names.nsf (LIVE), ID files, AdminP Create Replica requests (admin4.nsf), _results/_dryrun, password file, audit", "Config path, batch file, Yes/No, batch ID (LIVE), certifier password (UseCA=0)"],
  ["04 - Verify Registration and Vault (BR_RunVerify)", "A batch file or all users, ID Vault, mail files and their replicas", "_verify.csv, audit", "Config path, batch file or empty"],
  ["05 - Export (optional, BR_RunExport)", "names.nsf", "Text file, audit", "Config path, password Yes/No"],
], [2300, 2300, 2800, 1960]);

h2("Appendix C – HCL documentation used");
C.push({ t: "refs", items: [
  ["Registering Active Directory users (Directory Sync)", "https://help.hcl-software.com/domino/14.0.0/admin/conf_adsync_registering_ad_users.html"],
  ["ContactNoteID property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_CONTACTNOTEID_PROPERTY_NOTESREGISTRATION.html"],
  ["RegisterNewUser method", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_REGISTERNEWUSER_METHOD.html"],
  ["CreateReplica (NotesAdministrationProcess)", "https://help.hcl-software.com/dom_designer/9.0.1/appdev/H_CREATEREPLICA_METHOD_ADMINP.html"],
  ["Create replica (AdminP request: Check access, Accelerated create replica, Create replica)", "https://help.hcl-software.com/domino/14.0.0/admin/admn_createreplica_r.html"],
  ["Creating an ID vault", "https://help.hcl-software.com/domino/14.5.0/admin/conf_creatinganidvault_t.html"],
  ["Assigning users to a vault (Security Settings, ID Vault tab)", "https://help.hcl-software.com/domino/14.5.0/admin/conf_creatingoreditingidvaultpolicysettingsdocumentsma_t.html"],
  ["Creating a security policy settings document", "https://help.hcl-software.com/domino/14.0.0/admin/conf_creatingasecuritypolicysettingsdocument_t.html"],
  ["Creating a policy document (explicit policy names */name)", "https://help.hcl-software.com/domino/14.5.0/admin/conf_creatingapolicydocument_t.html"],
  ["Modifying a server-based CA (adding RAs)", "https://help.hcl-software.com/domino/14.5.1/admin/conf_modifyingaserverbasedca_t.html"],
  ["Administration roles in the Domino Directory ACL", "https://help.hcl-software.com/domino/14.0.0/admin/conf_usingadministrationrolesinthedominodirectoryacl_t.html"],
  ["Configuring a database ACL (Manage ACL)", "https://help.hcl-software.com/domino/14.0.0/admin/conf_configuringadatabaseacl_t.html"],
  ["Creating a database from a template", "https://help.hcl-software.com/dom_designer/14.5.1/basic/H_CREATING_A_DATABASE_FROM_A_TEMPLATE_OVER.html"],
  ["Script libraries (Designer)", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_USING_SCRIPT_LIBRARIES.html"],
  ["Creating an agent (Designer)", "https://help.hcl-software.com/dom_designer/14.5.1/basic/H_CREATING_AN_AGENT.html"],
  ["Naming agents: aliases '|' and cascading '\\'", "https://help.hcl-software.com/notes/14.0.0/client/agt_rules_for_agent_names_r.html"],
  ["Signing a database", "https://help.hcl-software.com/domino/14.0.0/admin/admn_signingadatabaseortemplate_t.html"],
  ["Checking field values (Document Properties)", "https://help.hcl-software.com/dom_designer/14.5.1/basic/H_ABOUT_CHECKING_FIELD_VALUES_IN_A_DOCUMENT.html"],
  ["Execution Security Alert (ECL)", "https://help.hcl-software.com/notes/14.0.0/client/sec_ecl_alert_c.html"],
]});

h2("Appendix D – Keeping the kit in GitHub");
p("Run these commands on the machine that holds the kit repository (Terminal on macOS, or PowerShell with Git for Windows).");
code(`# one time: connect the folder to your existing private repo
git remote add origin https://github.com/<org-or-user>/<repo>.git
git fetch origin
git push -u origin main            # empty repo
# repo created with a README/LICENSE:
git pull origin main --allow-unrelated-histories --no-rebase -X ours -m "Merge GitHub initial commit"
git push -u origin main

# every change
git add -A
git commit -m "Describe the change"
git pull --rebase
git push

# on the admin workstation: get updates
cd C:\\BulkReg-kit
git pull`);
warn("Never copy anything from `C:\\BulkReg` (configs with real values, batch files, ID files, passwords, logs) into the kit repository. `.gitignore` blocks the usual file names, but treat it as a safety net only.");

module.exports = { META, C };
