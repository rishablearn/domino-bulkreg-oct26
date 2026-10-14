# BulkReg 4.0.1 – Deployment steps

Upgrade from 3.6.6 up to 4.0.0. Libraries `BulkRegCommon` and `BulkRegAgents` change, plus the config files. Everything runs locally in the Notes client. The agents are unchanged (only the version comment in their header).

**4.0.1 change (unique last name):** `LastName` is built as `<LastNameField> + "-" + <ShortName or sAMAccountName>` in upper case, e.g. JobTitle `analyst` + short name `jdoe` -> `ANALYST-JDOE` -> Notes name `ANALYST-JDOE/Demo`. The generated value is copied to the Person item `Location` after the registered name was verified. `JobTitle`, `Department` and the other source items are never changed. New keys (add to your ini from `config/bulkreg.ini`): `LastNameSuffixFields`, `LastNameSeparator`, `LastNameUppercase`, `LastNameBackupField`, `LastNameBackupOverwrite`. `Location` is not allowed as a MatchField in `server_mapping.csv` (the run stops if a rule uses it). Users already registered are never renamed. New ERRORs: no usable suffix, `OrgUnit` equal to the organization (would give `/Demo/Demo`). The run stops (REGISTERED_WRONG_NAME) when the registered common name differs from the generated one.

**AutoSync removed:** 4.0.0 shipped an unattended server agent; it is deleted in 4.0.1. If you installed it, delete the `BulkReg\07 - AutoSync` agent, the `BulkRegAuto` library and `bulkreg_auto.nsf` from the server.

**3.9.3 change:** `HomeServerAssignment=FILL` (first server 2500, then the second); new `OverrideADInternetAddress=0` in `bulkreg.ini`.

**3.9.2 change:** the registration last name is the Person item `JobTitle` (`LastNameField=JobTitle`), used exactly as it is; no name is constructed, split or stripped. `FullNameField`, `RankHandling`, `RankPrefixes` and `IncludeMiddleInitial` no longer exist: remove them from your ini and add `LastNameField=JobTitle`, `FirstNameField=`, `MiddleNameField=` from `config/bulkreg.ini`.

**3.9.0 additions** (if you already run 3.8.0): `PreflightScope=ALL` (default), `BuildMaxBatches`. Build Batch now writes `BATCH-<run>-01.csv`, `-02.csv` ...; batch files and audit rows have `FullNameAfter`. Add the new settings from `config/bulkreg.ini` to your own ini; open batches built with 3.8.0 still register.

**3.8.0 additions** (if you already run 3.7.0): detected server platform (check the `Server X: ...` lines in Preflight), `ServerOSDetect`, `ServerOSMap`, `RegisterCreateMailDb`. Add them from `config/bulkreg.ini` to your own ini.

**Status:** the code was reviewed and checked for block balance and consistency, but **not compiled or run against Domino**. Treat the pilot in step 6 as the acceptance test.

## 1. Before you start

- **Rebuild OPEN batches.** Register re-reads each Person document and applies the current naming rule, so a batch file built with an older release shows the old `LastName` / `FullNameAfter`. Run 02 - Build Batch again before registering.

- Back up the current `bulkreg.nsf`, `config\bulkreg.ini` and `config\server_mapping.csv`.
- No batch should be half-registered. Finish or leave closed any OPEN batch. Open batches built with 3.6.6 still work; their users count towards the server capacity.
- Have ready: the two mail server names and the internet domain (e.g. `<demo.com>`).

## 2. Prepare the Linux mail servers (both)

Create the folders directly under the data directory, owned by the Domino user. 2500 users per server at 1000 per folder = 3 folders:

```bash
for i in 1 2 3; do mkdir -p /local/notesdata/mail$i; done
chown -R <domino-user>:<domino-group> /local/notesdata/mail*
```

Preflight (step 5) writes the exact commands for your numbers to `_mailfolders.txt`. The existing `mail` folder stays untouched.

## 3. Install the libraries (Designer)

1. Open the local `bulkreg.nsf` in Designer.
2. Script Libraries > **BulkRegCommon**: click in the editor, Ctrl+A, paste the whole `lotusscript/BulkRegCommon.lss`, Ctrl+S.
3. Script Libraries > **BulkRegAgents**: same with `lotusscript/BulkRegAgents.lss`. Do the Common library first.
4. Tools > **Recompile All LotusScript**. If a compile error appears, note the exact message and line and report it before changing anything.
5. Re-sign the database with the same ID as before (guide B17a).
6. Optional: paste the six `Agent0x_*.lss` files to refresh the version comment. No functional change.

## 4. Update the configuration

Either add the settings below to your existing `C:\BulkReg\config\bulkreg.ini` and `server_mapping.csv`, or copy the new files from `config/` and re-enter your values (paths, `RegistrationServer`, `CertifierName`, `VaultServer`, `LogServer`, policy). Do not just overwrite them:

**a. Servers and distribution**

