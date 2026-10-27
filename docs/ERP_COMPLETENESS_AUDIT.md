# RCLD Islampur ERP - Implementation Audit

Updated against the `main` branch after the CRUD/timetable review.

## Current working modules
- Dashboard
- Students: registration, list/search/filter, detail, edit, archive, fees, attendance
- Employees: create, list/search/filter, detail, edit, archive, skills, leave balances
- Courses: database-backed catalog, create, edit, archive, required skills, fee/admission fee
- Batches: create, edit, activate/draft/suspend/cancel, series, timetable generation, faculty skill matching, faculty conflict validation, timetable-hour locking
- Subjects: course-linked CRUD, required skills, chapters
- AI/RAG assistant

## Business rules locked in
- ERP only; do not reintroduce an LMS course-player/content platform.
- Academic structure: Course -> Subject -> Chapter.
- Batch structure: Course -> Batch -> Batch Series -> Schedule.
- A-series uses T1 and L1/L2; B-series uses T2 and L3/L4.
- An occupied batch timetable day + time is unavailable to another active/draft batch.
- Faculty availability is checked by day + time and required course skills.
- Batch edits revalidate schedule and faculty conflicts.
- Important ERP records are archived/cancelled rather than physically deleted.

## Still required before calling the ERP complete
- Authentication/session enforcement and student login
- Users, roles and permissions UI + server-side RBAC
- Student admission/enrollment lifecycle with course selection, discount approval, installments and batch allotment
- Student batch/enrollment relationship as a first-class database record
- Online/offline student separation
- Employee attendance, break/out-time and leave workflows
- Employee tasks and performance
- CRM/enquiries/follow-ups
- Exams, question bank, admit cards, results and certificates
- Subject-to-batch/faculty assignment and syllabus/chapter progress
- Student and faculty timetable dashboards
- Student ID card generation
- Reports/audit logs/notifications
- Cloudinary document/photo management
- PhonePe verified payment workflow
- Seeded dummy data with safe deletion/archival boundaries
- Final responsive UI pass and full route/API verification

This file is a tracking document; it does not claim unfinished modules are already implemented.
