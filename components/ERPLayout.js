"use client";

import { useEffect, useState } from "react";
import RAGAssistant from "@/components/RAGAssistant";
import { LayoutDashboard, Users, UserRoundCog, Menu, X, ShieldCheck, Layers3, BookOpen, BarChart3, UserRoundX, Clock3, ClipboardList, LogOut } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: Users },
  { href: "/dashboard/dropouts", label: "Dropouts", icon: UserRoundX },
  { href: "/dashboard/employees", label: "Employees", icon: UserRoundCog },
  { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
  { href: "/dashboard/course-content", label: "Course Content", icon: BookOpen },
  { href: "/dashboard/batches", label: "Batches", icon: Layers3 },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/attendance", label: "My Attendance", icon: Clock3 },
  { href: "/dashboard/back-office", label: "Task Assignment", icon: ClipboardList },
];

export default function ERPLayout({ active, children, hideAssistant = true }) {
  const [open, setOpen] = useState(false);\n  const [user, setUser] = useState(null);\n\n  useEffect(() => {\n    let active = true;\n    fetch("/api/auth/me", { cache: "no-store" })\n      .then((r) => r.ok ? r.json() : null)\n      .then((data) => { if (active && data?.authenticated) setUser(data.user); })\n      .catch(() => {});\n    return () => { active = false; };\n  }, []);
  return (
    <div className="erp-shell">
      <div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`erp-sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div><strong>RCLD</strong><span>Islampur ERP</span></div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="side-label">SUPER ADMIN WORKSPACE</div>
        <nav className="erp-nav">
          {links.map(({ href, label, icon: Icon }) => (
            <a key={href} className={`side-link ${active === href ? "active" : ""}`} href={href} onClick={() => setOpen(false)}>
              <Icon size={18} strokeWidth={1.9}/><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="rbac-notice"><ShieldCheck size={15}/><div><strong>RBAC Ready</strong><span>Super Admin view</span></div></div>
        <div className="sidebar-footer"><span className="status-dot"/> Local ERP Workspace</div><button className="side-logout" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/dashboard/login"}}><LogOut size={15}/><span>Sign out</span></button>
      </aside>
      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      <section className="erp-main">\n        <div className="erp-user-bar">\n          <div className="erp-user-identity">\n            <div className="erp-user-avatar">{String(user?.name || "R").trim().charAt(0).toUpperCase()}</div>\n            <div><strong>{user?.name || "Loading..."}</strong><span>{user?.designation || (user?.isSuperAdmin ? "Super Admin" : "RCLD User")}</span></div>\n          </div>\n        </div>\n        {children}\n      </section>
      {!hideAssistant && <RAGAssistant />}
    </div>
  );
}
