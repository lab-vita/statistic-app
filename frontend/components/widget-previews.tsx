"use client";
// Статические превью виджетов для галереи каталога.
// Используют хардкоженные данные — никаких запросов.

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Phone, TrendingUp, Users } from "lucide-react";

const DEMO_DAILY = [
  { date: "01", incoming: 68,  outgoing: 52, missed: 8  },
  { date: "02", incoming: 82,  outgoing: 60, missed: 12 },
  { date: "03", incoming: 54,  outgoing: 44, missed: 6  },
  { date: "04", incoming: 91,  outgoing: 70, missed: 14 },
  { date: "05", incoming: 75,  outgoing: 58, missed: 9  },
  { date: "06", incoming: 48,  outgoing: 36, missed: 5  },
  { date: "07", incoming: 103, outgoing: 78, missed: 16 },
  { date: "08", incoming: 87,  outgoing: 65, missed: 11 },
  { date: "09", incoming: 62,  outgoing: 48, missed: 7  },
];

const DEMO_OPS = [
  { name: "Иванова А.",  value: 412 },
  { name: "Петрова К.",  value: 389 },
  { name: "Сидоров М.",  value: 298 },
  { name: "Козлова Е.",  value: 241 },
];

const COLORS = ["#3b82f6","#8b5cf6","#22c55e","#f59e0b"];

// ─── 1. Одна метрика ─────────────────────────────────────────
export function CallsSinglePreview() {
  return (
    <div className="relative h-full flex flex-col justify-between p-4
      bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl overflow-hidden">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
      <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
        <Phone className="h-3.5 w-3.5 text-white" />
      </div>
      <div>
        <div className="text-3xl font-bold text-white">2 239</div>
        <div className="text-xs text-blue-100">Входящие звонки</div>
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-200">
        <TrendingUp className="h-3 w-3" /> +12% к прошлому периоду
      </div>
    </div>
  );
}

// ─── 2. Три показателя ───────────────────────────────────────
export function CallsTrioPreview() {
  const items = [
    { label: "Входящие",    value: "2 239", color: "text-blue-300",   bg: "bg-blue-500/20"   },
    { label: "Пропущенные", value: "268",   color: "text-rose-300",   bg: "bg-rose-500/20"   },
    { label: "Исходящие",   value: "2 112", color: "text-violet-300", bg: "bg-violet-500/20" },
  ];
  return (
    <div className="h-full flex flex-col justify-between p-3 bg-slate-900 rounded-xl">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Phone className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-white">Звонки</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {items.map(item => (
          <div key={item.label} className={`${item.bg} rounded-lg p-2 flex flex-col justify-between`}>
            <div className="text-[9px] text-white/50">{item.label}</div>
            <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 3. Динамика ─────────────────────────────────────────────
export function CallsChartPreview() {
  return (
    <div className="h-full flex flex-col p-3 bg-slate-900 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[9px] text-white/40">Входящие звонки</div>
          <div className="text-xl font-bold text-white">2 239</div>
        </div>
        <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold">
          +12%
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DEMO_DAILY} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cpg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="incoming" stroke="#3b82f6"
              strokeWidth={1.5} fill="url(#cpg)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 4. Полная сводка ────────────────────────────────────────
export function CallsFullPreview() {
  return (
    <div className="h-full flex flex-col p-3 bg-slate-900 rounded-xl">
      <div className="text-[9px] font-semibold text-white/50 mb-2 uppercase tracking-wide">Звонки · сводка</div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {[
          { label: "Вход.",    value: "2 239", color: "text-blue-300"   },
          { label: "Исход.",   value: "2 112", color: "text-violet-300" },
          { label: "Проп.",    value: "268",   color: "text-rose-300"   },
          { label: "Ср. дл.",  value: "3м 12с",color: "text-amber-300" },
        ].map(m => (
          <div key={m.label}>
            <div className="text-[8px] text-white/30">{m.label}</div>
            <div className={`text-xs font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DEMO_DAILY.slice(0, 7)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="35%">
            <Bar dataKey="incoming" fill="#3b82f6" opacity={0.8} radius={[1,1,0,0]} />
            <Bar dataKey="missed"   fill="#f43f5e" opacity={0.8} radius={[1,1,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 5. Операторы ────────────────────────────────────────────
export function CallsOperatorsPreview() {
  const total = DEMO_OPS.reduce((s, o) => s + o.value, 0);
  return (
    <div className="h-full flex flex-col p-3 bg-slate-900 rounded-xl">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="h-6 w-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Users className="h-3 w-3 text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-white">Операторы</span>
      </div>
      <div className="space-y-2 flex-1">
        {DEMO_OPS.map((op, i) => {
          const pct = op.value / total * 100;
          return (
            <div key={op.name} className="flex items-center gap-2">
              <span className="text-[9px] text-white/25 w-3">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-white/70">{op.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: COLORS[i] }}>{op.value}</span>
                </div>
                <div className="h-1 rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i] }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
