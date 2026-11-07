# Authentication and access control

This document distinguishes what the code currently does from what the production security model must guarantee. A permission name in a file is not the same as an enforced permission.

## Current implementation

- Session helpers are in lib/auth.js.
- The app signs JWT session tokens with jose.
- The cookie name is rcld_session; it is HTTP-only, uses SameSite=Lax and is marked Secure in production.
- Session lifetime is currently 12 hours.
- Employee role inference is based on designation and department text in roleOfEmployee().
- Employee password verification in the login route supports bcrypt hashes. There is also legacy/plain-text compatibility logic that must be removed before production.
- The Super Admin login path currently has fallback values in source code when environment variables are absent. Treat this as a security defect to close, not as supported production configuration.
- lib/access-control.js defines a permission catalog and default role mapping, but its own comments state that full permission enforcement is not yet enabled.
- Some endpoints explicitly check the session and role. Coverage is not yet uniform across every endpoint.

## Intended roles

| Role | Intended responsibility |
|---|---|
| Super Admin | Institute-wide configuration and privileged operations, including course discounts and user access |
| Office Admin / Admin | Operational administration within assigned authority |
| Accountant | Fee collection and finance operations within assigned authority |
| Faculty | Assigned academic work, batches, attendance and course progress |
| Employee | Assigned operational tasks and permitted employee self-service |
| Student | Their own profile, admission, fee, attendance, academic and result information |

Role names currently emitted by code may differ from the desired permission model. In particular, roleOfEmployee() currently derives a small set of role values from employee designation/department. Do not assume every intended role is fully represented.

## Permission design

The current permission catalog is in lib/access-control.js. Add a permission there when a new protected operation is introduced, but also implement the server-side check in the relevant route.

A permission should describe an action, not merely a screen. Examples include students.view, students.create, students.update, students.fees, batches.manage, employees.attendance, reports.view and roles.manage.

The Super Admin is the only role that should be able to set course discounts under the agreed business rules. An Admin may process an approved fee arrangement but must not silently change the institute's discount policy.

## Required API pattern

For every protected route:

1. Read the session on the server.
2. Reject unauthenticated requests.
3. Check the actor's role and explicit permission for the requested action.
4. Validate IDs and request payloads.
5. Load the target record and verify the actor is allowed to access that record.
6. Apply the business operation.
7. Record the actor and timestamp for important changes.
8. Return a deliberate status code and a safe error message.

A sidebar condition is useful for navigation, but it is never a substitute for these checks.

## Data access rules

- Students may access only their own records. Never trust a student ID supplied by the browser without comparing it to the authenticated identity.
- Faculty access should be limited to assigned batches/subjects and operations explicitly granted to them.
- Finance actions must be restricted to authorized roles and retain a traceable payment history.
- Employee attendance self-service and attendance administration are different permissions.
- Bulk actions require the same authorization as the equivalent individual action.
- Upload endpoints must validate session, file type, size and intended purpose.
- Development/maintenance endpoints must be disabled or protected in production.

## Production security work still required

- Remove source-code fallback credentials and require explicit Super Admin configuration.
- Require a strong AUTH_SECRET in every deployed environment; do not use the development fallback.
- Remove plain-text password compatibility and migrate legacy passwords to bcrypt hashes.
- Review session invalidation, logout behavior, token rotation and password-change invalidation.
- Enforce role/permission checks on every API route, including GET/list endpoints.
- Add record-level authorization for student, employee and batch data.
- Review CSRF exposure for cookie-authenticated mutation endpoints.
- Add rate limiting and login abuse protection.
- Add audit records for privileged changes and financial operations.
- Protect or remove all /api/dev/* endpoints from production.
- Test privilege escalation, direct URL access and IDOR scenarios.

Do not mark RBAC complete until the route inventory has been reviewed and tests demonstrate both allowed and denied cases.
