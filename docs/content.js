// BulkReg Administrator Guide v2.0 — single source for Word + Web.
// Assumes NOTHING exists yet. Every procedure: purpose, who/where, before you start,
// numbered single-action steps with expected results, and a "Done when" check.
const META = {
  title: "BulkReg Framework",
  subtitle: "Step-by-step guide: bulk registration of Directory Sync (Active Directory) users in HCL Domino with ID Vault, in reviewed batches across multiple servers, from the Windows Domino Administrator client",
  docType: "Administrator Setup, Operations & Audit Guide",
  version: "2.2",
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
  ["Framework version", "BulkReg 1.3.0: BulkRegCommon library, 5 agents, config templates, optional PowerShell helper, Audit Viewer"],
], [2400, 6960]);
h3("Revision history");
tbl(["Version", "Change"], [
  ["1.0 – 1.4", "Framework, runbook, Windows-client model, reviewed batch workflow"],
  ["2.2", "Mail settings (CreateMailDb, PreserveMailSystem) explained in plain language with a decision table and a before/after example (D3a)."],
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
  ["Vault server", "`CN=DominoVault/O=Demo`", "`DominoVault/Demo`", "Use the name shown in the vault document"],
  ["Organization certifier", "`O=Demo`", "`/Demo`", "CertifierName for the Domino CA"],
  ["OU certifier", "`OU=Sales/O=Demo`", "`/Sales/Demo`", "Registers users as John Smith/Sales/Demo"],
  ["Registered user", "`CN=John Smith/OU=Sales/O=Demo`", "`John Smith/Sales/Demo`", "Result of registration with OrgUnit Sales"],
  ["Organizational policy (whole org)", "`*/Demo`", "–", "Applied automatically to users under /Demo"],
  ["Organizational policy (one OU)", "`*/Sales/Demo`", "–", "Applied automatically to users under /Sales/Demo"],
  ["Explicit policy", "`*/DirSync-Vault`", "–", "Applied only when named at registration (Policy column)"],
], [2300, 2700, 2300, 2060]);
pb();

