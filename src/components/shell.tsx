"use client";

import { BookOpen, Bookmark, ChartNoAxesColumnIncreasing, ChevronRight, Compass, Files, House, LayoutDashboard, Moon, ShieldCheck, Sun, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const studyLinks = [
  { href: "/", label: "Overview", icon: House },
  { href: "/questions", label: "Question bank", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumnIncreasing },
];
const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/imports", label: "PDF imports", icon: Files },
];

export function Shell({ children, admin = false, privateAdmin = false }: { children: React.ReactNode; admin?: boolean; privateAdmin?: boolean }) {
  const pathname = usePathname();
  const links = admin ? adminLinks : studyLinks;
  const active = links.findLast(({ href }) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")));
  function toggleTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.dataset.theme = current === "dark" ? "light" : "dark";
    localStorage.setItem("atlas-theme", root.dataset.theme);
  }
  return <div className="shell">
    <script dangerouslySetInnerHTML={{ __html: "try{const t=localStorage.getItem('atlas-theme');if(t)document.documentElement.dataset.theme=t}catch{}" }} />
    <aside className="sidebar">
      <Link className="brand" href={admin ? "/admin" : "/"}>
        <span className="brand-mark"><Compass size={23} strokeWidth={1.8} /></span>
        <span>Study Atlas<small>{admin ? "Editorial workspace" : "Civil services prep"}</small></span>
      </Link>
      <nav aria-label={admin ? "Admin" : "Study"} className="navigation">
        <span className="nav-label">{admin ? "Administration" : "Workspace"}</span>
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active?.href === href ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>)}
      </nav>
      <div className="side-footer">
        {(admin || privateAdmin) && <Link href={admin ? "/" : "/admin"}><ShieldCheck size={17} />{admin ? "Student workspace" : "Admin console"}<ChevronRight size={14} /></Link>}
        <div className="side-note"><span className="status-dot" />{admin ? "Private workspace" : "Personal study space"}</div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>{admin ? "Admin" : "Study workspace"}</span><ChevronRight size={14} /><strong>{active?.label ?? "Question"}</strong></div><button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label="Toggle color theme"><Sun size={17} className="sun-icon" /><Moon size={17} className="moon-icon" /></button></header>
      <main id="content" className="workspace">{children}</main>
    </div>
  </div>;
}
