"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Gem,
  Trophy,
  TrendingUp,
  Calendar,
  Target,
  Gamepad2,
  Grid3x3,
  Menu,
  X,
} from "lucide-react";

const items = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/spiel", label: "Spiel", icon: Gamepad2 },
  { href: "/vip", label: "VIP", icon: Gem },
  { href: "/achievements", label: "Erfolge", icon: Trophy },
  { href: "/analytics", label: "Statistik", icon: TrendingUp },
  { href: "/seasonal", label: "Season", icon: Calendar },
  { href: "/challenges", label: "Aufgaben", icon: Target },
  { href: "/aether", label: "Aether", icon: Grid3x3 },
];

export default function NavFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Menü bei Seitenwechsel schließen.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body-Scroll sperren, solange das Menü offen ist.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Overlay + Menü-Panel */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <nav
            className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-surface-border bg-surface-card p-5 pb-24 animate-[slideUp_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
            <ul className="mx-auto grid max-w-lg grid-cols-4 gap-3">
              {items.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[11px] font-medium transition active:scale-95 ${
                        active
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-surface-border text-gray-300"
                      }`}
                    >
                      <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-black/40 transition active:scale-90 hover:bg-brand-dark"
      >
        {open ? <X size={26} /> : <Menu size={26} />}
      </button>
    </>
  );
}