// ================================================================ PART A
h1("Part A – Understand");
h2("A1 What BulkReg does");
p("Directory Sync (DirSync) copies Active Directory users into the Domino Directory (`names.nsf`) as **Person documents**. These users can be found in Domino, but they have **no Notes ID**, no certificate and no mail file (Mail system: *Other Internet Mail*).");
p("BulkReg registers these users **in reviewed batches**. Each user gets a certified Notes ID, the ID is stored in the **ID Vault**, and the user is assigned to the right **home server**. Every step is logged for audit.");
p("It uses HCL's documented API for this case, `NotesRegistration.ContactNoteID`: *“Used to register users who have existing Person documents created by syncing Active Directory users into the Domino directory.”* The existing Person document is upgraded in place, so no duplicate is created.");
h2("A2 How a batch works: you always see who is registered");
tbl(["Stage", "Tool", "What happens", "Changes Domino?"], [
  ["1 Build", "Agent 02", "Picks the next batch (default 500) of unregistered DirSync users. Works out each user's home server, OU, policy, groups and vault. Validates them and writes a **batch file** (CSV) plus a summary.", "No"],
  ["2 Review", "You, in Excel or Notepad", "Read the list. Exclude users (Include=N) or correct their server, OU, policy, groups or vault. Save the file.", "No"],
  ["3 Dry run", "Agent 03, DryRun=1", "Simulates the batch and shows what would happen", "No"],
  ["4 Register", "Agent 03, DryRun=0", "Shows totals per server. You type the batch ID to approve. Only the approved rows are registered.", "**Yes**"],
  ["5 Verify", "Agent 04", "Checks every user of the batch: registered? ID in the vault?", "No"],
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
  ["Configuration: bulkreg.ini, server_mapping.csv", "`C:\\BulkReg\\config\\`", "B11, B12"],
  ["Tool database bulkreg.nsf (+ optional log database)", "Local Notes data directory", "B13–B15"],
  ["Script library and 5 agents", "Inside bulkreg.nsf", "B17, B18"],
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
  ["4", "How users are split across home servers (department, email domain, location…)", "@emea.demo.com → DominoADMail2/Demo", ""],
  ["5", "Certification method: Domino CA (recommended) or certifier ID file", "Domino CA", ""],
  ["6", "CA-enabled certifier name (CA) or certifier ID file path", "O=Demo or OU=Sales/O=Demo", ""],
  ["7", "ID Vault name(s) and vault server(s)", "DemoVault on DominoVault/Demo (CN=DominoVault/O=Demo)", ""],
  ["8", "Security Settings document name(s)", "BulkReg-Vault-Security", ""],
  ["9", "Policy type (organizational or explicit, see A4) and exact name(s)", "Explicit: */DirSync-Vault, or organizational: */Demo, */Sales/Demo", ""],
  ["10", "Optional organizational unit (OU) per group of users", "EMEA", ""],
  ["11", "Optional groups to add new users to", "BR-EMEA", ""],
  ["12", "Admin ID that will run BulkReg", "Admin User/Demo", ""],
  ["13", "Windows admin workstation name", "ADMIN-PC01", ""],
  ["14", "Batch size", "500", ""],
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
  "Scroll to **MailSystem** and **MailFile** and note their values, so you can compare them after the pilot."
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
done("Your admin ID has Editor access with [UserCreator] and [UserModifier] (and the Policy roles if needed) in names.nsf on the registration server.");

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
  ["`C:\\BulkReg\\audit`", "Audit CSVs, debug logs", "Admins and auditors (read)"],
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
ol(
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
done("`C:\\BulkReg-kit\\lotusscript` contains 6 .lss files, and `C:\\BulkReg\\config` contains bulkreg.ini and server_mapping.csv.");

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
  ["UseCA", "`1` for the Domino CA, `0` for a certifier ID file", "Worksheet 5"],
  ["CertifierName", "With UseCA=1: the CA certifier, e.g. `O=Demo` or `OU=Sales/O=Demo`", "Worksheet 6"],
  ["CertifierIDFile", "With UseCA=0: `C:\\BulkReg\\cert\\<file>.id`. With UseCA=1: leave the placeholder or clear it.", "B5 Option 2"],
  ["DefaultHomeServer", "Home server for users that match no specific rule: `DominoADMail/Demo` or `CN=DominoADMail/O=Demo`", "Worksheet 3"],
  ["DefaultPolicy", "Explicit policy **exactly** as listed, e.g. `*/DirSync-Vault`. **Empty** with an organizational policy.", "Worksheet 9"],
  ["OrgPolicyAssignsVault", "`1` if an organizational policy (`*/Demo`, `*/Sales/Demo`) assigns the vault, otherwise `0`", "B8"],
  ["VaultServer", "The vault server, e.g. `DominoVault/Demo` (as shown in the vault document)", "Worksheet 7"],
  ["BatchSize", "`500` or your value", "Worksheet 14"],
  ["CreateMailDb / PreserveMailSystem", "Leave `0` / `1` if users keep their mailbox outside Domino (the usual case). See D3a before changing.", "D3a"],
  ["LogServer / LogDb", "Leave empty unless you create the log database in B15", "B15"],
  ["DryRun", "Leave `1`", "–"],
], [2300, 5100, 1960]);
done("bulkreg.ini contains no `<` or `>` characters except in comment lines (starting with `#`), and DryRun=1.");

// ---------- B12
h2("B12 Fill in server_mapping.csv (your servers)");
meta("Domino administrator", "Notepad", "C:\\BulkReg\\config\\server_mapping.csv");
p("Each line is a **rule**: *if this Person document field matches this pattern, use this home server, OU, policy, groups and vault*. Rules are checked top-down; the **first match wins**. The last rule `*;*` catches everyone else.");
tbl(["Column", "Meaning", "Example"], [
  ["MatchField", "Person document field to test (any field: Department, InternetAddress, Location, CompanyName…). `*` = any.", "`InternetAddress`"],
  ["MatchPattern", "Pattern, not case-sensitive. `*` = any text, `?` = one character.", "`*@emea.demo.com`"],
  ["HomeServer", "Home server for matching users, canonical or abbreviated (empty = DefaultHomeServer)", "`CN=DominoADMail2/O=Demo`"],
  ["OrgUnit", "OU added to the Notes name (empty = DefaultOrgUnit, `-` = none)", "`EMEA` → John Smith/EMEA/Demo"],
  ["Policy", "Explicit policy exactly as listed (empty = DefaultPolicy, `-` = none: rely on the organizational policy)", "`*/DirSync-Vault-EMEA` or `-`"],
  ["Groups", "Comma-separated groups (empty = DefaultGroups, `-` = none)", "`BR-EMEA`"],
  ["VaultServer", "Vault server for the vault check (empty = VaultServer)", "`DominoVaultEMEA/Demo`"],
], [2100, 4900, 2360]);
ol(
  "Open `C:\\BulkReg\\config\\server_mapping.csv` in **Notepad** (do not use Excel for this file).",
  "Keep line 1 (the header) unchanged. Lines starting with `#` are comments.",
  "Delete the example rules and write one rule per user group from worksheet row 4, most specific first.",
  "Make the last line the catch-all: `*;*;<DefaultHomeServer>;;;;`.",
  "Separate columns with a **semicolon** `;`. Leave a column empty but keep its semicolon.",
  "Save with **File > Save** (UTF-8)."
);
p("Worked example for three servers:");
code(`MatchField;MatchPattern;HomeServer;OrgUnit;Policy;Groups;VaultServer
InternetAddress;*@emea.demo.com;CN=DominoADMail2/O=Demo;EMEA;*/DirSync-Vault-EMEA;BR-EMEA;DominoVaultEMEA/Demo
InternetAddress;*@apac.demo.com;DominoADMail3/Demo;APAC;*/DirSync-Vault-APAC;BR-APAC;DominoVaultAPAC/Demo
Department;Sales*;DominoADMail/Demo;Sales;-;BR-Sales;
*;*;DominoADMail/Demo;;;;`);
tbl(["Rule", "Result for a matching user"], [
  ["1 (EMEA)", "Home server DominoADMail2/Demo, name John Smith/EMEA/Demo, explicit policy */DirSync-Vault-EMEA, group BR-EMEA, vault checked on DominoVaultEMEA/Demo"],
  ["2 (APAC)", "Home server DominoADMail3/Demo, name …/APAC/Demo, explicit policy */DirSync-Vault-APAC"],
  ["3 (Sales)", "Home server DominoADMail/Demo, name John Smith/Sales/Demo, **no explicit policy**: the organizational policy */Sales/Demo assigns the vault"],
  ["4 (everyone else)", "Defaults from bulkreg.ini"],
], [1800, 7560]);
done("Every rule names an existing server and policy from the worksheet, and the last rule is the catch-all.");
pb();

// ---------- B13
h2("B13 Create the tool database bulkreg.nsf");
meta("Domino administrator", "Domino Administrator (or Notes client)", "creates a local database");
ol(
  "Choose **File > Application > New**. *Result:* the New Application dialog opens.",
  "In **Server**, keep **Local**.",
  "In **Title**, type `BulkReg Tool`.",
  "In **File Name**, type `bulkreg.nsf`.",
  "In the template list, select **-Blank-**.",
  "Click **OK**. *Result:* an empty database opens. Close it."
);
done("bulkreg.nsf exists in your local Notes data directory.");

// ---------- B14
h2("B14 Restrict access to bulkreg.nsf");
ol(
  "Select the bulkreg.nsf icon (or open the database) and choose **File > Application > Access Control**.",
  "Set **-Default-** to **No Access**. Set **Anonymous** to **No Access** (add it if missing).",
  "Make sure your admin ID (or admin group) has **Manager** access.",
  "Click **OK**."
);
done("Only administrators have access to bulkreg.nsf.");

// ---------- B15
h2("B15 Optional: create a central log database");
p("Skip this unless you want BulkReg events in a Notes database as well as in the audit files.");
ol(
  "Choose **File > Application > New**. In **Server**, select the server that will hold the log (for example the registration server).",
  "In **Title**, type `BulkReg Log`. In **File Name**, type `bulkreg_log.nsf`.",
  "Tick **Show advanced templates** and select the **Agent Log** template (file alog4.ntf; some releases list alog.ntf). Click **OK**.",
  "In bulkreg.ini set `LogServer=<that server>` and `LogDb=bulkreg_log.nsf`. Save."
);
done("bulkreg_log.nsf exists and bulkreg.ini points to it, or LogDb is empty.");

// ---------- B16 / B17
h2("B16 Open bulkreg.nsf in Domino Designer");
ol(
  "Start **HCL Domino Designer**.",
  "Choose **File > Open > HCL Notes Application**, select **Local**, choose `bulkreg.nsf` and click **Open**. *Result:* BulkReg Tool appears in the **Applications Navigator** on the left.",
  "Expand **BulkReg Tool**, then expand **Code**."
);
h2("B17 Create the script library BulkRegCommon");
meta("Domino administrator", "Domino Designer", "adds a script library to bulkreg.nsf");
ol(
  "Under **Code**, double-click **Script Libraries**. Click **New LotusScript Library**.",
  "Type the name `BulkRegCommon` exactly (no spaces) and click **OK**. *Result:* the LotusScript editor opens, with **(Options)**, **(Declarations)**, **Initialize** and **Terminate** in the outline.",
  "Open `C:\\BulkReg-kit\\lotusscript\\BulkRegCommon.lss` in **Notepad**. The file contains three marked blocks: **STEP A**, **STEP B** and **STEP C**.",
  "**STEP A:** in Designer, select **(Options)**. Copy the two lines below the STEP A marker (`Option Public` and `Option Declare`) and paste them there, replacing what is there.",
  "**STEP B:** select **(Declarations)**. Copy everything between the STEP B and STEP C markers and paste it there.",
  "**STEP C:** click at the end of the last line in (Declarations), press **Enter** twice, then copy everything from the STEP C marker to the end of the file and paste it. *Result:* the outline now lists the functions (BR_Init, BR_Log …) as separate entries.",
  "Press **Ctrl+S** to save. *Result:* no error dialog. If a compile error appears, Designer shows the line. Check that each block went to the right place."
);
done("BulkRegCommon saves without errors, and its outline shows (Options), (Declarations) and the BR_… functions.");

// ---------- B18
h2("B18 Create the five agents");
meta("Domino administrator", "Domino Designer", "adds 5 agents to bulkreg.nsf");
warn("Type the names exactly as shown. The backslash `\\` creates the **Actions > BulkReg** submenu. Do **not** use `|` in agent names: Notes treats it as the separator between a name and its alias.");
tbl(["Agent name (type exactly)", "Source file in C:\\BulkReg-kit\\lotusscript", "Blocks in the file"], [
  ["`BulkReg\\01 - Preflight Check`", "Agent01_Preflight.lss", "A, C, D"],
  ["`BulkReg\\02 - Build Batch`", "Agent02_BuildBatch.lss", "A, C, D"],
  ["`BulkReg\\03 - Register Batch`", "Agent03_RegisterBatch.lss", "A, B, C, D"],
  ["`BulkReg\\04 - Verify Registration and Vault`", "Agent04_VerifyVaultStatus.lss", "A, B, C, D"],
  ["`BulkReg\\05 - Export to Registration Text File`", "Agent05_ExportToBatchRegFile.lss (optional)", "A, C"],
], [3600, 3700, 2060]);
p("Do the following for **each** agent in the table:");
ol(
  "Under **Code**, double-click **Agents**, then click **New Agent**.",
  "In **Name**, type the agent name from the table.",
  "Under **Type**, select **LotusScript**. Make sure the agent is **Shared** (HCL: private agents do not appear on the Actions menu). Click **OK**. *Result:* the agent's properties box and the LotusScript editor open.",
  "In the properties box, **Basics** tab: under **Runtime**, choose **On event** and then **Action menu selection**. Set **Target** to **None**.",
  "Open the source file in Notepad.",
  "**STEP A:** select **(Options)** in the agent outline and paste the three lines under the STEP A marker (`Option Public`, `Option Declare`, `Use \"BulkRegCommon\"`).",
  "**STEP B** (only Agents 03 and 04): select **(Declarations)** and paste the `Dim` lines under the STEP B marker.",
  "**STEP C:** select **Initialize**, select all its text (Ctrl+A), and paste the block under the STEP C marker, from `Sub Initialize` to its `End Sub`.",
  "**STEP D** (if present): click after the final `End Sub` of Initialize, press Enter twice, and paste everything from the STEP D marker to the end of the file. *Result:* the extra subs and functions appear as separate entries in the outline.",
  "Press **Ctrl+S**. *Result:* it saves without a compile error. HCL: saving also signs the agent with your current ID.",
  "Close the agent and repeat for the next row."
);
done("All five agents are listed under Code > Agents with the exact names, trigger 'Action menu selection', target 'None', and they save without errors.");
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
  "Click **Actions > BulkReg**. *Result:* the five agents appear in the submenu, in number order.",
  "Click **01 - Preflight Check**.",
  "If an **Execution Security Alert** appears, read the signer. It must be your admin ID. Choose **Execute the action this one time**, or trust the signer if your ECL policy allows it.",
  "When asked for the **Path to bulkreg.ini**, type `C:\\BulkReg\\config\\bulkreg.ini` and click **OK**. The path is remembered for later runs."
);
done("Preflight starts without a security block and accepts the config path.");

