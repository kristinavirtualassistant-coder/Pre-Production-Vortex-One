import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const DispositionChart: React.FC = () => {
    const [data, setData] = useState<{ name: string; count: number }[]>([]);

    useEffect(() => {
        fetch('/api/audit/logs')
            .then(res => res.json())
            .then(logs => {
                const dispositions: Record<string, number> = {};
                logs.filter((log: any) => log.action === 'call_disposition')
                    .forEach((log: any) => {
                        const disp = log.input?.disposition || 'unknown';
                        dispositions[disp] = (dispositions[disp] || 0) + 1;
                    });
                
                const chartData = Object.entries(dispositions).map(([name, count]) => ({
                    name,
                    count
                }));
                setData(chartData);
            });
    }, []);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
            <h2 className="text-lg font-bold mb-4">Frequent Dispositions</h2>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
