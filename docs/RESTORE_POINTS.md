# Restore points and release checkpoints

This file records source-code checkpoints that can be used to compare or recover application changes. It does not replace MongoDB backups or Cloudinary asset retention.

## Protected baseline — before documentation overhaul

**Restore branch created and verified on 7 November 2026.**

| Item | Value |
|---|---|
| Repository | Ujjwal0620/RCLD_ISLAMPUR |
| Integration branch | main |
| Restore branch | restore/2026-11-07-pre-documentation |
| Baseline commit | 6823ea161e00a404e825605688dc9014ed8bfe3b |
| Purpose | Preserve the source tree before the documentation overhaul |
| Source URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/restore/2026-11-07-pre-documentation |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/6823ea161e00a404e825605688dc9014ed8bfe3b |

## Documentation completion checkpoint

**Checkpoint branch created after the documentation overhaul on 7 November 2026.**

| Item | Value |
|---|---|
| Branch | checkpoint/2026-11-07-documentation-complete |
| Source commit | a44fc9f5ec0a65a914829064314102d909674814 |
| Purpose | Preserve the completed documentation set |
| Branch URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/checkpoint/2026-11-07-documentation-complete |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/a44fc9f5ec0a65a914829064314102d909674814 |

The checkpoint branch points to the main commit at the end of the documentation work. The restore branch above remains at the pre-documentation baseline.

Neither branch is a copy of the database, local environment files or Cloudinary assets.


## Pre-Hando UI restore point

**Restore branch created before the Hando-inspired workspace refresh on 7 November 2026.**

| Item | Value |
|---|---|
| Branch | restore/2026-11-07-before-hando-ui |
| Baseline commit | bb3027f1afbe7ad4ae88f6abe0ae376604037d04 |
| Purpose | Preserve the complete application and documentation before the UI/UX-only redesign |
| Branch URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/restore/2026-11-07-before-hando-ui |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/bb3027f1afbe7ad4ae88f6abe0ae376604037d04 |


## Hando UI refresh checkpoint

**Checkpoint branch created after the Hando-inspired UI/UX refresh and design guide were committed on 7 November 2026.**

| Item | Value |
|---|---|
| Branch | checkpoint/2026-11-07-hando-ui-refresh |
| Source commit | 2330ca0e61ed2ad8ab34fac39cf19241dbe0535e |
| Purpose | Preserve the Hando-inspired UI layer, shared ERP shell refinements and UI/UX design guide |
| Branch URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/checkpoint/2026-11-07-hando-ui-refresh |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/2330ca0e61ed2ad8ab34fac39cf19241dbe0535e |

The checkpoint is a source-code snapshot. It does not include a MongoDB backup, local secrets or Cloudinary assets.

## Checkpoint policy

Create a named restore branch before:
- MongoDB schema migrations or bulk data transformations;
- changes to fee/payment calculations or receipt history;
- changes to batch timetable generation or student movement;
- authentication/session redesign;
- broad layout or routing refactors;
- dependency/framework upgrades.

Use a descriptive name such as restore/YYYY-MM-DD-before-fee-migration. Record the branch, source commit, reason and verification status in this file.

## What a Git checkpoint protects

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
