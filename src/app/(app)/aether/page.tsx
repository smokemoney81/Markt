import AetherGridGame from "@/components/game/AetherGridGame";

export const metadata = {
  title: "Aether Grid",
};

export default function AetherPage() {
  return (
    <div>
      <header className="safe-top px-4 pb-2 pt-5">
        <p className="text-sm text-gray-400">Ultimate Protocol ⚡</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Aether Grid</h1>
      </header>
      <AetherGridGame />
    </div>
  );
}
