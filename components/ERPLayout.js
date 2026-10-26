"use client";

import { useState } from "react";
import { LayoutDashboard, Users, UserPlus, Menu, X } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/dashboard/students",
    label: "Students",
    icon: Users,
    children: [{ href: "/dashboard/students/register", label: "Registration", icon: UserPlus }],
  },
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
          {links.map(({ href, label, icon: Icon, children }) => (
            <div key={href} className="nav-group">
              <a className={`side-link ${active === href ? "active" : ""}`} href={href} onClick={() => setOpen(false)}>
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
              </a>
              {children?.length > 0 && (
                <div className="side-subnav">
                  {children.map(({ href: childHref, label: childLabel, icon: ChildIcon }) => (
                    <a key={childHref} className={`side-sublink ${active === childHref ? "active" : ""}`} href={childHref} onClick={() => setOpen(false)}>
                      <ChildIcon size={15} strokeWidth={1.9} />
                      <span>{childLabel}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Local ERP Workspace</div>
      </aside>

      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      <section className="erp-main">{children}</section>
    </div>
  );
}
