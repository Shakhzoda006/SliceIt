"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  User,
  Menu,
  X,
  Zap,
  Settings,
} from "lucide-react";
import styles from "./Navigation.module.css";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Analyze", icon: Upload },
  { href: "/history", label: "Progress", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "API Key", icon: Settings },
];

// Inner component that uses usePathname — must be inside <Suspense>
function NavLinks({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop links */}
      <div className={styles.links}>
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href || pathname.startsWith(href + "/") ? styles.active : ""}`}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.mobileLink} ${pathname === href ? styles.mobileActive : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <Link href="/upload" className={styles.mobileCta} onClick={() => setMobileOpen(false)}>
            <Upload size={14} />
            Analyze Video
          </Link>
        </div>
      )}
    </>
  );
}

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={16} fill="currentColor" />
          </div>
          <span className={styles.logoText}>SliceIt</span>
          <span className={styles.logoBeta}>BETA</span>
        </Link>

        {/* Wrap pathname-dependent links in Suspense to avoid prerender errors */}
        <Suspense fallback={<div className={styles.links} />}>
          <NavLinks mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        </Suspense>

        {/* CTA */}
        <div className={styles.actions}>
          <Link href="/upload" className={styles.ctaBtn}>
            <Upload size={14} />
            Analyze Video
          </Link>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
