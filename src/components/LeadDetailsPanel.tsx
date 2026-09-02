import React from 'react';
import { User, Building, Phone } from 'lucide-react';

interface LeadDetailsPanelProps {
  name: string;
  phone: string;
  address: string;
  brief: string;
}

export const LeadDetailsPanel: React.FC<LeadDetailsPanelProps> = ({ name, phone, address, brief }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Lead Details</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg"><User className="w-4 h-4 text-slate-600" /></div>
          <p className="text-sm font-semibold text-slate-800">{name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg"><Phone className="w-4 h-4 text-slate-600" /></div>
          <p className="text-sm text-slate-600">{phone}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg"><Building className="w-4 h-4 text-slate-600" /></div>
          <p className="text-sm text-slate-600">{address}</p>
        </div>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Call Brief</p>
            <p className="text-sm text-slate-700">{brief}</p>
        </div>
      </div>
    </div>
  );
};
