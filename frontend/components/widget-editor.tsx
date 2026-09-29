"use client";

import { useState } from "react";
import {
  Widget, WidgetSize, WidgetMode, ChartType,
  SimpleWidgetConfig, CompositeWidgetConfig,
  DataSource, FormulaOp, FormulaFormat,
  SOURCE_METRICS, COMPOSITE_PRESETS,
  newWidgetId, getMetricLabel,
} from "@/lib/dashboard";
import { X, Plus, Sparkles, BarChart2, Hash, CreditCard } from "lucide-react";

const SOURCES: { id: DataSource; label: string }[] = [
  { id: "calls",        label: "Звонки"     },
  { id: "appointments", label: "Записи"     },
  { id: "revenue",      label: "Выручка"    },
  { id: "sales",        label: "Услуги"     },
];

const OPS: { id: FormulaOp; label: string }[] = [
  { id: "divide",   label: "÷ делить"      },
  { id: "multiply", label: "× умножить"    },
  { id: "add",      label: "+ прибавить"   },
  { id: "subtract", label: "− вычесть"     },
];

const FORMATS: { id: FormulaFormat; label: string; icon: any }[] = [
  { id: "number",  label: "Число",    icon: Hash       },
  { id: "percent", label: "Процент",  icon: Sparkles   },
  { id: "money",   label: "Деньги ₽", icon: CreditCard },
];

const SIZES: { id: WidgetSize; label: string; cols: string }[] = [
  { id: "small",  label: "Маленький",  cols: "1 колонка"  },
  { id: "medium", label: "Средний",    cols: "2 колонки"  },
  { id: "large",  label: "Большой",    cols: "3 колонки"  },
];

const MODES: { id: WidgetMode; label: string; desc: string }[] = [
  { id: "number", label: "Число",          desc: "Только значение"          },
  { id: "card",   label: "Карточка",        desc: "Значение + дельта к пред." },
  { id: "chart",  label: "С графиком",     desc: "Значение + мини-график"    },
];

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "bar",  label: "Столбцы" },
  { id: "line", label: "Линия"   },
  { id: "area", label: "Область" },
];

type Tab = "simple" | "preset" | "custom";

interface WidgetEditorProps {
  initial?: Widget;
  onSave:   (w: Widget) => void;
  onClose:  () => void;
}

