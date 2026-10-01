"use client";

import { useState } from "react";
import { X, Plus, Phone } from "lucide-react";
import { WIDGET_TYPES, WidgetTypeDef } from "@/lib/grid";
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

export function WidgetCatalog({ onAdd, onClose }: { onAdd:(type:string)=>void; onClose:()=>void }) {
  const [group, setGroup] = useState(GROUPS[0]);
  const items = WIDGET_TYPES.filter(w => w.group === group);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-3xl w-full max-w-4xl max-h-[85vh]
        flex flex-col overflow-hidden shadow-2xl">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Добавить виджет</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Выберите виджет и добавьте его на главный экран</p>
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">

          {/* Боковая панель */}
          <div className="w-44 flex-shrink-0 border-r border-border p-3 space-y-1">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGroup(g)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                  group === g
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}>
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {g}
              </button>
            ))}
          </div>

          {/* Галерея */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              {items.map(def => (
                <div key={def.id}
                  className="rounded-2xl border border-border bg-muted/20 overflow-hidden
                    hover:bg-muted/30 transition-all duration-200">

                  {/* Превью */}
                  <div className="h-44 p-3 bg-muted/10">
                    <Preview type={def.id} />
                  </div>

                  {/* Описание */}
                  <div className="p-4 border-t border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{def.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{def.description}</div>
                        <span className="inline-block mt-2 text-[10px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-md">
                          {def.defaultW} × {def.defaultH}
                        </span>
                      </div>
                      <button onClick={() => onAdd(def.id)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
                          bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors">
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
      </div>
    </div>
  );
}