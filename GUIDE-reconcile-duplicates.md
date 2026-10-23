# Reconcile and remove duplicates (one machine)

Run this on machine A after the merge. Order: **check, reconcile, review, duplicates, repair mail, check again.** Keep `DryRun=1` except for the live steps.

> **Status:** agent **12 - Remove Duplicates** was added after 4.5.0 and has **not been compiled or run against Domino**. Compile it in Designer and do a dry run first. Removing Person documents is destructive: get written approval from the business owner and take a `names.nsf` backup before any live run.

## Before you start

- No batch is running. No `STOP.txt` in `BatchDir` (unless you put it there to stop a run).
- `bulkreg.ini`: `DryRun=1`, `PartitionCount=1`, no `<PLACEHOLDER>` left.
- `names.nsf` and `C:\BulkReg` are backed up.

## Step 1: read-only baseline

1. **01 - Preflight Check.** Expect no errors.
2. **11 - Batch Manager**, empty action. Note every batch that is not `DONE_COMPLETE`. For each, action `RECOVER <batch id>` and read `RECOVER_<id>_<run>.csv`.
3. **09 - Reconcile.** Open `RECON_<run>_summary.txt`, then these files:

| File | Meaning |
|---|---|
| `_gaps.csv` | users not registered, or registered without a mail file |
| `_duplicates.csv` | duplicate Person documents: `KEEP`, `DO_NOT_REGISTER`, `REVIEW` |
| `_duplicate_ids.csv` | duplicate ID files or vault entries |
| `_missing_mail.csv` | registered users with no mail file |

## Step 2: fix each state from `RECOVER`

| State | Do this |
|---|---|
| `NOT_REGISTERED` | run 03 again (resumes), or `REMAINDER <id>`, review, run 03 |
| `REGISTERED_NO_RESULT` | initial password is in `secure\`; then 08 and 04 for that user |
| `NO_MAIL` | step 4 (agent 08) |
| `NOT_IN_VAULT` | vault or policy action; never run 03 for this user |
| `DUPLICATE` | step 3 |
| `GONE`, `OK` | nothing |

## Step 3: duplicates

**Rules of thumb:** a duplicate is a second Person document for the same person. The registered one with a mail file is the **keeper**. Only an **unregistered, full duplicate** is removed. A second registered identity is never touched by agent 12.

| `_duplicates.csv` row | What to do |
|---|---|
| `KEEP` | stays |
| `DO_NOT_REGISTER` | unregistered duplicate: agent 12 can remove it |
| `REVIEW` | second registered identity: manual AdminP decision by the Domino owner |

`_duplicate_ids.csv`:

| Kind | What to do |
|---|---|
| `IDFILE_MULTIPLE` | keep the ID that is in the vault or was handed out; archive the others by hand |
| `IDFILE_UNREGISTERED`, `VAULT_UNREGISTERED` | do not register again; check the log and the vault first |

**Remove duplicates (agent 12):**

1. Confirm in `bulkreg.ini`: `DuplicateDeleteMethod=ADMINP`, `DuplicateMustMatch=name,short,inet,first,last`, `DuplicateMaxDelete=25`.
2. Run **12 - Remove Duplicates** with `DryRun=1`, input `RECON_<run>_duplicates.csv`. Read `DEDUP_DRYRUN_<run>.csv`: `WOULD_REMOVE` is the plan. Every `SKIP_*` row says why:

| Skip | Meaning |
|---|---|
| `SKIP_NOT_FULL_DUPLICATE` | a field differs: review by hand |
| `SKIP_NEEDS_DIRECT`, `SKIP_AMBIGUOUS_NAME` | flat or shared name: AdminP is unsafe; decide on DIRECT after review |
| `SKIP_IN_OPEN_BATCH` | finish the batch first |
| `SKIP_KEEPER_MAIL_MISSING` | repair mail first (step 4) |

3. Business owner approves the `WOULD_REMOVE` list. Write down name and date.
4. Set `DryRun=0`, run 12, type `REMOVE`. It stops after `DuplicateMaxDelete` removals: dry run and live run again for the rest.
5. Snapshots of each removed document are in `<PasswordDir>\DEDUP_<run>\`. This folder is sensitive (it can hold password hashes): keep it restricted. AdminP needs a few minutes: check the Administration Requests database.
6. Set `DryRun=1` again.

## Step 4: registered but no mail file

1. `MailTemplate` is set in `bulkreg.ini`.
2. **08 - Repair Missing Mail Files**, `DryRun=1`, scope empty or `RECON_<run>_gaps.csv`. Read `*_mailrepair_DRYRUN_<run>.csv` (`WOULD_CREATE`).
3. `DryRun=0`, run 08, type `REPAIR`. Results: `MAIL_CREATED` or `CREATED_PENDING` (AdminP still working).
4. **04 - Verify Registration and Vault.** Repeat until every user is `IN_VAULT`, `MAILFILE_OK`, `REPLICAS_OK`.

## Step 5: close out

1. **09 - Reconcile** again: `_gaps.csv`, `_duplicates.csv`, `_duplicate_ids.csv`, `_missing_mail.csv` are empty. Anything left gets a written owner.
2. Hand over the initial passwords from `secure\`, then delete them there through your normal process.
3. `DryRun=1`. Delete `STOP.txt` if you created one.

## Stop and escalate

On a suspected security incident (unexpected certificates or IDs, a password or ID file outside its folder, vault inconsistencies across many users), do not self-remediate. Create `STOP.txt` in `BatchDir` and contact the Domino or security owner.
