import CoinMasterGame from "@/components/game/CoinMasterGame";

export const metadata = {
  title: "Münz-Meister",
};

export default function SpielPage() {
  return (
    <div>
      <header className="safe-top px-4 pb-2 pt-5">
        <p className="text-sm text-gray-400">Kleine Pause? 🎰</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Münz-Meister</h1>
      </header>
      <CoinMasterGame />
    </div>
  );
}
