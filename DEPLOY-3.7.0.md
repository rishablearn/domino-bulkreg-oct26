# BulkReg 3.7.0 – Deployment steps

Upgrade from 3.6.6. Libraries `BulkRegCommon` and `BulkRegAgents` change, plus two config files. The six agents are unchanged (only the version comment in their header).

**Status:** the code was reviewed and checked for block balance and consistency, but **not compiled or run against Domino**. Treat the pilot in step 6 as the acceptance test.

## 1. Before you start

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
HomeServers=<DominoADMail/Demo>,<DominoADMail2/Demo>
HomeServerMaxUsers=2500
HomeServerAssignment=BALANCED
MailFolderPrefix=mail
MailFilesPerFolder=1000
MailFolderMax=3
MailClusterServers=
```

Keep `MailClusterServers` empty unless the two servers form a mail cluster. In a cluster, set `MailFolderMax=5` instead (guide B12.7).

**b. Internet address**

```ini
ConstructInternetAddress=1
InternetDomain=<demo.com>
```

**c. Short name.** The AD samaccountname maps to the Person item `ShortName` (a text list), so the default `ShortNameFields=ShortName` is correct. BulkReg looks at every value of the list and takes the first one without blanks, `/` or `=` that is not "First Last". If no value qualifies, the user gets an ERROR (`ShortName ... looks like a full name`).

**c2. Full name.** `FullNameField=DisplayName` (default). The first value of DisplayName is split at its last blank: "Mary Ann Smith" becomes first name "Mary Ann", last name "Smith", Notes name `Mary Ann Smith/Demo`. A one-word DisplayName gives a last name only and a WARN. Check the `NotesName` column of the batch file in the pilot.

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

1. Set `BatchSize=2`, `DryRun=1`. Run **02 - Build Batch**. In `BATCH-<id>.csv` check: `ShortName`, `InternetAddress` with `InetSource=CONSTRUCTED` where AD had none, `HomeServer` different for the two rows, `MailFile` like `mail1/<name>.nsf`, `NotesName` like `Abc xyz/Demo`.
2. Run **03 - Register Batch** (dry run, WOULD_REGISTER). Then `DryRun=0` and run it live on the same batch, typing the batch ID.
3. Run **04 - Verify**. In the Person documents confirm `MailServer`, `MailFile` (`mail1/...`), `ShortName`, `InternetAddress`, and that the file exists under `/local/notesdata/mail1/` on the right server.
4. Set `BatchSize=1000`, `DryRun=1`, and run the normal cycle from the README: 02, review, 03 dry run, `DryRun=0`, 03, 04. Repeat 5 times. Re-run 01 occasionally; its plan shrinks as users are registered.

## 7. What to watch

- `Users without a free home server` in Preflight above 0 means `HomeServerMaxUsers` is reached on both servers.
- The constructed internet address is written to the Person document by the registration. You confirmed DirSync does not overwrite it; still check it on the pilot users.
- With `BatchServerFilter` set, the other server's users are counted but not built; leave it empty with the pool.

## 8. Rollback

Restore the backed-up `bulkreg.nsf` (or paste the 3.6.6 libraries from commit `265e39d`) and the old `.ini` / `.csv`. Batches built with 3.7.0 have an extra `InetSource` column and an AUTO-assigned `HomeServer`; 3.6.6 reads them correctly. Users already registered stay registered.
