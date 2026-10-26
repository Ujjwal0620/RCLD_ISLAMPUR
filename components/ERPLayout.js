"use client";

import { useState } from "react";
import { LayoutDashboard, Users, UserPlus, Menu, X } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Students", icon: Users },
  { href: "/dashboard/students/register", label: "Registration", icon: UserPlus },
];

export default function ERPLayout({ active, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="erp-shell">
      <div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`erp-sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div><strong>RCLD</strong><span>Islampur ERP</span></div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="side-label">MAIN MENU</div>
        <nav className="erp-nav">
          {links.map(({ href, label, icon: Icon }) => (
            <a key={href} className={`side-link ${active === href ? "active" : ""}`} href={href} onClick={() => setOpen(false)}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Local ERP Workspace</div>
      </aside>

      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      <section className="erp-main">{children}</section>
    </div>
  );
}