// ---------- B21
h2("B21 Smoke test");
ol(
  "Let Preflight finish. *Result:* a dialog showing Environment errors, candidate counts (OK / WARN / ERROR) and **candidates per home server**.",
  "Open `C:\\BulkReg\\audit`. *Result:* a file `BulkReg_Preflight_<date-time>_audit.csv` and a `_debug.log`.",
  "If Environment errors is not 0, open the debug log, find the lines marked `FAIL`, fix the cause (D6), and run Preflight again."
);
done("Preflight reports 0 environment errors. **Setup is complete.** Continue with Part C.");
pb();

// ================================================================ PART C
h1("Part C – Run a Batch (repeat for every batch)");
p("Do C1–C9 in order. Record each batch in the batch log (C9). The first time, include C5 (pilot).");

h2("C1 Preflight: see the whole picture");
meta("Domino administrator", "bulkreg.nsf", "nothing");
ol(
  "Open `bulkreg.nsf` and click **Actions > BulkReg > 01 - Preflight Check**. Confirm the config path.",
  "Note the totals: candidates, OK / WARN / ERROR, and **candidates per home server**.",
  "Open the newest `C:\\BulkReg\\audit\\BulkReg_Preflight_*_audit.csv` (D4 lists the columns).",
  "For each **ERROR** row, read the Message column. Fix the cause in Active Directory, for example a missing last name or a duplicate email address, and let DirSync synchronise.",
  "If a user lands on the wrong server (HomeServer / MapRule columns), correct server_mapping.csv (B12) and run Preflight again."
);
done("0 environment errors, and every user lands on the intended home server.");

