# Restore points and release checkpoints

This file records source-code checkpoints that can be used to compare or recover application changes. It does not replace MongoDB backups or Cloudinary asset retention.

## Protected baseline — 7 November 2026

**Restore branch created and verified.**

| Item | Value |
|---|---|
| Repository | Ujjwal0620/RCLD_ISLAMPUR |
| Integration branch | main |
| Restore branch | restore/2026-11-07-pre-documentation |
| Baseline commit | 6823ea161e00a404e825605688dc9014ed8bfe3b |
| Purpose | Preserve the source tree before the documentation overhaul |
| Source URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/restore/2026-11-07-pre-documentation |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/6823ea161e00a404e825605688dc9014ed8bfe3b |

The restore branch was created from the exact main commit listed above. It is not a copy of the database and it does not contain a separate backup of environment files or Cloudinary assets.

## Checkpoint policy

Create a named restore branch before:
- MongoDB schema migrations or bulk data transformations;
- changes to fee/payment calculations or receipt history;
- changes to batch timetable generation or student movement;
- authentication/session redesign;
- broad layout or routing refactors;
- dependency/framework upgrades.

Use a descriptive name such as restore/YYYY-MM-DD-before-fee-migration. Record the branch, source commit, reason and verification status in this file.

## What a restore point protects

| Asset | Protected by Git branch? |
|---|---|
| Tracked application source | Yes |
| Documentation committed at that point | Yes |
| package manifest and lockfile, if tracked | Yes |
| Local .env.local and secrets | No |
| MongoDB records | No |
| Cloudinary files | No |
| Uncommitted local changes | No |

## Recovery guidance

For a source-only recovery, compare the restore branch with main first. Prefer a revert commit when only one change is faulty. If a full rollback is necessary, review the impact and coordinate it as a deliberate main-branch operation.

Never assume a source rollback will reverse database writes. Restore MongoDB from a separately verified backup if data recovery is required.

## Future checkpoint entry template

- Date:
- Branch:
- Commit SHA:
- Reason:
- Database backup reference (do not store credentials):
- Verification performed:
- Known limitations:
