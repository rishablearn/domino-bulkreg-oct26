# SOP: Wipe failed (unregistered) users with agent 14

**DRAFT, not compiled or run against Domino.** Pilot with 3 to 5 test users first. Deleting is irreversible: get written approval from the business owner and take a `names.nsf` backup before any live run.

## What it deletes (and what it never does)

- Deletes: the **unregistered** Person documents you list, through an AdminP `DeleteUser` request, plus the mail file (all replicas) when it is provably the user's own and nearly empty.
- Never: registered users (`SKIP_REGISTERED`), the ID vault entry (retained), ID files, or anything not in your CSV.
- A name shared with another person (a duplicate of a registered user) is `SKIP_AMBIGUOUS_NAME`: AdminP deletes by name and could hit the other person. Use **12 - Remove Duplicates** for those.

## Steps

| # | Do | Result |
|---|---|---|
| 1 | Build the CSV: columns `NoteID`, `Include`. Put `Y` only on the rows to delete (a `_gaps.csv`, plan or duplicates file can be edited this way) | The list you approve |
| 2 | `DryRun=1`. Run **14 - Delete Users** | `DELETE_DRYRUN_<run>.csv`: `WOULD_DELETE` or `SKIP_*` with the reason |
| 3 | Business owner approves the `WOULD_DELETE` rows. Write down name and date | Approval |
| 4 | Back up `names.nsf`. Set `DryRun=0`, `DeleteUserMaxPerRun=5`, run 14, type `DELETEUSERS` | Snapshots in `<PasswordDir>\DELETE_<run>\`, request IDs in `<ReconcileDir>\DELETE_requested.txt` |
| 5 | Wait a few minutes. Check `admin4.nsf` (Delete in Address Book, then the mail file requests) and run 09 - Reconcile | Documents gone, mail files gone |
| 6 | Remove `DeleteUserMaxPerRun=5`, repeat steps 2 to 5 for the rest. Set `DryRun=1` again | Clean slate |

## Skip reasons

| Skip | Meaning |
|---|---|
| `SKIP_REGISTERED` | has a certificate: never deleted by 14 |
| `SKIP_IN_OPEN_BATCH` | finish or close the batch first (11 - Batch Manager) |
| `SKIP_HAS_IDFILE` | an ID file exists: check the registration log and the vault |
| `SKIP_ALREADY_REQUESTED` | already sent to AdminP: see `DELETE_requested.txt` |
| `SKIP_NEEDS_HIERARCHICAL_NAME`, `SKIP_AMBIGUOUS_NAME` | AdminP by name is unsafe: review by hand |
| `SKIP_MAIL_SHARED` | another Person document uses the same mail path |
| `SKIP_MAIL_HAS_DATA` | mail file holds more than `DeleteUserMailMaxDocs` documents |
| `SKIP_MAIL_NOT_CHECKED` | the mail file could not be opened or the path index could not be built |

## Stop and escalate

Create `STOP.txt` in `BatchDir` to stop after the current chunk. On a suspected security incident (unexpected certificates or IDs, a password or ID file outside its folder), do not self-remediate: create `STOP.txt` and call the Domino or security owner.

## Roll back

Delete the agent and the library `BulkRegDelete`. A deleted Person document can only be restored from its DXL snapshot or the `names.nsf` backup; a deleted mail file only from a mail backup.