h2("C2 Build a batch");
meta("Domino administrator", "bulkreg.nsf", "writes a batch file; nothing in Domino");
ol(
  "Optional, for a wave: in bulkreg.ini set `BatchServerFilter=<home server>` (one server only), or `ExtraSelection=<formula>`, for example `Department = \"Sales\"`. Save.",
  "Click **Actions > BulkReg > 02 - Build Batch**.",
  "Read the dialog: **Batch ID** (for example `BATCH-20261005-093000`), rows, Include=Y, WARN, ERROR, and users left for the next batch. Write the batch ID in the batch log (C9).",
  "Open `C:\\BulkReg\\batches\\BATCH-<id>_summary.txt` in Notepad. Check the counts **per home server** and **per policy**."
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
  ["Right home server", "Read HomeServer (and MapRule)", "Correct HomeServer, or fix the mapping and rebuild"],
  ["Right OU / policy / vault", "Read OrgUnit, Policy and VaultServer", "Correct the value in the row"],
  ["Warnings", "Filter Check = WARN and read Issues", "Accept them, or set Include to `N`"],
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
  "Read the summary: users to register, users excluded, **users per home server**, registration server, certification. Click **Yes**.",
  "Wait for the end dialog. Open `C:\\BulkReg\\batches\\BATCH-<id>_dryrun_<run>.csv`.",
  "Check that every row shows **WOULD_REGISTER**. For SKIPPED or FAILED_VALIDATION rows, read the Message column, then correct the batch row or rebuild the batch (C2)."
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
  "In Domino Administrator, open each pilot Person document. Check: **Certificate** present (Document Properties > Fields), hierarchical full name, correct home server, **MailSystem** unchanged (compare with B3), and **Policy synopsis** showing your explicit and/or organizational policy with the vault.",
  "On a test PC, set up Notes for one pilot user: the ID must download from the vault, and the user must be asked to change the password.",
  "Run **04 - Verify Registration and Vault** and choose the pilot batch. *Result:* 2 × REGISTERED, IN_VAULT.",
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
  "Read the end dialog: ok / failed / skipped, plus the paths of the results file and the password file.",
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
  "**REGISTERED + IN_VAULT:** done. **NOT_IN_VAULT:** check the user's policy synopsis and vault, then run Verify again later (replication). **UNREGISTERED** or **NOT_FOUND:** see D6."
);
done("Every registered user of the batch is IN_VAULT, or the exceptions are logged in the change ticket.");

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
tbl(["Batch ID", "Built", "Include=Y", "Dry run OK", "Registered", "Failed", "In vault", "Secrets deleted", "Ticket"], [
  ["BATCH-…", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", ""],
], [1600, 900, 900, 900, 1000, 800, 900, 1200, 1160]);
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
], [2000, 2600, 4760]);
h3("Batch strategies");
tbl(["Strategy", "Setting", "Use when"], [
  ["Mixed batches", "BatchSize=500, no filter", "All servers are ready"],
  ["One server per wave", "`BatchServerFilter=DominoADMail2/Demo`", "Servers go live on different dates, or are owned by different teams"],
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
  ["BATCH-<id>_verify_<run>.csv", "04", "Registration and vault status"],
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
  ["HomeServer, OrgUnit, Policy, Groups, VaultServer", "**Yes**", "Values used for registration"],
  ["MapRule, Check, Issues", "No", "Where the values came from, and the validation result"],
], [3900, 1500, 3960]);