export function WidgetEditor({ initial, onSave, onClose }: WidgetEditorProps) {
  const isEdit = !!initial;

  // Определяем начальный таб
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

  // Simple
  const simpleInit = initial?.config.kind === "simple" ? initial.config as SimpleWidgetConfig : null;
  const [simpleSource, setSimpleSource] = useState<DataSource>(simpleInit?.source ?? "calls");
  const [simpleMetric, setSimpleMetric] = useState<string>(simpleInit?.metric ?? "incoming");

  // Preset
  const compInit = initial?.config.kind === "composite" ? initial.config as CompositeWidgetConfig : null;
  const [presetId, setPresetId] = useState<string>(compInit?.presetId ?? COMPOSITE_PRESETS[0].id);

  // Custom formula
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
          a:      { source: customASource, metric: customAMetric },
          b:      customBMode === "source"
                    ? { source: customBSource, metric: customBMetric }
                    : { value: customBValue },
          op:     customOp,
          format: customFormat,
        },
      };
    }

    const autoTitle = (): string => {
      if (tab === "simple")  return getMetricLabel(simpleSource, simpleMetric);
      if (tab === "preset")  return COMPOSITE_PRESETS.find(p => p.id === presetId)?.label ?? "Метрика";
      return "Пользовательская метрика";
    };

    onSave({
      id:         initial?.id ?? newWidgetId(),
      title:      title.trim() || autoTitle(),
      size, mode,
      chartType:  mode === "chart" ? chartType : undefined,
      config,
    });
  }

  // Метрики выбранного источника (simple)
  const simpleMetrics = SOURCE_METRICS[simpleSource] ?? [];
  const customAMetrics = SOURCE_METRICS[customASource] ?? [];
  const customBMetrics = SOURCE_METRICS[customBSource] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">
            {isEdit ? "Редактировать виджет" : "Добавить виджет"}
          </h2>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Тип метрики */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Тип метрики</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "simple" as Tab,  label: "Простая",    desc: "Один показатель" },
                { id: "preset" as Tab,  label: "Готовая",    desc: "Конверсия, явка..." },
                { id: "custom" as Tab,  label: "Своя формула", desc: "A ÷ B × C" },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    tab === t.id
                      ? "border-foreground/40 bg-muted/60"
                      : "border-border hover:bg-muted/30"
                  }`}>
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Содержимое по табу */}
          {tab === "simple" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Источник</label>
                <div className="grid grid-cols-2 gap-2">
                  {SOURCES.map(s => (
                    <button key={s.id} onClick={() => { setSimpleSource(s.id); setSimpleMetric(SOURCE_METRICS[s.id][0].key); }}
                      className={`rounded-lg border px-3 py-2 text-xs text-left transition-colors ${
                        simpleSource === s.id ? "border-foreground/40 bg-muted/60 font-medium" : "border-border hover:bg-muted/30"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Метрика</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {simpleMetrics.map(m => (
                    <button key={m.key} onClick={() => setSimpleMetric(m.key)}
                      className={`rounded-lg border px-3 py-2 text-xs text-left transition-colors ${
                        simpleMetric === m.key ? "border-foreground/40 bg-muted/60 font-medium" : "border-border hover:bg-muted/30"
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "preset" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Выберите метрику</label>
              {COMPOSITE_PRESETS.map(p => (
                <button key={p.id} onClick={() => p.available && setPresetId(p.id)}
                  disabled={!p.available}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    !p.available
                      ? "border-border opacity-40 cursor-not-allowed"
                      : presetId === p.id
                        ? "border-foreground/40 bg-muted/60"
                        : "border-border hover:bg-muted/30"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{p.label}</span>
                    {!p.available && (
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">Недоступно</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                </button>
              ))}
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                Формула: <strong>A [операция] B</strong> → результат
              </div>

              {/* A */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground">A — числитель</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={customASource} onChange={e => { setCustomASource(e.target.value as DataSource); setCustomAMetric(SOURCE_METRICS[e.target.value as DataSource][0].key); }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                    {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <select value={customAMetric} onChange={e => setCustomAMetric(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                    {customAMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Операция */}
              <div className="flex items-center gap-2">
                {OPS.map(o => (
                  <button key={o.id} onClick={() => setCustomOp(o.id)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-mono transition-colors ${
                      customOp === o.id ? "border-foreground/40 bg-muted/60" : "border-border hover:bg-muted/30"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* B */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-muted-foreground">B — знаменатель</label>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => setCustomBMode("source")}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        customBMode === "source" ? "border-foreground/40 bg-muted/60" : "border-border"
                      }`}>Метрика</button>
                    <button onClick={() => setCustomBMode("value")}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                        customBMode === "value" ? "border-foreground/40 bg-muted/60" : "border-border"
                      }`}>Число</button>
                  </div>
                </div>
                {customBMode === "source" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={customBSource} onChange={e => { setCustomBSource(e.target.value as DataSource); setCustomBMetric(SOURCE_METRICS[e.target.value as DataSource][0].key); }}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                      {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <select value={customBMetric} onChange={e => setCustomBMetric(e.target.value)}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                      {customBMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <input type="number" value={customBValue} onChange={e => setCustomBValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
                )}
              </div>

              {/* Формат */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Формат результата</label>
                <div className="flex gap-2">
                  {FORMATS.map(f => (
                    <button key={f.id} onClick={() => setCustomFormat(f.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors ${
                        customFormat === f.id ? "border-foreground/40 bg-muted/60 font-medium" : "border-border hover:bg-muted/30"
                      }`}>
                      <f.icon className="h-3 w-3" />{f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Название */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Название виджета</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Оставьте пустым для автоматического"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>

          {/* Размер */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Размер</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map(s => (
                <button key={s.id} onClick={() => setSize(s.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    size === s.id ? "border-foreground/40 bg-muted/60" : "border-border hover:bg-muted/30"
                  }`}>
                  <div className="text-xs font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.cols}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Режим отображения */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Отображение</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${
                    mode === m.id ? "border-foreground/40 bg-muted/60" : "border-border hover:bg-muted/30"
                  }`}>
                  <div className="text-xs font-medium">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Тип графика */}
          {mode === "chart" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Тип графика</label>
              <div className="flex gap-2">
                {CHART_TYPES.map(c => (
                  <button key={c.id} onClick={() => setChartType(c.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors ${
                      chartType === c.id ? "border-foreground/40 bg-muted/60 font-medium" : "border-border hover:bg-muted/30"
                    }`}>
                    <BarChart2 className="h-3 w-3" />{c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
              Отмена
            </button>
            <button onClick={handleSave}
              className="flex-1 rounded-lg bg-foreground text-background py-2 text-sm font-medium hover:opacity-90 transition-opacity">
              {isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
