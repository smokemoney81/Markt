import BottomNav from "@/components/BottomNav";

// Auth-gebundene, personalisierte Seiten – nicht statisch vorab rendern.
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
