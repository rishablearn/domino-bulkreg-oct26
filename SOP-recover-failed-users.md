# SOP: Recover failed and missing users

**One rule:** the Domino Directory is the truth. Agent **13 - Recover Users** looks at the directory and the mail servers, works out what is missing, and fixes it. Run it again as often as you like: it only does what is still missing and never overwrites a mail file.

> Agent 13 is **not compiled or run against Domino yet**. Do the pilot (step 3) before the full run.

## What happens to each user

| 13 finds | What it does |
|---|---|
| Registered, mail file missing | **Creates it** |
| Mail file is an empty, cut-off shell | **Replaces it** (needs `RepairRemoveEmptyShells=1`) |
| Mail file fine | Nothing |
| Not registered | Lists it only. Register with **02 + 03** |
| Anything else (no mail item, server down, file with data but no design) | Lists it as `MANUAL` with the reason. You fix it by hand |

The list is `RECOVER_<run>_plan.csv`. `Include=Y` rows are fixed by 13. `MANUAL` and `REGISTER` rows are left to you.

## Steps (one machine)

1. **Dry run.** `DryRun=1`. Run **13 - Recover Users**, leave the scope empty. Read the counts and the plan CSV.
2. **Agree the plan.** Set `Include=N` on rows you do not want touched.
3. **Pilot.** Add `RecoverMaxCreates=10` to `bulkreg.ini`, set `DryRun=0`, run 13, type `RECOVER`. Check 2 to 3 of the 10 users in Domino Administrator (file exists, mail opens).
4. **Full run.** Remove `RecoverMaxCreates`, run 13, type `RECOVER`. If it stops (`SLOW`, `STOP.txt`, time limit, error), fix the cause and **run it again**. It continues.
5. **Proof.** Set `DryRun=1` and run 13. It must say **nothing for this agent to do**. Then register the `NOT_REGISTERED` users with 02 + 03 (if `Detail` names an open batch, use **11 - Batch Manager**: `RESUME <id>`, then 03), and run 13 once more for their mail files.

Finish: hand over initial passwords from `secure\`, then delete them. Set `DryRun=1`.

## Two machines

Set once: Machine A `PartitionCount=2`, `PartitionIndex=1`. Machine B `PartitionCount=2`, `PartitionIndex=2`. Each machine then handles its own half of the users and never the other's.

1. Both machines use the **same** `DirectoryServer` and the same kit.
2. Dry run on both. **"Directory users scanned" must be the same number.** If not, stop and let the directory replicate.
3. Pilot, then full run on both at the same time. If you start a second run on the same partition, 13 warns you and asks.
4. Proof: step 5 on each machine.

If a machine crashed, its run stays "running" in the log database. Start 13 again and answer **Yes** to the warning only if you are sure that run is over. Passwords and ID files stay on the machine that registered the user.

## If it is slow or hangs

- 13 writes `RECOVER_<run>_timing.csv`: seconds per create. Look at `SecCreate`.
- It **stops itself** after 3 creates over 60 s in a row, or after 120 minutes. Run it again later.
- Likely causes (not confirmed): server busy (backup, indexer, compact), antivirus scanning the mail folders, client far from the server. Run the Notes client next to the servers, outside backup windows, and ask the security owner about excluding the mail folders from on-access scanning.
- After a hang or closed client: run 13 again. Cut-off files show up as empty shells and are replaced.

## Stop and escalate

Create `STOP.txt` in `BatchDir` to stop cleanly. For a suspected security incident (unexpected certificates or IDs, a password or ID file outside its folder), do not fix it yourself: create `STOP.txt` and call the Domino or security owner.

## Install and roll back

Install: new library `BulkRegRecover` (paste `lotusscript/BulkRegRecover.lss`), new agent `BulkReg\13 - Recover Users` (paste `lotusscript/Agent13_Recover.lss`), re-sign, recompile. Optionally re-paste `BulkRegCommon` (two label lines only). Roll back: delete the agent and the library.

Optional ini keys (defaults are built in, you normally set none): `RecoverMaxCreates` (cap per run), `RecoverMaxMinutes` (120), `RecoverCheckReplicas` (0; set 1 once at the end on a cluster to find missing replicas).

## Get changes from GitHub (Windows)

In PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\windows\BulkReg_SyncFromGitHub.ps1 -DryRun` shows what is new; run it without `-DryRun` to pull. It only fast-forwards, never overwrites local changes, never touches `C:\BulkReg`, and lists the `.lss` files you must paste into Designer afterwards.

## Send changes to GitHub (Mac)

Run `scripts/mac/sync_to_github.sh` from Terminal. It shows what changed and asks before anything is committed or pushed. Details in the script header.
