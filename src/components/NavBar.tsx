"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Sidebar } from "./Sidebar";
import { ROLE_LABELS } from "@/lib/types";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/upload", label: "Importer", icon: "📤" },
  { href: "/stores", label: "Stores", icon: "🏪" },
];

export function NavBar() {
  const { session } = useAuth();
  const pathname = usePathname();
  if (!session) return null;

  return (
    <header className="chanv-header">
      <div className="mx-auto max-w-6xl flex items-center gap-6 flex-wrap relative flex-col md:flex-row text-center md:text-left">
        <a
          href={process.env.NEXT_PUBLIC_HUB_URL || "https://chanv-apps-hub-271227085398.northamerica-northeast1.run.app/"}
          className="chanv-logo-wrapper flex items-center"
          title="Retour au Hub"
        >
          <Image
            src="/logo-groupe-chanv.svg"
            alt="Chanv"
            width={130}
            height={44}
            priority
            className="h-10 w-auto"
          />
        </a>
        <div>
          <h1 className="text-xl font-bold m-0 leading-tight">Données OCS</h1>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[3px] opacity-70 mt-1 m-0">
            Groupe Chanv
          </p>
        </div>

        {/* Nav links — desktop only (sidebar handles mobile) */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-[10px] text-[12px] sm:text-[13px] font-semibold tracking-wider text-white/75 hover:text-white hover:bg-white/10 transition-all",
                (pathname === link.href || pathname?.startsWith(link.href + "/")) &&
                  "bg-chanv-beige !text-chanv-terre"
              )}
            >
              <span>{link.icon}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:ml-auto flex-shrink-0 absolute top-0 right-0 md:relative md:top-auto md:right-auto">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              {session.displayName || session.email}
            </div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider whitespace-nowrap">
              {ROLE_LABELS[session.role]}
            </div>
          </div>
          <Sidebar />
        </div>
      </div>
    </header>
  );
}

