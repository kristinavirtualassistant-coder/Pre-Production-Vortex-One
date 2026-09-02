import React, { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  Building,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Radio,
  FileText,
  Trash2,
  Filter,
  Send,
  Mic,
  MicOff,
  Star,
  Flame,
  BarChart3,
  Shuffle,
  ArrowUpDown,
  Zap,
  Layers,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DialerCampaign, CallRecord, VoicemailFile, DialerMetrics, TaskPriority, LeadRecord } from '../types';
import { BulkOutreachScheduleModal } from './BulkOutreachScheduleModal';
import { DialerSummaryRow } from './DialerSummaryRow';
import { DialerDashboard } from './DialerDashboard';
import { CampaignEfficiencySection } from './CampaignEfficiencySection';
import { CampaignEngagementHeatmap } from './CampaignEngagementHeatmap';
import { VoicemailDrawer } from './VoicemailDrawer';
import { CallTimer } from './CallTimer';
import { DispositionChart } from './DispositionChart';
import { CallTranscriptAnalyzer } from './CallTranscriptAnalyzer';
import { CallScriptsRepository } from './CallScriptsRepository';
import { DispositionSelector } from './DispositionSelector';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { RingCentralPhone } from './RingCentralPhone';
import { LiveSpeechTranscriptionIndicator } from './LiveSpeechTranscriptionIndicator';
import { VoicemailDropControl } from './VoicemailDropControl';
import { QuickSnippetsPanel } from './QuickSnippetsPanel';

import { useToast } from '../contexts/ToastContext';

interface DialerViewProps {
  campaigns: DialerCampaign[];
  calls: CallRecord[];
  leads?: LeadRecord[];
  onDialCall: (payload: any) => Promise<any>;
  onCreateCampaign?: (payload: any) => Promise<any>;
  onRefreshCampaigns?: () => void;
  onAddTask?: (task: { objective: string; priority: TaskPriority; due_date: string }) => void;
}

