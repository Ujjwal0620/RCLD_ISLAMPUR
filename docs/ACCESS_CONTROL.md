# RCLD ERP Role-Based Access Control

## Roles

### Super Admin
Full control over the ERP. Can manage users, roles, permissions, students, employees, courses, subjects, batches, finance, attendance, exams, certificates, reports and settings.

### Admin / Faculty
No access is granted automatically. The Super Admin assigns permissions to each employee/account. A faculty member can therefore receive only the modules and actions required for their job.

### Student
Students only see their own operational portal data: profile, enrolled course/batch, class information, syllabus/subject progress supplied by the ERP, attendance, fees paid/due, notices/documents and results/certificates when available.

## Enforcement rule

The ERP is currently being implemented from the Super Admin perspective. The permission catalog is centralized now, but route/API enforcement will be switched on after the major ERP modules are completed. Every protected API must then check the authenticated user role and explicit permission on the server.

Never rely on hiding a sidebar item as security. The API must enforce permissions server-side.

## Permission catalog

Permissions are defined in `lib/access-control.js`. New modules should add their permission names there before implementation.
