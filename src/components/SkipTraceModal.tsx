/**
 * Vortex One - 5-Step Real Estate Skip Tracing Intelligence Suite
 *
 * Implements the comprehensive 5-step methodology:
 * 1. Find Parcel Number (GIS Map & APN)
 * 2. Identify Owner of Record (Tax Assessor & Recorder)
 * 3. Look up Mailing Address (Tax Billing vs Situs Absentee Analysis)
 * 4. Trace Corporate Owners (California Secretary of State / bizfile & Registered Agents)
 * 5. Uncover Phone Numbers & Emails (TruePeopleSearch, CyberBackgroundChecks, FastPeopleSearch)
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  FileText,
  Mail,
  Building2,
  Phone,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  UserCheck,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Smartphone,
  PhoneCall,
  Globe,
  Briefcase,
  Layers,
  ChevronRight,
  Info,
  Landmark,
  BookOpen,
  Users,
  Vote,
  Building,
  Zap,
} from 'lucide-react';
import { Property, PropertyOwner, Full5StepSkipTraceResult, LookupPlatformLink } from '../types';

interface SkipTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property | null;
  propertyId?: string;
  address?: string;
  apn?: string;
  onContactsUpdated?: (owner: PropertyOwner) => void;
  onOpenDialer?: (phoneNumber: string, ownerName: string, propertyAddress: string) => void;
}

export const SkipTraceModal: React.FC<SkipTraceModalProps> = ({
  isOpen,
  onClose,
  property,
  propertyId,
  address,
  apn,
  onContactsUpdated,
  onOpenDialer,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<Full5StepSkipTraceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Form state for discovered contacts in Step 5
  const [phoneInputs, setPhoneInputs] = useState<Array<{ number: string; type: 'mobile' | 'landline'; dnc_status: boolean }>>([
    { number: '', type: 'mobile', dnc_status: false },
  ]);
  const [emailInputs, setEmailInputs] = useState<Array<{ email: string; verified: boolean }>>([
    { email: '', verified: true },
  ]);
  const [researchNotes, setResearchNotes] = useState<string>('');
  const [savingContacts, setSavingContacts] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [autoEnriching, setAutoEnriching] = useState<boolean>(false);
  const [engineCategoryFilter, setEngineCategoryFilter] = useState<
    'all' | 'directory' | 'reverse_address' | 'background' | 'public_records' | 'corporate' | 'social' | 'voter' | 'dork'
  >('all');

  useEffect(() => {
    if (isOpen) {
      runSkipTrace();
    }
  }, [isOpen, property?.id, propertyId, address, apn]);

  const runSkipTrace = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const targetPropId = property?.id || propertyId;
      const targetAddress = property?.address || address;
      const targetApn = property?.apn || apn;
      const targetCity = property?.city;
      const targetCounty = property?.county;

      const response = await fetch('/api/skip-trace/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: targetPropId,
          address: targetAddress,
          apn: targetApn,
          city: targetCity,
          county: targetCounty,
        }),
      });

      if (!response.ok) {
        throw new Error(`Skip trace execution failed (HTTP ${response.status})`);
      }

      const data: Full5StepSkipTraceResult = await response.json();
      setResult(data);

      // Populate existing contact inputs if available
      if (data.step5_contact_discovery.existing_phones.length > 0) {
        setPhoneInputs(
          data.step5_contact_discovery.existing_phones.map((p) => ({
            number: p.number,
            type: p.type || 'mobile',
            dnc_status: p.dnc_status || false,
          }))
        );
      } else {
        setPhoneInputs([{ number: '', type: 'mobile', dnc_status: false }]);
      }

      if (data.step5_contact_discovery.existing_emails.length > 0) {
        setEmailInputs(
          data.step5_contact_discovery.existing_emails.map((e) => ({
            email: e.email,
            verified: e.verified ?? true,
          }))
        );
      } else {
        setEmailInputs([{ email: '', verified: true }]);
      }
    } catch (err: any) {
      console.error('Skip trace modal error:', err);
      setError(err.message || 'Failed to retrieve skip trace intelligence');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoEnrich = async () => {
    if (!result) return;
    setAutoEnriching(true);
    setError(null);

    try {
      const response = await fetch('/api/skip-trace/auto-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: result.owner_id,
          propertyId: result.property_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Auto-enrichment failed');
      }

      const data = await response.json();
      if (data.discoveredPhones && data.discoveredPhones.length > 0) {
        setPhoneInputs(
          data.discoveredPhones.map((p: any) => ({
            number: p.number,
            type: p.type || 'mobile',
            dnc_status: Boolean(p.dnc_status),
          }))
        );
      }

      if (data.discoveredEmails && data.discoveredEmails.length > 0) {
        setEmailInputs(
          data.discoveredEmails.map((e: any) => ({
            email: e.email,
            verified: Boolean(e.verified),
          }))
        );
      }

      setSaveSuccess(true);
      if (onContactsUpdated && data.owner) {
        onContactsUpdated(data.owner);
      }
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to auto-enrich contacts');
    } finally {
      setAutoEnriching(false);
    }
  };

  const handleLaunchAllEngines = () => {
    if (!result || !result.step5_contact_discovery.lookup_links) return;
    // Launch primary lookup links
    const primary = result.step5_contact_discovery.lookup_links.slice(0, 4);
    for (const link of primary) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleAddPhone = () => {
    setPhoneInputs([...phoneInputs, { number: '', type: 'mobile', dnc_status: false }]);
  };

  const handleRemovePhone = (index: number) => {
    setPhoneInputs(phoneInputs.filter((_, i) => i !== index));
  };

  const handleAddEmail = () => {
    setEmailInputs([...emailInputs, { email: '', verified: true }]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmailInputs(emailInputs.filter((_, i) => i !== index));
  };

  const handleSaveContacts = async () => {
    if (!result) return;
    setSavingContacts(true);
    setSaveSuccess(false);

    try {
      const cleanPhones = phoneInputs.filter((p) => p.number.trim().length >= 7);
      const cleanEmails = emailInputs.filter((e) => e.email.trim().includes('@'));

      const response = await fetch('/api/skip-trace/save-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: result.owner_id,
          propertyId: result.property_id,
          phoneNumbers: cleanPhones,
          emailAddresses: cleanEmails,
          notes: researchNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save verified contacts to database');
      }

      const resData = await response.json();
      setSaveSuccess(true);
      if (onContactsUpdated && resData.owner) {
        onContactsUpdated(resData.owner);
      }
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(`Error saving contacts: ${err.message}`);
    } finally {
      setSavingContacts(false);
    }
  };

  if (!isOpen) return null;

  const stepsList = [
    { num: 1, title: 'GIS & APN', icon: Layers, desc: 'County GIS Cadastral Map' },
    { num: 2, title: 'Owner of Record', icon: FileText, desc: 'Tax Assessor & Deed Roll' },
    { num: 3, title: 'Mailing Analysis', icon: Mail, desc: 'Absentee Residence vs Situs' },
    { num: 4, title: 'Corporate Trace', icon: Building2, desc: 'CA SOS & Registered Agents' },
    { num: 5, title: 'Contact Lookups', icon: Phone, desc: '11 Multi-Source Engines' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">5-Step Skip Tracing Intelligence Suite</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  Real Estate Protocol
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {result ? result.address : (property?.address || address || 'County Cadastral Parcel Lookup')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runSkipTrace}
              disabled={loading}
              title="Refresh Skip Trace Analysis"
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5-Step Process Navigation Stepper */}
        <div className="bg-slate-950/60 px-6 py-3 border-b border-slate-800/80 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {stepsList.map((step) => {
              const StepIcon = step.icon;
              const isActive = activeStep === step.num;
              const isPast = activeStep > step.num;

              return (
                <button
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-left transition ${
                    isActive
                      ? 'bg-indigo-600/20 border border-indigo-500/50 text-white shadow-sm'
                      : isPast
                      ? 'bg-slate-800/60 border border-emerald-500/30 text-emerald-300 hover:bg-slate-800'
                      : 'bg-slate-900/40 border border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isPast
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-none">{step.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[110px]">{step.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && !result && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
              <h3 className="text-base font-semibold text-white">Running 5-Step Skip Trace Engine...</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Querying California Cadastral GIS, Tax Assessor rolls, Secretary of State business registry, and generating direct lookup endpoints.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <h4 className="text-sm font-semibold">Skip Trace Retrieval Issue</h4>
                <p className="text-xs text-rose-300/90 mt-1">{error}</p>
                <button
                  onClick={runSkipTrace}
                  className="mt-3 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-semibold transition"
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          )}

          {result && (
            <div>
              {/* Quick Summary Pill Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Parcel APN</div>
                  <div className="text-sm font-mono font-bold text-white mt-1 flex items-center gap-1.5">
                    {result.step1_gis.apn}
                    <button
                      onClick={() => handleCopy(result.step1_gis.apn, 'apn_summary')}
                      className="text-slate-400 hover:text-white"
                      title="Copy APN"
                    >
                      {copiedLink === 'apn_summary' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recorded Owner</div>
                  <div className="text-sm font-bold text-white mt-1 truncate" title={result.step2_assessor_owner.legal_owner_name}>
                    {result.step2_assessor_owner.legal_owner_name}
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Absentee Status</div>
                  <div className="text-xs font-semibold mt-1">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      result.step3_mailing_analysis.absentee_tier === 'Out-of-State Absentee'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : result.step3_mailing_analysis.absentee_tier === 'Out-of-County Absentee'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : result.step3_mailing_analysis.absentee_tier === 'In-County Absentee'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {result.step3_mailing_analysis.absentee_tier}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Corporate Entity</div>
                  <div className="text-xs font-bold text-white mt-1 truncate">
                    {result.step4_corporate_trace.is_corporate_entity ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {result.step4_corporate_trace.entity_type.split(' ')[0]}
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        Individual Owner
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* STEP 1: FIND PARCEL NUMBER (GIS / APN)                     */}
              {/* ========================================================= */}
              {activeStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold text-white">Step 1: Find the Parcel Number (GIS / APN)</h3>
                      </div>
                      <p className="text-xs text-indigo-200/80">
                        Authoritative Assessor’s Parcel Number (APN) identified from California County Cadastral GIS Open Data.
                      </p>
                    </div>
                    <a
                      href={result.step1_gis.county_gis_portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>County GIS Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        Cadastral Spatial Attributes
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Assessor Parcel Number (APN):</span>
                          <span className="font-mono font-bold text-white flex items-center gap-1">
                            {result.step1_gis.apn}
                            <button
                              onClick={() => handleCopy(result.step1_gis.apn, 'apn_step1')}
                              className="text-slate-400 hover:text-white"
                            >
                              {copiedLink === 'apn_step1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">County Jurisdiction:</span>
                          <span className="font-semibold text-white">{result.step1_gis.county}</span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Zoning Designation:</span>
                          <span className="font-semibold text-white">{result.step1_gis.zoning_code}</span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Parcel Size (Acres / SqFt):</span>
                          <span className="font-semibold text-white">
                            {result.step1_gis.parcel_acres} acres ({result.step1_gis.parcel_sqft.toLocaleString()} sqft)
                          </span>
                        </div>

                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Centroid Coordinates:</span>
                          <span className="font-mono text-white">
                            {result.step1_gis.latitude?.toFixed(4)}, {result.step1_gis.longitude?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Data Provenance & Source
                      </h4>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        Sourced via <strong className="text-white">{result.step1_gis.gis_source_name}</strong>. Boundaries are verified against the county digital cadastral land database.
                      </p>

                      <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/40 text-[11px] font-mono text-slate-400 break-all">
                        {result.step1_gis.gis_endpoint_url}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>APN is legally registered and queryable across all California public databases.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setActiveStep(2)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span>Proceed to Step 2: Owner of Record</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 2: IDENTIFY OWNER OF RECORD (TAX ASSESSOR / DEEDS)   */}
              {/* ========================================================= */}
              {activeStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold text-white">Step 2: Identify the Owner of Record</h3>
                      </div>
                      <p className="text-xs text-indigo-200/80">
                        Legal owner of record extracted from official County Tax Assessor roll and recorded deed database.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Legal Title & Owner Information
                      </h4>

                      <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700/80">
                        <div className="text-[11px] text-slate-400 uppercase font-semibold">Recorded Legal Name</div>
                        <div className="text-base font-bold text-white mt-0.5 flex items-center justify-between">
                          <span>{result.step2_assessor_owner.legal_owner_name}</span>
                          <button
                            onClick={() => handleCopy(result.step2_assessor_owner.legal_owner_name, 'owner_name')}
                            className="text-slate-400 hover:text-white p-1"
                            title="Copy Owner Name"
                          >
                            {copiedLink === 'owner_name' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[11px] font-semibold uppercase">
                            {result.step2_assessor_owner.entity_type}
                          </span>
                          {result.step2_assessor_owner.tax_delinquent ? (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[11px] font-semibold">
                              Tax Delinquent
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold">
                              Taxes Current
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-xs pt-1">
                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Last Recorded Deed Date:</span>
                          <span className="font-semibold text-white">{result.step2_assessor_owner.recorded_deed_date}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Estimated Market Valuation:</span>
                          <span className="font-bold text-emerald-400">
                            ${(result.step2_assessor_owner.estimated_market_value / 1000000).toFixed(2)}M
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Estimated Equity Position:</span>
                          <span className="font-bold text-indigo-400">
                            ${(result.step2_assessor_owner.estimated_equity / 1000000).toFixed(2)}M
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Assessor Tax Roll Breakdown
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Assessed Land Value:</span>
                          <span className="font-mono font-semibold text-white">
                            ${result.step2_assessor_owner.assessed_land_value.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Assessed Improvements:</span>
                          <span className="font-mono font-semibold text-white">
                            ${result.step2_assessor_owner.assessed_improvement_value.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Total Assessed Tax Roll:</span>
                          <span className="font-mono font-bold text-white">
                            ${result.step2_assessor_owner.assessed_tax_value.toLocaleString()}
                          </span>
                        </div>

                        <div className="pt-2 text-[11px] text-slate-400 leading-relaxed">
                          <strong className="text-slate-300">County Assessor Provenance:</strong> {result.step2_assessor_owner.provenance_source}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setActiveStep(1)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Back to Step 1
                    </button>
                    <button
                      onClick={() => setActiveStep(3)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span>Proceed to Step 3: Mailing Analysis</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 3: LOOK UP MAILING ADDRESS (ABSENTEE ANALYSIS)        */}
              {/* ========================================================= */}
              {activeStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold text-white">Step 3: Look Up the Mailing Address</h3>
                      </div>
                      <p className="text-xs text-indigo-200/80">
                        Tax billing address vs. physical property address discrepancy test to identify where the owner actually lives.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Physical Property Situs */}
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-indigo-400" />
                          Physical Property Situs (Rental Asset)
                        </span>
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-semibold">
                          Parcel Site
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/70">
                        <div className="text-sm font-bold text-white">{result.step3_mailing_analysis.situs_address}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {result.step3_mailing_analysis.situs_city}, {result.step3_mailing_analysis.situs_state} {result.step3_mailing_analysis.situs_zip}
                        </div>
                      </div>
                    </div>

                    {/* Tax Billing / Mailing Address */}
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-amber-400" />
                          Tax Billing / Owner Mailing Destination
                        </span>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold">
                          Where Bills Are Sent
                        </span>
                      </div>
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/70">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{result.step3_mailing_analysis.tax_billing_address}</span>
                          <button
                            onClick={() => handleCopy(result.step3_mailing_analysis.tax_billing_address, 'tax_addr')}
                            className="text-slate-400 hover:text-white p-1"
                            title="Copy Mailing Address"
                          >
                            {copiedLink === 'tax_addr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {result.step3_mailing_analysis.tax_billing_city}, {result.step3_mailing_analysis.tax_billing_state} {result.step3_mailing_analysis.tax_billing_zip}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy & Opportunity Card */}
                  <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Absentee Discrepancy Analysis:
                        </span>
                        <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold">
                          {result.step3_mailing_analysis.absentee_tier}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        Distance: <strong className="text-white">{result.step3_mailing_analysis.distance_category}</strong>
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-700/60 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block mb-0.5">Strategic Cold Outreach & Management Pitch:</strong>
                        {result.step3_mailing_analysis.strategic_pitch_note}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setActiveStep(2)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Back to Step 2
                    </button>
                    <button
                      onClick={() => setActiveStep(4)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span>Proceed to Step 4: Corporate Trace</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 4: TRACE CORPORATE OWNERS (SECRETARY OF STATE)        */}
              {/* ========================================================= */}
              {activeStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold text-white">Step 4: Trace Corporate Owners (Secretary of State)</h3>
                      </div>
                      <p className="text-xs text-indigo-200/80">
                        Pierces LLC, LP, and corporate entities to locate registered agents, managing members, and human decision makers.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={result.step4_corporate_trace.sos_lookup_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <span>CA SOS bizfile Search</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        Entity Filing & Legal Status
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Entity Name:</span>
                          <span className="font-bold text-white">{result.step4_corporate_trace.entity_name}</span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">Entity Type:</span>
                          <span className="font-semibold text-white">{result.step4_corporate_trace.entity_type}</span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-700/50">
                          <span className="text-slate-400">State Jurisdiction:</span>
                          <span className="font-semibold text-white">{result.step4_corporate_trace.filing_jurisdiction}</span>
                        </div>

                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Status:</span>
                          <span className="font-bold text-emerald-400">{result.step4_corporate_trace.entity_status}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <a
                          href={result.step4_corporate_trace.opencorporates_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                        >
                          <span>Check OpenCorporates Database</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-indigo-400" />
                        Registered Agent & Managing Officers
                      </h4>

                      {result.step4_corporate_trace.registered_agent_name ? (
                        <div className="space-y-2 text-xs">
                          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/70">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">Registered Agent for Service</div>
                            <div className="text-xs font-bold text-white mt-0.5">{result.step4_corporate_trace.registered_agent_name}</div>
                            {result.step4_corporate_trace.registered_agent_address && (
                              <div className="text-[11px] text-slate-400 mt-1">{result.step4_corporate_trace.registered_agent_address}</div>
                            )}
                          </div>

                          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/70">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Managing Members / Directors</div>
                            {result.step4_corporate_trace.managing_members.map((member, idx) => (
                              <div key={idx} className="text-xs font-semibold text-emerald-300 py-0.5 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                {member}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50 text-xs text-slate-400 leading-relaxed">
                          This property is held under individual title. No corporate entity veil required. You can skip directly to phone and email lookups in Step 5.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setActiveStep(3)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Back to Step 3
                    </button>
                    <button
                      onClick={() => setActiveStep(5)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span>Proceed to Step 5: Contact Lookups</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* STEP 5: UNCOVER PHONE NUMBERS & EMAILS                     */}
              {/* ========================================================= */}
              {activeStep === 5 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Phone className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-bold text-white">Step 5: Uncover Phone Numbers, Emails & Public Records</h3>
                      </div>
                      <p className="text-xs text-indigo-200/80">
                        Launch one-click targeted searches across the 11 integrated skip-tracing resources: TruePeopleSearch, CyberBackgroundChecks, Public & County Records, Business Registries (CA SOS & OpenCorporates), FastPeopleSearch, County Recorded Documents, Assessor Websites, LinkedIn, Facebook, Whitepages, and Voter Registration Records.
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Platform Launch Buttons */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        Multi-Engine Skip Tracing Suite ({result.step5_contact_discovery.lookup_links.length} Resources Generated)
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleAutoEnrich}
                          disabled={autoEnriching}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition disabled:opacity-50"
                        >
                          {autoEnriching ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          <span>{autoEnriching ? 'Scraping Public Engines...' : 'Auto-Enrich Contacts'}</span>
                        </button>

                        <button
                          onClick={handleLaunchAllEngines}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Open Top Free Engines in New Tabs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Launch Top 4 Tabs</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter Category Tabs with Dynamic Item Counts */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      {(
                        [
                          { id: 'all', label: 'All Resources' },
                          { id: 'directory', label: 'Directories & Whitepages' },
                          { id: 'background', label: 'Background Checks' },
                          { id: 'public_records', label: 'Assessor & County Recorded' },
                          { id: 'corporate', label: 'Business Registries' },
                          { id: 'social', label: 'Social & Executive' },
                          { id: 'voter', label: 'Voter Registration' },
                          { id: 'reverse_address', label: 'Reverse Address' },
                          { id: 'dork', label: 'Google Dorks' },
                        ] as const
                      ).map((cat) => {
                        const count = result.step5_contact_discovery.lookup_links.filter((l) =>
                          cat.id === 'all' ? true : (l.category || 'directory') === cat.id
                        ).length;

                        return (
                          <button
                            key={cat.id}
                            onClick={() => setEngineCategoryFilter(cat.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 ${
                              engineCategoryFilter === cat.id
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <span>{cat.label}</span>
                            {count > 0 && (
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                  engineCategoryFilter === cat.id
                                    ? 'bg-indigo-400/30 text-white'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {result.step5_contact_discovery.lookup_links
                        .filter((link) => {
                          if (engineCategoryFilter === 'all') return true;
                          return (link.category || 'directory') === engineCategoryFilter;
                        })
                        .map((link, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/80 flex flex-col justify-between space-y-2.5 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5 leading-snug">
                                {link.platformName === 'TruePeopleSearch' && (
                                  <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                    <Phone className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'CyberBackgroundChecks' && (
                                  <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'PublicCountyRecords' && (
                                  <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                                    <Landmark className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'BusinessRegistries' && (
                                  <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                    <Building className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'FastPeopleSearch' && (
                                  <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <Zap className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'CountyRecorder' && (
                                  <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                                    <FileText className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'AssessorWebsites' && (
                                  <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'LinkedInSearch' && (
                                  <span className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                                    <Briefcase className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'FacebookSearch' && (
                                  <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                    <Users className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'Whitepages' && (
                                  <span className="w-5 h-5 rounded-md bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                                    <BookOpen className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'VoterRecords' && (
                                  <span className="w-5 h-5 rounded-md bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0">
                                    <Vote className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'ThatsThem' && (
                                  <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                    <Search className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'CaliforniaSOS' && (
                                  <span className="w-5 h-5 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                                    <Building2 className="w-3 h-3" />
                                  </span>
                                )}
                                {link.platformName === 'GoogleDork' && (
                                  <span className="w-5 h-5 rounded-md bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                                    <Search className="w-3 h-3" />
                                  </span>
                                )}
                                <span className="truncate">{link.label}</span>
                              </span>

                              {link.category === 'reverse_address' && (
                                <span className="px-1.5 py-0.5 bg-slate-700/80 text-[9px] font-semibold text-slate-300 rounded shrink-0">
                                  Reverse
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">{link.description}</p>
                            <div className="text-[10px] text-indigo-300 font-mono mt-1.5 truncate">
                              Target: {link.targetName} • {link.targetLocation}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                            >
                              <span>Open Search</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleCopy(link.url, `link_${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition"
                              title="Copy URL"
                            >
                              {copiedLink === `link_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact Capture & Persistence Card */}
                  <div className="p-4 bg-slate-800/70 rounded-xl border border-slate-700/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          Discovered Contact Ingestion & CRM Lead Sync
                        </h4>
                        <p className="text-xs text-slate-400">
                          Paste newly discovered phone numbers and emails. Automatically verified against TCPA suppression rules.
                        </p>
                      </div>
                      {saveSuccess && (
                        <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Contacts Synced to Database & Lead Pipeline!</span>
                        </div>
                      )}
                    </div>

                    {/* Phone Numbers Input List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-400" />
                          Discovered Phone Numbers
                        </label>
                        <button
                          type="button"
                          onClick={handleAddPhone}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Phone
                        </button>
                      </div>

                      {phoneInputs.map((phone, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="(714) 555-0199"
                            value={phone.number}
                            onChange={(e) => {
                              const updated = [...phoneInputs];
                              updated[idx].number = e.target.value;
                              setPhoneInputs(updated);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <select
                            value={phone.type}
                            onChange={(e) => {
                              const updated = [...phoneInputs];
                              updated[idx].type = e.target.value as 'mobile' | 'landline';
                              setPhoneInputs(updated);
                            }}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="mobile">Mobile (SMS/Voice)</option>
                            <option value="landline">Landline</option>
                          </select>

                          <label className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-900/60 border border-slate-700/80 rounded-xl text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={phone.dnc_status}
                              onChange={(e) => {
                                const updated = [...phoneInputs];
                                updated[idx].dnc_status = e.target.checked;
                                setPhoneInputs(updated);
                              }}
                              className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                            />
                            <span className={phone.dnc_status ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                              DNC
                            </span>
                          </label>

                          {onOpenDialer && phone.number.trim().length >= 7 && (
                            <button
                              type="button"
                              onClick={() => onOpenDialer(phone.number, result.step2_assessor_owner.legal_owner_name, result.address)}
                              className="p-2 text-emerald-300 hover:text-white bg-emerald-600/30 hover:bg-emerald-600 rounded-xl border border-emerald-500/40 transition"
                              title="Launch Instant Call in Dialer"
                            >
                              <PhoneCall className="w-4 h-4" />
                            </button>
                          )}

                          {phoneInputs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePhone(idx)}
                              className="p-2 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Email Addresses Input List */}
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-indigo-400" />
                          Discovered Email Addresses
                        </label>
                        <button
                          type="button"
                          onClick={handleAddEmail}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Email
                        </button>
                      </div>

                      {emailInputs.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="email"
                            placeholder="owner@example.com"
                            value={email.email}
                            onChange={(e) => {
                              const updated = [...emailInputs];
                              updated[idx].email = e.target.value;
                              setEmailInputs(updated);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <label className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-900/60 border border-slate-700/80 rounded-xl text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={email.verified}
                              onChange={(e) => {
                                const updated = [...emailInputs];
                                updated[idx].verified = e.target.checked;
                                setEmailInputs(updated);
                              }}
                              className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className={email.verified ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                              Verified
                            </span>
                          </label>

                          {emailInputs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(idx)}
                              className="p-2 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Research Notes */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Skip Trace Intelligence Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., Verified phone with TruePeopleSearch, managing member answered, interested in Orange County property management proposal..."
                        value={researchNotes}
                        onChange={(e) => setResearchNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-[11px] text-slate-400">
                        Saves to PostgreSQL, updates owner profile, and qualifies lead in CRM.
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveContacts}
                        disabled={savingContacts}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
                      >
                        {savingContacts ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Save & Sync to Lead Record</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setActiveStep(4)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Back to Step 4
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
                    >
                      Close Skip Trace Suite
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
