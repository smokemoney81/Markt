import Link from "next/link";
import AetherGridGame from "@/components/game/AetherGridGame";

export const metadata = {
  title: "Aether Grid – frei spielbar",
};

export default function PublicAetherPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-10">
      <header className="safe-top flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <p className="text-sm text-gray-400">Ultimate Protocol ⚡</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Aether Grid</h1>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-brand hover:text-brand"
        >
          Login
        </Link>
      </header>
      <AetherGridGame />
    </div>
  );
}
