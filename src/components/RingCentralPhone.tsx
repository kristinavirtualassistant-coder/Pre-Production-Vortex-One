import React from 'react';

export const RingCentralPhone: React.FC = () => {
  return (
    <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        RingCentral WebPhone
      </h2>
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center border border-slate-800">
        <p className="text-slate-500 text-sm">RingCentral Softphone Interface Active</p>
      </div>
      <div className="mt-4 text-xs text-slate-400">
        Status: Ready to receive/make calls
      </div>
    </div>
  );
};
