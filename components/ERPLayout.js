"use client";

import { useEffect, useState } from "react";
import RAGAssistant from "@/components/RAGAssistant";
import {
  LayoutDashboard, Users, UserRoundCog, Menu, X, ShieldCheck, Layers3, BookOpen,
  BarChart3, UserRoundX, Clock3, ClipboardList, LogOut, GraduationCap, BookMarked,
  ChevronDown, Search, Bell, Settings2, Sparkles, PanelLeftClose
} from "lucide-react";

const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/students", label: "Students", icon: Users },
      { href: "/dashboard/employees", label: "Employees", icon: UserRoundCog },
      { href: "/dashboard/batches", label: "Batches & Timetable", icon: Layers3 },
    ],
  },
  {
    label: "ACADEMICS",
    items: [
      { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
      { href: "/dashboard/course-content", label: "Course Content", icon: BookMarked },
      { href: "/dashboard/subjects", label: "Subjects", icon: GraduationCap },
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock3 },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/dashboard/back-office", label: "Task Assignment", icon: ClipboardList },
      { href: "/dashboard/dropouts", label: "Dropouts & Movement", icon: UserRoundX },
      { href: "/dashboard/reports", label: "Reports & Analytics", icon: BarChart3 },
    ],
  },
];

export default function ERPLayout({ active, children, hideAssistant = true }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data?.authenticated) setUser(data.user);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const roleLabel = user?.isSuperAdmin ? "Super Admin" : (user?.designation || user?.role || "RCLD User");
  const initials = String(user?.name || "R").trim().split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`erp-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`erp-sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>R</span></div>
          <div className="brand-copy"><strong>RCLD</strong><span>Islampur Education ERP</span></div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon"><Sparkles size={15}/></div>
          <div><strong>RCLD Islampur</strong><span>{roleLabel}</span></div>
          <ChevronDown size={15}/>
        </div>

        <nav className="erp-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="side-label">{group.label}</div>
              {group.items.map(({ href, label, icon: Icon }) => (
                <a key={href} className={`side-link ${active === href ? "active" : ""}`} href={href} onClick={() => setOpen(false)}>
                  <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
                  {active === href && <i className="side-active-dot" />}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="rbac-notice"><ShieldCheck size={15}/><div><strong>Access controlled</strong><span>{roleLabel} permissions apply</span></div></div>
          <div className="sidebar-footer"><span className="status-dot"/> System operational</div>
          <button className="side-logout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/dashboard/login"; }}>
            <LogOut size={15}/><span>Sign out</span>
          </button>
        </div>
      </aside>

      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
      <section className="erp-main">
        <div className="erp-user-bar">
          <div className="erp-command-search">
            <Search size={16}/><input aria-label="Search ERP" placeholder="Search students, batches, employees..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="erp-top-actions">
            <button className="erp-top-icon" title="Settings"><Settings2 size={17}/></button>
            <button className="erp-top-icon" title="Notifications"><Bell size={17}/><i/></button>
            <button className="erp-sidebar-toggle" title="Toggle sidebar" onClick={() => setCollapsed((v) => !v)}><PanelLeftClose size={17}/></button>
            <div className="erp-user-identity">
              <div className="erp-user-avatar">{initials || "R"}</div>
              <div><strong>{user?.name || "Loading..."}</strong><span>{roleLabel}</span></div>
              <ChevronDown size={14} className="user-chevron" />
            </div>
          </div>
        </div>
        {children}
      </section>
      {!hideAssistant && <RAGAssistant />}
    </div>
  );
}
