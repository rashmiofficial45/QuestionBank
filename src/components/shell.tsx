"use client";

import { Button } from "@/components/ui/button";
import { BookOpen, Bookmark, ChartNoAxesColumnIncreasing, ChevronRight, Compass, Files, House, LayoutDashboard, ListRestart, Maximize, Minimize, Moon, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun, Zap } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const studyLinks = [
  { href: "/", label: "Overview", icon: House },
  { href: "/questions", label: "Question bank", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/revision", label: "Revision", icon: ListRestart },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumnIncreasing },
];
const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/imports", label: "PDF imports", icon: Files },
];

const TestFocusContext = createContext({ focused: false, toggle: () => {} });

export function TestFocusButton() {
  const { focused, toggle } = useContext(TestFocusContext);
  return <Button type="button" variant="outline" onClick={toggle} aria-pressed={focused}>
    {focused ? <Minimize /> : <Maximize />}{focused ? "Minimize test" : "Maximize test"}
  </Button>;
}

export function Shell({ children, admin = false, privateAdmin = false }: { children: React.ReactNode; admin?: boolean; privateAdmin?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const focused = focusPath === pathname;
  const links = admin ? adminLinks : studyLinks;
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("atlas-sidebar") === "collapsed"); } catch {}
  }, []);
  useEffect(() => {
    if (focusPath && pathname !== focusPath) setFocusPath(null);
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, focusPath, pathname]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("atlas-sidebar", next ? "collapsed" : "expanded"); } catch {}
  }
  const active = links.findLast(({ href }) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")));
  function toggleTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme === "dark" ? "dark" : "light";
    root.dataset.theme = current === "dark" ? "light" : "dark";
    localStorage.setItem("atlas-theme", root.dataset.theme);
  }
  return <TestFocusContext.Provider value={{ focused, toggle: () => setFocusPath(focused ? null : pathname) }}>
    <div className="shell" data-collapsed={collapsed || undefined} data-test-focus={focused || undefined}>
    <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
    <script dangerouslySetInnerHTML={{ __html: "try{const t=localStorage.getItem('atlas-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch{}" }} />
    <aside className="sidebar" id="workspace-sidebar">
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
      <header className="topbar"><div className="shell-crumb"><Button type="button" variant="ghost" size="icon" onClick={toggleSidebar}
        aria-controls="workspace-sidebar" aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
        <div className="breadcrumb"><span>{admin ? "Admin" : "Study workspace"}</span><ChevronRight size={14} /><strong>{active?.label ?? "Question"}</strong></div></div><Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle black and white theme"><Sun className="sun-icon" /><Moon className="moon-icon" /></Button></header>
      <main id="content" tabIndex={-1} className="workspace">{children}</main>
    </div>
  </div></TestFocusContext.Provider>;
}
