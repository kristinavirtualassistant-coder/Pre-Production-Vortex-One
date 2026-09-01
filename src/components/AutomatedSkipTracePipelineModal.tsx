/**
 * Vortex One - Automated Property Search & Skip Tracing Pipeline Suite
 *
 * Automates:
 * 1. Live GIS / Assessor Cadastral Ingestion
 * 2. 5-Step Skip Trace & Provenance Verification
 * 3. Multi-Engine Contact Resolution (Whitepages, TruePeopleSearch, FastPeopleSearch, SOS bizfile, That's Them)
 * 4. TCPA National DNC Suppression Scrub
 * 5. Automatic CRM Lead Generation & Campaign Staging
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Bot,
  Zap,
  Phone,
  Mail,
  ShieldCheck,
  Building2,
  MapPin,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowRight,
  ExternalLink,
  PhoneCall,
  Sliders,
  Play,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import { Property, PropertyOwner, AutomatedPipelineParams, AutomatedPipelineResult } from '../types';
import { useToast } from '../contexts/ToastContext';

interface AutomatedSkipTracePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
  onOpenDialer?: (phoneNumber: string, ownerName: string, propertyAddress: string) => void;
  onSelectProperty?: (property: Property) => void;
  initialCounty?: string;
  initialCity?: string;
}

const COUNTY_CITIES_MAP: Record<string, string[]> = {
  'Orange County': [
    'All Cities in County (Countywide)',
    'Costa Mesa',
    'Newport Beach',
    'Irvine',
    'Santa Ana',
    'Anaheim',
    'Huntington Beach',
    'Orange',
    'Fullerton',
    'Garden Grove',
    'Laguna Beach',
    'Mission Viejo',
    'Lake Forest',
    'Tustin',
    'Fountain Valley',
    'Brea',
    'Yorba Linda',
    'Laguna Niguel',
    'San Clemente',
    'San Juan Capistrano',
    'Aliso Viejo',
    'Laguna Hills',
    'Westminster',
    'Cypress',
    'Seal Beach',
    'Dana Point',
    'Rancho Santa Margarita',
  ],
  'Los Angeles County': [
    'All Cities in County (Countywide)',
    'Los Angeles',
    'Long Beach',
    'Glendale',
    'Santa Clarita',
    'Pasadena',
    'Torrance',
    'Pomona',
    'Palmdale',
    'Lancaster',
    'El Monte',
    'Downey',
    'West Covina',
    'Norwalk',
    'Burbank',
    'South Gate',
    'Compton',
    'Carson',
    'Santa Monica',
    'Whittier',
    'Alhambra',
    'Hawthorne',
    'Lakewood',
    'Bellflower',
    'Redondo Beach',
    'Montebello',
    'Monterey Park',
    'Gardena',
    'Arcadia',
    'Glendora',
    'Cerritos',
  ],
  'San Diego County': [
    'All Cities in County (Countywide)',
    'San Diego',
    'Chula Vista',
    'Oceanside',
    'Escondido',
    'El Cajon',
    'Vista',
    'San Marcos',
    'Carlsbad',
    'Encinitas',
    'National City',
    'La Mesa',
    'Santee',
    'Poway',
  ],
  'Riverside County': [
    'All Cities in County (Countywide)',
    'Riverside',
    'Moreno Valley',
    'Corona',
    'Temecula',
    'Murrieta',
    'Indio',
    'Hemet',
    'Perris',
    'Lake Elsinore',
    'Cathedral City',
    'Palm Desert',
    'Palm Springs',
    'San Jacinto',
    'Beaumont',
    'Banning',
    'La Quinta',
  ],
  'San Bernardino County': [
    'All Cities in County (Countywide)',
    'San Bernardino',
    'Fontana',
    'Ontario',
    'Rancho Cucamonga',
    'Rialto',
    'Hesperia',
    'Victorville',
    'Chino',
    'Chino Hills',
    'Upland',
    'Apple Valley',
    'Redlands',
    'Colton',
    'Yucaipa',
  ],
  'Ventura County': [
    'All Cities in County (Countywide)',
    'Oxnard',
    'Thousand Oaks',
    'Simi Valley',
    'Ventura',
    'Camarillo',
    'Moorpark',
    'Santa Paula',
    'Port Hueneme',
    'Ojai',
  ],
  'Santa Clara County': [
    'All Cities in County (Countywide)',
    'San Jose',
    'Sunnyvale',
    'Santa Clara',
    'Mountain View',
    'Palo Alto',
    'Milpitas',
    'Cupertino',
    'Gilroy',
    'Morgan Hill',
    'Los Gatos',
    'Saratoga',
    'Campbell',
  ],
  'Alameda County': [
    'All Cities in County (Countywide)',
    'Oakland',
    'Fremont',
    'Hayward',
    'Berkeley',
    'San Leandro',
    'Livermore',
    'Pleasanton',
    'Union City',
    'Newark',
    'Dublin',
  ],
  'Sacramento County': [
    'All Cities in County (Countywide)',
    'Sacramento',
    'Elk Grove',
    'Citrus Heights',
    'Folsom',
    'Rancho Cordova',
    'Galt',
  ],
};

export const AutomatedSkipTracePipelineModal: React.FC<AutomatedSkipTracePipelineModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  onOpenDialer,
  onSelectProperty,
  initialCounty = 'Orange County',
  initialCity = 'All Cities in County (Countywide)',
}) => {
  const { addToast } = useToast();
  const [county, setCounty] = useState(initialCounty);
  const [city, setCity] = useState(initialCity);
  const [zip, setZip] = useState('');
  const [propertyType, setPropertyType] = useState('Multi-Family');
  const [minUnits, setMinUnits] = useState<number>(4);
  const [maxUnits, setMaxUnits] = useState<number>(50);
  const [absenteeOnly, setAbsenteeOnly] = useState<boolean>(true);
  const [minEquity, setMinEquity] = useState<number>(500000);
  const [limit, setLimit] = useState<number>(500); // Increased default prospecting batch size to 500

  // Additional filters
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000000);
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState<boolean>(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('All');
  const [minSquareFeet, setMinSquareFeet] = useState<number>(0);

  const [autoEnrichContacts, setAutoEnrichContacts] = useState<boolean>(true);
  const [createLeads, setCreateLeads] = useState<boolean>(true);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<AutomatedPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const pipelineStages = [
    { name: 'GIS & Cadastral Ingestion', icon: Layers, desc: 'Querying official County GIS map servers' },
    { name: 'Assessor Tax Roll Match', icon: Building2, desc: 'Matching assessed value and deed date' },
    { name: 'Mailing & Absentee Audit', icon: Mail, desc: 'Identifying off-site owner billing addresses' },
    { name: 'CA SOS Corporate Piercing', icon: ShieldCheck, desc: 'Piercing LLC veils to find managing directors' },
    { name: 'Whitepages & Multi-Engine Resolution', icon: Search, desc: 'Cross-referencing Whitepages, TruePeopleSearch & FastPeopleSearch' },
    { name: 'TCPA National DNC Scrub', icon: Phone, desc: 'Scrubbing against national Do-Not-Call registry' },
    { name: 'CRM Outreach-Ready Staging', icon: Users, desc: 'Generating scored leads ready for automated dialer' },
  ];

  const handleStartPipeline = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgressPercent(10);
    setCurrentStepIndex(0);
    setStatusMessage('Connecting to County Cadastral GIS Server...');

    // Progress animation loop
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 90) {
          const next = prev + Math.floor(Math.random() * 8) + 4;
          const stageIdx = Math.min(Math.floor((next / 90) * pipelineStages.length), pipelineStages.length - 1);
          setCurrentStepIndex(stageIdx);
          setStatusMessage(pipelineStages[stageIdx].desc);
          return next;
        }
        return prev;
      });
    }, 600);

    try {
      const response = await fetch('/api/skip-trace/automated-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county,
          city: city && !city.includes('All Cities') ? city : undefined,
          zip: zip || undefined,
          propertyType: propertyType !== 'All' ? propertyType : undefined,
          minUnits: Number(minUnits) || undefined,
          maxUnits: Number(maxUnits) || undefined,
          absenteeOnly,
          minEquity: Number(minEquity) || undefined,
          minPrice: Number(minPrice) || undefined,
          maxPrice: Number(maxPrice) || undefined,
          taxDelinquentOnly,
          entityType: entityTypeFilter !== 'All' ? entityTypeFilter : undefined,
          minSquareFeet: Number(minSquareFeet) || undefined,
          limit: Number(limit) || 500,
          autoEnrichContacts,
          createLeads,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`Pipeline failed (HTTP ${response.status})`);
      }

      const data: AutomatedPipelineResult = await response.json();
      setProgressPercent(100);
      setCurrentStepIndex(pipelineStages.length - 1);
      setStatusMessage('Pipeline completed successfully!');
      setResult(data);

      addToast(
        `Automated Pipeline Complete: ${data.totalDiscovered} properties discovered, ${data.contactsFoundCount} contact points verified!`,
        'success'
      );

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Pipeline execution error:', err);
      setError(err.message || 'Automated pipeline failed');
      addToast(`Pipeline failed: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCSV = () => {
    if (!result || !result.results) return;
    const rows = [
      ['Address', 'City', 'County', 'APN', 'Property Type', 'Owner Name', 'Entity Type', 'Phone Numbers', 'Emails', 'Lead Score', 'DNC Status'],
      ...result.results.map((r) => [
        `"${r.property.address}"`,
        `"${r.property.city}"`,
        `"${r.property.county}"`,
        `"${r.property.apn}"`,
        `"${r.property.property_type}"`,
        `"${r.owner.name}"`,
        `"${r.owner.entity_type}"`,
        `"${(r.owner.phone_numbers || []).map((p) => p.number).join('; ')}"`,
        `"${(r.owner.email_addresses || []).map((e) => e.email).join('; ')}"`,
        `"${r.lead?.lead_score || 85}"`,
        `"${(r.owner.phone_numbers || []).some((p) => !p.dnc_status) ? 'DNC Compliant' : 'Requires DNC Scrub'}"`,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VortexOne_SkipTrace_${county.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Exported skip trace records to CSV', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Automate Property Search & Skip Tracing</h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
                  Live DAG Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                End-to-end autonomous ingestion: County GIS ➔ Assessor Roll ➔ Whitepages & Public Engines ➔ TCPA DNC Scrub ➔ CRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Configuration Form */}
          {!result && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed flex items-start gap-3">
                <Bot className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Autonomous Multi-Engine Skip Tracing Protocol:</strong> The pipeline searches official California Cadastral parcel databases, matches Tax Assessor valuations, traces corporate ownership across California SOS (bizfile), cross-references <span className="text-white font-semibold">Whitepages, TruePeopleSearch, FastPeopleSearch & That's Them</span>, scrubs against National DNC registries, and generates ready-to-dial prospects.
                </div>
              </div>

              {/* Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* County */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">California County Assessor</label>
                  <select
                    value={county}
                    onChange={(e) => {
                      const newCounty = e.target.value;
                      setCounty(newCounty);
                      const cities = COUNTY_CITIES_MAP[newCounty] || [];
                      setCity(cities[0] || 'All Cities in County (Countywide)');
                    }}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    {Object.keys(COUNTY_CITIES_MAP).map((cName) => (
                      <option key={cName} value={cName}>{cName} Cadastral GIS</option>
                    ))}
                  </select>
                </div>

                {/* City Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target City (Dropdown)</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    {(COUNTY_CITIES_MAP[county] || ['All Cities in County (Countywide)']).map((cityName) => (
                      <option key={cityName} value={cityName}>{cityName}</option>
                    ))}
                  </select>
                </div>

                {/* Property Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Asset Class / Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Multi-Family">Multi-Family (Apartments & Plexes)</option>
                    <option value="Commercial">Commercial (Office, Retail, Mixed-Use)</option>
                    <option value="Industrial">Industrial & Warehousing</option>
                    <option value="Single Family">Single Family Residential</option>
                    <option value="All">All Asset Classes</option>
                  </select>
                </div>

                {/* Unit Count Range */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Unit Count Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={minUnits}
                      onChange={(e) => setMinUnits(Number(e.target.value))}
                      disabled={isRunning}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition text-center"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={maxUnits}
                      onChange={(e) => setMaxUnits(Number(e.target.value))}
                      disabled={isRunning}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition text-center"
                    />
                  </div>
                </div>

                {/* Min Equity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Minimum Estimated Equity</label>
                  <select
                    value={minEquity}
                    onChange={(e) => setMinEquity(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value={0}>Any Equity Level</option>
                    <option value={250000}>$250,000+ Equity</option>
                    <option value={500000}>$500,000+ Equity (Recommended)</option>
                    <option value={1000000}>$1,000,000+ High Equity</option>
                    <option value={2000000}>$2,000,000+ Ultra High Equity</option>
                  </select>
                </div>

                {/* Batch Limit (Increased to 500+) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Prospecting Batch Size (Up to 1,000)</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition font-semibold"
                  >
                    <option value={50}>50 Properties (Quick Scan)</option>
                    <option value={100}>100 Properties (Standard Batch)</option>
                    <option value={250}>250 Properties (High Volume)</option>
                    <option value={500}>500 Properties (Enterprise Batch)</option>
                    <option value={1000}>1,000 Properties (Max Statewide Ingestion)</option>
                  </select>
                </div>

                {/* Additional Filter: Estimated Market Value */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Minimum Estimated Market Value</label>
                  <select
                    value={minPrice}
                    onChange={(e) => setMinPrice(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value={0}>Any Valuation</option>
                    <option value={1000000}>$1,000,000+</option>
                    <option value={2500000}>$2,500,000+</option>
                    <option value={5000000}>$5,000,000+ (Commercial/Multi-Family)</option>
                    <option value={10000000}>$10,000,000+ (Institutional)</option>
                  </select>
                </div>

                {/* Additional Filter: Owner Entity Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Owner Entity Structure</label>
                  <select
                    value={entityTypeFilter}
                    onChange={(e) => setEntityTypeFilter(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="All">All Entity Types</option>
                    <option value="llc">LLC / Corporation (Corporate Owned)</option>
                    <option value="individual">Individual / Private Owner</option>
                    <option value="trust">Family Trust / Estate</option>
                  </select>
                </div>

                {/* Additional Filter: Min Square Feet */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Minimum Building Size (SqFt)</label>
                  <select
                    value={minSquareFeet}
                    onChange={(e) => setMinSquareFeet(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value={0}>Any Square Footage</option>
                    <option value={2500}>2,500+ SqFt</option>
                    <option value={5000}>5,000+ SqFt</option>
                    <option value={10000}>10,000+ SqFt</option>
                    <option value={25000}>25,000+ SqFt</option>
                  </select>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Autonomous Pipeline Rules & Engine Ingestion
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={absenteeOnly}
                      onChange={(e) => setAbsenteeOnly(e.target.checked)}
                      disabled={isRunning}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300 font-medium">Filter Absentee Owners Only</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoEnrichContacts}
                      onChange={(e) => setAutoEnrichContacts(e.target.checked)}
                      disabled={isRunning}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300 font-medium">Whitepages & Public Contact Auto-Enrich</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createLeads}
                      onChange={(e) => setCreateLeads(e.target.checked)}
                      disabled={isRunning}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300 font-medium">Auto-Create CRM Ready Leads</span>
                  </label>
                </div>
              </div>

              {/* Execution Progress & Status */}
              {isRunning && (
                <div className="p-5 bg-slate-800/80 rounded-xl border border-indigo-500/40 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Autonomous Pipeline in Progress ({progressPercent}%)
                      </span>
                    </div>
                    <span className="text-xs text-indigo-300 font-mono">Stage {currentStepIndex + 1} of {pipelineStages.length}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-300 font-medium italic">{statusMessage}</p>

                  {/* Stage Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
                    {pipelineStages.map((stage, idx) => {
                      const Icon = stage.icon;
                      const isPast = idx < currentStepIndex;
                      const isCurrent = idx === currentStepIndex;
                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-center flex flex-col items-center space-y-1 transition ${
                            isPast
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                              : isCurrent
                              ? 'bg-indigo-950/50 border-indigo-500 text-white animate-pulse'
                              : 'bg-slate-900/40 border-slate-800 text-slate-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold truncate w-full">{stage.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Results View */}
          {result && (
            <div className="space-y-5 animate-in fade-in">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">Parcels Ingested</div>
                  <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>{result.totalDiscovered}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">Skip Traced Owners</div>
                  <div className="text-xl font-bold text-indigo-300 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>{result.totalSkipTraced}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">Contact Points Verified</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>{result.contactsFoundCount}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">Outreach-Ready Leads</div>
                  <div className="text-xl font-bold text-purple-300 mt-1 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>{result.leadsCreatedCount}</span>
                  </div>
                </div>
              </div>

              {/* Discovered Items Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Ingested & Skip-Traced Pipeline Results
                  </h3>
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export to CSV</span>
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-800/80 sticky top-0 z-10 text-[11px] font-bold text-slate-300 uppercase border-b border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">Property / APN</th>
                          <th className="py-2.5 px-3">Owner of Record</th>
                          <th className="py-2.5 px-3">Entity Veil</th>
                          <th className="py-2.5 px-3">Verified Contacts</th>
                          <th className="py-2.5 px-3">TCPA / DNC</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {result.results.map((item, idx) => {
                          const primaryPhone = item.owner.phone_numbers?.[0];
                          const hasCompliantPhone = item.owner.phone_numbers?.some((p) => !p.dnc_status);
                          return (
                            <tr key={idx} className="hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-white">{item.property.address}</div>
                                <div className="text-[11px] text-slate-400">
                                  {item.property.city}, {item.property.county} • APN: <span className="font-mono text-slate-300">{item.property.apn}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-200">{item.owner.name}</div>
                                <div className="text-[11px] text-slate-400">{item.skipTrace.step3_mailing_analysis.absentee_tier}</div>
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-semibold uppercase">
                                  {item.owner.entity_type}
                                </span>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5">
                                  {item.owner.phone_numbers && item.owner.phone_numbers.length > 0 ? (
                                    <div className="font-mono text-white text-[11px] flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-emerald-400" />
                                      {item.owner.phone_numbers[0].number}
                                      {item.owner.phone_numbers.length > 1 && (
                                        <span className="text-[10px] text-slate-400">+{item.owner.phone_numbers.length - 1}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">No phone verified</span>
                                  )}

                                  {item.owner.email_addresses && item.owner.email_addresses.length > 0 && (
                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                      {item.owner.email_addresses[0].email}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                {hasCompliantPhone ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold">
                                    Compliant
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold">
                                    Suppressed
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {primaryPhone && onOpenDialer && (
                                    <button
                                      onClick={() => onOpenDialer(primaryPhone.number, item.owner.name, item.property.address)}
                                      className="p-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg transition"
                                      title="Call via 1-Click Dialer"
                                    >
                                      <PhoneCall className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onSelectProperty && (
                                    <button
                                      onClick={() => {
                                        onSelectProperty(item.property);
                                        onClose();
                                      }}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition"
                                    >
                                      View Property
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div>
            {result ? (
              <button
                onClick={() => {
                  setResult(null);
                  setProgressPercent(0);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Run Another Automated Batch
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                Queries Live County GIS + Tax Assessor + Whitepages Engine
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              Close
            </button>

            {!result && (
              <button
                onClick={handleStartPipeline}
                disabled={isRunning}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {isRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>{isRunning ? 'Running DAG Ingestion...' : 'Start Automated Pipeline'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