export const DialerView: React.FC<DialerViewProps> = ({
  campaigns,
  calls,
  leads = [],
  onDialCall,
  onCreateCampaign,
  onRefreshCampaigns,
  onAddTask,
}) => {
  const { addToast, setNotificationsPaused, isPaused } = useToast();
  const [localCampaigns, setLocalCampaigns] = useState<DialerCampaign[]>(campaigns);
  const [selectedCampaign, setSelectedCampaign] = useState<DialerCampaign>(campaigns[0] || null);

  const [isVoicemailDrawerOpen, setIsVoicemailDrawerOpen] = useState(false);
  const [voicemails, setVoicemails] = useState<VoicemailFile[]>([]);
  const [selectedVoicemailId, setSelectedVoicemailId] = useState<string>('');
  const [lastDroppedVoicemail, setLastDroppedVoicemail] = useState<{
    label: string;
    contactName: string;
    timestamp: string;
  } | null>(null);
  const [metrics, setMetrics] = useState<DialerMetrics[]>([]);

  useEffect(() => {
    setLocalCampaigns(campaigns);
    if (!selectedCampaign && campaigns.length > 0) {
      setSelectedCampaign(campaigns[0]);
    } else if (selectedCampaign) {
      const match = campaigns.find((c) => c.id === selectedCampaign.id);
      if (match) setSelectedCampaign(match);
    }
  }, [campaigns]);

  const [isDialing, setIsDialing] = useState(false);
  const [dialResult, setDialResult] = useState<CallRecord | null>(null);
  const [dialError, setDialError] = useState<string | null>(null);
  const [contactName, setContactName] = useState('Jonathan Sterling');
  const [phoneNumber, setPhoneNumber] = useState('(949) 555-0182');
  const [propertyAddress, setPropertyAddress] = useState('1420 Newport Blvd, Costa Mesa, CA');
  const [callBrief, setCallBrief] = useState(
    'Outbound pitch regarding zero vacancy downtime and 24/7 maintenance dispatch for 6-unit Newport Blvd asset.'
  );
  const [telephonyProvider] = useState<'ringcentral'>('ringcentral');
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [dialingMode, setDialingMode] = useState<'manual' | 'predictive'>('manual');
  const [callStartTime, setCallStartTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('callStartTime');
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    // Ensure notifications are unpaused when component unmounts or call ends
    if (!callStartTime) {
      setNotificationsPaused(false);
    }
    return () => {
      setNotificationsPaused(false);
    };
  }, [callStartTime, setNotificationsPaused]);

  useEffect(() => {
    if (callStartTime) {
        localStorage.setItem('callStartTime', callStartTime.toString());
        // Report state to server
        fetch('/api/agent/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'busy', leadId: dialResult?.id })
        });
    } else {
        localStorage.removeItem('callStartTime');
        // Report state to server
        fetch('/api/agent/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'wrapping_up' })
        });
        
        if (dialingMode === 'predictive') {
             fetch('/api/predictive/trigger', { method: 'POST' });
        }
    }
  }, [callStartTime, dialResult?.id, dialingMode]);
  
  const [suggestedTask, setSuggestedTask] = useState<string | null>(null);
  const [autoRecord, setAutoRecord] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [followUpTime, setFollowUpTime] = useState<string>('09:00');
  const [callNotes, setCallNotes] = useState('');
  const [callQualityRating, setCallQualityRating] = useState<number>(0);
  const [leadStatus, setLeadStatus] = useState('qualified');
  const [leadScore, setLeadScore] = useState(85);

  // --- Prioritized Lead Queue & Anti-Fatigue State ---
  const defaultLeadPool = useMemo<LeadRecord[]>(
    () => [
      {
        id: 'lead_q1',
        organization_id: '',
        owner_id: 'owner_1',
        primary_property_id: 'prop_1',
        owner_name: 'Jonathan Sterling (Sterling West Holdings LLC)',
        property_address: '1420 Newport Blvd, Costa Mesa, CA',
        phone_number: '(949) 555-0182',
        lead_score: 95,
        classification: 'high_priority',
        stage: 'outreach_ready',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date().toISOString(),
        next_recommended_action: 'Pitch zero-vacancy downtime & local management for 6-unit asset',
        created_at: new Date().toISOString(),
        units_count: 6,
        estimated_equity: 1850000,
        factors: [{ factor: 'High Equity ($1.85M)', impact: 25 }, { factor: 'Absentee Owner LLC', impact: 20 }],
      },
      {
        id: 'lead_q2',
        organization_id: '',
        owner_id: 'owner_2',
        primary_property_id: 'prop_2',
        owner_name: 'Elena Rostova & Partners',
        property_address: '884 Baker St, Costa Mesa, CA',
        phone_number: '(949) 555-0144',
        lead_score: 92,
        classification: 'high_priority',
        stage: 'qualified',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 2).toISOString(),
        next_recommended_action: 'Present zero-vacancy maintenance dispatch program for 8-unit parcel',
        created_at: new Date().toISOString(),
        units_count: 8,
        estimated_equity: 2400000,
        factors: [{ factor: 'Surging GIS Inquiries', impact: 30 }],
      },
      {
        id: 'lead_q3',
        organization_id: '',
        owner_id: 'owner_3',
        primary_property_id: 'prop_3',
        owner_name: 'Arthur Vance Trust',
        property_address: '2200 Harbor Blvd, Costa Mesa, CA',
        phone_number: '(949) 555-0199',
        lead_score: 88,
        classification: 'high_priority',
        stage: 'outreach_ready',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 5).toISOString(),
        next_recommended_action: 'Offer multi-family capital reserve underwriting audit',
        created_at: new Date().toISOString(),
        units_count: 12,
        estimated_equity: 3600000,
        factors: [{ factor: 'Long-term Ownership (>15 yrs)', impact: 22 }],
      },
      {
        id: 'lead_q4',
        organization_id: '',
        owner_id: 'owner_4',
        primary_property_id: 'prop_4',
        owner_name: 'Miramar Real Estate Partners LP',
        property_address: '340 17th St, Costa Mesa, CA',
        phone_number: '(949) 555-0132',
        lead_score: 84,
        classification: 'medium_priority',
        stage: 'identified',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 12).toISOString(),
        next_recommended_action: 'Follow up on preliminary tax valuation discrepancy',
        created_at: new Date().toISOString(),
        units_count: 4,
        estimated_equity: 1200000,
        factors: [{ factor: 'High Market Appreciation', impact: 15 }],
      },
      {
        id: 'lead_q5',
        organization_id: '',
        owner_id: 'owner_5',
        primary_property_id: 'prop_5',
        owner_name: 'Pacific Crest Assets Inc',
        property_address: '1901 Placentia Ave, Costa Mesa, CA',
        phone_number: '(949) 555-0165',
        lead_score: 81,
        classification: 'medium_priority',
        stage: 'identified',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 20).toISOString(),
        next_recommended_action: 'Present commercial zoning upside study',
        created_at: new Date().toISOString(),
        units_count: 5,
        estimated_equity: 1650000,
        factors: [{ factor: 'Absentee Corporate Entity', impact: 18 }],
      },
      {
        id: 'lead_q6',
        organization_id: '',
        owner_id: 'owner_6',
        primary_property_id: 'prop_6',
        owner_name: 'Claire Kensington Properties',
        property_address: '410 E 17th St, Costa Mesa, CA',
        phone_number: '(949) 555-0177',
        lead_score: 79,
        classification: 'medium_priority',
        stage: 'qualified',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 24).toISOString(),
        next_recommended_action: 'Discuss tenant retention & local leasing optimization',
        created_at: new Date().toISOString(),
        units_count: 6,
        estimated_equity: 1950000,
        factors: [{ factor: 'High Rental Yield Potential', impact: 15 }],
      },
      {
        id: 'lead_q7',
        organization_id: '',
        owner_id: 'owner_7',
        primary_property_id: 'prop_7',
        owner_name: 'David & Sharon Miller Family Trust',
        property_address: '720 W 19th St, Costa Mesa, CA',
        phone_number: '(949) 555-0121',
        lead_score: 76,
        classification: 'nurture',
        stage: 'contacted',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 30).toISOString(),
        next_recommended_action: 'Send quarterly Costa Mesa multi-family rent index',
        created_at: new Date().toISOString(),
        units_count: 3,
        estimated_equity: 980000,
        factors: [{ factor: 'Owner-Occupied Transition', impact: 10 }],
      },
      {
        id: 'lead_q8',
        organization_id: '',
        owner_id: 'owner_8',
        primary_property_id: 'prop_8',
        owner_name: 'Beacon Bay Holdings LLC',
        property_address: '550 Superior Ave, Newport Beach, CA',
        phone_number: '(949) 555-0158',
        lead_score: 74,
        classification: 'nurture',
        stage: 'identified',
        assigned_agent: 'agent_1' as any,
        dnc_compliant: true,
        last_activity_date: new Date(Date.now() - 3600000 * 48).toISOString(),
        next_recommended_action: 'Quarterly touchpoint regarding coastal CAP rates',
        created_at: new Date().toISOString(),
        units_count: 4,
        estimated_equity: 2800000,
        factors: [{ factor: 'High Value Coastal Asset', impact: 20 }],
      },
    ],
    []
  );

  const [queueLeads, setQueueLeads] = useState<LeadRecord[]>([]);
  const [queueOrderMode, setQueueOrderMode] = useState<'priority' | 'shuffled'>('priority');
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleToast, setShuffleToast] = useState<{ message: string; timestamp: number } | null>(null);
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);

  // Initialize and synchronize lead queue from props
  useEffect(() => {
    if (leads && leads.length > 0) {
      const sorted = [...leads].sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
      setQueueLeads(sorted);
    } else {
      setQueueLeads(defaultLeadPool);
    }
  }, [leads, defaultLeadPool]);

  // Auto-dismiss shuffle notification after 5 seconds
  useEffect(() => {
    if (shuffleToast) {
      const timer = setTimeout(() => setShuffleToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [shuffleToast]);

  /**
   * Randomly reorders the lead queue using Fisher-Yates algorithm to prevent calling fatigue
   */
  const handleShuffleQueue = async () => {
    setIsShuffling(true);
    
    // Fisher-Yates shuffle
    const array = [...queueLeads];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    setQueueLeads(array);
    setQueueOrderMode('shuffled');

    // Automatically load the newly top-ranked lead into the Live Dialer Console
    if (array.length > 0) {
      const top = array[0];
      setContactName(top.owner_name || 'Prospect Owner');
      setPhoneNumber(top.phone_number || '(949) 555-0182');
      setPropertyAddress(top.property_address || '');
      if (top.lead_score) setLeadScore(top.lead_score);
      setCallBrief(
        top.next_recommended_action ||
        `Outbound pitch regarding zero vacancy downtime and 24/7 maintenance dispatch for ${top.property_address}.`
      );
    }

    // Call backend shuffle endpoint if campaign exists
    if (selectedCampaign?.id) {
      try {
        await fetch(`/api/campaigns/${selectedCampaign.id}/shuffle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: '' }),
        });
      } catch (err) {
        console.warn('Backend campaign queue shuffle sync:', err);
      }
    }

    setShuffleToast({
      message: `Queue Shuffled! 🎲 ${array.length} prospects randomized to prevent agent outreach fatigue. Next up: ${array[0]?.owner_name || 'Top Lead'}.`,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      setIsShuffling(false);
    }, 500);
  };

  /**
   * Restores the queue order to highest dynamic lead score first
   */
  const handleSortByPriority = () => {
    const sorted = [...queueLeads].sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));
    setQueueLeads(sorted);
    setQueueOrderMode('priority');
    if (sorted.length > 0) {
      const top = sorted[0];
      setContactName(top.owner_name || 'Prospect Owner');
      setPhoneNumber(top.phone_number || '(949) 555-0182');
      setPropertyAddress(top.property_address || '');
      if (top.lead_score) setLeadScore(top.lead_score);
      setCallBrief(
        top.next_recommended_action ||
        `Outbound pitch regarding zero vacancy downtime and 24/7 maintenance dispatch for ${top.property_address}.`
      );
    }
    setShuffleToast({
      message: `Queue Restored! ⚡ Ordered by highest dynamic lead score priority.`,
      timestamp: Date.now(),
    });
  };

  const filteredQueueLeads = useMemo(() => {
    if (!queueSearchTerm.trim()) return queueLeads;
    const q = queueSearchTerm.toLowerCase();
    return queueLeads.filter(
      (l) =>
        l.owner_name?.toLowerCase().includes(q) ||
        l.property_address?.toLowerCase().includes(q) ||
        l.phone_number?.includes(q)
    );
  }, [queueLeads, queueSearchTerm]);

  const handleCallWrapUp = () => {
    setCallStartTime(null);
    setCallNotes('');
    setIsMuted(false);
    setShowFollowUpForm(false);
    setCallQualityRating(0);
  };

  const handleQuickDisposition = async (disposition: string) => {
    if (disposition === 'follow_up') {
        setShowFollowUpForm(true);
        return;
    }
    
    if (dialResult?.id) {
        try {
            // Save notes
            await fetch(`/api/calls/${dialResult.id}/notes`, {
                method: 'POST',
                body: JSON.stringify({ notes: callNotes }),
                headers: { 'Content-Type': 'application/json' }
            });

            // Update disposition / status
            await fetch(`/api/calls/${dialResult.id}/disposition`, {
                method: 'POST',
                body: JSON.stringify({ disposition }),
                headers: { 'Content-Type': 'application/json' }
            });
            
            // Log audit disposition
            await fetch('/api/audit/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'call_disposition',
                    callerId: dialResult.phoneNumber,
                    timestamp: new Date().toISOString(),
                    organizationId: '',
                    input: { disposition }
                })
            });
            
        } catch (err) {
            console.error('Failed to save notes or update disposition:', err);
        }
    }
    handleCallWrapUp();
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const nextState = !prev;
      // Optional logging for audit / telemetry
      console.log(`[Telephony] Microphone mute state changed to: ${nextState ? 'MUTED' : 'UNMUTED'}`);
      return nextState;
    });
  };

  const handleCancelFollowUp = () => {
    setShowFollowUpForm(false);
  };

  const handleConfirmFollowUp = async () => {
    if (!dialResult?.id) return;
    
    try {
      // 1. Save notes (with follow-up info appended)
      const enhancedNotes = `${callNotes}\n\n[Follow-up Scheduled]: ${followUpDate} at ${followUpTime}`;
      await fetch(`/api/calls/${dialResult.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes: enhancedNotes }),
        headers: { 'Content-Type': 'application/json' }
      });

      // 2. Update disposition
      await fetch(`/api/calls/${dialResult.id}/disposition`, {
        method: 'POST',
        body: JSON.stringify({ 
          disposition: 'follow_up',
          followUpAt: `${followUpDate}T${followUpTime}:00Z` 
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // 3. Log audit
      await fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'call_followup_scheduled',
          callerId: dialResult.phoneNumber,
          timestamp: new Date().toISOString(),
          organizationId: '',
          input: { 
            disposition: 'follow_up',
            scheduledAt: `${followUpDate}T${followUpTime}:00` 
          }
        })
      });

      // 4. Reset states and close call
      setShowFollowUpForm(false);
      handleCallWrapUp();
      addToast('Follow-up call successfully scheduled.', 'success');
      
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      addToast('Error scheduling follow-up.', 'error');
    }
  };

  const handleHold = () => {
    console.log('Hold call triggered');
  };

  const handleTransfer = () => {
    console.log('Transfer call triggered');
  };

  // Scheduling Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [campaignToReschedule, setCampaignToReschedule] = useState<DialerCampaign | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'scheduled' | 'active' | 'draft'>('all');

  // Suppression & DNC State
  const [suppressions, setSuppressions] = useState<Array<{ id: string; phone_number: string; reason: string; source: string; suppressed_at: string }>>([]);
  const [newDncNumber, setNewDncNumber] = useState('');
  const [newDncReason, setNewDncReason] = useState('National / State DNC Registry Match');
  const [showDncModal, setShowDncModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'suppression' | 'webhooks'>('console');
  const [webhookLog, setWebhookLog] = useState<any[]>([]);

  // Fetch suppression records on mount
  useEffect(() => {
    fetchSuppressions();
  }, []);

  // Fetch dialer metrics and voicemails on mount
  useEffect(() => {
    fetchDialerData();
  }, []);

  const fetchDialerData = async () => {
    try {
      const [metricsRes, voicemailsRes] = await Promise.all([
        fetch('/api/dialer/metrics'),
        fetch('/api/dialer/voicemails')
      ]);
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (voicemailsRes.ok) setVoicemails(await voicemailsRes.json());
    } catch (err) {
      console.error('Failed to fetch dialer data:', err);
    }
  };

  const handleUploadVoicemail = async (file: File, label: string) => {
    try {
      const response = await fetch('/api/dialer/voicemails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: '',
          label,
          url: `https://storage.googleapis.com/vortex-one-voicemails/${file.name}`,
        }),
      });
      if (response.ok) {
        fetchDialerData(); // Refresh list
      }
    } catch (err) {
      console.error('Failed to upload voicemail:', err);
    }
  };

  const handleDeleteVoicemail = async (id: string) => {
    try {
      const res = await fetch(`/api/dialer/voicemails/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setVoicemails((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete voicemail:', err);
    }
  };

  const handleDropVoicemail = async (vm: VoicemailFile) => {
    const durationSeconds = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
    const callId = dialResult?.id || `call_${Date.now()}`;
    const contact = contactName || 'Lead';

    try {
      // 1. Post to drop voicemail API
      await fetch(`/api/calls/${callId}/drop-voicemail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voicemailId: vm.id,
          voicemailLabel: vm.label,
          voicemailUrl: vm.url,
          callerId: phoneNumber,
          organizationId: '',
          durationSeconds,
        }),
      });

      // 2. Also log quick disposition
      await handleQuickDisposition('voicemail');
    } catch (err) {
      console.warn('Voicemail drop API call handled:', err);
    }

    // 3. Immediately disconnect agent from active call so they can move to next lead
    handleCallWrapUp();
    setLastDroppedVoicemail({
      label: vm.label,
      contactName: contact,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (dialResult) {
      setDialResult({
        ...dialResult,
        status: 'completed',
        disposition: 'voicemail',
        duration_seconds: durationSeconds,
      });
    }

    // Auto-advance if predictive dialing is enabled
    if (dialingMode === 'predictive') {
      setTimeout(() => {
        handleDialNextQueued();
      }, 700);
    }
  };

  const fetchSuppressions = async () => {
    try {
      const res = await fetch('/api/suppression');
      if (res.ok) {
        const data = await res.json();
        setSuppressions(data);
      }
    } catch (err) {
      console.warn('Failed to load suppressions:', err);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDncNumber) return;
    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: '',
          phone_number: newDncNumber,
          reason: newDncReason,
          source: 'manual_compliance_entry',
        }),
      });
      if (res.ok) {
        setNewDncNumber('');
        setShowDncModal(false);
        fetchSuppressions();
      }
    } catch (err) {
      console.error('Error adding suppression:', err);
    }
  };

  const handleRemoveSuppression = async (id: string) => {
    try {
      const res = await fetch(`/api/suppression/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSuppressions();
      }
    } catch (err) {
      console.error('Error removing suppression:', err);
    }
  };

  const handleDial = async () => {
    if (isDialing) return;
    setIsDialing(true);
    setDialResult(null);
    setDialError(null);

    try {
      const res = await onDialCall({
        organization_id: '',
        campaign_id: selectedCampaign?.id || 'camp_401',
        contact_name: contactName,
        phone_number: phoneNumber,
        property_address: propertyAddress,
        call_strategy_brief: callBrief,
        telephony_provider: telephonyProvider,
        auto_record: autoRecord,
      });

      if (res.error || res.isSuppressed) {
        setDialError(res.error || `TCPA Block: ${res.reason}`);
      } else {
        setDialResult(res);
        setCallStartTime(Date.now());
      }
    } catch (err: any) {
      setDialError(err.message || 'Call failed');
    } finally {
      setIsDialing(false);
    }
  };

  const handleDialNextQueued = async () => {
    if (isDialing) return;
    
    // Select the next contact in queue
    let targetLead = queueLeads[0];
    if (queueLeads.length > 1) {
      const currentIdx = queueLeads.findIndex(
        (l) => l.owner_name === contactName || l.phone_number === phoneNumber
      );
      const nextIdx = currentIdx >= 0 && currentIdx < queueLeads.length - 1 ? currentIdx + 1 : 0;
      targetLead = queueLeads[nextIdx];
    }

    if (targetLead) {
      setContactName(targetLead.owner_name || 'Prospect Owner');
      setPhoneNumber(targetLead.phone_number || '(949) 555-0182');
      setPropertyAddress(targetLead.property_address || '');
      if (targetLead.lead_score) setLeadScore(targetLead.lead_score);
      if (targetLead.next_recommended_action) setCallBrief(targetLead.next_recommended_action);
    }

    setIsDialing(true);
    setDialResult(null);
    setDialError(null);

    try {
      if (selectedCampaign) {
        const res = await fetch(`/api/campaigns/${selectedCampaign.id}/dial-next`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: '',
            telephony_provider: telephonyProvider,
          }),
        });
        const data = await res.json();
        if (data.status === 'suppressed') {
          setDialError(`TCPA Pre-Dial Block: Contact ${data.contact?.contact_name} is on the DNC list (${data.suppressionReason}). Auto-skipped.`);
        } else if (data.call) {
          setDialResult(data.call);
          setCallStartTime(Date.now());
        }
      } else {
        const res = await onDialCall({
          organization_id: '',
          campaign_id: 'camp_preview_queue',
          contact_name: targetLead?.owner_name || contactName,
          phone_number: targetLead?.phone_number || phoneNumber,
          property_address: targetLead?.property_address || propertyAddress,
          call_strategy_brief: targetLead?.next_recommended_action || callBrief,
          telephony_provider: telephonyProvider,
          auto_record: autoRecord,
        });
        if (res.error || res.isSuppressed) {
          setDialError(res.error || `TCPA Block: ${res.reason}`);
        } else {
          setDialResult(res);
          setCallStartTime(Date.now());
        }
      }
    } catch (err: any) {
      setDialError(err.message || 'Call failed');
    } finally {
      setIsDialing(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: '' }),
      });
      if (res.ok) {
        const updated = { ...selectedCampaign, status: 'active' as const, scheduled_at: undefined };
        setSelectedCampaign(updated);
        setLocalCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (onRefreshCampaigns) onRefreshCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: '' }),
      });
      if (res.ok) {
        const updated = { ...selectedCampaign, status: 'paused' as const };
        setSelectedCampaign(updated);
        setLocalCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (onRefreshCampaigns) onRefreshCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSchedule = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: '' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalCampaigns((prev) => prev.map((c) => (c.id === campaignId ? updated : c)));
        if (selectedCampaign?.id === campaignId) {
          setSelectedCampaign(updated);
        }
        if (onRefreshCampaigns) onRefreshCampaigns();
      }
    } catch (err) {
      console.error('Failed to cancel campaign schedule:', err);
    }
  };

  const handleCampaignCreatedOrUpdated = (camp: DialerCampaign) => {
    setLocalCampaigns((prev) => {
      const exists = prev.some((c) => c.id === camp.id);
      if (exists) {
        return prev.map((c) => (c.id === camp.id ? camp : c));
      }
      return [camp, ...prev];
    });
    setSelectedCampaign(camp);
    if (onRefreshCampaigns) onRefreshCampaigns();
  };

  const handlePlayVoicePreview = async () => {
    if (isPlayingTTS) return;
    setIsPlayingTTS(true);

    try {
      const pitch = `Hi ${contactName}, this is CMC Realty in Costa Mesa. We manage multi-family portfolios across Orange County and noticed your property on Newport Boulevard. We offer dedicated local vendor rates and zero vacancy downtime.`;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pitch, voice: 'Kore' }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.onended = () => setIsPlayingTTS(false);
        audio.onerror = () => setIsPlayingTTS(false);
        await audio.play();
      } else {
        setIsPlayingTTS(false);
      }
    } catch (err) {
      setIsPlayingTTS(false);
    }
  };

  const handleSimulateWebhook = async () => {
    const rawPayload = {
      eventId: `rc_sim_${Date.now()}`,
      telephonyCallId: selectedCampaign ? `call_sim_${selectedCampaign.id}` : 'call_sim_1',
      status: 'completed',
      disposition: 'interested',
      duration_seconds: 78,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/telephony/webhook/${telephonyProvider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawPayload),
      });
      const data = await res.json();
      setWebhookLog((prev) => [data, ...prev]);
    } catch (err) {
      console.error('Webhook simulation failed:', err);
    }
  };

  const handleSelectLeadForDial = (lead: {
    contact_name: string;
    phone_number: string;
    property_address: string;
    lead_score?: number;
    call_brief?: string;
  }) => {
    setContactName(lead.contact_name);
    setPhoneNumber(lead.phone_number);
    setPropertyAddress(lead.property_address);
    if (lead.lead_score) setLeadScore(lead.lead_score);
    if (lead.call_brief) setCallBrief(lead.call_brief);
    
    // Smooth scroll down to live dialer controls
    const el = document.getElementById('live-dialer-console');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <DialerSummaryRow liveCalls={12} successfulDials={45} voicemailsSent={18} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Dialer Engine &amp; Telephony Integration</h1>
            <p className="text-xs text-slate-500">
              Telephony FSM, automated campaign sessions, and TCPA-enforced suppression registry.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>RingCentral REST Telephony</span>
          </div>

          <button
            onClick={() => {
              const el = document.getElementById('dialer-performance-dashboard');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center space-x-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>📊 Performance KPIs</span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('campaign-engagement-heatmap');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center space-x-1.5 text-xs bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>🔥 Lead Heatmap</span>
          </button>

          <button
            onClick={() => {
              setCampaignToReschedule(null);
              setShowScheduleModal(true);
            }}
            className="flex items-center space-x-1.5 text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Schedule Campaign</span>
          </button>

          <button
            onClick={() => setIsVoicemailDrawerOpen(true)}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
          >
            <Mic className="w-3.5 h-3.5" /> Voicemail Library
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'console' ? 'suppression' : 'console')}
            className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer font-semibold ${
              activeTab === 'suppression'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>DNC &amp; TCPA ({suppressions.length})</span>
          </button>
        </div>
      </div>
      
      {/* Real-time Dialer Performance Dashboard Widget (Connect Ratio, Avg Duration by Lead Source) */}
      <DialerDashboard
        data={metrics}
        calls={calls}
        campaigns={localCampaigns}
        leads={leads}
        selectedCampaignId={selectedCampaign?.id}
      />
      
      {/* Campaign Efficiency & Unit Economics (CPL, ASR, Funnel) */}
      <CampaignEfficiencySection
        campaigns={localCampaigns}
        calls={calls}
        selectedCampaignId={selectedCampaign?.id}
        onSelectCampaign={(id) => {
          const matched = localCampaigns.find((c) => c.id === id);
          if (matched) setSelectedCampaign(matched);
        }}
      />

      {/* Campaign Lead Interaction Heatmap Overlay */}
      <div id="campaign-engagement-heatmap">
        <CampaignEngagementHeatmap
          campaign={selectedCampaign}
          allCampaigns={localCampaigns}
          calls={calls}
          leads={leads}
          onSelectLeadForDial={handleSelectLeadForDial}
          onSelectCampaign={(id) => {
            const matched = localCampaigns.find((c) => c.id === id);
            if (matched) setSelectedCampaign(matched);
          }}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Live Dialer Controls */}
          <div id="live-dialer-console" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm scroll-mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Live Telephony &amp; Dialer Console</h2>
                  <p className="text-xs text-slate-500">
                    Active Target: <span className="font-semibold text-slate-800">{contactName}</span> ({phoneNumber})
                  </p>
                </div>
              </div>

              {/* Queue Mode Badge */}
              <div className="flex items-center gap-2">
                {queueOrderMode === 'shuffled' ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                    <Shuffle className="w-3 h-3 text-purple-600" />
                    <span>🎲 Anti-Fatigue Shuffled Order</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-2xs">
                    <Zap className="w-3 h-3 text-cyan-600" />
                    <span>⚡ Priority Lead Score Order</span>
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center mb-4 gap-2 text-sm text-slate-700">
                <input 
                    type="checkbox" 
                    id="auto-record" 
                    checked={autoRecord}
                    onChange={(e) => setAutoRecord(e.target.checked)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="auto-record" className="font-medium">Automatic Call Recording</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <button
                id="btn-dial-current-lead"
                onClick={handleDial}
                disabled={isDialing}
                className="sm:col-span-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PhoneCall className="w-5 h-5" />
                <span>{isDialing ? 'Dialing...' : 'Dial Current Lead'}</span>
              </button>
              
              <button
                id="btn-dial-next-queue"
                onClick={handleDialNextQueued}
                disabled={isDialing}
                className="sm:col-span-4 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PhoneForwarded className="w-5 h-5" />
                <span>{isDialing ? 'Dialing...' : 'Dial Next In Queue'}</span>
              </button>

              <button
                id="btn-shuffle-queue-primary"
                type="button"
                onClick={handleShuffleQueue}
                disabled={isShuffling}
                className="sm:col-span-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:from-purple-800 active:to-indigo-800 text-white font-bold py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                title="Randomly reorders the lead queue to prevent agent fatigue and predictable calling sequence"
              >
                <Shuffle className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
                <span>Shuffle Queue</span>
              </button>

              <button
                id="btn-sort-priority-primary"
                type="button"
                onClick={handleSortByPriority}
                className="sm:col-span-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer text-xs"
                title="Reset queue order to highest dynamic lead score first"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Score Order</span>
              </button>
            </div>

            {/* Anti-fatigue feedback toast */}
            {shuffleToast && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shuffle className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-medium">{shuffleToast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShuffleToast(null)}
                  className="text-purple-500 hover:text-purple-800 text-xs font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {dialError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {dialError}
              </div>
            )}
          </div>

          {/* Prioritized Lead Queue & Anti-Fatigue Session Panel */}
          <div id="dialer-queue-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">Prioritized Outreach Queue</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                      {queueLeads.length} Prospects
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {queueOrderMode === 'shuffled'
                      ? '🎲 Anti-Fatigue Random Order active — outreach randomized across high-conviction owners.'
                      : '⚡ Ranked descending by dynamic composite Lead Score and high equity signals.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Secondary Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={queueSearchTerm}
                    onChange={(e) => setQueueSearchTerm(e.target.value)}
                    placeholder="Filter queue..."
                    className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-36"
                  />
                  {queueSearchTerm && (
                    <button
                      onClick={() => setQueueSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Shuffle Button in Queue Header */}
                <button
                  id="btn-shuffle-queue-panel"
                  type="button"
                  onClick={handleShuffleQueue}
                  disabled={isShuffling}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:from-purple-800 active:to-indigo-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                  title="Randomly reorder the current lead queue to prevent agent fatigue"
                >
                  <Shuffle className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
                  <span>Shuffle Queue</span>
                </button>

                {/* Sort by Priority Button */}
                <button
                  id="btn-sort-priority-panel"
                  type="button"
                  onClick={handleSortByPriority}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
                  title="Restore score priority order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sort Priority</span>
                </button>
              </div>
            </div>

            {/* Queue List Cards */}
            <div className="p-3 space-y-2">
              {filteredQueueLeads.slice(0, isQueueExpanded ? filteredQueueLeads.length : 5).map((lead, idx) => {
                const isCurrent = lead.owner_name === contactName || lead.phone_number === phoneNumber;
                const score = lead.lead_score || 80;
                const scoreColor =
                  score >= 90
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : score >= 80
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div
                    key={lead.id || `lead_row_${idx}`}
                    className={`p-3 rounded-lg border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-cyan-50/70 border-cyan-300 ring-1 ring-cyan-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black ${
                            isCurrent
                              ? 'bg-cyan-600 text-white'
                              : idx === 0
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold text-cyan-700 mt-0.5">Active</span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{lead.owner_name}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${scoreColor}`}>
                            ⭐ {score} pts
                          </span>
                          {lead.units_count && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                              {lead.units_count} units
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 flex items-center space-x-1.5">
                          <span>{lead.property_address}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-slate-500 font-semibold">{lead.phone_number || '(949) 555-0100'}</span>
                        </p>

                        {lead.next_recommended_action && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                            🎯 {lead.next_recommended_action}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end md:self-center shrink-0">
                      {isCurrent ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-100 text-cyan-800">
                          <Check className="w-3.5 h-3.5" />
                          <span>Loaded in Dialer</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectLeadForDial({
                              contact_name: lead.owner_name,
                              phone_number: lead.phone_number || '(949) 555-0100',
                              property_address: lead.property_address,
                              lead_score: lead.lead_score,
                              call_brief: lead.next_recommended_action,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-700 transition cursor-pointer flex items-center space-x-1"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Load Lead</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredQueueLeads.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No queued contacts matched &quot;{queueSearchTerm}&quot;.
                </div>
              )}
            </div>

            {filteredQueueLeads.length > 5 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => setIsQueueExpanded(!isQueueExpanded)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center space-x-1 cursor-pointer"
                >
                  <span>{isQueueExpanded ? 'Show Fewer Leads' : `View All ${filteredQueueLeads.length} Queued Prospects`}</span>
                  {isQueueExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
          
          <LeadDetailsPanel 
            name={contactName} 
            phone={phoneNumber} 
            address={propertyAddress} 
            brief={callBrief} 
          />
          
          <CallScriptsRepository 
            leadStatus={leadStatus}
            propertyAddress={propertyAddress}
            leadScore={leadScore}
          />
          
          <DispositionSelector onSelect={(d) => console.log('Disposition:', d)} />
        </div>
        
        <div className="space-y-6">
          <RingCentralPhone />
          <DispositionChart />
          
          {callStartTime && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Active Call</h2>
                    <select value={dialingMode} onChange={(e) => setDialingMode(e.target.value as 'manual' | 'predictive')} className="text-xs border border-slate-300 rounded p-1">
                        <option value="manual">Manual</option>
                        <option value="predictive">Predictive</option>
                    </select>
                </div>
                <CallTimer startTime={callStartTime} />
              </div>

              {showFollowUpForm ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Schedule Follow-Up Call
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Date</label>
                      <input 
                        type="date" 
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Time Slot</label>
                      <input 
                        type="time" 
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={handleCancelFollowUp}
                        className="text-xs py-2 border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-100 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmFollowUp}
                        className="text-xs py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-xs transition"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'Callback', value: 'callback' },
                    { label: 'DNC', value: 'dnc' },
                    { label: 'Follow Up', value: 'follow_up' },
                    { label: 'Voicemail', value: 'voicemail' },
                  ].map((d) => (
                    <button
                      key={d.value}
                      onClick={() => handleQuickDisposition(d.value)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-2 rounded-lg"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  id="btn-toggle-mic-mute"
                  type="button"
                  onClick={handleToggleMute}
                  className={`text-xs font-bold py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isMuted
                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 ring-2 ring-rose-300/60 shadow-2xs animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                  title={isMuted ? 'Microphone is currently MUTED. Click to unmute.' : 'Click to mute your microphone'}
                  aria-pressed={isMuted}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-rose-600" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-slate-600" />
                      <span>Mute Mic</span>
                    </>
                  )}
                </button>
                <button
                    onClick={handleHold}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold py-2 px-2 rounded-lg border border-amber-200 transition cursor-pointer"
                >
                    Hold
                </button>
                <button
                    onClick={handleTransfer}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold py-2 px-2 rounded-lg border border-blue-200 transition cursor-pointer"
                >
                    Transfer
                </button>
              </div>

              {/* Instant Pre-recorded Voicemail Drop */}
              <div className="mb-4">
                <VoicemailDropControl
                  voicemails={voicemails}
                  activeCallId={dialResult?.id}
                  phoneNumber={phoneNumber}
                  contactName={contactName}
                  onDropVoicemail={handleDropVoicemail}
                  onOpenLibrary={() => setIsVoicemailDrawerOpen(true)}
                />
              </div>

              {/* Real-time Speech-to-Text & Waveform Visualizer */}
              <div className="mb-4">
                <LiveSpeechTranscriptionIndicator
                  isCallActive={!!callStartTime}
                  isMuted={isMuted}
                  contactName={contactName}
                  onAppendToNotes={(text) => {
                    setCallNotes((prev) => (prev ? `${prev}\n\n[Transcript]: ${text}` : `[Transcript]: ${text}`));
                  }}
                />
              </div>

              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-700">Call Notes</p>
                  {isPaused && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-full animate-pulse border border-cyan-200">
                      <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Smart Pause Active</span>
                    </div>
                  )}
                </div>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  onFocus={() => {
                    if (callStartTime) setNotificationsPaused(true);
                  }}
                  onBlur={() => setNotificationsPaused(false)}
                  placeholder="Take call notes here..."
                  className={`w-full h-24 p-2 text-sm border rounded-lg transition-all duration-200 ${
                    isPaused 
                      ? 'border-cyan-400 ring-2 ring-cyan-500/10 shadow-inner' 
                      : 'border-slate-300 focus:ring-cyan-500 focus:border-cyan-500'
                  }`}
                />
                {isPaused && (
                  <p className="text-[9px] text-slate-500 mt-1 italic">
                    Notifications suppressed while typing notes to prevent distractions.
                  </p>
                )}
              </div>

              {/* Quick Snippets Section */}
              <div className="mb-4">
                <QuickSnippetsPanel 
                  onInsert={(content) => {
                    setCallNotes(prev => prev ? `${prev}\n${content}` : content);
                    addToast('Snippet inserted into notes', 'info');
                  }}
                />
              </div>

              <button
                onClick={async () => {
                  if (dialResult?.id) {
                    try {
                      // Save notes
                      await fetch(`/api/calls/${dialResult.id}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({ notes: callNotes }),
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      // Log call audit
                      const durationSeconds = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
                      await fetch('/api/audit/log', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              action: 'call_completed',
                              callerId: phoneNumber,
                              durationSeconds,
                              timestamp: new Date().toISOString(),
                              organizationId: '',
                              input: {
                                  callQualityRating
                              }
                          })
                      });
                      
                      // Suggest task
                      const res = await fetch(`/api/calls/${dialResult.id}/suggest-task`, {
                        method: 'POST',
                      });
                      const data = await res.json();
                      setSuggestedTask(data.suggestedTask);
                    } catch (err) {
                      console.error('Failed to save notes, log audit, or get suggested task:', err);
                    }
                  }
                  handleCallWrapUp();
                }}
                className="text-xs text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
              >
                End Call & Save Notes
              </button>
            </div>
          )}

          {/* Quick Notification & Action after Voicemail Drop */}
          {lastDroppedVoicemail && !callStartTime && (
            <div className="bg-linear-to-r from-emerald-900 to-slate-900 border border-emerald-500/40 rounded-xl p-4 shadow-sm text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">
                      Voicemail Dropped Successfully
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      "{lastDroppedVoicemail.label}" left for {lastDroppedVoicemail.contactName} at {lastDroppedVoicemail.timestamp}. Agent line is free.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLastDroppedVoicemail(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {selectedCampaign && (
                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">
                    Campaign: <strong>{selectedCampaign.name}</strong>
                  </span>
                  <button
                    onClick={handleDialNextQueued}
                    disabled={isDialing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>⚡ Dial Next Lead</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {suggestedTask && (
            <div className="p-4 bg-blue-50 rounded-lg text-xs text-blue-900 border border-blue-200">
                <strong>Suggested Follow-up:</strong> {suggestedTask}
            </div>
          )}
        </div>
      </div>

      
      <VoicemailDrawer
        isOpen={isVoicemailDrawerOpen}
        onClose={() => setIsVoicemailDrawerOpen(false)}
        voicemails={voicemails}
        onUpload={handleUploadVoicemail}
        onDelete={handleDeleteVoicemail}
        selectedVoicemailId={selectedVoicemailId}
        onSelectVoicemail={setSelectedVoicemailId}
      />

      {/* Live Call Transcript & Sentiment Analyzer */}
      <div className="mt-4">
        <CallTranscriptAnalyzer
          callId={dialResult?.id}
          contactName={contactName}
          defaultNotes={callBrief}
          onTaskCreated={(newTask) => {
            if (onAddTask) {
              onAddTask(newTask);
            }
          }}
        />
      </div>

      {/* Bulk Outreach & Campaign Schedule Modal */}
      {showScheduleModal && (
        <BulkOutreachScheduleModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setCampaignToReschedule(null);
          }}
          targets={[
            {
              name: contactName || 'Jonathan Sterling',
              phone: phoneNumber || '(949) 555-0182',
              address: propertyAddress || '1420 Newport Blvd, Costa Mesa, CA',
              score: 92,
            },
          ]}
          existingCampaignToReschedule={campaignToReschedule}
          onCampaignCreated={handleCampaignCreatedOrUpdated}
        />
      )}
    </div>
  );
};
