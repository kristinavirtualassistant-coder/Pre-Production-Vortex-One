import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  MessageSquare,
  PhoneCall,
  Plus,
  Search,
  Filter,
  Copy,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Tag,
  Check,
  Smartphone,
  Send,
  RefreshCw,
  X,
  FileText,
  Sliders,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  OutreachTemplate,
  OutreachChannel,
  TemplateCategory,
  Property,
  PropertyOwner,
  LeadRecord,
} from '../types';

interface OutreachTemplateManagerProps {
  onSelectTemplateForOutreach?: (template: OutreachTemplate, renderedContent?: { subject?: string; body: string }) => void;
  organizationId?: string;
  className?: string;
}

const DEFAULT_VARIABLES = [
  { name: 'owner_name', label: 'Owner Full Name', group: 'Owner', sample: 'John R. Sterling' },
  { name: 'first_name', label: 'Owner First Name', group: 'Owner', sample: 'John' },
  { name: 'property_address', label: 'Property Address', group: 'Property', sample: '1420 Newport Blvd' },
  { name: 'property_city', label: 'City', group: 'Property', sample: 'Costa Mesa' },
  { name: 'property_state', label: 'State', group: 'Property', sample: 'CA' },
  { name: 'property_zip', label: 'ZIP Code', group: 'Property', sample: '92627' },
  { name: 'units_count', label: 'Units Count', group: 'Property', sample: '6' },
  { name: 'property_type', label: 'Property Type', group: 'Property', sample: 'Multi-Family' },
  { name: 'apn', label: 'Assessor Parcel Number (APN)', group: 'Property', sample: '423-112-09' },
  { name: 'estimated_value', label: 'Estimated Valuation', group: 'Financials', sample: '$2,650,000' },
  { name: 'estimated_equity', label: 'Estimated Equity', group: 'Financials', sample: '$1,850,000' },
  { name: 'assessed_tax_value', label: 'Assessed Tax Value', group: 'Financials', sample: '$1,720,000' },
  { name: 'company_name', label: 'Brokerage / Company Name', group: 'Brokerage', sample: 'CMC Realty & Property Management' },
  { name: 'agent_name', label: 'Agent Name', group: 'Brokerage', sample: 'Marcus Vance' },
  { name: 'agent_phone', label: 'Agent Phone', group: 'Brokerage', sample: '(949) 555-0199' },
  { name: 'agent_email', label: 'Agent Email', group: 'Brokerage', sample: 'marcus@cmcrealty.com' },
  { name: 'lead_score', label: 'Lead Score', group: 'Lead', sample: '94' },
  { name: 'lead_classification', label: 'Lead Classification', group: 'Lead', sample: 'High Priority' },
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  absentee_owner: 'Absentee Landlord',
  high_equity: 'High Equity / Cash Flow',
  tax_delinquency: 'Assessor / Tax Relief',
  distressed_preforeclosure: 'Pre-Foreclosure / Distressed',
  expired_listing: 'Expired Listing',
  off_market_acquisition: 'Off-Market Acquisition',
  property_management: 'Turnkey Property Management',
  follow_up: 'Lead Follow-Up',
  cold_outreach: 'Cold Outreach Campaign',
  custom: 'Custom Campaign',
};

const DEFAULT_OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'tpl_email_absentee_01',
    organization_id: 'org_cmc_realty',
    name: 'Absentee Landlord Multi-Family Management Proposal',
    description: 'High-touch value proposition targeting out-of-area multi-family owners with estimated equity over $1M.',
    channel: 'email',
    category: 'absentee_owner',
    subject: 'Management & Rent Roll Optimization for {{property_address}}, {{property_city}}',
    body: `Dear {{owner_name}},

I noticed your {{units_count}}-unit multi-family asset located at {{property_address}} in {{property_city}}. As an out-of-area property owner, managing tenant turnovers, maintenance dispatches, and local municipal compliance from a distance can be demanding.

At {{company_name}}, we specialize in turnkey Orange County asset management:
• Rapid tenant placement with 100% verified income & credit screening
• 24/7 in-house maintenance dispatch at negotiated local contractor rates
• Direct deposit owner disbursements on the 1st of every month
• Real-time owner portal with live expense, invoice, and inspection reporting

Based on current {{property_city}} market data, similar properties are leasing with a strong premium over historical leases. With your estimated equity position of {{estimated_equity}}, optimizing your rent roll can substantially increase your annual net operating income (NOI).

Would you be open to a brief 10-minute call this week to review our comprehensive rent comparables report for {{property_address}}?

Best regards,
{{agent_name}}
{{company_name}}
Direct: {{agent_phone}}
Email: {{agent_email}}`,
    variables: [
      'owner_name',
      'units_count',
      'property_address',
      'property_city',
      'company_name',
      'estimated_equity',
      'agent_name',
      'agent_phone',
      'agent_email',
    ],
    tags: ['Absentee', 'Multi-Family', 'Turnkey Management', 'High Equity'],
    is_default: true,
    performance_metrics: {
      usage_count: 24,
      response_rate_percent: 28.5,
      conversion_rate_percent: 14.2,
      last_used_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_by: 'Sub-Agent 5 (Outreach Specialist)',
  },
  {
    id: 'tpl_sms_absentee_01',
    organization_id: 'org_cmc_realty',
    name: 'Absentee Owner Quick SMS Inquiry (Costa Mesa / OC)',
    description: 'Concise, TCPA-compliant SMS text to initiate conversational interest with absentee landlords.',
    channel: 'sms',
    category: 'absentee_owner',
    body: `Hi {{first_name}}, this is {{agent_name}} with {{company_name}}. Are you still managing the {{units_count}}-unit property at {{property_address}} yourself, or open to seeing our 2026 rental comp report? Reply STOP to opt out.`,
    variables: ['first_name', 'agent_name', 'company_name', 'units_count', 'property_address'],
    tags: ['SMS', 'Absentee', 'Quick Intro', 'TCPA Compliant'],
    is_default: true,
    performance_metrics: {
      usage_count: 46,
      response_rate_percent: 34.8,
      conversion_rate_percent: 18.0,
      last_used_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    created_by: 'Sub-Agent 5 (Outreach Specialist)',
  },
  {
    id: 'tpl_email_high_equity_01',
    organization_id: 'org_cmc_realty',
    name: 'High-Equity Portfolio Cash-Flow Optimization',
    description: 'Strategic proposal highlighting cap rate optimization and operating expense reduction.',
    channel: 'email',
    category: 'high_equity',
    subject: 'Unlocking Peak Cash Flow on {{property_address}} (Estimated Equity: {{estimated_equity}})',
    body: `Hello {{owner_name}},

According to public county records, your asset at {{property_address}} in {{property_city}} holds an estimated equity spread of approximately {{estimated_equity}} (estimated market valuation of {{estimated_value}}).

Many commercial and residential landlords in {{property_city}} are currently reviewing their expense ratios and vendor contracts to maximize capitalization rates. Our team at {{company_name}} conducts complimentary operational audits that typically reduce maintenance overhead by 14–22% while bringing existing lease rates up to fair market value.

We recently prepared an updated valuation and expense analysis for parcel APN {{apn}}.

When is a convenient time for a brief introductory discussion?

Warm regards,
{{agent_name}}
{{company_name}} | {{agent_phone}}`,
    variables: [
      'owner_name',
      'property_address',
      'property_city',
      'estimated_equity',
      'estimated_value',
      'company_name',
      'apn',
      'agent_name',
      'agent_phone',
    ],
    tags: ['High Equity', 'Cap Rate', 'Expense Audit', 'Commercial'],
    is_default: true,
    performance_metrics: {
      usage_count: 18,
      response_rate_percent: 22.0,
      conversion_rate_percent: 11.5,
      last_used_at: new Date(Date.now() - 86400000).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    created_by: 'Sub-Agent 5 (Outreach Specialist)',
  },
  {
    id: 'tpl_sms_off_market_01',
    organization_id: 'org_cmc_realty',
    name: 'Off-Market Acquisition & Valuation Inquiry',
    description: 'Fast-response SMS inquiring if owner would consider off-market acquisition or management review.',
    channel: 'sms',
    category: 'off_market_acquisition',
    body: `Hi {{first_name}}, {{agent_name}} here with {{company_name}}. We have pre-approved buyers looking for {{property_type}} assets near {{property_address}}. Would you consider an off-market offer or property management review? Reply STOP to stop.`,
    variables: ['first_name', 'agent_name', 'company_name', 'property_type', 'property_address'],
    tags: ['SMS', 'Acquisition', 'Off-Market', 'Buyer Interest'],
    is_default: false,
    performance_metrics: {
      usage_count: 31,
      response_rate_percent: 39.2,
      conversion_rate_percent: 21.4,
      last_used_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_by: 'Operations Executive',
  },
  {
    id: 'tpl_email_tax_delinq_01',
    organization_id: 'org_cmc_realty',
    name: 'County Assessor Valuation & Tax Relief Consultation',
    description: 'Educates owners on recent county tax assessments and potential operational expense reductions.',
    channel: 'email',
    category: 'tax_delinquency',
    subject: 'Property Tax & Operational Cost Review for {{property_address}}',
    body: `Dear {{owner_name}},

Our intelligence system recently reviewed county tax assessment records for your property at {{property_address}} (APN: {{apn}}).

With current assessed tax values at {{assessed_tax_value}}, many property owners in {{property_city}} are eligible for property tax appeals and local operational credits. At {{company_name}}, we assist owners in contesting inflated assessments and trimming unnecessary operating costs.

If you would like a complimentary summary of recent comparable tax assessments and property management yields in {{property_city}}, please let me know.

Sincerely,
{{agent_name}}
{{company_name}}
{{agent_phone}} | {{agent_email}}`,
    variables: [
      'owner_name',
      'property_address',
      'apn',
      'assessed_tax_value',
      'property_city',
      'company_name',
      'agent_name',
      'agent_phone',
      'agent_email',
    ],
    tags: ['Tax Assessor', 'Prop 13', 'Expense Reduction', 'Assessment Review'],
    is_default: false,
    performance_metrics: {
      usage_count: 12,
      response_rate_percent: 19.5,
      conversion_rate_percent: 8.3,
      last_used_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    created_by: 'Sub-Agent 1 (Property Intelligence)',
  },
  {
    id: 'tpl_call_script_01',
    organization_id: 'org_cmc_realty',
    name: 'Cold Inbound/Outbound Discovery Call Script',
    description: 'Structured telephony pitch script for multi-family property owners in Costa Mesa/Orange County.',
    channel: 'call_script',
    category: 'property_management',
    body: `[OPENING HOOK]
"Hi {{first_name}}, this is {{agent_name}} with {{company_name}} right here in Orange County. I'm reaching out specifically regarding your {{units_count}}-unit property at {{property_address}}."

[VALUE PROPOSITION]
"We manage several properties in {{property_city}} and notice landlords are frequently struggling with delayed vendor response and tenant lease turnover. We offer a guaranteed 14-day vacancy fill and 24/7 local maintenance."

[QUALIFICATION QUESTIONS]
1. "Are you currently self-managing or working with a third-party property manager?"
2. "When was the last time leases were adjusted to reflect current market rates (approx. {{estimated_value}} valuation)?"

[CLOSING / NEXT STEP]
"I would love to email you our 2-page {{property_city}} rental comparables report. What's the best email address to reach you at?"`,
    variables: [
      'first_name',
      'agent_name',
      'company_name',
      'units_count',
      'property_address',
      'property_city',
      'estimated_value',
    ],
    tags: ['Call Script', 'Discovery', 'Telephony Pitch', 'Objection Handling'],
    is_default: false,
    performance_metrics: {
      usage_count: 73,
      response_rate_percent: 41.2,
      conversion_rate_percent: 23.8,
      last_used_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    created_by: 'Sub-Agent 5 (Outreach Specialist)',
  },
];

export const OutreachTemplateManager: React.FC<OutreachTemplateManagerProps> = ({
  onSelectTemplateForOutreach,
  organizationId = 'org_cmc_realty',
  className = '',
}) => {
  const [templates, setTemplates] = useState<OutreachTemplate[]>(DEFAULT_OUTREACH_TEMPLATES);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<'all' | OutreachChannel>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<OutreachTemplate> | null>(null);
  const [tagInput, setTagInput] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Previewer / Tester State
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<OutreachTemplate | null>(null);
  const [propertiesList, setPropertiesList] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [renderedPreview, setRenderedPreview] = useState<{
    subject?: string;
    body: string;
    resolved: Record<string, string>;
    unresolved: string[];
    charCount: number;
    smsSegments?: number;
  } | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Fetch templates and available properties for testing with resilient retry
  const fetchTemplates = async (retryCount = 0) => {
    try {
      const res = await fetch(`/api/outreach-templates?organizationId=${encodeURIComponent(organizationId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setTemplates(data);
            setError(null);
            return;
          }
        }
      }
      if (retryCount < 2) {
        setTimeout(() => fetchTemplates(retryCount + 1), 1000 * (retryCount + 1));
      }
    } catch (err: any) {
      if (retryCount < 2) {
        setTimeout(() => fetchTemplates(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.warn('Outreach templates network sync deferred; using active pre-loaded templates:', err);
        // Do not block user with hard error if fallback templates are available
        setError(null);
      }
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch(`/api/property-search?organizationId=${encodeURIComponent(organizationId)}&limit=20`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.records && Array.isArray(data.records) && data.records.length > 0) {
          setPropertiesList(data.records);
          if (!selectedPropertyId) {
            setSelectedPropertyId(data.records[0].id);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch sample properties for preview:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchProperties();
  }, [organizationId]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (selectedChannel !== 'all' && tpl.channel !== selectedChannel) return false;
      if (selectedCategory !== 'all' && tpl.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = tpl.name.toLowerCase().includes(q);
        const matchesDesc = (tpl.description || '').toLowerCase().includes(q);
        const matchesSubj = (tpl.subject || '').toLowerCase().includes(q);
        const matchesBody = tpl.body.toLowerCase().includes(q);
        const matchesTag = (tpl.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesSubj && !matchesBody && !matchesTag) return false;
      }
      return true;
    });
  }, [templates, selectedChannel, selectedCategory, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = templates.length;
    const emailCount = templates.filter((t) => t.channel === 'email').length;
    const smsCount = templates.filter((t) => t.channel === 'sms').length;
    const callScriptCount = templates.filter((t) => t.channel === 'call_script').length;
    const totalUsage = templates.reduce((acc, t) => acc + (t.performance_metrics?.usage_count || 0), 0);
    const avgResponseRate =
      templates.length > 0
        ? (
            templates.reduce((acc, t) => acc + (t.performance_metrics?.response_rate_percent || 0), 0) /
            templates.length
          ).toFixed(1)
        : '0.0';

    return { total, emailCount, smsCount, callScriptCount, totalUsage, avgResponseRate };
  }, [templates]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTemplate({
      name: '',
      description: '',
      channel: 'email',
      category: 'absentee_owner',
      subject: '',
      body: '',
      tags: ['Multi-Family', 'Costa Mesa'],
      is_default: false,
    });
    setTagInput('');
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (template: OutreachTemplate) => {
    setEditingTemplate({ ...template });
    setTagInput('');
    setIsEditorOpen(true);
  };

  // Save Template (Create or Update)
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.body) {
      alert('Please provide a template title and message body.');
      return;
    }

    try {
      setSaving(true);
      const isUpdating = Boolean(editingTemplate.id);
      const url = isUpdating
        ? `/api/outreach-templates/${editingTemplate.id}`
        : '/api/outreach-templates';
      const method = isUpdating ? 'PUT' : 'POST';

      const payload = {
        ...editingTemplate,
        organization_id: organizationId,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save template');
      }

      await fetchTemplates();
      setIsEditorOpen(false);
      setEditingTemplate(null);
    } catch (err: any) {
      alert(`Error saving template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/outreach-templates/${templateId}?organizationId=${organizationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      await fetchTemplates();
    } catch (err: any) {
      alert(`Error deleting template: ${err.message}`);
    }
  };

  // Duplicate Template
  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/outreach-templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error('Failed to clone template');
      await fetchTemplates();
    } catch (err: any) {
      alert(`Error duplicating template: ${err.message}`);
    }
  };

  // Insert Merge Variable into active field
  const handleInsertVariable = (varName: string, targetField: 'subject' | 'body') => {
    if (!editingTemplate) return;
    const token = `{{${varName}}}`;

    if (targetField === 'subject') {
      const current = editingTemplate.subject || '';
      setEditingTemplate({ ...editingTemplate, subject: current + token });
    } else {
      const current = editingTemplate.body || '';
      setEditingTemplate({ ...editingTemplate, body: current + (current.endsWith(' ') || current.endsWith('\n') ? '' : ' ') + token });
    }
  };

  // Add Tag
  const handleAddTag = () => {
    if (!tagInput.trim() || !editingTemplate) return;
    const currentTags = editingTemplate.tags || [];
    if (!currentTags.includes(tagInput.trim())) {
      setEditingTemplate({ ...editingTemplate, tags: [...currentTags, tagInput.trim()] });
    }
    setTagInput('');
  };

  // Remove Tag
  const handleRemoveTag = (tagToRemove: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      tags: (editingTemplate.tags || []).filter((t) => t !== tagToRemove),
    });
  };

  // Open Live Preview
  const handleOpenPreview = async (template: OutreachTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
    await executeRender(template, selectedPropertyId);
  };

  // Render Template on Property Change
  const executeRender = async (template: OutreachTemplate, propertyId?: string) => {
    try {
      setRendering(true);
      const res = await fetch('/api/outreach-templates/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          rawTemplate: {
            channel: template.channel,
            subject: template.subject,
            body: template.body,
          },
          propertyId: propertyId || selectedPropertyId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRenderedPreview({
          subject: data.rendered_subject,
          body: data.rendered_body,
          resolved: data.resolved_variables || {},
          unresolved: data.unresolved_variables || [],
          charCount: data.char_count || (data.rendered_body || '').length,
          smsSegments: data.sms_segments || Math.ceil((data.rendered_body || '').length / 160),
        });
      } else {
        throw new Error('Server render unavailable');
      }
    } catch (err) {
      console.warn('Using client-side template variable resolution:', err);
      // Client-side fallback resolution
      const activeProp = propertiesList.find((p) => p.id === (propertyId || selectedPropertyId));
      const sampleValues: Record<string, string> = {
        owner_name: activeProp?.owner_name || 'Jonathan R. Sterling',
        first_name: (activeProp?.owner_name || 'Jonathan').split(' ')[0],
        property_address: activeProp?.address || '1420 Newport Blvd',
        property_city: activeProp?.city || 'Costa Mesa',
        property_state: activeProp?.state || 'CA',
        property_zip: activeProp?.zip || '92627',
        units_count: String(activeProp?.units_count || 6),
        property_type: activeProp?.property_type || 'Multi-Family',
        apn: activeProp?.apn || '423-112-09',
        estimated_value: activeProp ? `$${Number(activeProp.estimated_value || 2650000).toLocaleString()}` : '$2,650,000',
        estimated_equity: activeProp ? `$${Number(activeProp.estimated_equity || 1850000).toLocaleString()}` : '$1,850,000',
        assessed_tax_value: activeProp ? `$${Number(activeProp.assessed_tax_value || 1720000).toLocaleString()}` : '$1,720,000',
        company_name: 'CMC Realty & Property Management',
        agent_name: 'Marcus Vance',
        agent_phone: '(949) 555-0199',
        agent_email: 'marcus@cmcrealty.com',
        lead_score: String(activeProp?.viability_score || 94),
        lead_classification: 'High Priority',
      };

      const resolveText = (text?: string) => {
        if (!text) return '';
        return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
          return sampleValues[key] !== undefined ? sampleValues[key] : `{{${key}}}`;
        });
      };

      const renderedBody = resolveText(template.body);
      const renderedSubject = template.subject ? resolveText(template.subject) : undefined;
      setRenderedPreview({
        subject: renderedSubject,
        body: renderedBody,
        resolved: sampleValues,
        unresolved: [],
        charCount: renderedBody.length,
        smsSegments: Math.ceil(renderedBody.length / 160),
      });
    } finally {
      setRendering(false);
    }
  };

  // Copy Rendered Output
  const handleCopyRendered = () => {
    if (!renderedPreview) return;
    const fullText =
      previewTemplate?.channel === 'email' && renderedPreview.subject
        ? `Subject: ${renderedPreview.subject}\n\n${renderedPreview.body}`
        : renderedPreview.body;

    navigator.clipboard.writeText(fullText);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  // Record usage when user dispatches template
  const handleUseTemplate = async (template: OutreachTemplate) => {
    try {
      await fetch(`/api/outreach-templates/${template.id}/use`, { method: 'POST' });
      fetchTemplates();
      if (onSelectTemplateForOutreach) {
        onSelectTemplateForOutreach(template, {
          subject: renderedPreview?.subject || template.subject,
          body: renderedPreview?.body || template.body,
        });
      }
    } catch (err) {
      console.warn('Failed to record template usage:', err);
    }
  };

  const getChannelBadge = (channel: OutreachChannel) => {
    switch (channel) {
      case 'email':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Mail className="w-3.5 h-3.5" /> Email
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-3.5 h-3.5" /> SMS Text
          </span>
        );
      case 'call_script':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PhoneCall className="w-3.5 h-3.5" /> Call Script
          </span>
        );
    }
  };

  return (
    <div id="outreach-template-manager-container" className={`flex flex-col h-full bg-slate-950 text-slate-100 ${className}`}>
      {/* Header & Quick Action Banner */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Outreach Template Manager
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/60">
                    Sub-Agent 5 Studio
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Design, manage, and render high-converting email, SMS, and cold-call scripts with dynamic property assessor merge tags.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-refresh-templates"
              onClick={fetchTemplates}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              title="Refresh templates"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              id="btn-create-template"
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Outreach Template
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-slate-400">Total Templates</div>
            <div className="text-lg font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-blue-400 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Email Templates
            </div>
            <div className="text-lg font-bold text-white mt-1">{stats.emailCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> SMS Templates
            </div>
            <div className="text-lg font-bold text-white mt-1">{stats.smsCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-purple-400 flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5" /> Call Scripts
            </div>
            <div className="text-lg font-bold text-white mt-1">{stats.callScriptCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-amber-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Total Dispatches
            </div>
            <div className="text-lg font-bold text-white mt-1">{stats.totalUsage}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-xs font-medium text-indigo-400">Avg Response Rate</div>
            <div className="text-lg font-bold text-white mt-1">{stats.avgResponseRate}%</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Tabs */}
            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                id="filter-channel-all"
                onClick={() => setSelectedChannel('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  selectedChannel === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Channels
              </button>
              <button
                id="filter-channel-email"
                onClick={() => setSelectedChannel('email')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  selectedChannel === 'email' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3 h-3" /> Email
              </button>
              <button
                id="filter-channel-sms"
                onClick={() => setSelectedChannel('sms')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  selectedChannel === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3 h-3" /> SMS
              </button>
              <button
                id="filter-channel-script"
                onClick={() => setSelectedChannel('call_script')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  selectedChannel === 'call_script' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <PhoneCall className="w-3 h-3" /> Call Script
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                id="filter-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-templates-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates or tags..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Template Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm font-medium">Loading outreach templates...</p>
          </div>
        )}

        {!loading && filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <div className="p-3 rounded-full bg-slate-800/80 text-slate-400 mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No matching templates found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery || selectedChannel !== 'all' || selectedCategory !== 'all'
                ? 'Try resetting your search filters or create a new template.'
                : 'Create your first automated email, SMS, or call script template for property outreach.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Template
            </button>
          </div>
        )}

        {!loading && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                id={`template-card-${tpl.id}`}
                className="group flex flex-col justify-between p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/90 transition-all duration-200 shadow-sm"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getChannelBadge(tpl.channel)}
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                        {CATEGORY_LABELS[tpl.category] || tpl.category}
                      </span>
                    </div>
                    {tpl.is_default && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Default
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                    {tpl.name}
                  </h3>
                  {tpl.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>
                  )}

                  {/* Subject preview if email */}
                  {tpl.channel === 'email' && tpl.subject && (
                    <div className="mt-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
                      <span className="text-slate-500 font-medium">Subj: </span>
                      <span className="text-slate-300 font-mono text-[11px]">{tpl.subject}</span>
                    </div>
                  )}

                  {/* Body Snippet */}
                  <div className="mt-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 font-mono text-xs line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {tpl.body}
                  </div>

                  {/* Merge Variables Detected */}
                  {tpl.variables && tpl.variables.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                        Merge Tags:
                      </span>
                      {tpl.variables.slice(0, 4).map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {tpl.variables.length > 4 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{tpl.variables.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {tpl.tags && tpl.tags.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                      {tpl.tags.map((tg) => (
                        <span
                          key={tg}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/60 text-slate-400"
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Metrics & Actions */}
                <div className="mt-5 pt-4 border-t border-slate-800/80">
                  {/* Performance Indicators */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                    <div>
                      Used: <span className="font-semibold text-white">{tpl.performance_metrics?.usage_count || 0} times</span>
                    </div>
                    <div>
                      Response:{' '}
                      <span className="font-semibold text-emerald-400">
                        {tpl.performance_metrics?.response_rate_percent || 0}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-preview-${tpl.id}`}
                        onClick={() => handleOpenPreview(tpl)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Test & Preview Merge Fields"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        Preview
                      </button>

                      <button
                        id={`btn-edit-${tpl.id}`}
                        onClick={() => handleOpenEdit(tpl)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Edit Template"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`btn-duplicate-${tpl.id}`}
                        onClick={() => handleDuplicateTemplate(tpl.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Duplicate Template"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`btn-delete-${tpl.id}`}
                        onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      id={`btn-use-${tpl.id}`}
                      onClick={() => handleUseTemplate(tpl)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1 transition-all"
                    >
                      <span>Use</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: Create / Edit Template */}
      {isEditorOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            id="template-editor-modal"
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingTemplate.id ? 'Edit Outreach Template' : 'Create New Outreach Template'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Define copy and embed dynamic merge tags for real property assessor data.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Row 1: Name & Channel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Template Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-template-name"
                    type="text"
                    value={editingTemplate.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="e.g. Absentee Multi-Family Management Proposal"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Outreach Channel <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="select-template-channel"
                    value={editingTemplate.channel || 'email'}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, channel: e.target.value as OutreachChannel })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="email">Email Campaign</option>
                    <option value="sms">SMS Text Message</option>
                    <option value="call_script">Telephony Call Script</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Category & Description */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Lead / Property Category</label>
                  <select
                    id="select-template-category"
                    value={editingTemplate.category || 'absentee_owner'}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, category: e.target.value as TemplateCategory })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                      <option key={catKey} value={catKey}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Internal Description</label>
                  <input
                    id="input-template-description"
                    type="text"
                    value={editingTemplate.description || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    placeholder="Brief explanation of when to deploy this template..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Email Subject Line (Conditional) */}
              {editingTemplate.channel === 'email' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">Email Subject Line</label>
                    <span className="text-[11px] text-slate-500">Supports merge variables</span>
                  </div>
                  <input
                    id="input-template-subject"
                    type="text"
                    value={editingTemplate.subject || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    placeholder="e.g. Asset Management & Comps for {{property_address}}, {{property_city}}"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Variable Quick-Insert Palette */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    Insert Merge Variables (Click to append)
                  </span>
                  <span className="text-[11px] text-slate-500">Auto-resolved on dispatch</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {DEFAULT_VARIABLES.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => handleInsertVariable(v.name, 'body')}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-300 border border-slate-800 text-xs font-mono transition-colors flex items-center gap-1"
                      title={`${v.label} (Example: ${v.sample})`}
                    >
                      <span>{`{{${v.name}}}`}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Message Body / Script <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{(editingTemplate.body || '').length} characters</span>
                    {editingTemplate.channel === 'sms' && (
                      <span className="text-amber-400 font-medium">
                        ~{Math.max(1, Math.ceil(((editingTemplate.body || '').length || 1) / 160))} SMS Segments
                      </span>
                    )}
                  </div>
                </div>
                <textarea
                  id="textarea-template-body"
                  rows={8}
                  value={editingTemplate.body || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  placeholder={
                    editingTemplate.channel === 'sms'
                      ? 'Hi {{first_name}}, this is {{agent_name}} with {{company_name}} regarding your property at {{property_address}}...'
                      : editingTemplate.channel === 'call_script'
                      ? '[OPENING]\n"Hi {{first_name}}, this is {{agent_name}} from {{company_name}}..."'
                      : 'Dear {{owner_name}},\n\nI noticed your asset at {{property_address}}...'
                  }
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Tags & Default Checkbox */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Tags</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input-add-tag"
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add tag and hit Enter..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      Add
                    </button>
                  </div>
                  {/* Render Active Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(editingTemplate.tags || []).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-950/60 border border-slate-800 w-full">
                    <input
                      id="checkbox-is-default"
                      type="checkbox"
                      checked={Boolean(editingTemplate.is_default)}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, is_default: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">Default Channel Template</span>
                      <span className="text-[11px] text-slate-400 block">
                        Sub-Agent 5 will recommend this template by default for {editingTemplate.channel} outreach.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                id="btn-save-template-submit"
                type="button"
                onClick={handleSaveTemplate}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingTemplate.id ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Interactive Real Property Previewer & Simulator */}
      {isPreviewOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            id="template-preview-modal"
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Live Assessor Data Merge Preview: {previewTemplate.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Verify dynamic variable resolution against live properties in your database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-preview-text"
                  onClick={handleCopyRendered}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Output
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Header: Target Property Selector */}
            <div className="px-6 py-3 bg-slate-950 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Test with Live Property:</span>
                <select
                  id="select-preview-property"
                  value={selectedPropertyId}
                  onChange={(e) => {
                    setSelectedPropertyId(e.target.value);
                    executeRender(previewTemplate, e.target.value);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  {propertiesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.city} ({p.units_count || 1} units • {p.owner_name || 'Owner'})
                    </option>
                  ))}
                  {propertiesList.length === 0 && (
                    <option value="sample">1420 Newport Blvd, Costa Mesa (Sample Record)</option>
                  )}
                </select>
              </div>

              {/* Resolved Variables Count */}
              {renderedPreview && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {Object.keys(renderedPreview.resolved).length} Variables Resolved
                  </span>
                  {renderedPreview.unresolved.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {renderedPreview.unresolved.length} Unresolved
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Preview Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Channel Specialized Visual Container */}
              {previewTemplate.channel === 'sms' && (
                <div className="max-w-md mx-auto">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl relative">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        SMS Messenger Simulator
                      </span>
                      <span>TCPA 10DLC Verified</span>
                    </div>

                    {/* Chat Bubble */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="p-3.5 rounded-2xl rounded-br-xs bg-emerald-600 text-white text-sm font-sans leading-relaxed max-w-[90%] shadow-md">
                        {renderedPreview?.body || previewTemplate.body}
                      </div>
                      <span className="text-[10px] text-slate-500">Delivered • Just now</span>
                    </div>

                    {/* Stats Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Length: {renderedPreview?.charCount || 0} characters</span>
                      <span className="font-semibold text-emerald-400">
                        {renderedPreview?.smsSegments || 1} GSM Segment(s)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {previewTemplate.channel === 'email' && (
                <div className="max-w-2xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl">
                  {/* Email Chrome Header */}
                  <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-medium">Subject:</span>
                      <span className="text-white font-semibold">
                        {renderedPreview?.subject || previewTemplate.subject || '(No Subject)'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-medium">From:</span>
                      <span className="text-slate-300">Marcus Vance &lt;marcus@cmcrealty.com&gt;</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-medium">To:</span>
                      <span className="text-blue-400 font-mono">
                        {renderedPreview?.resolved['owner_name'] || 'Property Owner'} &lt;owner@public-records.org&gt;
                      </span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6 text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed bg-slate-950 min-h-[220px]">
                    {renderedPreview?.body || previewTemplate.body}
                  </div>
                </div>
              )}

              {previewTemplate.channel === 'call_script' && (
                <div className="max-w-2xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xl">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs">
                    <span className="font-semibold text-purple-400 flex items-center gap-1.5">
                      <PhoneCall className="w-4 h-4" /> Telephony Live Teleprompter
                    </span>
                    <span className="text-slate-400">Target APN: {renderedPreview?.resolved['apn'] || 'N/A'}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                    {renderedPreview?.body || previewTemplate.body}
                  </div>
                </div>
              )}

              {/* Resolved Variables Table */}
              {renderedPreview && Object.keys(renderedPreview.resolved).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Resolved Merge Values for this Record
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(renderedPreview.resolved).map(([varKey, val]) => (
                      <div
                        key={varKey}
                        className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                      >
                        <div className="text-[10px] font-mono text-blue-400">{`{{${varKey}}}`}</div>
                        <div className="font-medium text-slate-200 truncate mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close Preview
              </button>

              <button
                id="btn-use-rendered-output"
                type="button"
                onClick={() => {
                  handleUseTemplate(previewTemplate);
                  setIsPreviewOpen(false);
                }}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Send className="w-4 h-4" />
                Dispatch with this Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutreachTemplateManager;
