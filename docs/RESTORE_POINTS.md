# Restore points and release checkpoints

This file records source-code checkpoints that can be used to compare or recover application changes. It does not replace MongoDB backups or Cloudinary asset retention.

## Latest checkpoint — compact dashboard UI

**Checkpoint branch created on 12 November 2026 from main.**

| Item | Value |
|---|---|
| Repository | Ujjwal0620/RCLD_ISLAMPUR |
| Integration branch | main |
| Checkpoint branch | checkpoint/2026-11-12-compact-dashboard-ui |
| Source commit | 707b3c90c468d42fbcd4c69efdf8e81f82b9d27d |
| Purpose | Preserve the compact Hando-style dashboard density pass, chart accessibility labels/tooltips and current shared UI baseline |
| Branch URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/checkpoint/2026-11-12-compact-dashboard-ui |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/707b3c90c468d42fbcd4c69efdf8e81f82b9d27d |
| Verification | GitHub branch created; local lint/build/browser checks not run in this checkpoint |

This checkpoint preserves tracked source at the listed commit. It does not include MongoDB records, local secrets, uncommitted changes or Cloudinary assets.

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


## Documentation refresh checkpoint

**Checkpoint branch created on 12 November 2026 after the documentation refresh.**

| Item | Value |
|---|---|
| Branch | checkpoint/2026-11-12-documentation-updated |
| Source commit | 3584cb86552ab1ece483fdd7ba17be9a7c1e42cd |
| Purpose | Preserve the updated UI/UX guide, engineering workflow and implementation audit |
| Branch URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/tree/checkpoint/2026-11-12-documentation-updated |
| Commit URL | https://github.com/Ujjwal0620/RCLD_ISLAMPUR/commit/3584cb86552ab1ece483fdd7ba17be9a7c1e42cd |
| Verification | Documentation files committed and checkpoint branch created; application lint/build/browser checks not run |

The checkpoint branch was created from main immediately after the documentation refresh commits. This entry is a later log update on main; the branch intentionally preserves the documentation state immediately before this self-referential log entry.


## Upcoming delivery checkpoints

Tick a checkpoint only after the related workflow is implemented, verified against representative data and documented. A page or API route alone is not sufficient evidence of completion.

### Milestone 1 — Security baseline
- [ ] Remove source-code fallback Super Admin credentials.
- [ ] Require a strong AUTH_SECRET in every deployed environment.
- [ ] Remove plain-text password compatibility and define a safe legacy-password migration.
- [ ] Audit every API route for session, role, permission and record-level authorization.
- [ ] Protect or disable development utility endpoints in production.
- [ ] Test both allowed and denied access paths.

### Milestone 2 — Student identity and admission
- [ ] Complete student login and student-scoped session identity.
- [ ] Finalize registration-to-enrollment data relationships.
- [ ] Enforce separate online and offline student workflows.
- [ ] Verify student lifecycle status transitions and batch movement history.

### Milestone 3 — Fees and payment integrity
- [ ] Implement Super Admin-controlled discount approval.
- [ ] Finalize installment and fee-plan rules.
- [ ] Verify receipts, partial payments, payment history and outstanding calculations.
- [ ] Complete PhonePe signature-verified callbacks/webhooks, idempotency and reconciliation before activating paid enrollments.

### Milestone 4 — Academic delivery
- [ ] Verify Course → Subject → Chapter mapping end to end.
- [ ] Verify Course → Main Batch → Batch Series → Schedule mapping and timetable conflict rules.
- [ ] Complete subject/faculty assignment and chapter-progress tracking.
- [ ] Implement exams, results and certificates.

### Milestone 5 — Employee and institute operations
- [ ] Complete employee role/permission administration and enforcement.
- [ ] Verify employee attendance, breaks, official/personal out-time and leave workflows.
- [ ] Verify employee task assignment and employee dashboard visibility.

### Milestone 6 — Operational readiness
- [ ] Complete CRM enquiry/follow-up/admission-conversion workflows.
- [ ] Complete audit logging, notifications and operational monitoring.
- [ ] Add safe, repeatable demo-data seed and cleanup scripts.
- [ ] Add automated tests for fees, timetable conflicts, access control and migrations.
- [ ] Verify responsive behavior and receipt print preview.
- [ ] Run npm run lint and npm run build; record results and unresolved failures.
- [ ] Record a release checkpoint and a separate verified MongoDB backup reference.

**Current status:** These are outstanding delivery gates from the implementation audit. Do not mark them complete until verified.
