# BulkReg 4.6.0 - upgrade from 4.5.0 (or older)

4.6.0 adds agent **12 - Remove Duplicates**, agent **13 - Recover Users** (new library `BulkRegRecover`) and helper scripts. Agents 00-11 behave as before. Do this on **every machine that runs BulkReg**, so all machines report the same version.

> Not compiled or run against Domino. Keep `DryRun=1` until the pilot in `SOP-recover-failed-users.md` has passed.

| # | Do | Check |
|---|---|---|
| 1 | Pull the kit: Mac `scripts/mac/sync_to_github.sh`, Windows `scripts\windows\BulkReg_SyncFromGitHub.ps1` (or copy the folder) | `VERSION` says 4.6.0 |
| 2 | Designer: paste **`BulkRegCommon.lss`**, then **`BulkRegAgents.lss`** (Ctrl+A, Delete, paste, Ctrl+S) | Both save without error |
| 3 | Designer: new script library **`BulkRegRecover`**, paste `lotusscript/BulkRegRecover.lss` | Saves |
| 4 | Agents: `BulkReg\12 - Remove Duplicates` (if not there yet) and new `BulkReg\13 - Recover Users`: paste `Agent12_RemoveDuplicates.lss`, `Agent13_Recover.lss`. Shared agents, Action menu selection, Target None | Names appear under Actions > BulkReg |
| 5 | **Tools > Recompile All LotusScript**, re-sign the database | No compile errors. Fix any, do not run |
| 6 | `scripts\windows\bulkreg.cmd IniCompare`, then `IniUpgrade -Yes` | Your `bulkreg.ini` gains the new keys; your values are untouched |
| 7 | `scripts\windows\bulkreg.cmd Versions` | Every line PASS (the Admin Guide HTML still shows 4.4.0: known) |
| 8 | Run any agent with `DryRun=1`, open the debug log | First line shows `==== BulkReg 4.6.0` |

Roll back: delete agents 12/13 and the library `BulkRegRecover`, paste the 4.5.0 versions of the two libraries.
