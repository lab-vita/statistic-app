"use client";

import { useState } from "react";
import { X, Plus, Phone, Check } from "lucide-react";
import { WIDGET_TYPES, WidgetTypeDef } from "@/lib/grid";
import { CALLS_SINGLE_METRICS, CallsSingleMetric } from "@/components/widgets/calls-single";
import { CallsSinglePreview    } from "@/components/widget-previews";
import { CallsTrioPreview      } from "@/components/widget-previews";
import { CallsChartPreview     } from "@/components/widget-previews";
import { CallsFullPreview      } from "@/components/widget-previews";
import { CallsOperatorsPreview } from "@/components/widget-previews";

const GROUPS = ["Звонки"];

function Preview({ type }: { type: string }) {
  switch (type) {
    case "calls_single":    return <CallsSinglePreview />;
    case "calls_trio":      return <CallsTrioPreview />;
    case "calls_chart":     return <CallsChartPreview />;
    case "calls_full":      return <CallsFullPreview />;
    case "calls_operators": return <CallsOperatorsPreview />;
    default: return <div className="h-full bg-muted/20 rounded-xl" />;
  }
}

// Виджеты с настройками — показываем шаг выбора перед добавлением
const CONFIGURABLE = ["calls_single"];

interface WidgetCatalogProps {
  onAdd:   (type: string, config?: Record<string, string>) => void;
  onClose: () => void;
}

export function WidgetCatalog({ onAdd, onClose }: WidgetCatalogProps) {
  const [group, setGroup] = useState(GROUPS[0]);
  // Если не null — показываем шаг конфигурации для этого виджета
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<CallsSingleMetric>("incoming");

  const items = WIDGET_TYPES.filter(w => w.group === group);

  function handleAdd(typeId: string) {
    if (CONFIGURABLE.includes(typeId)) {
      setConfiguring(typeId);
    } else {
      onAdd(typeId);
    }
  }

  function handleConfirm() {
    if (configuring === "calls_single") {
      onAdd(configuring, { metric: selectedMetric });
    }
    setConfiguring(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-3xl w-full max-w-4xl max-h-[85vh]
        flex flex-col overflow-hidden shadow-2xl">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            {configuring ? (
              <>
                <h2 className="text-base font-semibold">Настройка виджета</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Выберите метрику для отображения</p>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold">Добавить виджет</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Выберите виджет и добавьте его на главный экран</p>
              </>
            )}
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Шаг конфигурации */}
{configuring === "calls_single" ? (
  <div className="flex flex-col p-6 gap-5">

    <div className="grid grid-cols-4 gap-2">
      {CALLS_SINGLE_METRICS.map(m => {
        const selected = selectedMetric === m.key;
        const COLORS: Record<string, { from: string; to: string }> = {
          incoming:       { from: "#2563eb", to: "#1d4ed8" },
          received:       { from: "#0891b2", to: "#0e7490" },
          outgoing:       { from: "#7c3aed", to: "#6d28d9" },
          missed:         { from: "#dc2626", to: "#b91c1c" },
          missed_pct:     { from: "#e11d48", to: "#be123c" },
          callback_count: { from: "#0d9488", to: "#0f766e" },
          callback_pct:   { from: "#059669", to: "#047857" },
          avg_duration:   { from: "#d97706", to: "#b45309" },
          conversion:     { from: "#16a34a", to: "#15803d" },
        };
        const EXAMPLE: Record<string, string> = {
          incoming:       "2 239",
          received:       "2 507",
          outgoing:       "3 099",
          missed:         "268",
          missed_pct:     "10,7%",
          callback_count: "214",
          callback_pct:   "79.9%",
          avg_duration:   "3м 12с",
          conversion:     "34.5%",
        };
        const c = COLORS[m.key];
        return (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(m.key)}
            className={`relative rounded-2xl overflow-hidden text-left transition-all duration-150
              ring-2 ${selected ? "ring-primary scale-[1.03]" : "ring-transparent hover:scale-[1.01]"}`}
          >
            {/* Цветной блок */}
            <div
              className="h-16 w-full flex flex-col justify-between p-3 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full bg-white/10" />
              <div className="text-lg font-bold text-white tracking-tight z-10">
                {EXAMPLE[m.key]}
              </div>
              {selected && (
                <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-white/30
                  flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>

            {/* Подпись */}
            <div className={`px-3 py-2 border-t text-[11px] font-medium leading-tight
              ${selected
                ? "bg-primary/5 border-primary/20 text-foreground"
                : "bg-card border-border text-muted-foreground"
              }`}>
              {m.label}
            </div>
          </button>
        );
      })}
    </div>

    <div className="flex gap-3">
      <button
        onClick={() => setConfiguring(null)}
        className="flex-1 py-2.5 rounded-xl border border-border text-sm
          text-muted-foreground hover:bg-muted/40 transition-colors"
      >
        Назад
      </button>
      <button
        onClick={handleConfirm}
        className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90
          text-primary-foreground text-sm font-semibold transition-colors"
      >
        Добавить
      </button>
    </div>
  </div>
) : (
          /* Галерея */
          <div className="flex flex-1 min-h-0">
            {/* Боковая панель */}
            <div className="w-44 flex-shrink-0 border-r border-border p-3 space-y-1">
              {GROUPS.map(g => (
                <button key={g} onClick={() => setGroup(g)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm
                    transition-colors ${
                      group === g
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}>
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  {g}
                </button>
              ))}
            </div>

            {/* Карточки */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                {items.map(def => (
                  <div key={def.id}
                    className="rounded-2xl border border-border bg-muted/20 overflow-hidden
                      hover:bg-muted/30 transition-all duration-200">
                    <div className="h-44 p-3 bg-muted/10">
                      <Preview type={def.id} />
                    </div>
                    <div className="p-4 border-t border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{def.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{def.description}</div>
                          <span className="inline-block mt-2 text-[10px] text-muted-foreground/50
                            bg-muted/50 px-2 py-0.5 rounded-md">
                            {def.defaultW} × {def.defaultH}
                          </span>
                        </div>
                        <button onClick={() => handleAdd(def.id)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
                            bg-primary hover:bg-primary/90 text-primary-foreground
                            text-xs font-semibold transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                          Добавить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}