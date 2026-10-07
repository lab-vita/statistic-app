"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Phone } from "lucide-react";

const DEMO_DAILY = [
  { date: "01", incoming: 68,  missed: 8  },
  { date: "02", incoming: 82,  missed: 12 },
  { date: "03", incoming: 54,  missed: 6  },
  { date: "04", incoming: 91,  missed: 14 },
  { date: "05", incoming: 75,  missed: 9  },
  { date: "06", incoming: 48,  missed: 5  },
  { date: "07", incoming: 103, missed: 16 },
  { date: "08", incoming: 87,  missed: 11 },
  { date: "09", incoming: 62,  missed: 7  },
];

// ─── 1. Одна метрика ─────────────────────────────────────────
export function CallsSinglePreview() {
  return (
    <div className="relative h-full flex flex-col justify-between p-4
      bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl overflow-hidden">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 pointer-events-none" />
      <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
        <Phone className="h-3.5 w-3.5 text-white" />
      </div>
      <div>
        <div className="text-3xl font-bold text-white">2 239</div>
        <div className="text-xs text-white/70">Выберите метрику</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {["Принятые","Пропущ.","Исход.","Конверсия"].map(l => (
          <span key={l} className="text-[9px] bg-white/15 text-white/80 px-1.5 py-0.5 rounded-md">{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── 2. Три показателя ───────────────────────────────────────
export function CallsTrioPreview() {
  const items = [
    { label: "Принято",      value: "2 239",  from: "#2563eb", to: "#1d4ed8" },
    { label: "Потеряно",     value: "72",     from: "#e11d48", to: "#be123c" },
    { label: "До перезвона", value: "39 мин", from: "#f97316", to: "#ea580c" },
  ];
  return (
    <div className="h-full grid grid-cols-3 gap-1.5">
      {items.map(item => (
        <div
          key={item.label}
          className="relative flex flex-col justify-between p-3 rounded-xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
        >
          <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/10 pointer-events-none" />
          <div className="text-[9px] text-white/60">{item.label}</div>
          <div className="text-base font-bold text-white z-10">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── 3. Динамика ─────────────────────────────────────────────
export function CallsChartPreview() {
  return (
    <div className="relative h-full flex flex-col p-3 rounded-xl overflow-hidden text-white bg-gradient-to-br from-blue-600 to-indigo-700">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 pointer-events-none" />
      <div className="flex items-start justify-between z-10">
        <div>
          <div className="text-[9px] text-white/60">Принято, по дням</div>
          <div className="text-xl font-bold leading-tight">1 900</div>
        </div>
        <span className="text-[9px] font-semibold text-emerald-200">+4%</span>
      </div>
      <div className="flex-1 min-h-0 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DEMO_DAILY} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cpg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#fff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#fff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="incoming" stroke="#fff" strokeWidth={1.5} fill="url(#cpg)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 4. Судьба звонков ───────────────────────────────────────
export function CallsFunnelPreview() {
  return (
    <div className="relative h-full flex flex-col justify-between p-3 rounded-xl overflow-hidden text-white
      bg-gradient-to-br from-indigo-700 to-slate-900">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 pointer-events-none" />
      <div className="text-[9px] text-white/70 z-10">Судьба звонков</div>
      <div className="z-10 space-y-1.5">
        <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden">
          <div className="bg-sky-300" style={{ flexGrow: 91 }} />
          <div className="bg-orange-300" style={{ flexGrow: 9 }} />
        </div>
        <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden">
          <div className="bg-emerald-300" style={{ flexGrow: 50 }} />
          <div className="bg-teal-200" style={{ flexGrow: 12 }} />
          <div className="bg-amber-300" style={{ flexGrow: 12 }} />
          <div className="bg-rose-400" style={{ flexGrow: 26 }} />
        </div>
      </div>
      <div className="z-10 flex items-end justify-between">
        <div className="text-[9px] text-white/60">Потеряно</div>
        <div className="text-lg font-bold leading-none">72</div>
      </div>
    </div>
  );
}

// ─── 5. План и прогноз ───────────────────────────────────────
export function CallsPlanPreview() {
  return (
    <div className="relative h-full flex flex-col justify-between p-3 rounded-xl overflow-hidden text-white
      bg-gradient-to-br from-emerald-600 to-teal-700">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 pointer-events-none" />
      <div className="text-[9px] text-white/70 z-10">План и прогноз</div>
      <div className="z-10">
        <div className="flex items-end justify-between mb-1">
          <div className="text-lg font-bold leading-none">1 900</div>
          <div className="text-[9px] text-white/70">63% плана</div>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/20">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: "63%" }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-amber-200" style={{ left: "95%" }} />
        </div>
      </div>
      <div className="z-10 text-[9px] text-amber-200">прогноз 2 850 · 95%</div>
    </div>
  );
}

// ─── 6. Операторы: качество ──────────────────────────────────
export function CallsOperatorsPreview() {
  const rows = [
    { n: "Оператор А", v: "720", d: "bg-emerald-400" },
    { n: "Оператор Б", v: "640", d: "bg-amber-400" },
    { n: "Оператор В", v: "540", d: "bg-rose-400" },
  ];
  return (
    <div className="relative h-full flex flex-col p-3 rounded-xl overflow-hidden text-white bg-gradient-to-br from-slate-700 to-slate-900">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 pointer-events-none" />
      <div className="text-[9px] text-white/70 mb-1.5 z-10">Операторы: качество</div>
      <div className="flex-1 space-y-1.5 z-10">
        {rows.map(r => (
          <div key={r.n} className="flex items-center gap-1.5 text-[9px]">
            <span className={`h-1.5 w-1.5 rounded-full ${r.d}`} />
            <span className="flex-1 truncate text-white/80">{r.n}</span>
            <span className="font-semibold">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
