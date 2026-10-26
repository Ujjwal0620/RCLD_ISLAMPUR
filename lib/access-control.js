// Central permission catalog for the future RBAC enforcement layer.
// The application is currently being built from the Super Admin perspective.
// Enforcement will be enabled after the ERP modules are complete.

export const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN_FACULTY: "admin_faculty",
  STUDENT: "student",
};

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  STUDENTS_VIEW: "students.view",
  STUDENTS_CREATE: "students.create",
  STUDENTS_UPDATE: "students.update",
  STUDENTS_FEES: "students.fees",
  STUDENTS_ATTENDANCE: "students.attendance",
  COURSES_MANAGE: "courses.manage",
  SUBJECTS_MANAGE: "subjects.manage",
  BATCHES_MANAGE: "batches.manage",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_UPDATE: "employees.update",
  EMPLOYEE_ATTENDANCE: "employees.attendance",
  EMPLOYEE_LEAVE: "employees.leave",
  EMPLOYEE_SALARY: "employees.salary",
  EXAMS_MANAGE: "exams.manage",
  RESULTS_MANAGE: "results.manage",
  CERTIFICATES_MANAGE: "certificates.manage",
  REPORTS_VIEW: "reports.view",
  SETTINGS_MANAGE: "settings.manage",
  ROLES_MANAGE: "roles.manage",
  AUDIT_VIEW: "audit.view",
};

export const ROLE_DEFAULTS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN_FACULTY]: [],
  [ROLES.STUDENT]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_FEES,
    PERMISSIONS.STUDENTS_ATTENDANCE,
  ],
};

export const ALL_EMPLOYEE_SKILLS = [
  "Fundamentals",
  "DOS",
  "Windows",
  "MS Word",
  "MS Paint",
  "MS Excel",
  "MS PowerPoint",
  "MS Access",
  "Blue Java",
  "HTML",
  "Internet and Email",
  "C Programming",
  "JavaScript",
  "Python",
  "SQL",
  "Visual Basic",
  "VB .NET",
  "MS Outlook",
  "CorelDRAW",
  "Photoshop",
  "Tally ERP 9",
  "Gen AI Tools",
  "Hardware",
  "Networking",
  "CCTV Installation",
  "Cyber Security Online Works",
  "Scratch",
  "CSS",
  "Android App Development",
];

export function hasPermission(role, permission, assignedPermissions = []) {
  if (role === ROLES.SUPER_ADMIN) return true;
  return assignedPermissions.includes(permission);
}
