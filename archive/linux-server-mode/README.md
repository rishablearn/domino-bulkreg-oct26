# Archived: Linux / RHEL server (headless) mode

BulkReg is operated **only from the Windows Domino Administrator client** (decision October 2026).
These files belong to the earlier server-mode design (BulkReg 1.1.0) and are **not used** by the current kit:

- `bulkreg.sh` – Linux admin helper (init, check, arm/disarm, status, purge-secrets)
- `bulkreg.linux.ini` – Linux config template

The server-mode code paths were removed from the LotusScript in BulkReg 1.2.0.
To restore the full 1.1.0 design, check out commit `ca40577`.
