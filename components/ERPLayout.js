"use client";

import { useEffect, useState } from "react";
import RAGAssistant from "@/components/RAGAssistant";
import RCLDLogo from "@/components/RCLDLogo";
import {
  LayoutDashboard, Users, UserRoundCog, Menu, X, ShieldCheck, Layers3, BookOpen, BrainCircuit,
  BarChart3, UserRoundX, Clock3, ClipboardList, LogOut, GraduationCap, BookMarked,
  ChevronDown, Search, Bell, Settings2, Sparkles, PanelLeftClose, Megaphone, ContactRound,
  Sun, Moon, Maximize2, Minimize2
} from "lucide-react";

const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/ai", label: "AI Copilot", icon: BrainCircuit },
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
    label: "MARKETING",
    items: [
      { href: "/dashboard/marketing", label: "Marketing CRM", icon: Megaphone },
      { href: "/dashboard/referrals", label: "Referrals", icon: ContactRound },
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
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("light");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("rcld-erp-theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;

    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("rcld-erp-theme", nextTheme);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by the browser or device policy.
    }
  };

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
      <aside id="rcld-mobile-navigation" className={`erp-sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <RCLDLogo className="brand-mark-image" />
          <div className="brand-copy"><strong>RCLD</strong><span>Islampur Education ERP</span></div>
          <button type="button" className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon"><Sparkles size={15}/></div>
          <div><strong>RCLD Islampur</strong><span>{roleLabel}</span></div>
          <ChevronDown size={15}/>
        </div>

        <nav className="erp-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <button type="button" className="side-label side-group-toggle" aria-expanded={!collapsedGroups[group.label]} onClick={() => setCollapsedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}>
                <span>{group.label}</span><ChevronDown size={13} className={collapsedGroups[group.label] ? "group-chevron is-collapsed" : "group-chevron"}/>
              </button>
              {!collapsedGroups[group.label] && group.items.map(({ href, label, icon: Icon }) => (
                <a key={href} className={`side-link ${active === href ? "active" : ""}`} href={href} title={collapsed ? label : undefined} aria-label={label} aria-current={active === href ? "page" : undefined} onClick={() => setOpen(false)}>
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

      <button type="button" className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="rcld-mobile-navigation"><Menu size={20} /></button>
      <a className="erp-skip-link" href="#erp-page-content">Skip to main content</a>
      <main className="erp-main" id="erp-page-content">
        <header className="erp-user-bar">
          <div className="erp-command-search">
            <Search size={16}/><input aria-label="Search ERP" placeholder="Search students, batches, employees..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="erp-top-actions">
            <button type="button" className="erp-top-icon erp-theme-toggle" title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={theme === "dark"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button>
            <button type="button" className="erp-top-icon erp-fullscreen-toggle" title={isFullscreen ? "Exit full screen" : "Enter full screen"} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"} aria-pressed={isFullscreen} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button>
            <button type="button" className="erp-top-icon" title="Settings" aria-label="Settings"><Settings2 size={17}/></button>
            <button className="erp-top-icon" title="Notifications"><Bell size={17}/><i/></button>
            <button className="erp-sidebar-toggle" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} onClick={() => setCollapsed((v) => !v)}><PanelLeftClose size={17}/></button>
            <div className="erp-user-identity">
              <div className="erp-user-avatar">{initials || "R"}</div>
              <div><strong>{user?.name || "Loading..."}</strong><span>{roleLabel}</span></div>
              <ChevronDown size={14} className="user-chevron" />
            </div>
          </div>
        </header>
        {children}
      </main>
      {!hideAssistant && <RAGAssistant />}
    </div>
  );
}
