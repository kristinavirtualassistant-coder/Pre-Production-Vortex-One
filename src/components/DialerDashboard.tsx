import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DialerMetrics } from '../types';

interface DialerDashboardProps {
  data: DialerMetrics[];
}

export const DialerDashboard: React.FC<DialerDashboardProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
      <h2 className="text-lg font-bold mb-4">Campaign Performance</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="campaign_id" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="call_volume" fill="#0891b2" name="Volume" />
          <Bar dataKey="success_rate" fill="#10b981" name="Success Rate %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
