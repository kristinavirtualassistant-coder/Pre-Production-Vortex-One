import React from 'react';
import { DialerMetrics, CallRecord, DialerCampaign, LeadRecord } from '../types';
import { DialerPerformanceWidget } from './DialerPerformanceWidget';

interface DialerDashboardProps {
  data?: DialerMetrics[];
  calls?: CallRecord[];
  campaigns?: DialerCampaign[];
  leads?: LeadRecord[];
  selectedCampaignId?: string;
  onSelectLeadSource?: (source: string) => void;
}

export const DialerDashboard: React.FC<DialerDashboardProps> = ({
  data = [],
  calls = [],
  campaigns = [],
  leads = [],
  selectedCampaignId,
  onSelectLeadSource,
}) => {
  return (
    <div id="dialer-performance-dashboard" className="mb-6 scroll-mt-6">
      <DialerPerformanceWidget
        calls={calls}
        campaigns={campaigns}
        leads={leads}
        metrics={data}
        selectedCampaignId={selectedCampaignId}
        onSelectLeadSource={onSelectLeadSource}
      />
    </div>
  );
};
