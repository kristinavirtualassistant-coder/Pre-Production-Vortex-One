import React from 'react';
import { SlidersHorizontal, X, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw } from 'lucide-react';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleOrder: string[];
  hiddenModules: Record<string, boolean>;
  moveModule: (index: number, direction: 'up' | 'down') => void;
  toggleVisibility: (id: string) => void;
  resetLayout: () => void;
  moduleMeta: Record<string, { title: string; desc: string }>;
}

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  moduleOrder,
  hiddenModules,
  moveModule,
  toggleVisibility,
  resetLayout,
  moduleMeta,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Customize Dashboard Layout</h3>
              <p className="text-xs text-slate-500">Reorder modules via drag &amp; drop or toggle visibility.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {moduleOrder.map((id, index) => {
            const meta = moduleMeta[id] || { title: id, desc: '' };
            const isHidden = hiddenModules[id];
            return (
              <div
                key={id}
                className="bg-slate-50 border border-slate-200 hover:border-cyan-300 rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-slate-900 truncate">{meta.title}</span>
                      {isHidden && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{meta.desc}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => moveModule(index, 'up')}
                    disabled={index === 0}
                    title="Move Up"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveModule(index, 'down')}
                    disabled={index === moduleOrder.length - 1}
                    title="Move Down"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleVisibility(id)}
                    title={isHidden ? 'Show Module' : 'Hide Module'}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      isHidden
                        ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={resetLayout}
            className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