h2("D3 bulkreg.ini – all settings");
tbl(["Key", "Default", "Meaning"], [
  ["BaseDir", "C:\\BulkReg\\", "Base for default paths"],
  ["DirectoryServer / DirectoryFile", "– / names.nsf", "Directory that DirSync writes into"],
  ["RegistrationServer / RegistrationLog", "– / log.nsf", "Server that registers; Domino registration log"],
  ["UseCA / CertifierName / CertifierIDFile", "1 / – / –", "Domino CA or certifier ID (password prompted, never stored)"],
  ["DefaultHomeServer / DefaultOrgUnit / DefaultPolicy / DefaultGroups", "–", "Defaults when no mapping rule sets a value. Servers: canonical or abbreviated."],
  ["OrgPolicyAssignsVault", "0", "1 = an organizational policy (*/Demo, */OU/Demo) assigns the vault; no explicit policy needed"],
  ["VaultServer / VaultCheckAfterReg", "– / 1", "Default vault server for the check; check after each user"],
  ["MappingFile", "C:\\BulkReg\\config\\server_mapping.csv", "Multi-server rules"],
  ["ExtraSelection / BatchServerFilter", "(empty)", "Narrow a batch: formula / one home server"],
  ["BatchSize / MaxScan", "500 / 5000", "Rows per batch; directory search limit (0 = none)"],
  ["BatchDir / MaxBatchRows", "C:\\BulkReg\\batches\\ / 1000", "Batch folder; largest accepted batch"],
  ["PauseMs / MaxConsecutiveErrors", "500 / 5", "Pause between users; circuit breaker"],
  ["DryRun", "1", "1 = simulate, 0 = live"],
  ["ExpirationDays / MinPasswordLength / InitialPasswordLength", "730 / 8 / 16", "Certificate validity; password strength (0–16); initial password length"],
  ["CreateMailDb / PreserveMailSystem", "0 / 1", "No mail file; keep Other Internet Mail"],
  ["IDFileDir / PasswordDir / AuditDir / WritePasswordFile", "C:\\BulkReg\\… / 1", "Output folders; write passwords to a restricted file"],
  ["IsNorthAmerican / EnforceUniqueShortName / StoreIDInAddressBook / SyncInternetPassword", "1 / 1 / 0 / 0", "NotesRegistration options"],
  ["LogLevel / LogServer / LogDb", "INFO / – / –", "Log detail; optional log database"],
], [3900, 2200, 3260]);

