"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { useAuth } from "./AuthProvider";
import { Sidebar } from "./Sidebar";
import { useT } from "@/lib/i18n";
import type { Role } from "@/lib/types";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// « masqué ≠ perdu » : la même liste alimente la barre standalone ET la nav
// d'embed — aucun lien ne disparaît en mode embarqué.
const NAV_LINKS: { href: string; labelKey: string; icon: string; minRole?: Role }[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: "📊" },
  { href: "/actions-marketing", labelKey: "nav.marketing", icon: "📣" },
  { href: "/sheets", labelKey: "nav.sheets", icon: "📑" },
  // « Importer » (upload OCS) = Gestionnaire+ : un Consulter ne le voit pas.
  { href: "/upload", labelKey: "nav.upload", icon: "📤", minRole: "gestionnaire" },
  { href: "/stores", labelKey: "nav.stores", icon: "🏪" },
  { href: "/aide", labelKey: "nav.help", icon: "📖" },
];

export function NavBar() {
  const { session } = useAuth();
  const pathname = usePathname();
  const { embedded } = useGandalf();
  const t = useT();
  if (!session) return null;

  // Onglets réservés Gestionnaire+ (ex. Importer) masqués pour Consulter (membre).
  const canManage =
    session.role === "gestionnaire" || session.role === "admin" || session.role === "superadmin";
  const visibleLinks = NAV_LINKS.filter((l) => !l.minRole || canManage);

  if (embedded) {
    // Contrat d'embed, morceau 3 — nav interne d'embed, modèle xero/elearning
    // (#gandalf-embed-nav) : barre claire sticky sur fond parchemin, pastilles
    // blanches arrondies, pastille active or. Le hub fournit logo/titre/profil/
    // logout — on ne recrée rien de redondant (pas de widget/menu Gandalf).
    return (
      <nav id="gandalf-embed-nav" className="sticky top-0 z-40 flex flex-wrap items-center gap-1.5 bg-[#F4EFE3] px-4 pb-1 pt-3">
        {visibleLinks.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-[#A8863F] bg-[#A8863F] font-bold text-white"
                  : "border-black/10 bg-white text-black/60 hover:border-[#A8863F]/40 hover:text-[#282828]"
              )}
            >
              <span aria-hidden>{link.icon}</span>
              <span>{t(link.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <header className="chanv-header">
      <div className="mx-auto max-w-7xl flex items-center gap-4 relative px-4">
        <a
          href={process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"}
          className="chanv-logo-wrapper flex items-center"
          title={t("nav.backToHub")}
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
          <h1 className="text-xl font-bold m-0 leading-tight">{t("app.title")}</h1>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[3px] opacity-70 mt-1 m-0">
            {t("app.subtitle")}
          </p>
        </div>

        {/* Nav links — desktop only (sidebar handles mobile) */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {visibleLinks.map((link) => (
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
              <span className="hidden sm:inline">{t(link.labelKey)}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              {session.displayName || session.email}
            </div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider whitespace-nowrap">
              {t(`role.${session.role}`)}
            </div>
          </div>
          <Sidebar />
        </div>
      </div>
    </header>
  );
}