```ini
ServerOS=LINUX
ServerDataDir=/local/notesdata
ServerOSMap=
HomeServers=<DominoADMail/Demo>,<DominoADMail2/Demo>
HomeServerMaxUsers=2500
HomeServerAssignment=BALANCED
MailFolderPrefix=mail
MailFilesPerFolder=1000
MailFolderMax=3
MailClusterServers=
```

Each server's platform is detected automatically (`ServerOSDetect=1`); Preflight logs it per server (`Server X: WINDOWS (detected from the server)`) and warns if `ServerOS` disagrees. `ServerOS` is only the fallback. For Windows servers use `ServerOS=WINDOWS`; for a mix list the exceptions, e.g. `ServerOSMap=DominoADMail/Demo:LINUX,DominoADMail2/Demo:WINDOWS`. Preflight logs the form used. A wrong value is a likely cause of registration/mail-file path errors.

Keep `MailClusterServers` empty unless the two servers form a mail cluster. In a cluster, set `MailFolderMax=5` instead (guide B12.7).

**b. Internet address**

```ini
ConstructInternetAddress=1
InternetDomain=<demo.com>
```

**c. Short name.** The AD samaccountname maps to the Person item `ShortName` (a text list), so the default `ShortNameFields=ShortName` is correct. BulkReg looks at every value of the list and takes the first one without blanks, `/` or `=` that is not "First Last". If no value qualifies, the user gets an ERROR (`ShortName ... looks like a full name`).

**c2. Registration name (4.0.1).**

```ini
LastNameField=JobTitle
LastNameSuffixFields=ShortName,sAMAccountName
LastNameSeparator=-
LastNameUppercase=1
LastNameBackupField=Location
LastNameBackupOverwrite=1
FirstNameField=
MiddleNameField=
```

Result: JobTitle `analyst`, short name `jdoe` -> last name `ANALYST-JDOE`, Notes name `ANALYST-JDOE/Demo` (no first name). A user with an empty JobTitle or no usable suffix gets an ERROR. Check the `FullNameAfter` column of the Preflight audit CSV in the pilot: the organization must appear once (`ANALYST-JDOE/Demo`, never `/Demo/Demo`). Remove any `Location` rule from `server_mapping.csv`.

**d. Mapping file.** The only active line must be:

```
*;*;AUTO;;;;;
```

**e. Remove every `<placeholder>`.** The agents refuse to start while `HomeServers`, `InternetDomain` or a mapping rule still contains one.

## 5. Check with Preflight (no changes to Domino)

Run **01 - Preflight Check**, DryRun setting irrelevant. Open the run folder under `C:\BulkReg\audit\` and confirm:

| File | What to look for |
|---|---|
| `_batchplan.txt` | Total users, number of batches of 1000, about 500/500 per batch on the two servers, planned total about 2500/2500 |
| `_mailfolders.txt` | `mail1..mail3` on each server, with the mkdir/chown commands for `/local/notesdata` |
| audit CSV | `ShortName` column shows `102939ops`-style values; no `ERROR: ShortName ... looks like a full name` |
| `_mapping.txt` | The AUTO rule matched all users |

## 6. Pilot (2 users), then production

1. Set `BatchSize=2`, `DryRun=1`. Run **02 - Build Batch**. In `BATCH-<id>.csv` check: `ShortName`, `InternetAddress` with `InetSource=CONSTRUCTED` where AD had none, `HomeServer` different for the two rows, `MailFile` like `mail1/<name>.nsf`, `NotesName` and `FullNameAfter` like `ANALYST-JDOE/Demo`.
2. Run **03 - Register Batch** (dry run, WOULD_REGISTER). Then `DryRun=0` and run it live on the same batch, typing the batch ID.
3. Run **04 - Verify**. In the Person documents confirm `MailServer`, `MailFile` (`mail1/<shortname>.nsf`), `ShortName`, `InternetAddress`, `Location` = the generated last name (`JobTitle` and `Department` unchanged), and that the file exists under `/local/notesdata/mail1/` on the right server.
4. Set `BatchSize=1000`, `DryRun=1`, and run the normal cycle from the README: 02, review, 03 dry run, `DryRun=0`, 03, 04. Repeat 5 times. Re-run 01 occasionally; its plan shrinks as users are registered.

## 7. What to watch

- `Users without a free home server` in Preflight above 0 means `HomeServerMaxUsers` is reached on both servers.
- The constructed internet address is written to the Person document by the registration. You confirmed DirSync does not overwrite it; still check it on the pilot users.
- With `BatchServerFilter` set, the other server's users are counted but not built; leave it empty with the pool.

## 8. Rollback

Restore the backed-up `bulkreg.nsf` (or paste the 3.6.6 libraries from commit `265e39d`) and the old `.ini` / `.csv`. Batches built with 3.8.0 or later have an extra `InetSource` column and an AUTO-assigned `HomeServer`; 3.6.6 reads them correctly. Users already registered stay registered.
