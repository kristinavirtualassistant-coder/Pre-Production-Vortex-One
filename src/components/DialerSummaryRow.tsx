import React from 'react';

interface DialerSummaryProps {
  liveCalls: number;
  successfulDials: number;
  voicemailsSent: number;
}

export const DialerSummaryRow: React.FC<DialerSummaryProps> = ({ liveCalls, successfulDials, voicemailsSent }) => {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[
        { label: 'Live Calls Today', value: liveCalls },
        { label: 'Successful Dials', value: successfulDials },
        { label: 'Voicemail Drops Sent', value: voicemailsSent },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{stat.label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};