h2("D3a Mail settings explained: CreateMailDb and PreserveMailSystem");
p("**Background.** DirSync users usually keep their mailbox **outside Domino** (Exchange, Microsoft 365, Gmail…). Their Person document says *Mail system = Other Internet Mail*, *Mail file* is empty, and Domino delivers mail for them to their Internet address. They only need a **Notes ID**, for applications and the ID vault, not a Domino mailbox.");
h3("CreateMailDb: should registration create a Domino mailbox?");
tbl(["Value", "What happens", "Choose it when"], [
  ["`0` (default)", "No mail file is created. Only the Notes ID is created and stored in the vault.", "Users keep their mailbox where it is today"],
  ["`1`", "A Domino mail file `mail\\<shortname>_<noteid>.nsf` is created on the user's home server, and the user becomes a Domino (Notes) mail user", "You are moving these users' mail to Domino. Needs *Create databases* rights on the home servers."],
], [1500, 4800, 3060]);
h3("PreserveMailSystem: keep the user's mail routing as it was (only when CreateMailDb=0)");
p("Registration can switch the Person document to **Notes** mail with a mail file path, even though no mail file was created. Domino would then try to deliver the user's mail to a mailbox that does not exist. With `PreserveMailSystem=1`, BulkReg checks the Person document straight after registration and **puts back the values it had before**.");
tbl(["Value", "What happens", "Choose it when"], [
  ["`1` (default, recommended)", "Mail system and Mail file are restored to their pre-registration values. Mail keeps flowing to the external mailbox exactly as before.", "Users keep their external mailbox"],
  ["`0`", "BulkReg leaves whatever registration wrote", "You will set the mail fields yourself, for example in a separate migration step"],
], [2200, 4700, 2460]);
h3("Example: one user, before and after (CreateMailDb=0, PreserveMailSystem=1)");
tbl(["Person document field", "Before registration", "Right after RegisterNewUser (possible)", "After BulkReg finishes"], [
  ["Full name", "John Smith", "John Smith/Sales/Demo", "John Smith/Sales/Demo"],
  ["Certificate", "(empty)", "(present)", "(present)"],
  ["Mail system", "Other Internet Mail", "Notes", "**Other Internet Mail**"],
  ["Mail file", "(empty)", "mail\\jsmith.nsf", "**(empty)**"],
  ["Internet address", "john.smith@demo.com", "john.smith@demo.com", "john.smith@demo.com"],
], [2200, 2100, 2700, 2360]);
h3("Which combination do I need?");
tbl(["Your situation", "CreateMailDb", "PreserveMailSystem"], [
  ["Users keep Exchange / Microsoft 365 / other external mail (normal DirSync case)", "0", "1"],
  ["Users should get a Domino mailbox now", "1", "(ignored)"],
  ["You manage the mail fields yourself after registration", "0", "0"],
], [5600, 1800, 1960]);
note("Every user's MailSystemBefore and MailSystemAfter values are in the audit and results CSV, so you can check them. Confirm the behaviour in the pilot (C5): compare the Mail system field with the value noted in B3. If a later DirSync run overwrites these fields, the DirSync field mapping wins (Directory Sync configuration, Synchronization tab).");

