interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "green" | "blue" | "red" | "yellow" | "purple";
}

const ACCENTS = {
  green:  "text-emerald-500",
  blue:   "text-blue-500",
  red:    "text-red-500",
  yellow: "text-yellow-500",
  purple: "text-purple-500",
};

export function StatCard({ title, value, sub, icon, accent }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-foreground/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold tracking-tight font-mono ${accent ? ACCENTS[accent] : ""}`}>
        {value}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}