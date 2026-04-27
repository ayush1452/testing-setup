"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/app-config";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-list" aria-label="Primary">
      {navItems.map((item) => (
        <Link
          className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
          href={item.href}
          key={item.href}
        >
          <span className="nav-label">{item.label}</span>
          <span className="nav-step">{item.step}</span>
        </Link>
      ))}
    </nav>
  );
}
