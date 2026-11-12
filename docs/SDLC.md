# Engineering workflow

This document describes how changes should be planned, implemented and released in the RCLD Islampur ERP repository. It is intended for day-to-day development, not as a theoretical SDLC description.

## Working model

Use short, complete increments in a modular monolith. Each change should leave the application in a state another developer can understand and continue.

Preferred sequence: Understand → Specify → Trace the data → Implement → Verify → Document → Commit.

Do not start by changing a screen before understanding the API, schema and business rule behind it.

## Before changing a module

1. Confirm the repository is Ujjwal0620/RCLD_ISLAMPUR and the working branch is main.
2. Read the relevant section of docs/DEVELOPER_GUIDE.md.
3. Inspect the page, its API route(s), Mongoose model(s) and shared utilities.
4. Search for every other place that reads or writes the same collection.
5. Identify existing records and backward-compatibility requirements.
6. Write down expected behavior, permissions, business rules, edge cases and acceptance criteria.
7. Create a restore branch before schema migrations, bulk data changes or broad refactors.

## Implementation order

For a normal feature, work through these layers:

1. Data contract and schema/index changes.
2. Server-side validation and normalization.
3. Authentication and authorization.
4. Business rules and persistence.
5. API response and error contract.
6. UI workflow and responsive states.
7. Tests and regression checks.
8. Documentation and changelog.

Keep the business rule on the server. Client-side validation is useful feedback, but it cannot protect stored data.

## Definition of ready

A task is ready when the developer knows who uses it and which role can perform each action; which records are created, updated or read; which existing data may be affected; the status transitions and business rules; how errors and conflicts should be reported; and what success looks like and how it will be verified.

## Definition of done

A change is done when the requested workflow works end to end; the database schema and indexes are compatible with existing data; every protected API action checks session and authorization; validation, empty, loading, success and failure states are handled; desktop and mobile behavior are checked; relevant regression checks pass; lint and production build pass or blockers are recorded; documentation is updated; the commit is pushed to the intended branch; and a restore point exists for major milestones.

A successful commit is not proof that a feature is tested. Report exactly what was run.

## Verification commands

Run from the repository root: npm run lint and npm run build. For local manual verification, run npm run dev.

Check the actual workflow in a browser with representative records. For finance, test partial payments, multiple payments, zero/negative values, discounts, late fines, payment edits and receipt printing. For batches, test duplicate slots, faculty unavailability, missing skills, edits and student transfers. For access control, test both permitted and forbidden users.

## Git conventions

- main is the integration branch.
- Keep commits small enough to review and revert.
- Use clear messages such as feat(students): preserve batch movement history, fix(fees): calculate remaining balance after receipt and docs: update developer guide.
- Do not commit secrets, local environment files, private student data or database dumps.
- Do not force-push main.
- Before a risky change, create a restore branch from the current main commit.
- After a release-worthy change, record the commit SHA, purpose and verification result in docs/RESTORE_POINTS.md.

## Database and migration discipline

MongoDB schema changes need a migration plan even when Mongoose is schema-flexible.

- Identify existing documents that lack the new field.
- Decide whether the field is optional, defaulted or backfilled.
- Make migration scripts safe to re-run where possible.
- Avoid destructive migrations.
- Take a database backup before bulk updates.
- Verify counts and sample documents before and after migration.
- Keep a rollback or repair plan.
- Never run a cleanup script against production without an explicit dry-run and reviewed filter.

## Financial workflow discipline

Fees and payments are business records, not just editable profile fields.

- Preserve each payment as a separate history entry.
- Never derive the paid amount from a browser-provided total.
- Recalculate totals on the server from persisted fee/payment data.
- Use unique receipt numbers and prevent duplicate processing.
- Keep payment method, reference/UTR, proof URL, date, note, recorder and authorizer where applicable.
- Gateway callbacks must be authenticated and idempotent.
- Do not activate an enrollment based only on a client redirect; use verified payment status.

## UI conventions

The target is a compact, professional ERP interface inspired by the Hando admin dashboard. Follow docs/UI_UX_GUIDE.md for the current visual direction, density rules, shared components, responsive behavior and accessibility requirements.

Every data-heavy page should be considered at desktop, tablet and narrow mobile widths. Use hamburger navigation on small screens and avoid forcing wide tables beyond the viewport without a deliberate scroll or responsive treatment.

Print layouts need their own acceptance checks. Browser print preview is the source of truth for pagination, margins, clipping and page size; CSS dimensions alone do not prove a receipt fits.

## Documentation maintenance

Update the relevant docs in the same change that alters behavior: schema/relationship changes → DATA_MODEL.md; new routes or folder conventions → DEVELOPER_GUIDE.md; new roles/permissions → ACCESS_CONTROL.md; feature status → ERP_COMPLETENESS_AUDIT.md; environment, release or recovery changes → OPERATIONS_RUNBOOK.md and RESTORE_POINTS.md.

Avoid aspirational language. Distinguish current behavior from planned behavior and record unverified assumptions.
