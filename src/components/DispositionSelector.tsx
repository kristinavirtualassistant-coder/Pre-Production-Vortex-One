import React from 'react';

interface DispositionSelectorProps {
  onSelect: (disposition: string) => void;
  selected?: string;
}

export const DispositionSelector: React.FC<DispositionSelectorProps> = ({ onSelect, selected }) => {
  const dispositions = [
    { id: 'no_answer', label: 'No Answer' },
    { id: 'busy', label: 'Busy' },
    { id: 'interested', label: 'Interested' },
    { id: 'not_interested', label: 'Not Interested' },
    { id: 'follow_up', label: 'Follow Up' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-4">
      <h3 className="text-sm font-bold text-slate-900 mb-4">Call Disposition</h3>
      <div className="grid grid-cols-2 gap-2">
        {dispositions.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
              selected === d.id
                ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
};
