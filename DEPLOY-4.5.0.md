# BulkReg 4.5.0 – Deployment steps (several machines)

Upgrade from 4.4.0 (or any release covered by `DEPLOY-4.4.0.md`; do those steps first when coming from older than 4.4.0). Only the two script libraries change: `BulkRegCommon` first, then `BulkRegAgents`. No new agent; the agent files only changed their version comment. Replace `bulkreg.ps1` and `bulkreg.cmd`, add the two new helper scripts, keep your own `bulkreg.ini` and `server_mapping.csv`.

Do this **on every machine** that runs BulkReg (each has its own local `bulkreg.nsf` and `bulkreg.ini`). `<KIT>` is the folder holding the 4.5.0 kit (`lotusscript\`, `config\`, `scripts\`). Run PowerShell in a normal (non-elevated) window. Full background and the data list: `PLAYBOOK-post-deploy-4.5.0.md`.

## 1. Get exactly the same kit onto every machine

On the machine that has the kit (A):

```powershell
New-Item -ItemType Directory -Force 'C:\BulkReg\transfer' | Out-Null
Compress-Archive -Path '<KIT>\*' -DestinationPath 'C:\BulkReg\transfer\bulkreg-kit-4.5.0.zip' -Force
Get-FileHash 'C:\BulkReg\transfer\bulkreg-kit-4.5.0.zip' -Algorithm SHA256 | Format-List Hash, Path
```

Copy the zip to the other machine through an **approved internal channel** (internal file share or encrypted removable drive; not email or external services). On the other machine (B):

```powershell
Get-FileHash '<path>\bulkreg-kit-4.5.0.zip' -Algorithm SHA256     # must equal the hash shown on A
Expand-Archive '<path>\bulkreg-kit-4.5.0.zip' -DestinationPath '<KIT>' -Force
```

A different hash means a damaged or changed copy: delete it and copy again.

## 2. Before you change anything (each machine)

1. Run **11 - Batch Manager** and note every batch that is `OPEN`, `STOPPED` or `DONE_INCOMPLETE`. Finish or stop cleanly (`bulkreg Stop`) any running batch.
2. Back up the local `bulkreg.nsf`, `config\bulkreg.ini`, `config\server_mapping.csv`, and the folders `batches\`, `audit\`, `secure\`, `ids\`, `reconcile\` (`robocopy`, see the playbook section 3). The backup holds passwords and ID files: encrypted disk, restricted access.
3. Collect the evidence pack of the old version (`BulkReg_CollectEvidence.ps1`, playbook section 2.4).

## 3. Paste the libraries (Designer, each machine)

Put a library on the clipboard without opening it in an editor that may change it:

```powershell
Get-Content -LiteralPath '<KIT>\lotusscript\BulkRegCommon.lss' -Raw -Encoding UTF8 | Set-Clipboard
```

1. Open the local `bulkreg.nsf` in **Domino Designer**.
2. **Script Libraries > BulkRegCommon**: click in the editor, `Ctrl+A`, `Ctrl+V`, `Ctrl+S`. **Common first.**
3. Repeat the clipboard command with `BulkRegAgents.lss`; **Script Libraries > BulkRegAgents**: click in the editor, `Ctrl+A`, `Ctrl+V`, `Ctrl+S`.
4. **Tools > Recompile All LotusScript**. On a compile error, note the exact message and line and stop; do not change the code on one machine only.
5. Re-sign the database with the same ID as before (guide B17a).
6. Run **01 - Preflight**: `RUN_INFO.txt` in the new audit folder must show `BulkReg 4.5.0` and a `Machines :` line.

## 4. Configuration (each machine)

```powershell
cd '<KIT>\scripts\windows'
.\bulkreg.cmd IniCompare
.\bulkreg.cmd IniUpgrade          # preview
.\bulkreg.cmd IniUpgrade -Yes     # adds MachineId, PartitionCount=1, PartitionIndex=1, PartitionOverride=0; your values stay
```

Leave `PartitionCount=1` until the clean-up of old batches is finished.

## 5. Switch partitioning on (only when no old batch is still open)

1. **Finish or close every OPEN batch first** (agent 11). Batches built before partitioning contain users of both partitions; 03 refuses them once `PartitionCount` is above 1. The compare script's `2_partition_preview.csv` shows which batches would be refused.
2. Same `PartitionCount` everywhere, a different `PartitionIndex` per machine:

    | Machine | PartitionCount | PartitionIndex | MachineId (optional) |
    |---|---|---|---|
    | 1 | 2 | 1 | `A` |
    | 2 | 2 | 2 | `B` |

    Adding a third machine later means changing `PartitionCount` to 3 on **all** machines at once, with no open batch.
3. Run **01 - Preflight** on each machine. In `_batchplan.txt` the line *other machine's partition (excluded)* is about half of the candidates and the *Users to register* lines of the machines add up to the total.
4. Pilot with `BatchSize=2`, `DryRun=1` on both machines at the same time: `BATCH-<run>-A-01.csv` and `BATCH-<run>-B-01.csv` must not share a single user (compare the `UNID` column).

## 6. Check that both machines match

```powershell
.\BulkReg_CollectEvidence.ps1 -Machine A -KitDir '<KIT>\lotusscript'      # on A; use -Machine B on B
.\BulkReg_CompareMachines.ps1 -PackA '<path>\A_<stamp>' -PackB '<path>\B_<stamp>' -PartitionCount 2 -IndexA 1 -IndexB 2
```

`3_config_compare.csv` and `4_kit_compare.csv` must show no `PROBLEM`, `DIFFERENT` or `MISSING`.

## Status and rollback

Not tested against Domino; the helper scripts were written without PowerShell available to run them. The code was checked for block balance, and the partition rule was simulated outside Domino (20,000 random UNIDs: each in exactly one partition, 50/50 within 1 % for 2 machines). Treat step 5.4 as the acceptance test.

Rollback: set `PartitionCount=1` on all machines (behaviour of 4.4.0), or paste the 4.4.0 libraries from git.