h2("D4 Outputs, audit and result codes");
tbl(["Output", "Location", "Content"], [
  ["Batch files", "C:\\BulkReg\\batches\\", "D2"],
  ["Audit CSV", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<run>_audit.csv", "One row per user per action, including BatchID. **No passwords.**"],
  ["Debug log", "C:\\BulkReg\\audit\\BulkReg_<Tool>_<run>_debug.log", "Every step, the approval line, and the batch file size and time"],
  ["Password file", "C:\\BulkReg\\secure\\BulkReg_InitialPasswords_<batch>_<run>.csv", "Initial passwords (delete in C8)"],
  ["Domino registration log", "log.nsf on the registration server", "Domino's own records"],
  ["Helper actions log", "C:\\BulkReg\\audit\\bulkreg_admin_actions.log", "PowerShell helper changes"],
], [2000, 4300, 3060]);
tbl(["Result", "Meaning", "Action"], [
  ["OK / WARN / ERROR", "Preflight or Build Batch check", "Fix ERROR (those rows are excluded)"],
  ["WOULD_REGISTER", "Dry run", "Review"],
  ["REGISTERED", "Registered, ID in vault", "None"],
  ["REGISTERED_VAULT_PENDING", "Registered, ID not yet found in the vault", "Check the policy; re-run Verify"],
  ["FAILED_VALIDATION", "Row values invalid; not attempted", "Fix the row or rebuild"],
  ["FAILED", "Registration error (Message: stage + error)", "D6"],
  ["SKIPPED", "Already registered, document gone, or objectGUID mismatch", "None, or rebuild"],
  ["NOT_PROCESSED", "Stopped by the circuit breaker", "Next batch"],
  ["UNREGISTERED / NOT_FOUND", "Verify: no ID yet / document missing", "Next batch / investigate"],
], [2900, 3800, 2660]);
p("To read the results, open any audit or results CSV in `C:\\BulkReg-kit\\tools\\BulkReg_AuditViewer.html` (offline), in Excel (as text), or with `bulkreg.cmd Status <file>`.");

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
], [3800, 5560]);

