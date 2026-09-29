"use client";

import { useState } from "react";
import {
  Widget, WidgetSize, WidgetMode, ChartType,
  SimpleWidgetConfig, CompositeWidgetConfig,
  DataSource, FormulaOp, FormulaFormat,
  SOURCE_METRICS, COMPOSITE_PRESETS,
  newWidgetId, getMetricLabel,
} from "@/lib/dashboard";
import {
  Phone, Calendar, Banknote, ShoppingBag, Sparkles,
  X, Check, BarChart2, LineChart, AreaChart as AreaIcon,
  Maximize2, Columns2, Square,
} from "lucide-react";

// ─── Метаданные источников ────────────────────────────────────

const SOURCE_META: Record<DataSource, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  calls:        { label: "Звонки",   icon: Phone,       color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10" },
  appointments: { label: "Записи",   icon: Calendar,    color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  revenue:      { label: "Выручка",  icon: Banknote,    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  sales:        { label: "Услуги",   icon: ShoppingBag, color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-500/10" },
};

const OPS: { id: FormulaOp; sym: string; label: string }[] = [
  { id: "divide",   sym: "÷", label: "делить"   },
  { id: "multiply", sym: "×", label: "умножить"  },
  { id: "add",      sym: "+", label: "прибавить" },
  { id: "subtract", sym: "−", label: "вычесть"   },
];

const FORMATS: { id: FormulaFormat; label: string; example: string }[] = [
  { id: "percent", label: "Процент",  example: "34.5%"     },
  { id: "money",   label: "Деньги",   example: "12 345 ₽"  },
  { id: "number",  label: "Число",    example: "1 234"     },
];

type Tab = "simple" | "preset" | "custom";

interface WidgetEditorProps {
  initial?: Widget;
  onSave:   (w: Widget) => void;
  onClose:  () => void;
}

export function WidgetEditor({ initial, onSave, onClose }: WidgetEditorProps) {
  const isEdit = !!initial;

  const initTab = (): Tab => {
    if (!initial) return "simple";
    if (initial.config.kind === "simple") return "simple";
    if ((initial.config as CompositeWidgetConfig).presetId) return "preset";
    return "custom";
  };

  const [tab,       setTab]       = useState<Tab>(initTab);
  const [title,     setTitle]     = useState(initial?.title ?? "");
  const [size,      setSize]      = useState<WidgetSize>(initial?.size ?? "small");
  const [mode,      setMode]      = useState<WidgetMode>(initial?.mode ?? "card");
  const [chartType, setChartType] = useState<ChartType>(initial?.chartType ?? "bar");

  const simpleInit = initial?.config.kind === "simple" ? initial.config as SimpleWidgetConfig : null;
  const [simpleSource, setSimpleSource] = useState<DataSource>(simpleInit?.source ?? "calls");
  const [simpleMetric, setSimpleMetric] = useState<string>(simpleInit?.metric ?? "incoming");

  const compInit = initial?.config.kind === "composite" ? initial.config as CompositeWidgetConfig : null;
  const [presetId, setPresetId] = useState<string>(compInit?.presetId ?? COMPOSITE_PRESETS[0].id);

  const [customASource,  setCustomASource]  = useState<DataSource>("calls");
  const [customAMetric,  setCustomAMetric]  = useState<string>("incoming");
  const [customBMode,    setCustomBMode]    = useState<"source" | "value">("source");
  const [customBSource,  setCustomBSource]  = useState<DataSource>("appointments");
  const [customBMetric,  setCustomBMetric]  = useState<string>("total");
  const [customBValue,   setCustomBValue]   = useState<number>(100);
  const [customOp,       setCustomOp]       = useState<FormulaOp>("divide");
  const [customFormat,   setCustomFormat]   = useState<FormulaFormat>("percent");

  function handleSave() {
    let config: SimpleWidgetConfig | CompositeWidgetConfig;
    if (tab === "simple") {
      config = { kind: "simple", source: simpleSource, metric: simpleMetric };
    } else if (tab === "preset") {
      const preset = COMPOSITE_PRESETS.find(p => p.id === presetId)!;
      config = { kind: "composite", presetId, formula: preset.formula };
    } else {
      config = {
        kind: "composite",
        formula: {
          a:  { source: customASource, metric: customAMetric },
          b:  customBMode === "source"
                ? { source: customBSource, metric: customBMetric }
                : { value: customBValue },
          op: customOp, format: customFormat,
        },
      };
    }
    const autoTitle = () => {
      if (tab === "simple") return getMetricLabel(simpleSource, simpleMetric);
      if (tab === "preset") return COMPOSITE_PRESETS.find(p => p.id === presetId)?.label ?? "Метрика";
      return "Пользовательская метрика";
    };
    onSave({
      id: initial?.id ?? newWidgetId(),
      title: title.trim() || autoTitle(),
      size, mode,
      chartType: mode === "chart" ? chartType : undefined,
      config,
    });
  }

  const simpleMetrics  = SOURCE_METRICS[simpleSource] ?? [];
  const customAMetrics = SOURCE_METRICS[customASource] ?? [];
  const customBMetrics = SOURCE_METRICS[customBSource] ?? [];

  // ── Переиспользуемые блоки ──
  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{children}</p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">

        {/* Шапка */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-2xl">
          <h2 className="text-sm font-semibold">{isEdit ? "Редактировать виджет" : "Новый виджет"}</h2>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/60 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Тип */}
          <div>
            <Label>Тип метрики</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "simple" as Tab,  label: "Простая",       desc: "Один показатель",    icon: "📊" },
                { id: "preset" as Tab,  label: "Готовая",       desc: "Конверсия, явка...",  icon: "✨" },
                { id: "custom" as Tab,  label: "Своя формула",  desc: "A ÷ B × C",          icon: "🧮" },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    tab === t.id
                      ? "border-foreground/50 bg-muted/60 shadow-sm"
                      : "border-border hover:border-foreground/20 hover:bg-muted/30"
                  }`}>
                  <div className="text-lg mb-1">{t.icon}</div>
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Простая метрика */}
          {tab === "simple" && (
            <div className="space-y-4">
              <div>
                <Label>Источник данных</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(SOURCE_META) as [DataSource, typeof SOURCE_META[DataSource]][]).map(([id, meta]) => {
                    const Icon = meta.icon;
                    const sel  = simpleSource === id;
                    return (
                      <button key={id} onClick={() => { setSimpleSource(id); setSimpleMetric(SOURCE_METRICS[id][0].key); }}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          sel ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:border-foreground/20 hover:bg-muted/20"
                        }`}>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div>
                          <div className="text-xs font-medium">{meta.label}</div>
                        </div>
                        {sel && <Check className="h-3.5 w-3.5 ml-auto text-foreground/60" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Метрика</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {simpleMetrics.map(m => (
                    <button key={m.key} onClick={() => setSimpleMetric(m.key)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition-all ${
                        simpleMetric === m.key
                          ? "border-foreground/40 bg-muted/60 font-semibold shadow-sm"
                          : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground hover:bg-muted/20"
                      }`}>
                      <span>{m.label}</span>
                      {simpleMetric === m.key && <Check className="h-3 w-3 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Готовые пресеты */}
          {tab === "preset" && (
            <div>
              <Label>Выберите метрику</Label>
              <div className="space-y-1.5">
                {COMPOSITE_PRESETS.map(p => (
                  <button key={p.id}
                    onClick={() => p.available && setPresetId(p.id)}
                    disabled={!p.available}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      !p.available
                        ? "border-border opacity-40 cursor-not-allowed bg-muted/10"
                        : presetId === p.id
                          ? "border-foreground/40 bg-muted/60 shadow-sm"
                          : "border-border hover:border-foreground/20 hover:bg-muted/20"
                    }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{p.label}</span>
                        {!p.available && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground">Нет данных</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                    </div>
                    {p.available && presetId === p.id && <Check className="h-4 w-4 flex-shrink-0 text-foreground/60" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Своя формула */}
          {tab === "custom" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Конструктор формулы</p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">Результат = A [операция] B</p>
              </div>

              {/* A */}
              <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                <p className="text-[11px] font-bold text-muted-foreground">A — числитель</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={customASource}
                    onChange={e => { setCustomASource(e.target.value as DataSource); setCustomAMetric(SOURCE_METRICS[e.target.value as DataSource][0].key); }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none">
                    {Object.entries(SOURCE_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                  </select>
                  <select value={customAMetric} onChange={e => setCustomAMetric(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none">
                    {customAMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Операция */}
              <div>
                <Label>Операция</Label>
                <div className="grid grid-cols-4 gap-2">
                  {OPS.map(o => (
                    <button key={o.id} onClick={() => setCustomOp(o.id)}
                      className={`rounded-xl border py-2.5 text-center transition-all ${
                        customOp === o.id ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:bg-muted/30"
                      }`}>
                      <div className="text-lg font-bold">{o.sym}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{o.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* B */}
              <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground">B — знаменатель</p>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button onClick={() => setCustomBMode("source")}
                      className={`px-3 py-1 text-[10px] font-medium transition-colors ${
                        customBMode === "source" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground hover:bg-muted/40"
                      }`}>Метрика</button>
                    <button onClick={() => setCustomBMode("value")}
                      className={`px-3 py-1 text-[10px] font-medium transition-colors ${
                        customBMode === "value" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground hover:bg-muted/40"
                      }`}>Число</button>
                  </div>
                </div>
                {customBMode === "source" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={customBSource}
                      onChange={e => { setCustomBSource(e.target.value as DataSource); setCustomBMetric(SOURCE_METRICS[e.target.value as DataSource][0].key); }}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none">
                      {Object.entries(SOURCE_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                    </select>
                    <select value={customBMetric} onChange={e => setCustomBMetric(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none">
                      {customBMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <input type="number" value={customBValue} onChange={e => setCustomBValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none" />
                )}
              </div>

              {/* Формат */}
              <div>
                <Label>Формат результата</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map(f => (
                    <button key={f.id} onClick={() => setCustomFormat(f.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        customFormat === f.id ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:bg-muted/20"
                      }`}>
                      <div className="text-xs font-semibold">{f.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{f.example}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Название */}
          <div>
            <Label>Название виджета</Label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Оставьте пустым для автоматического"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10" />
          </div>

          {/* Размер */}
          <div>
            <Label>Размер</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "small"  as WidgetSize, label: "Маленький",  icon: Square,    desc: "1 колонка" },
                { id: "medium" as WidgetSize, label: "Средний",    icon: Columns2,  desc: "2 колонки" },
                { id: "large"  as WidgetSize, label: "Большой",    icon: Maximize2, desc: "3 колонки" },
              ]).map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.id} onClick={() => setSize(s.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      size === s.id ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:bg-muted/20"
                    }`}>
                    <Icon className="h-4 w-4 mb-1.5 text-muted-foreground" />
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Режим */}
          <div>
            <Label>Отображение</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "number" as WidgetMode, label: "Только число",  desc: "Минимально",        icon: "🔢" },
                { id: "card"   as WidgetMode, label: "Карточка",      desc: "Число + бейдж",     icon: "🪪" },
                { id: "chart"  as WidgetMode, label: "С графиком",    desc: "Число + мини-график", icon: "📈" },
              ]).map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    mode === m.id ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:bg-muted/20"
                  }`}>
                  <div className="text-lg mb-1">{m.icon}</div>
                  <div className="text-xs font-semibold">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Тип графика */}
          {mode === "chart" && (
            <div>
              <Label>Тип графика</Label>
              <div className="flex gap-2">
                {([
                  { id: "bar"  as ChartType, label: "Столбцы",  icon: BarChart2  },
                  { id: "line" as ChartType, label: "Линия",    icon: LineChart  },
                  { id: "area" as ChartType, label: "Область",  icon: AreaIcon   },
                ]).map(c => {
                  const Icon = c.icon;
                  return (
                    <button key={c.id} onClick={() => setChartType(c.id)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                        chartType === c.id ? "border-foreground/40 bg-muted/60 shadow-sm" : "border-border hover:bg-muted/20"
                      }`}>
                      <Icon className="h-3.5 w-3.5" />{c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
              Отмена
            </button>
            <button onClick={handleSave}
              className="flex-1 rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
              {isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
