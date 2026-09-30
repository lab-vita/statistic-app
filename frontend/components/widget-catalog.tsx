"use client";

import { useState } from "react";
import { X, Plus, Phone } from "lucide-react";
import { WIDGET_TYPES, WidgetTypeDef } from "@/lib/grid";
import { CallsSinglePreview } from "@/components/widget-previews";
import { CallsTrioPreview   } from "@/components/widget-previews";
import { CallsChartPreview  } from "@/components/widget-previews";
import { CallsFullPreview   } from "@/components/widget-previews";
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

interface WidgetCatalogProps {
  onAdd:   (type: string) => void;
  onClose: () => void;
}

export function WidgetCatalog({ onAdd, onClose }: WidgetCatalogProps) {
  const [group, setGroup] = useState(GROUPS[0]);

  const items = WIDGET_TYPES.filter(w => w.group === group);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh]
        flex flex-col overflow-hidden shadow-2xl">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">Добавить виджет</h2>
            <p className="text-xs text-white/40 mt-0.5">Выберите виджет и добавьте его на главный экран</p>
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center
              hover:bg-white/20 transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Тело */}
        <div className="flex flex-1 min-h-0">

          {/* Боковая панель групп */}
          <div className="w-40 flex-shrink-0 border-r border-white/10 p-3 space-y-1">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGroup(g)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm
                  transition-colors ${
                    group === g
                      ? "bg-blue-500/20 text-blue-300 font-medium"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}>
                <Phone className="h-3.5 w-3.5" />
                {g}
              </button>
            ))}
          </div>

          {/* Галерея виджетов */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              {items.map(def => (
                <CatalogCard key={def.id} def={def} onAdd={() => onAdd(def.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ def, onAdd }: { def: WidgetTypeDef; onAdd: () => void }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 overflow-hidden
      hover:border-white/20 hover:bg-white/8 transition-all duration-200">

      {/* Превью */}
      <div className="h-40 p-3 bg-white/3">
        <div className="h-full">
          <Preview type={def.id} />
        </div>
      </div>

      {/* Описание */}
      <div className="p-4 border-t border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{def.name}</div>
            <div className="text-[11px] text-white/40 mt-1 leading-relaxed">{def.description}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-white/25 bg-white/5 px-2 py-0.5 rounded-md">
                {def.defaultW} × {def.defaultH}
              </span>
            </div>
          </div>
          <button onClick={onAdd}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
              bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold
              transition-colors shadow-lg shadow-blue-500/20">
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
