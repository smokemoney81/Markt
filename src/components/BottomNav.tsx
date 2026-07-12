"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  CalendarDays,
  Wallet,
  Images,
  Gamepad2,
} from "lucide-react";

const items = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/anzeigen", label: "Anzeigen", icon: Megaphone },
  { href: "/kontakte", label: "Kontakte", icon: Users },
  { href: "/termine", label: "Termine", icon: CalendarDays },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/medien", label: "Medien", icon: Images },
  { href: "/spiel", label: "Spiel", icon: Gamepad2 },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-7">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active ? "text-brand" : "text-gray-400"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
