import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Building2,
  DollarSign,
  Layers,
  Sparkles,
  ChevronDown,
  Check,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Download,
  Share2,
  Phone,
  UserPlus,
  ArrowRight,
  TrendingUp,
  Eye,
  CheckSquare,
  Square,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { Property, LeadRecord } from '../types';

interface PropertySearchViewProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  onOpenInspector: (property: Property) => void;
  onCreateLead: (property: Property) => void;
  onInitiateCall: (name: string, phone: string, address: string) => void;
  onNavigate: (view: string) => void;
}

export const PropertySearchView: React.FC<PropertySearchViewProps> = ({
  properties,
  onSelectProperty,
  onOpenInspector,
  onCreateLead,
  onInitiateCall,
  onNavigate,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [absenteeOnly, setAbsenteeOnly] = useState<boolean>(false);
  const [taxDelinquentOnly, setTaxDelinquentOnly] = useState<boolean>(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [activeLayer, setActiveLayer] = useState<'parcels' | 'owners' | 'opportunities' | 'leads'>('parcels');
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  // Filter logic
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.apn.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCity = selectedCity === 'all' || p.city.toLowerCase() === selectedCity.toLowerCase();
      const matchType = selectedType === 'all' || p.property_type === selectedType;
      const score = p.is_absentee_owner ? 88 : 74;
      const matchScore = score >= minScore;
      const matchAbsentee = !absenteeOnly || p.is_absentee_owner;
      const matchTax = !taxDelinquentOnly || p.tax_delinquent;

      return matchSearch && matchCity && matchType && matchScore && matchAbsentee && matchTax;
    });
  }, [properties, searchTerm, selectedCity, selectedType, minScore, absenteeOnly, taxDelinquentOnly]);

  const activeProperty = useMemo(() => {
    return properties.find((p) => p.id === selectedPropertyId) || filteredProperties[0] || properties[0];
  }, [properties, selectedPropertyId, filteredProperties]);

  const handleToggleSelectAll = () => {
    if (selectedPropertyIds.length === filteredProperties.length) {
      setSelectedPropertyIds([]);
    } else {
      setSelectedPropertyIds(filteredProperties.map((p) => p.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const cities = Array.from(new Set(properties.map((p) => p.city))).filter(Boolean);
  const types = Array.from(new Set(properties.map((p) => p.property_type))).filter(Boolean);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Address, APN, Owner name, City, ZIP..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Layer Controls & Stats */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 flex space-x-1">
            {(['parcels', 'owners', 'opportunities', 'leads'] as const).map((layer) => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize transition cursor-pointer ${
                  activeLayer === layer
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/80 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-400 px-2 py-1 rounded bg-slate-900 border border-slate-800">
            {filteredProperties.length} Properties
          </span>
        </div>
      </div>

      {/* Bulk Action Bar (Section 32) */}
      {selectedPropertyIds.length > 0 && (
        <div className="px-4 py-2.5 bg-cyan-950/80 border-b border-cyan-800 text-xs flex items-center justify-between text-cyan-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-cyan-400" />
            <span className="font-bold">{selectedPropertyIds.length} properties selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('dialer')}
              className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer"
            >
              Add to Dialer Campaign
            </button>
            <button
              onClick={() => onNavigate('leads')}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border border-slate-700 transition cursor-pointer"
            >
              Batch Create Leads
            </button>
            <button
              onClick={() => setSelectedPropertyIds([])}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Part Layout: Filters (Left) | Interactive Map (Center) | Property Cards / Inspector (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Filter Drawer (Collapsible) */}
        <aside className="w-64 border-r border-slate-800/80 bg-slate-950/90 p-4 space-y-5 overflow-y-auto hidden xl:block shrink-0">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Filters</span>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCity('all');
                setSelectedType('all');
                setMinScore(0);
                setAbsenteeOnly(false);
                setTaxDelinquentOnly(false);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition cursor-pointer flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Opportunity Score Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Min Opportunity Score</span>
              <span className="font-mono text-cyan-400 font-bold">{minScore}</span>
            </div>
            <input
              type="range"
              min="0"
              max="95"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>0 (All)</span>
              <span>80+ (High Priority)</span>
            </div>
          </div>

          {/* Targeted Boolean Flags */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Ownership Signals
            </span>

            <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={absenteeOnly}
                onChange={(e) => setAbsenteeOnly(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
              <span>Absentee Owner Only</span>
            </label>

            <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={taxDelinquentOnly}
                onChange={(e) => setTaxDelinquentOnly(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
              <span>Tax Delinquent Distress</span>
            </label>
          </div>

          {/* Saved Searches (Section 31) */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Saved Searches
            </span>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => {
                  setSelectedCity('Costa Mesa');
                  setAbsenteeOnly(true);
                  setMinScore(75);
                }}
                className="w-full text-left p-2 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-[11px] transition cursor-pointer"
              >
                Costa Mesa · Absentee &gt; 75
              </button>
              <button
                onClick={() => {
                  setSelectedType('Multi-Family');
                  setMinScore(80);
                }}
                className="w-full text-left p-2 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-[11px] transition cursor-pointer"
              >
                Orange County · Multi-Family 80+
              </button>
            </div>
          </div>
        </aside>

        {/* Center: Interactive Map & Parcels (Section 19: Quiet Basemap, Strong Data Layer) */}
        <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden border-r border-slate-800/80">
          {/* Map Surface Representation */}
          <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            {/* GIS Grid Coordinates & Layer Indicator */}
            <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-cyan-400 backdrop-blur-md">
                GIS ACTIVE LAYER: {activeLayer.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400 backdrop-blur-md">
                33.6411° N, 117.9187° W
              </span>
            </div>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col space-y-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 backdrop-blur-md shadow-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.min(18, z + 1))}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(10, z - 1))}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="h-px bg-slate-800" />
              <button
                onClick={() => setSelectedPropertyId(null)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                title="Recenter Map"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>

            {/* Render Simulated Parcel Mesh & Markers */}
            <div className="relative w-full max-w-2xl aspect-video rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xs p-6 flex flex-wrap content-center justify-center gap-3">
              {filteredProperties.slice(0, 12).map((prop, idx) => {
                const isSelected = prop.id === (activeProperty?.id || '');
                const score = prop.is_absentee_owner ? 88 : 74;

                return (
                  <button
                    key={prop.id}
                    onClick={() => {
                      setSelectedPropertyId(prop.id);
                      onOpenInspector(prop);
                    }}
                    className={`relative p-3 rounded-xl border transition-all cursor-pointer text-left w-48 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 scale-105 z-20 ring-2 ring-cyan-500/20'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">{prop.apn || `PARCEL-${idx + 1}`}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          score >= 80 ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {score} PTS
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-100 truncate">{prop.address}</div>
                    <div className="text-[10px] text-slate-400 truncate">{prop.city}, CA · {prop.property_type}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>${((prop.estimated_value || 1400000) / 1000000).toFixed(2)}M</span>
                      <span className="text-emerald-400">${((prop.estimated_equity || 800000) / 1000000).toFixed(2)}M Eq</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Footer Bar */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>High Opportunity (80+)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <span>Qualified Baseline</span>
              </span>
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              Assessor Boundaries: Orange County &amp; Los Angeles County
            </span>
          </div>
        </div>

        {/* Right Column: Scored Property Cards & Scannable List (Section 6) */}
        <div className="w-80 md:w-96 border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {selectedPropertyIds.length === filteredProperties.length && filteredProperties.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              <span>Select All</span>
            </button>

            <span className="text-[11px] font-mono text-slate-400">
              Showing {filteredProperties.length} records
            </span>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredProperties.map((property) => {
              const isSelected = selectedPropertyIds.includes(property.id);
              const isActive = property.id === activeProperty?.id;
              const score = property.is_absentee_owner ? 88 : 74;

              return (
                <div
                  key={property.id}
                  className={`p-3 rounded-xl border transition cursor-pointer relative ${
                    isActive
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                  onClick={() => {
                    setSelectedPropertyId(property.id);
                    onOpenInspector(property);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(property.id);
                        }}
                        className="mt-0.5 text-slate-500 hover:text-cyan-400 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-100 truncate">{property.address}</h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono font-bold text-cyan-400 block">{score} PTS</span>
                      <span className="text-[9px] text-slate-500 uppercase">{score >= 80 ? 'High' : 'Medium'}</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                    <span>
                      {property.property_type} · {property.square_feet?.toLocaleString() || '1,842'} sq ft
                    </span>
                    <span className="font-mono text-slate-300">
                      ${((property.estimated_value || 1450000) / 1000000).toFixed(2)}M
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-slate-400 truncate max-w-[130px]">
                      Owner: <span className="text-slate-200 font-semibold">{property.owner_name}</span>
                    </span>

                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenInspector(property)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                      >
                        Inspector
                      </button>
                      <button
                        onClick={() => onCreateLead(property)}
                        className="px-2 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                      >
                        + Lead
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