h2("D6 Troubleshooting");
p("General method: set `LogLevel=DEBUG`, rebuild a 1-user batch (ExtraSelection), dry-run it, and read the debug log. FAILED rows show the stage (load, validate, configure, RegisterNewUser, verify, preserveMail, vault) and the Notes error.");
tbl(["Symptom", "Likely cause", "Fix"], [
  ["Actions menu shows only \"01\", \"02\"…", "`|` used in the agent names (alias separator)", "Rename the agents exactly as in B18"],
  ["Agents not in the Actions menu", "Private agent, or wrong trigger", "B18: Shared, On event > Action menu selection"],
  ["Execution Security Alert every time", "Signer not trusted in the ECL", "B19 sign; trust the signer if your policy allows"],
  ["Compile error when saving", "A block was pasted into the wrong section", "Redo B17/B18 steps A–D"],
  ["\"supported only in the Domino Administrator client on Windows\"", "Run outside the Windows client", "Run from the admin workstation"],
  ["Audit folder not writable", "B9 not done, or wrong permissions", "Redo B9; `bulkreg.cmd Check`"],
  ["Build Batch selects 0 users", "All registered, in OPEN batches, or filtered", "Read the summary's 'Not selected' line"],
  ["\"no open batch\" / \"already DONE\"", "No batch, or it has already run", "Build a new batch (C2)"],
  ["\"header is missing … columns\"", "File saved without its header, or the layout changed", "Rebuild; save as CSV UTF-8 (C3)"],
  ["SKIPPED: objectGUID mismatch", "Document recreated, or the row was edited", "Rebuild the batch"],
  ["FAILED stage=RegisterNewUser", "Not an RA, wrong certifier or password, missing roles, unknown server or policy", "B4, B5, B8; check the names in bulkreg.ini and the mapping"],
  ["REGISTERED_VAULT_PENDING", "Policy without a vault, wrong policy name, wrong VaultServer, replication, or the user's OU does not match the organizational policy", "B7/B8; Policy synopsis; re-run Verify later"],
  ["WARN: No explicit policy", "Policy empty and OrgPolicyAssignsVault=0", "Set the explicit policy, or OrgPolicyAssignsVault=1 if an organizational policy assigns the vault"],
  ["ERROR: Policy looks like a server/canonical name", "A server name (CN=…/O=…) was put in the Policy column", "Put the policy name (*/Name) or `-`"],
  ["ERROR: Policy '*'", "The organization-wide policy was entered", "Leave Policy empty: `*` applies automatically"],
  ["MailSystem changes after the next DirSync", "DirSync attribute mapping (Directory Sync configuration, Synchronization tab)", "Adjust the DirSync mapping or PreserveMailSystem"],
], [2900, 3300, 3160]);
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
  ["5", "PreserveMailSystem with your DirSync mapping", "MailSystem after the pilot and after the next sync"],
  ["6", "The Agent Log template file name differs between releases (alog4.ntf / alog.ntf)", "B15"],
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
  ["Home server", "The user's Domino server (MailServer field)"],
  ["ID Vault", "Server-side store for Notes IDs; assigned through Security Settings in a policy"],
  ["Explicit policy", "A policy assigned to specific users (stored as */name)"],
  ["Organizational policy", "A policy applied automatically to everyone under an org or OU (*/Demo, */Sales/Demo)"],
  ["Canonical / abbreviated name", "CN=DominoADMail/O=Demo / DominoADMail/Demo: the same name in two formats"],
  ["RA", "Registration Authority: may register users through the Domino CA"],
  ["Batch / Batch ID", "A reviewed list of users / its name BATCH-yyyymmdd-hhnnss"],
  ["Include=Y", "The row will be registered"],
  ["DryRun", "Simulation mode; nothing is changed"],
], [2600, 6760]);
pb();

// ================================================================ APPENDICES
h1("Appendices");
h2("Appendix A – Manual alternatives");
p("**Register Selected Person:** in Domino Administrator, People & Groups > select DirSync users > right-click **Register Selected Person**. You are prompted per user. Choose the explicit policy if you use one.");
p("**Registration text file:** Agent 05 writes `C:\\BulkReg\\secure\\BatchReg_DirSync_<run>.txt` (HCL 20-field format, UTF-8 BOM, contains passwords). Import it with **People > Register > Import Text File**. HCL documents this for new users, so test 1–2 DirSync users first.");

h2("Appendix B – Agent reference");
tbl(["Agent", "Reads", "Writes", "Asks for"], [
  ["01 - Preflight Check", "names.nsf, servers", "Audit, debug log", "Config path"],
  ["02 - Build Batch", "names.nsf, open batches, servers", "BATCH-<id>.csv, _summary.txt, audit", "Config path"],
  ["03 - Register Batch", "One batch file, names.nsf", "names.nsf (LIVE), ID files, _results/_dryrun, password file, audit", "Config path, batch file, Yes/No, batch ID (LIVE), certifier password (UseCA=0)"],
  ["04 - Verify Registration and Vault", "A batch file or all users, ID Vault", "_verify.csv, audit", "Config path, batch file or empty"],
  ["05 - Export (optional)", "names.nsf", "Text file, audit", "Config path, password Yes/No"],
], [2300, 2300, 2800, 1960]);

h2("Appendix C – HCL documentation used");
C.push({ t: "refs", items: [
  ["Registering Active Directory users (Directory Sync)", "https://help.hcl-software.com/domino/14.0.0/admin/conf_adsync_registering_ad_users.html"],
  ["ContactNoteID property", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_CONTACTNOTEID_PROPERTY_NOTESREGISTRATION.html"],
  ["RegisterNewUser method", "https://help.hcl-software.com/dom_designer/14.5.0/basic/H_REGISTERNEWUSER_METHOD.html"],
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
