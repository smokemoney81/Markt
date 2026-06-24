export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 mb-4 border-b border-surface-border bg-surface/90 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
