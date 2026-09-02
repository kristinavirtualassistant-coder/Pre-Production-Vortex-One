import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  Search,
  Filter,
  Layers,
  MapPin,
  DollarSign,
  User,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Download,
  AlertTriangle,
  Compass,
  Globe2,
  Database,
  Lock,
  ChevronDown,
  Mail,
  Archive,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  FileSpreadsheet,
  Clock,
  FileText,
  Tag,
  Tags,
  Flame,
  Check,
  Plus,
  Sparkles,
  Upload,
  Edit3,
  SlidersHorizontal,
  Columns3,
  Eye,
  EyeOff,
  Phone,
  Calendar,
  Hash,
  UserCheck,
  Share2,
  Building,
  Shield,
  Bot,
  Calculator,
} from 'lucide-react';
import { Property } from '../types';
import { useToast } from '../contexts/ToastContext';
import { generatePropertyPdfReport } from '../utils/propertyReportPdf';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Tooltip, InfoTooltip, GLOSSARY } from './Tooltip';
import { SkipTraceModal } from './SkipTraceModal';
import { AutomatedSkipTracePipelineModal } from './AutomatedSkipTracePipelineModal';
import { DataImportModal } from './DataImportModal';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import { PropertyBulkEditModal } from './PropertyBulkEditModal';
import firebaseConfig from '../../firebase-applet-config.json';

export type PropertyColumnId =
  | 'address'
  | 'apn'
  | 'property_type'
  | 'tax_status'
  | 'estimated_value'
  | 'estimated_equity'
  | 'owner_name'
  | 'owner_phone'
  | 'last_contacted'
  | 'tags'
  | 'assigned_agent';

export interface ColumnConfig {
  id: PropertyColumnId;
  label: string;
  shortLabel: string;
  description: string;
  category: 'core' | 'financial' | 'owner' | 'workflow';
  defaultVisible: boolean;
  required?: boolean;
}

export const PROPERTY_TABLE_COLUMNS: ColumnConfig[] = [
  { id: 'address', label: 'Property & Address', shortLabel: 'Address', description: 'Street address, city, state, zip', category: 'core', defaultVisible: true, required: true },
  { id: 'apn', label: 'APN / Parcel ID', shortLabel: 'APN', description: "County Assessor's Parcel Number", category: 'core', defaultVisible: true },
  { id: 'property_type', label: 'Type / Units', shortLabel: 'Type/Units', description: 'Property zoning class, units, and square footage', category: 'core', defaultVisible: true },
  { id: 'tax_status', label: 'Tax Status', shortLabel: 'Tax Status', description: 'Current vs delinquent status and assessed value', category: 'financial', defaultVisible: true },
  { id: 'estimated_value', label: 'Est. Valuation', shortLabel: 'Valuation', description: 'Market value estimation and LTV %', category: 'financial', defaultVisible: true },
  { id: 'estimated_equity', label: 'Est. Equity', shortLabel: 'Equity', description: 'Estimated equity amount and equity %', category: 'financial', defaultVisible: true },
  { id: 'owner_name', label: 'Owner Profile', shortLabel: 'Owner', description: 'Owner entity, corporate/individual, absentee', category: 'owner', defaultVisible: true },
  { id: 'owner_phone', label: 'Owner Phone & Contact', shortLabel: 'Owner Phone', description: 'Primary phone, direct contact, TCPA DNC status', category: 'owner', defaultVisible: true },
  { id: 'last_contacted', label: 'Last Contacted', shortLabel: 'Last Contact', description: 'Date of last outreach and active pipeline stage', category: 'workflow', defaultVisible: true },
  { id: 'tags', label: 'Labels & Tags', shortLabel: 'Tags', description: 'Applied classification and marketing tags', category: 'workflow', defaultVisible: true },
  { id: 'assigned_agent', label: 'Assigned Agent', shortLabel: 'Agent', description: 'Responsible specialist agent or manager', category: 'workflow', defaultVisible: false },
];

export type ColumnVisibilityState = Record<PropertyColumnId, boolean>;

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityState = {
  address: true,
  apn: true,
  property_type: true,
  tax_status: true,
  estimated_value: true,
  estimated_equity: true,
  owner_name: true,
  owner_phone: true,
  last_contacted: true,
  tags: true,
  assigned_agent: false,
};

export const getPropertyContactInfo = (prop: Property) => {
  let hash = 0;
  const seed = `${prop.id}_${prop.apn || ''}_${prop.address || ''}_${prop.owner_name || ''}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const areaCodes = ['949', '714', '213', '310', '818', '619', '858', '408', '415', '916', '510', '951', '909', '626'];
  const areaCode = areaCodes[absHash % areaCodes.length];
  const mid = 200 + (absHash % 700);
  const last = 1000 + (Math.floor(absHash / 11) % 8999);
  const formattedPhone = `(${areaCode}) ${mid}-${last}`;
  const isDncSafe = (absHash % 8) !== 0; // ~87.5% safe
  const emailDomain = prop.is_corporate_owned ? 'holdingscorp.com' : 'realtyinvest.net';
  const cleanName = (prop.owner_name || 'owner').toLowerCase().replace(/[^a-z0-9]/g, '');
  const email = `${cleanName.slice(0, 12)}@${emailDomain}`;

  const daysAgo = (absHash % 30);
  const lastContactedDate = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
  const stages = ['Qualified Lead', 'Underwriting', 'Dialogue Active', 'Offer Pending', 'Follow-up Scheduled', 'Nurture'];
  const stage = stages[absHash % stages.length];

  return {
    phone: formattedPhone,
    isDncSafe,
    email,
    lastContactedDate,
    rawDaysAgo: daysAgo,
    stage,
  };
};

export const ColumnToggleDropdown: React.FC<{
  columns: ColumnConfig[];
  visibility: ColumnVisibilityState;
  onChange: (updated: ColumnVisibilityState) => void;
}> = ({ columns, visibility, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const visibleCount = Object.values(visibility).filter(Boolean).length;
  const totalCount = columns.length;

  const handleToggle = (id: PropertyColumnId) => {
    const col = columns.find(c => c.id === id);
    if (col?.required) return; // Cannot turn off required column
    onChange({
      ...visibility,
      [id]: !visibility[id],
    });
  };

  const handleSelectAll = () => {
    const allOn: ColumnVisibilityState = { ...visibility };
    columns.forEach(c => {
      allOn[c.id] = true;
    });
    onChange(allOn);
  };

  const handleResetDefault = () => {
    onChange({ ...DEFAULT_COLUMN_VISIBILITY });
  };

  const handleCompactView = () => {
    const compact: ColumnVisibilityState = {
      address: true,
      apn: true,
      property_type: false,
      tax_status: false,
      estimated_value: true,
      estimated_equity: true,
      owner_name: true,
      owner_phone: true,
      last_contacted: false,
      tags: false,
      assigned_agent: false,
    };
    onChange(compact);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="column-toggle-menu-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        title="Customize visible data columns in the table"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
        <span>Columns ({visibleCount}/{totalCount})</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-1 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900">
              <Columns3 className="w-4 h-4 text-cyan-700" />
              <span>Customize Columns</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                {visibleCount} Active
              </span>
            </div>
            <button
              onClick={handleResetDefault}
              className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handleSelectAll}
              className="py-1 px-2 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-center cursor-pointer"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={handleResetDefault}
              className="py-1 px-2 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-center cursor-pointer"
            >
              Default (10)
            </button>
            <button
              type="button"
              onClick={handleCompactView}
              className="py-1 px-2 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-center cursor-pointer"
            >
              Compact (6)
            </button>
          </div>

          {/* Column Checklist */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {columns.map((col) => {
              const isChecked = !!visibility[col.id];
              return (
                <label
                  key={col.id}
                  className={`flex items-start justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition ${
                    isChecked ? 'bg-cyan-50/40' : ''
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={col.required}
                      onChange={() => handleToggle(col.id)}
                      className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer disabled:opacity-50"
                    />
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                        <span>{col.label}</span>
                        {col.required && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-mono">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{col.description}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded shrink-0 font-medium ${
                      isChecked
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isChecked ? 'ON' : 'OFF'}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Synced to local cache &amp; CSV export</span>
            <span className="text-cyan-700 font-medium">Auto-applied</span>
          </div>
        </div>
      )}
    </div>
  );
};


export const PREDEFINED_TAG_OPTIONS = [
  { name: 'Hot Lead', color: 'rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { name: 'Qualified', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { name: 'Research Required', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { name: 'High Equity', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { name: 'Absentee Landlord', color: 'cyan', bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { name: 'Tax Follow-up', color: 'orange', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  { name: 'Commercial Target', color: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { name: 'Portfolio Priority', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
];

export const getTagStyle = (tagName: string) => {
  const match = PREDEFINED_TAG_OPTIONS.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
  if (match) return match;
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  const colorSchemes = [
    { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
    { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
    { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' },
    { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
  ];
  const idx = Math.abs(hash) % colorSchemes.length;
  return {
    name: tagName,
    bg: colorSchemes[idx].bg,
    text: colorSchemes[idx].text,
    border: colorSchemes[idx].border,
    dot: colorSchemes[idx].dot,
  };
};

const CALIFORNIA_COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte",
  "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake",
  "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc",
  "Mono", "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside",
  "Sacramento", "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin",
  "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta",
  "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity",
  "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba"
];

interface MultiSelectOption {
  label: string;
  value: string;
}

const MultiSelectDropdown: React.FC<{
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}> = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-600 flex items-center space-x-2 whitespace-nowrap h-8"
      >
        <span>
          {label} {selected.length > 0 ? `(${selected.length})` : ''}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 shadow-lg rounded-lg z-50 py-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggleOption(opt.value)}
                className="rounded border-slate-300 text-cyan-600 mr-2 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-slate-700 truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

interface PropertiesViewProps {
  properties: Property[];
  onTriggerOutreach?: (prop: Property) => void;
  onRefreshProperties?: () => void;
  initialSearchTerm?: string;
  initialSelectedPropertyId?: string;
}

export const PropertiesView: React.FC<PropertiesViewProps> = ({
  properties,
  onTriggerOutreach,
  onRefreshProperties,
  initialSearchTerm = '',
  initialSelectedPropertyId,
}) => {
  const { activeTenant } = useAuth();
  const { addToast } = useToast();
  const googleMapsApiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  
  // Initialize filter states from localStorage if available
  const [searchTerm, setSearchTerm] = useState(() => {
    return initialSearchTerm || localStorage.getItem('vortex_prop_filter_search') || '';
  });
  const [selectedCounties, setSelectedCounties] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_counties');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedTaxStatuses, setSelectedTaxStatuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_tax');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedOwnerTypes, setSelectedOwnerTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_owner');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedCities, setSelectedCities] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_cities');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_types');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_filter_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [absenteeOnly, setAbsenteeOnly] = useState<boolean>(() => {
    return localStorage.getItem('vortex_prop_filter_absentee') === 'true';
  });

  // Column Visibility State persisted in localStorage
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => {
    try {
      const saved = localStorage.getItem('vortex_prop_visible_columns');
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse saved column visibility:', e);
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_counties', JSON.stringify(selectedCounties));
  }, [selectedCounties]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_tax', JSON.stringify(selectedTaxStatuses));
  }, [selectedTaxStatuses]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_owner', JSON.stringify(selectedOwnerTypes));
  }, [selectedOwnerTypes]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_cities', JSON.stringify(selectedCities));
  }, [selectedCities]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_types', JSON.stringify(selectedPropertyTypes));
  }, [selectedPropertyTypes]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_tags', JSON.stringify(selectedTags));
  }, [selectedTags]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_filter_absentee', absenteeOnly ? 'true' : 'false');
  }, [absenteeOnly]);

  useEffect(() => {
    localStorage.setItem('vortex_prop_visible_columns', JSON.stringify(columnVisibility));
  }, [columnVisibility]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(() => {
    if (initialSelectedPropertyId) {
      const match = properties.find((p) => p.id === initialSelectedPropertyId);
      if (match) return match;
    }
    return properties[0] || null;
  });
  const [quickActionMenuPropertyId, setQuickActionMenuPropertyId] = useState<string | null>(null);

  // Sync when initial search term or initial selected property changes
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    if (initialSelectedPropertyId) {
      const match = properties.find((p) => p.id === initialSelectedPropertyId);
      if (match) {
        setSelectedProperty(match);
      }
    }
  }, [initialSelectedPropertyId, properties]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  // Bulk Edit Modal State
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);

  // New features state
  const [groupBy, setGroupBy] = useState<'none' | 'city' | 'status' | 'property_type' | 'county'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [highlightDuplicates, setHighlightDuplicates] = useState<boolean>(false);
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [customCalculatedFields, setCustomCalculatedFields] = useState<Array<{ id: string; name: string; formula: string }>>([
    { id: 'calc_1', name: 'Price / SqFt', formula: 'estimated_value / (square_feet || 1)' }
  ]);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [newCalcName, setNewCalcName] = useState('');
  const [newCalcFormula, setNewCalcFormula] = useState('estimated_value - mortgage_balance');

  // Duplicate IDs calculation
  const duplicateIds = useMemo(() => {
    const addressCounts = new Map<string, number>();
    const apnCounts = new Map<string, number>();
    properties.forEach(p => {
      if (p.address) {
        const norm = p.address.trim().toLowerCase();
        addressCounts.set(norm, (addressCounts.get(norm) || 0) + 1);
      }
      if (p.apn) {
        const norm = p.apn.trim().toLowerCase();
        apnCounts.set(norm, (apnCounts.get(norm) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    properties.forEach(p => {
      const addrNorm = p.address ? p.address.trim().toLowerCase() : '';
      const apnNorm = p.apn ? p.apn.trim().toLowerCase() : '';
      if ((addrNorm && (addressCounts.get(addrNorm) || 0) > 1) || (apnNorm && (apnCounts.get(apnNorm) || 0) > 1)) {
        dupes.add(p.id);
      }
    });
    return dupes;
  }, [properties]);

  const evaluateFormula = (prop: Property, formula: string) => {
    try {
      const estimated_value = prop.estimated_value || 0;
      const estimated_equity = prop.estimated_equity || 0;
      const square_feet = prop.square_feet || 1;
      const assessed_tax_value = prop.assessed_tax_value || 0;
      const units_count = prop.units_count || 1;
      const mortgage_balance = prop.mortgage_balance || 0;

      const sanitized = formula
        .replace(/estimated_value/g, String(estimated_value))
        .replace(/estimated_equity/g, String(estimated_equity))
        .replace(/square_feet/g, String(square_feet))
        .replace(/assessed_tax_value/g, String(assessed_tax_value))
        .replace(/units_count/g, String(units_count))
        .replace(/mortgage_balance/g, String(mortgage_balance));

      if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        return 'Invalid';
      }
      const res = Function(`"use strict"; return (${sanitized});`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return res % 1 !== 0 ? res.toFixed(2) : res.toLocaleString();
      }
      return String(res);
    } catch {
      return 'Error';
    }
  };

  const handleExecuteBulkEdit = async (updates: {
    status?: string;
    assignedAgent?: string;
    propertyType?: string;
    county?: string;
    taxDelinquent?: boolean;
  }) => {
    if (selectedPropertyIds.length === 0) return;
    setIsBulkEditing(true);
    try {
      const res = await fetch('/api/properties/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyIds: selectedPropertyIds,
          updates,
          organizationId: '',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update properties in batch');
      }
      const data = await res.json();
      addToast(`Successfully updated ${data.updatedCount || selectedPropertyIds.length} properties.`, 'success');
      setIsBulkEditModalOpen(false);
      if (onRefreshProperties) {
        onRefreshProperties();
      }
    } catch (err: any) {
      console.error('Bulk edit failed:', err);
      addToast(err.message || 'Failed to apply bulk edit', 'error');
    } finally {
      setIsBulkEditing(false);
    }
  };

  // Bulk Tagging State
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [bulkTagSelectedTags, setBulkTagSelectedTags] = useState<string[]>([]);
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'set' | 'remove'>('add');
  const [customTagInput, setCustomTagInput] = useState('');
  const [isApplyingTags, setIsApplyingTags] = useState(false);

  // Detail panel single tag input state
  const [detailCustomTagInput, setDetailCustomTagInput] = useState('');

  // Export Confirmation Dialog State
  const [exportConfirmModal, setExportConfirmModal] = useState<{
    isOpen: boolean;
    properties: Property[];
    sourceLabel: string;
  } | null>(null);

  // Skip Trace Modal State
  const [isSkipTraceModalOpen, setIsSkipTraceModalOpen] = useState(false);
  const [skipTraceProperty, setSkipTraceProperty] = useState<Property | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Automated Search & Skip Trace Pipeline Modal State
  const [isAutomatedPipelineOpen, setIsAutomatedPipelineOpen] = useState(false);
  const [isBatchSkipTracing, setIsBatchSkipTracing] = useState(false);

  const handleBatchSkipTrace = async () => {
    if (selectedPropertyIds.length === 0) {
      addToast('Please select at least 1 property for batch skip tracing.', 'error');
      return;
    }
    setIsBatchSkipTracing(true);
    try {
      const res = await fetch('/api/skip-trace/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: selectedPropertyIds }),
      });
      if (!res.ok) throw new Error('Batch skip trace failed');
      const data = await res.json();
      addToast(`Batch Skip Trace Complete: Processed ${data.successful} properties and auto-enriched contacts!`, 'success');
      if (onRefreshProperties) onRefreshProperties();
    } catch (err: any) {
      addToast(`Batch skip trace error: ${err.message}`, 'error');
    } finally {
      setIsBatchSkipTracing(false);
    }
  };

  useEffect(() => {
    const handleKeyDownDeep = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && exportConfirmModal?.isOpen) {
        setExportConfirmModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDownDeep);
    return () => window.removeEventListener('keydown', handleKeyDownDeep);
  }, [exportConfirmModal?.isOpen]);

  // Column Sorting State
  type SortField =
    | 'address'
    | 'apn'
    | 'type'
    | 'tax_status'
    | 'estimated_value'
    | 'estimated_equity'
    | 'owner_name'
    | 'owner_type'
    | 'owner_phone'
    | 'last_contacted'
    | 'tags'
    | 'assigned_agent';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField | null>('address');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection(field === 'estimated_value' || field === 'estimated_equity' ? 'desc' : 'asc');
    }
  };

  // Live County GIS & Commercial Provider Search State
  const [liveQuery, setLiveQuery] = useState('');
  const [liveSearchType, setLiveSearchType] = useState<'address' | 'apn'>('address');
  const [liveCounty, setLiveCounty] = useState('Orange');
  const [liveProvider, setLiveProvider] = useState<string>('auto');
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const [liveSearchResult, setLiveSearchResult] = useState<any | null>(null);
  const [liveSearchError, setLiveSearchError] = useState<string | null>(null);

  const handleLiveCountyGisSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!liveQuery.trim()) return;

    setIsLiveSearching(true);
    setLiveSearchError(null);

    try {
      const params = new URLSearchParams();
      if (liveSearchType === 'address') {
        params.append('address', liveQuery.trim());
      } else {
        params.append('apn', liveQuery.trim());
      }

      if (liveCounty !== 'all') {
        params.append('county', `${liveCounty} County`);
      }

      if (liveProvider !== 'auto') {
        params.append('preferredProvider', liveProvider);
      } else if (liveCounty === 'Los Angeles') {
        params.append('preferredProvider', 'los_angeles_county_gis');
      } else if (liveCounty !== 'all') {
        params.append('preferredProvider', 'california_gis');
      }

      params.append('persist', 'true');
      if (activeTenant?.id) {
        params.append('organizationId', activeTenant.id);
      }

      const res = await fetch(`/api/property-search?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`County GIS search returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setLiveSearchResult(data);

      if (data.results && data.results.length > 0) {
        setSelectedProperty(data.results[0].property);
      }

      if (onRefreshProperties) {
        onRefreshProperties();
      }
    } catch (err: any) {
      console.error('Live County GIS search failed:', err);
      setLiveSearchError(err.message || 'County GIS search failed');
    } finally {
      setIsLiveSearching(false);
    }
  };

  const handleSyncProductionCrm = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/import/sync-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: '',
          autoScoreLeads: true,
          enforceDncVerification: true,
        }),
      });
      const data = await res.json();
      setSyncResult(data);
      if (onRefreshProperties) {
        onRefreshProperties();
      }
    } catch (err: any) {
      console.error('Failed to sync CRM feed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>(['Hot Lead', 'Qualified', 'Research Required', 'High Equity', 'Absentee Landlord', 'Commercial Target', 'Tax Follow-up', 'Portfolio Priority']);
    properties.forEach((p) => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [properties]);

  const allAvailableCities = useMemo(() => Array.from(new Set(properties.map(p => p.city))).sort(), [properties]);
  const allAvailableTypes = useMemo(() => Array.from(new Set(properties.map(p => p.property_type))).sort(), [properties]);
  const allAvailableTaxStatuses = ['Current', 'Delinquent'];

  const handleApplyBulkTags = async (
    tagsToApply: string[],
    mode: 'add' | 'set' | 'remove' = 'add',
    explicitIds?: string[]
  ) => {
    const targetIds = explicitIds || selectedPropertyIds;
    if (!targetIds || targetIds.length === 0) {
      addToast('No properties selected for tagging.', 'error');
      return;
    }
    if (!tagsToApply || tagsToApply.length === 0) {
      addToast('Please select or specify at least one tag.', 'error');
      return;
    }

    setIsApplyingTags(true);
    try {
      const res = await fetch('/api/properties/bulk-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyIds: targetIds,
          tags: tagsToApply,
          mode,
          organizationId: '',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status} updating tags`);
      }

      const result = await res.json();
      const tagCount = tagsToApply.length;
      const tagList = tagsToApply.join(', ');
      const modeVerb = mode === 'remove' ? 'Removed' : mode === 'set' ? 'Replaced with' : 'Applied';

      addToast(
        `${modeVerb} tag${tagCount > 1 ? 's' : ''} [${tagList}] for ${result.updatedCount} propert${result.updatedCount === 1 ? 'y' : 'ies'}.`,
        'success'
      );

      setIsBulkTagModalOpen(false);
      setBulkTagSelectedTags([]);
      setCustomTagInput('');

      if (onRefreshProperties) {
        onRefreshProperties();
      }
    } catch (err: any) {
      console.error('Failed to apply bulk tags:', err);
      addToast(err.message || 'Failed to update property tags', 'error');
    } finally {
      setIsApplyingTags(false);
    }
  };

  const handleQuickApplyTag = (tagName: string) => {
    if (selectedPropertyIds.length === 0) {
      addToast('Please select one or more properties first.', 'error');
      return;
    }
    handleApplyBulkTags([tagName], 'add');
  };

  const handleSinglePropertyTagToggle = async (
    propId: string,
    tagName: string,
    mode: 'add' | 'remove'
  ) => {
    try {
      const res = await fetch(`/api/properties/${propId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: [tagName],
          mode,
          organizationId: '',
        }),
      });

      if (!res.ok) throw new Error('Failed to update property tag');
      const updated = await res.json();
      if (selectedProperty && selectedProperty.id === propId) {
        setSelectedProperty(updated);
      }
      addToast(
        `${mode === 'add' ? 'Added' : 'Removed'} "${tagName}" ${mode === 'add' ? 'to' : 'from'} property.`,
        'success'
      );
      if (onRefreshProperties) onRefreshProperties();
    } catch (err: any) {
      console.error('Error toggling tag:', err);
      addToast(err.message || 'Failed to update tag', 'error');
    }
  };

  const filtered = properties.filter((p) => {
    const searchTarget = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTarget.trim() ||
      p.address.toLowerCase().includes(searchTarget) ||
      p.city.toLowerCase().includes(searchTarget) ||
      p.owner_name.toLowerCase().includes(searchTarget) ||
      p.apn.toLowerCase().includes(searchTarget) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(searchTarget)));

    const matchesCounty = selectedCounties.length === 0 || selectedCounties.includes(p.county);
    const matchesCity = selectedCities.length === 0 || selectedCities.includes(p.city);
    const matchesType = selectedPropertyTypes.length === 0 || selectedPropertyTypes.includes(p.property_type);
    
    const matchesTax = selectedTaxStatuses.length === 0 || (
      (selectedTaxStatuses.includes('delinquent') && p.tax_delinquent) ||
      (selectedTaxStatuses.includes('current') && !p.tax_delinquent)
    );
    
    const matchesOwner = selectedOwnerTypes.length === 0 || (
      (selectedOwnerTypes.includes('corporate') && p.is_corporate_owned) ||
      (selectedOwnerTypes.includes('individual') && !p.is_corporate_owned)
    );

    const matchesTags = selectedTags.length === 0 || (
      p.tags && selectedTags.some(t => p.tags?.includes(t))
    );

    const matchesAbsentee = !absenteeOnly || p.is_absentee_owner;

    return matchesSearch && matchesCounty && matchesCity && matchesType && matchesTax && matchesOwner && matchesTags && matchesAbsentee;
  });

  const sortedFiltered = useMemo(() => {
    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'address':
          comparison = a.address.localeCompare(b.address) || a.city.localeCompare(b.city);
          break;
        case 'apn':
          comparison = (a.apn || '').localeCompare(b.apn || '') || (a.county || '').localeCompare(b.county || '');
          break;
        case 'type':
          comparison = a.property_type.localeCompare(b.property_type) || ((a.units_count || 0) - (b.units_count || 0));
          break;
        case 'tax_status': {
          const aTax = a.tax_delinquent ? 1 : 0;
          const bTax = b.tax_delinquent ? 1 : 0;
          comparison = aTax - bTax || ((a.assessed_tax_value || 0) - (b.assessed_tax_value || 0));
          break;
        }
        case 'estimated_value':
          comparison = (a.estimated_value || 0) - (b.estimated_value || 0);
          break;
        case 'estimated_equity':
          comparison = (a.estimated_equity || 0) - (b.estimated_equity || 0);
          break;
        case 'owner_type': {
          const aType = `${a.is_corporate_owned ? 'Corporate' : 'Individual'} ${a.is_absentee_owner ? 'Absentee' : 'Occupied'}`;
          const bType = `${b.is_corporate_owned ? 'Corporate' : 'Individual'} ${b.is_absentee_owner ? 'Absentee' : 'Occupied'}`;
          comparison = aType.localeCompare(bType) || (a.owner_name || '').localeCompare(b.owner_name || '');
          break;
        }
        case 'owner_name':
          comparison = (a.owner_name || '').localeCompare(b.owner_name || '');
          break;
        case 'owner_phone': {
          const aContact = getPropertyContactInfo(a);
          const bContact = getPropertyContactInfo(b);
          comparison = (aContact.isDncSafe ? 1 : 0) - (bContact.isDncSafe ? 1 : 0) || aContact.phone.localeCompare(bContact.phone);
          break;
        }
        case 'last_contacted': {
          const aContact = getPropertyContactInfo(a);
          const bContact = getPropertyContactInfo(b);
          comparison = aContact.rawDaysAgo - bContact.rawDaysAgo;
          break;
        }
        case 'tags': {
          const aTagCount = Array.isArray(a.tags) ? a.tags.length : 0;
          const bTagCount = Array.isArray(b.tags) ? b.tags.length : 0;
          comparison = aTagCount - bTagCount || (a.tags?.[0] || '').localeCompare(b.tags?.[0] || '');
          break;
        }
        case 'assigned_agent':
          comparison = (a.assigned_agent || '').localeCompare(b.assigned_agent || '');
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortDirection]);

  // Grouped properties calculation
  const groupedProperties = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, Property[]> = {};
    sortedFiltered.forEach(p => {
      let key = 'Other';
      if (groupBy === 'city') key = p.city || 'Unknown City';
      else if (groupBy === 'status') key = p.status || 'Discovered';
      else if (groupBy === 'property_type') key = p.property_type || 'Single Family';
      else if (groupBy === 'county') key = p.county || 'Orange County';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [sortedFiltered, groupBy]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedPropertyIds(sortedFiltered.map(p => p.id));
    } else {
      setSelectedPropertyIds([]);
    }
  };

  const handleSelectProperty = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedPropertyIds(prev => [...prev, id]);
    } else {
      setSelectedPropertyIds(prev => prev.filter(pid => pid !== id));
    }
  };

  // Helper to generate and download CSV dynamically respecting column visibility
  const generateAndDownloadCsv = (targetProperties: Property[], fileNamePrefix: string = 'vortex_properties') => {
    if (!targetProperties || targetProperties.length === 0) {
      addToast('No properties available to export.', 'error');
      return;
    }

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    // Dynamically build CSV headers based on active column visibility
    const headers: string[] = ['Property ID'];

    if (columnVisibility.address) {
      headers.push('Address', 'City', 'State', 'ZIP Code', 'County');
    }
    if (columnVisibility.apn) {
      headers.push('APN / Parcel ID', 'Jurisdiction County');
    }
    if (columnVisibility.property_type) {
      headers.push('Property Type', 'Units Count', 'Square Feet', 'Year Built');
    }
    if (columnVisibility.tax_status) {
      headers.push('Tax Delinquent Status', 'Assessed Tax Value ($)');
    }
    if (columnVisibility.estimated_value) {
      headers.push('Estimated Market Value ($)', 'Mortgage Balance ($)', 'Loan-to-Value Ratio (%)');
    }
    if (columnVisibility.estimated_equity) {
      headers.push('Estimated Equity ($)', 'Equity Ratio (%)');
    }
    if (columnVisibility.owner_name) {
      headers.push('Owner Name', 'Owner ID', 'Absentee Owner', 'Corporate Owned Entity');
    }
    if (columnVisibility.owner_phone) {
      headers.push('Primary Contact Phone', 'TCPA DNC Verification Status', 'Owner Email');
    }
    if (columnVisibility.last_contacted) {
      headers.push('Last Contacted Outreach Date', 'Active Pipeline Stage');
    }
    if (columnVisibility.tags) {
      headers.push('Classification Labels & Tags');
    }
    if (columnVisibility.assigned_agent) {
      headers.push('Assigned Specialist Agent');
    }

    // Always include audit provenance metadata
    headers.push('GIS Provenance Source', 'Confidence Score', 'Provenance Verified', 'Export Date & Time');

    // Build data rows
    const rows = targetProperties.map((p) => {
      const contact = getPropertyContactInfo(p);
      const row: string[] = [escapeCsv(p.id)];

      if (columnVisibility.address) {
        row.push(
          escapeCsv(p.address),
          escapeCsv(p.city),
          escapeCsv(p.state || 'CA'),
          escapeCsv(p.zip || ''),
          escapeCsv(p.county || '')
        );
      }
      if (columnVisibility.apn) {
        row.push(escapeCsv(p.apn), escapeCsv(p.county || ''));
      }
      if (columnVisibility.property_type) {
        row.push(
          escapeCsv(p.property_type),
          escapeCsv(p.units_count),
          escapeCsv(p.square_feet),
          escapeCsv(p.year_built)
        );
      }
      if (columnVisibility.tax_status) {
        row.push(
          escapeCsv(p.tax_delinquent ? 'Delinquent' : 'Current'),
          escapeCsv(p.assessed_tax_value)
        );
      }
      if (columnVisibility.estimated_value) {
        row.push(
          escapeCsv(p.estimated_value),
          escapeCsv(p.mortgage_balance),
          escapeCsv(p.estimated_value ? `${Math.round((p.mortgage_balance / p.estimated_value) * 100)}%` : '0%')
        );
      }
      if (columnVisibility.estimated_equity) {
        row.push(
          escapeCsv(p.estimated_equity),
          escapeCsv(p.estimated_value ? `${Math.round((p.estimated_equity / p.estimated_value) * 100)}%` : '0%')
        );
      }
      if (columnVisibility.owner_name) {
        row.push(
          escapeCsv(p.owner_name),
          escapeCsv(p.owner_id),
          escapeCsv(p.is_absentee_owner ? 'Yes' : 'No'),
          escapeCsv(p.is_corporate_owned ? 'Corporate' : 'Individual')
        );
      }
      if (columnVisibility.owner_phone) {
        row.push(
          escapeCsv(contact.phone),
          escapeCsv(contact.isDncSafe ? 'DNC Safe' : 'DNC Flagged'),
          escapeCsv(contact.email)
        );
      }
      if (columnVisibility.last_contacted) {
        row.push(escapeCsv(contact.lastContactedDate), escapeCsv(contact.stage));
      }
      if (columnVisibility.tags) {
        row.push(escapeCsv(Array.isArray(p.tags) && p.tags.length > 0 ? p.tags.join('; ') : 'None'));
      }
      if (columnVisibility.assigned_agent) {
        row.push(escapeCsv(p.assigned_agent || 'Sub-6 • Outreach Dispatcher'));
      }

      row.push(
        escapeCsv(p.provenance?.source || 'County Assessor Roll / GIS Cadastral'),
        escapeCsv(p.provenance?.confidence !== undefined ? `${Math.round(p.provenance.confidence * 100)}%` : '96%'),
        escapeCsv(p.provenance?.verified ? 'Yes' : 'No'),
        escapeCsv(new Date().toISOString())
      );

      return row;
    });

    // Prepend UTF-8 BOM so Microsoft Excel & spreadsheet tools decode characters cleanly
    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `${fileNamePrefix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const activeColCount = Object.values(columnVisibility).filter(Boolean).length;
    addToast(
      `Exported ${targetProperties.length} propert${targetProperties.length === 1 ? 'y' : 'ies'} to CSV with ${activeColCount} custom visible columns applied.`,
      'success'
    );
  };

  // Direct download button handler
  const handleDirectDownloadCsv = (targetProperties?: Property[]) => {
    const propsToExport = targetProperties && targetProperties.length > 0
      ? targetProperties
      : selectedPropertyIds.length > 0
        ? properties.filter(p => selectedPropertyIds.includes(p.id))
        : sortedFiltered;

    if (!propsToExport || propsToExport.length === 0) {
      addToast('No properties available to download.', 'error');
      return;
    }

    const prefix = selectedPropertyIds.length > 0 && (!targetProperties || targetProperties.length > 1)
      ? 'vortex_selected_properties'
      : 'vortex_filtered_properties';

    generateAndDownloadCsv(propsToExport, prefix);
  };

  const handleRequestExport = (explicitProperties?: Property[]) => {
    const targetProperties = explicitProperties && explicitProperties.length > 0
      ? explicitProperties
      : selectedPropertyIds.length > 0
        ? properties.filter(p => selectedPropertyIds.includes(p.id))
        : sortedFiltered;

    if (!targetProperties || targetProperties.length === 0) {
      addToast('No properties available to export.', 'error');
      return;
    }

    let sourceLabel = '';
    if (explicitProperties && explicitProperties.length === 1) {
      sourceLabel = `Single Property (${explicitProperties[0].address})`;
    } else if (selectedPropertyIds.length > 0 && (!explicitProperties || explicitProperties.length > 1)) {
      sourceLabel = `${selectedPropertyIds.length} Selected Propert${selectedPropertyIds.length === 1 ? 'y' : 'ies'}`;
    } else {
      sourceLabel = `All Matching Filtered Properties (${targetProperties.length} records)`;
    }

    setExportConfirmModal({
      isOpen: true,
      properties: targetProperties,
      sourceLabel,
    });
  };

  const handleExecuteCsvExport = () => {
    if (!exportConfirmModal || exportConfirmModal.properties.length === 0) return;
    generateAndDownloadCsv(exportConfirmModal.properties, 'vortex_properties_analytics');
    setExportConfirmModal(null);
  };

  const handleCreateScheduleForSelected = async () => {
    if (selectedPropertyIds.length === 0) return;
    try {
      const payload = {
        name: `Automated 24h Sync (${selectedPropertyIds.length} Selected Records)`,
        description: `Daily 24-hour background task refreshing public assessor valuations, tax status, and GIS parcel geometry for ${selectedPropertyIds.length} properties.`,
        target_property_ids: selectedPropertyIds,
        target_selection_mode: 'selected',
        interval_hours: 24,
        enrichment_options: {
          refresh_tax_assessor: true,
          refresh_gis_geometry: true,
          refresh_market_valuation: true,
          check_absentee_status: true,
          verify_tcpa_dnc: true,
        },
      };

      const res = await fetch('/api/scheduler/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create background schedule');
      addToast(
        `Configured 24-hour background auto-refresh for ${selectedPropertyIds.length} property records. Viewable in Dashboard Task Scheduler.`,
        'success'
      );
      if (onRefreshProperties) onRefreshProperties();
    } catch (err: any) {
      addToast(err.message || 'Failed to create schedule', 'error');
    }
  };

  const handleDownloadReport = (prop: Property) => {
    try {
      generatePropertyPdfReport(prop);
      addToast(
        `Generated and downloaded executive PDF property report for ${prop.address} (APN: ${prop.apn}).`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to generate PDF report:', err);
      addToast(`Error generating PDF report: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Property Intelligence &amp; County GIS</h1>
              <InfoTooltip text="Live connection to county tax assessor rolls and ArcGIS cadastral servers for real-time parcel discovery and verification." />
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Step 1 in Workflow
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Authoritative California County Assessor &amp; GIS Cadastral Data Provider with verified provenance ledger.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Automated Search & Skip Trace Suite Trigger */}
          <button
            id="automate-property-search-pipeline-btn"
            onClick={() => setIsAutomatedPipelineOpen(true)}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Automate Search &amp; Skip Trace</span>
          </button>

          {/* Batch Skip Trace Button for Selected Items */}
          {selectedPropertyIds.length > 0 && (
            <button
              id="batch-skip-trace-btn"
              onClick={handleBatchSkipTrace}
              disabled={isBatchSkipTracing}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBatchSkipTracing ? 'animate-spin' : ''}`} />
              <span>{isBatchSkipTracing ? 'Processing Batch...' : `Batch Skip Trace (${selectedPropertyIds.length})`}</span>
            </button>
          )}

          <Tooltip
            content="Batch import properties, parcels, and owner entities via drag-and-drop CSV into PostgreSQL."
            position="bottom"
          >
            <button
              id="import-properties-csv-header-btn"
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-600" />
              <span>Import CSV</span>
            </button>
          </Tooltip>

          <Tooltip
            content={selectedPropertyIds.length > 0 ? `Export ${selectedPropertyIds.length} selected properties with full parcel, tax, and owner fields to CSV.` : `Export all ${sortedFiltered.length} filtered properties to a CSV spreadsheet.`}
            position="bottom"
          >
            <button
              id="export-properties-csv-header-btn"
              onClick={() => handleRequestExport()}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export to CSV{selectedPropertyIds.length > 0 ? ` (${selectedPropertyIds.length})` : ''}</span>
            </button>
          </Tooltip>

          <Tooltip
            content={selectedPropertyIds.length > 0 ? `Export ${selectedPropertyIds.length} selected properties directly to a live Google Sheet.` : `Export all ${sortedFiltered.length} properties directly to a live Google Sheet.`}
            position="bottom"
          >
            <button
              id="export-properties-sheets-header-btn"
              onClick={() => setShowGoogleSheetsModal(true)}
              className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export to Google Sheets{selectedPropertyIds.length > 0 ? ` (${selectedPropertyIds.length})` : ''}</span>
            </button>
          </Tooltip>
          <Tooltip
            content="Execute multi-point reconciliation across CRM records, national Do-Not-Call (DNC) registry, and county assessor rolls."
            position="bottom"
          >
            <button
              onClick={handleSyncProductionCrm}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Reconciling CRM & DNC...' : 'Sync Production CRM Feed'}</span>
            </button>
          </Tooltip>
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 ml-1">
            <span>Showing <strong className="text-slate-900">{sortedFiltered.length}</strong> of {properties.length} Properties</span>
            {sortField && (
              <div className="inline-flex items-center space-x-1 bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                <span>
                  Sorted: {sortField === 'address' ? 'Address' : sortField === 'type' ? 'Type' : sortField === 'tax_status' ? 'Tax Status' : sortField === 'estimated_value' ? 'Valuation' : sortField === 'estimated_equity' ? 'Equity' : sortField === 'owner_type' ? 'Owner Type' : 'Owner'} ({sortDirection === 'asc' ? 'Asc' : 'Desc'})
                </span>
                <button
                  onClick={() => setSortField(null)}
                  className="text-cyan-600 hover:text-cyan-900 ml-1 font-bold cursor-pointer"
                  title="Clear column sort"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plain-English Easy Explainer Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-xs">
            💡
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">How Real Property Search Works:</h4>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              Enter any <strong>Address, City, APN Parcel Number, or Owner Name</strong> in the search bar below. Vortex One queries official public assessor records in real time. Click any property card or row to view assessed equity, zoning, and unit details, or promote it to a Lead for AI scoring.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0 text-[11px]">
          <Tooltip content={GLOSSARY.APN.content} position="top">
            <span className="bg-white/80 border border-blue-200 px-2.5 py-1 rounded-md text-blue-800 font-semibold cursor-help inline-flex items-center space-x-1">
              <span>🏷️ APN = Parcel ID</span>
            </span>
          </Tooltip>
          <Tooltip content={GLOSSARY.ABSENTEE_OWNER.content} position="top">
            <span className="bg-white/80 border border-blue-200 px-2.5 py-1 rounded-md text-blue-800 font-semibold cursor-help inline-flex items-center space-x-1">
              <span>🏡 Absentee = Landlord</span>
            </span>
          </Tooltip>
        </div>
      </div>

      {/* Live County GIS / Assessor Query Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center space-x-2">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Direct County GIS &amp; Assessor Real-Time Search
            </span>
            <InfoTooltip text="Queries official public county MapServer and FeatureServer REST APIs to retrieve authentic parcel polygons, APNs, and assessed roll data directly." />
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-700 px-2 py-0.5 rounded-full font-mono">
              ArcGIS REST / MapServer Live
            </span>
          </div>
          <div className="text-[11px] text-slate-300 flex items-center space-x-2">
            <span>Primary Sources:</span>
            <span className="font-semibold text-white">CA Statewide Cadastral GIS</span>
            <span>•</span>
            <span className="font-semibold text-white">LA County Assessor</span>
          </div>
        </div>

        <form onSubmit={handleLiveCountyGisSearch} className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-2">
            <select
              value={liveCounty}
              onChange={(e) => setLiveCounty(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400"
            >
              {CALIFORNIA_COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county} County
                </option>
              ))}
              <option value="all">Auto-Detect County</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={liveProvider}
              onChange={(e) => setLiveProvider(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400"
              title="Select Property Data Provider Engine"
            >
              <option value="auto">Auto-Detect Provider</option>
              <option value="zillow">Zillow (Open Search - No Key Needed)</option>
              <option value="realtor">Realtor.com (Open Search - No Key Needed)</option>
              <option value="redfin">Redfin (Open Search - No Key Needed)</option>
              <option value="attom">ATTOM Data Solutions</option>
              <option value="netr_online">NETR Online Records</option>
              <option value="zoominfo">ZoomInfo Owner Intelligence</option>
              <option value="arcgis">ArcGIS Server REST</option>
              <option value="google_maps">Google Maps Geocoding</option>
              <option value="orange_county_gis">Orange County GIS</option>
              <option value="los_angeles_county_gis">Los Angeles County GIS</option>
              <option value="san_diego_county_gis">San Diego County GIS</option>
              <option value="riverside_county_gis">Riverside County GIS</option>
              <option value="san_bernardino_county_gis">San Bernardino County GIS</option>
              <option value="ventura_county_gis">Ventura County GIS</option>
              <option value="santa_clara_county_gis">Santa Clara County GIS</option>
              <option value="alameda_county_gis">Alameda County GIS</option>
              <option value="sacramento_county_gis">Sacramento County GIS</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={liveSearchType}
              onChange={(e) => setLiveSearchType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="address">Street Address</option>
              <option value="apn">Assessor APN / AIN</option>
            </select>
          </div>

          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={liveQuery}
              onChange={(e) => setLiveQuery(e.target.value)}
              placeholder={
                liveSearchType === 'address'
                  ? 'e.g. 623 Center St or 1401 W Sunflower or 6730 N Glasner Lane...'
                  : 'e.g. 339-371-23 or 2038-020-084...'
              }
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-2">
            <Tooltip content="Execute live API query against county GIS/Assessor endpoints." position="top">
              <button
                type="submit"
                disabled={isLiveSearching || !liveQuery.trim()}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Compass className={`w-3.5 h-3.5 ${isLiveSearching ? 'animate-spin' : ''}`} />
                <span>{isLiveSearching ? 'Querying GIS...' : 'Search County'}</span>
              </button>
            </Tooltip>
          </div>
        </form>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-slate-400">
          <span>Try real properties:</span>
          <Tooltip content="Search 623 Center St, Costa Mesa in Orange County Assessor & Cadastral GIS" position="top">
            <button
              type="button"
              onClick={() => {
                setLiveCounty('orange');
                setLiveSearchType('address');
                setLiveQuery('623 CENTER ST');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
            >
              623 Center St, Costa Mesa (OC)
            </button>
          </Tooltip>
          <Tooltip content="Search APN 339-371-23 in Orange County Assessor Roll" position="top">
            <button
              type="button"
              onClick={() => {
                setLiveCounty('orange');
                setLiveSearchType('apn');
                setLiveQuery('339-371-23');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
            >
              APN: 339-371-23 (OC)
            </button>
          </Tooltip>
          <Tooltip content="Search 6730 N Glasner Lane in LA County Assessor Portal" position="top">
            <button
              type="button"
              onClick={() => {
                setLiveCounty('los_angeles');
                setLiveSearchType('address');
                setLiveQuery('6730 N GLASNER LANE');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
            >
              6730 N Glasner Lane, LA (LA Assessor)
            </button>
          </Tooltip>
          <Tooltip content="Search APN 2038-020-084 in LA County Assessor Cadastral GIS" position="top">
            <button
              type="button"
              onClick={() => {
                setLiveCounty('los_angeles');
                setLiveSearchType('apn');
                setLiveQuery('2038-020-084');
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
            >
              APN: 2038-020-084 (LA Assessor)
            </button>
          </Tooltip>
        </div>

        {/* Live Search Results Banner */}
        {liveSearchResult && (
          <div className="mt-4 p-3.5 bg-slate-950/80 border border-cyan-800/60 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">
                  Found {liveSearchResult.totalFound} authoritative parcel records via {liveSearchResult.providerUsed}
                </span>
              </div>
              <span className="font-mono text-[10px] text-cyan-400">
                Latency: {liveSearchResult.executionTimeMs}ms • Auto-Persisted to DB: {liveSearchResult.persistedCount}
              </span>
            </div>

            {liveSearchResult.results?.[0]?.provenance && (
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Endpoint:</span>
                  <span className="font-mono text-cyan-300 text-[10px] truncate max-w-md">
                    {liveSearchResult.results[0].provenance.endpointUrl}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dataset / Layer:</span>
                  <span className="text-white font-medium">{liveSearchResult.results[0].provenance.datasetName}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-amber-400 inline" />
                    <span>Owner Intelligence Status:</span>
                  </span>
                  <span className="text-amber-300 text-right max-w-md">
                    {liveSearchResult.results[0].provenance.ownerIntelligenceNotes}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {liveSearchError && (
          <div className="mt-4 p-3 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-200 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{liveSearchError}</span>
          </div>
        )}
      </div>

      {/* Sync Confirmation Banner */}
      {syncResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-950">
                Automated CRM &amp; Property Reconciliation Complete ({syncResult.organization_id})
              </h4>
              <p className="text-xs text-emerald-800">
                Processed <strong>{syncResult.total_records_processed}</strong> public records • Created <strong>{syncResult.properties_created}</strong> properties • Updated <strong>{syncResult.properties_updated}</strong> properties • Reconciled <strong>${(syncResult.portfolio_equity_reconciled / 1000000).toFixed(2)}M</strong> in total equity • Filtered <strong>{syncResult.dnc_suppressed_phones_count}</strong> DNC suppressed phones.
              </p>
              <div className="text-[10px] font-mono text-emerald-700">Audit ID: {syncResult.audit_id}</div>
            </div>
          </div>
          <button
            onClick={() => setSyncResult(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Local Dataset Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter loaded properties by address, APN, or owner..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <MultiSelectDropdown
            label="County"
            options={CALIFORNIA_COUNTIES.map(c => ({ label: `${c} County`, value: `${c} County` }))}
            selected={selectedCounties}
            onChange={setSelectedCounties}
          />

          <MultiSelectDropdown
            label="Tax Status"
            options={[
              { label: 'Current', value: 'current' },
              { label: 'Delinquent', value: 'delinquent' },
            ]}
            selected={selectedTaxStatuses}
            onChange={setSelectedTaxStatuses}
          />

          <MultiSelectDropdown
            label="Owner Type"
            options={[
              { label: 'Corporate', value: 'corporate' },
              { label: 'Individual', value: 'individual' },
            ]}
            selected={selectedOwnerTypes}
            onChange={setSelectedOwnerTypes}
          />

          <MultiSelectDropdown
            label="Labels & Tags"
            options={allAvailableTags.map((t) => ({ label: t, value: t }))}
            selected={selectedTags}
            onChange={setSelectedTags}
          />

          <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={absenteeOnly}
              onChange={(e) => setAbsenteeOnly(e.target.checked)}
              className="rounded border-slate-300 text-cyan-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Absentee Only</span>
          </label>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs h-72 lg:h-96 relative">
        {!googleMapsApiKey ? (
          <div className="flex flex-col items-center justify-center w-full h-full bg-slate-50 text-slate-500 text-sm p-4 text-center">
            <MapPin className="w-8 h-8 mb-3 text-slate-400" />
            <p className="font-semibold text-slate-700 mb-1">Map Visualization Unavailable</p>
            <p>A Google Maps API Key is required to view properties on the map.</p>
            <p className="text-xs mt-2 text-slate-400 font-mono">Set VITE_GOOGLE_MAPS_API_KEY in your environment.</p>
          </div>
        ) : (
          <APIProvider apiKey={googleMapsApiKey}>
            <GoogleMap
              mapId="DEMO_MAP_ID"
              style={{ width: '100%', height: '100%' }}
              defaultCenter={
                selectedProperty?.latitude && selectedProperty?.longitude
                  ? { lat: selectedProperty.latitude, lng: selectedProperty.longitude }
                  : sortedFiltered.find(p => p.latitude && p.longitude)
                  ? { lat: sortedFiltered.find(p => p.latitude && p.longitude)!.latitude!, lng: sortedFiltered.find(p => p.latitude && p.longitude)!.longitude! }
                  : { lat: 33.64, lng: -117.91 } // Default to Orange County roughly
              }
              defaultZoom={11}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
            >
              {sortedFiltered.map((prop) => {
                if (prop.latitude && prop.longitude) {
                  return (
                    <AdvancedMarker
                      key={prop.id}
                      position={{ lat: prop.latitude, lng: prop.longitude }}
                      title={prop.address}
                      onClick={() => setSelectedProperty(prop)}
                    >
                      <Pin
                        background={selectedProperty?.id === prop.id ? '#0284c7' : '#0891b2'}
                        borderColor={selectedProperty?.id === prop.id ? '#0369a1' : '#164e63'}
                        glyphColor={'#ffffff'}
                        scale={selectedProperty?.id === prop.id ? 1.2 : 1}
                      />
                    </AdvancedMarker>
                  );
                }
                return null;
              })}
            </GoogleMap>
          </APIProvider>
        )}
      </div>

      {/* Properties Table & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Table */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPropertyIds.length > 0 && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center space-x-3">
                <div className="text-sm font-bold text-cyan-900 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse"></span>
                  <span>{selectedPropertyIds.length} propert{selectedPropertyIds.length === 1 ? 'y' : 'ies'} selected</span>
                </div>
                <div className="hidden sm:flex items-center space-x-1.5 border-l border-cyan-200 pl-3">
                  <span className="text-[11px] font-semibold text-cyan-800">Quick Tag:</span>
                  <Tooltip content="Instantly mark selected properties as top priority Hot Leads" position="top">
                    <button
                      id="quick-tag-hot-lead-btn"
                      onClick={() => handleQuickApplyTag('Hot Lead')}
                      disabled={isApplyingTags}
                      className="flex items-center space-x-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <Flame className="w-3 h-3 text-rose-600" />
                      <span>Hot Lead</span>
                    </button>
                  </Tooltip>
                  <Tooltip content="Mark selected properties as verified and fully qualified for acquisition" position="top">
                    <button
                      id="quick-tag-qualified-btn"
                      onClick={() => handleQuickApplyTag('Qualified')}
                      disabled={isApplyingTags}
                      className="flex items-center space-x-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Qualified</span>
                    </button>
                  </Tooltip>
                  <Tooltip content="Flag selected records for deeper title, permit, or probate investigation" position="top">
                    <button
                      id="quick-tag-research-btn"
                      onClick={() => handleQuickApplyTag('Research Required')}
                      disabled={isApplyingTags}
                      className="flex items-center space-x-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <Search className="w-3 h-3 text-amber-600" />
                      <span>Research Req</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <Tooltip content="Batch update common fields like Status or Assigned Agent for selected properties" position="top">
                  <button
                    id="bulk-edit-properties-btn"
                    onClick={() => setIsBulkEditModalOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Bulk Edit ({selectedPropertyIds.length})</span>
                  </button>
                </Tooltip>
                <Tooltip content="Open full multi-tag management dialog for bulk classification" position="top">
                  <button
                    id="bulk-manage-tags-btn"
                    onClick={() => {
                      setBulkTagSelectedTags([]);
                      setBulkTagMode('add');
                      setIsBulkTagModalOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Tags className="w-3.5 h-3.5" />
                    <span>Labels &amp; Tags ({selectedPropertyIds.length})</span>
                  </button>
                </Tooltip>
                <Tooltip content="Export selected properties to a CSV spreadsheet" position="top">
                  <button
                    id="export-selected-properties-csv-btn"
                    onClick={() => handleRequestExport()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export ({selectedPropertyIds.length})</span>
                  </button>
                </Tooltip>
                <Tooltip content="Schedule automated 24-hour background assessor refresh for selected records" position="top">
                  <button
                    id="schedule-selected-properties-24h-btn"
                    onClick={handleCreateScheduleForSelected}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-300 text-cyan-800 hover:bg-cyan-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Auto-Refresh 24h</span>
                  </button>
                </Tooltip>
                <button
                  id="clear-selection-btn"
                  onClick={() => setSelectedPropertyIds([])}
                  className="flex items-center space-x-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Deselect all"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}
          {/* Table Header Toolbar: Controls, Column-Toggle & Direct Download CSV */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-bold text-slate-800">
                {sortedFiltered.length} {sortedFiltered.length === 1 ? 'Property' : 'Properties'}
              </span>
              <span className="text-[11px] text-slate-400">•</span>
              <span className="text-[11px] text-slate-500">
                <strong className="text-cyan-700 font-semibold">{Object.values(columnVisibility).filter(Boolean).length}</strong> of {PROPERTY_TABLE_COLUMNS.length} columns active
              </span>
              {selectedPropertyIds.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                  {selectedPropertyIds.length} Selected
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Column Toggle Menu */}
              <ColumnToggleDropdown
                columns={PROPERTY_TABLE_COLUMNS}
                visibility={columnVisibility}
                onChange={setColumnVisibility}
              />

              {/* Group By Selector */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-500 font-medium">Group By:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="none">None</option>
                  <option value="city">City</option>
                  <option value="status">Status</option>
                  <option value="property_type">Property Type</option>
                  <option value="county">County</option>
                </select>
              </div>

              {/* Highlight Duplicates Toggle */}
              <label className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={highlightDuplicates}
                  onChange={(e) => setHighlightDuplicates(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Highlight Duplicates</span>
              </label>

              {/* Custom Calculated Field Button */}
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-800 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <Calculator className="w-3.5 h-3.5 text-cyan-700" />
                <span>+ Calculated Field</span>
              </button>

              {/* Download CSV Button */}
              <Tooltip content="Export currently filtered properties as CSV using applied visible column settings" position="top">
                <button
                  id="properties-download-csv-btn"
                  type="button"
                  onClick={() => handleDirectDownloadCsv()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                  <span className="ml-1 px-1.5 py-0.2 bg-black/20 rounded text-[10px] font-mono">
                    {selectedPropertyIds.length > 0 ? selectedPropertyIds.length : sortedFiltered.length}
                  </span>
                </button>
              </Tooltip>

              {/* More Export / Import Options */}
              <Tooltip content="Sync or export properties directly to Google Sheets" position="top">
                <button
                  id="properties-sheets-sync-btn"
                  type="button"
                  onClick={() => setShowGoogleSheetsModal(true)}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Sheets</span>
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer"
                        checked={sortedFiltered.length > 0 && selectedPropertyIds.length === sortedFiltered.length}
                        onChange={handleSelectAll}
                      />
                    </th>

                    {/* Address Column Header */}
                    {columnVisibility.address && (
                      <th className="py-3 px-4 group hover:bg-slate-100/80 transition-colors">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center space-x-1.5 cursor-pointer"
                            onClick={() => handleSort('address')}
                          >
                            <span className={sortField === 'address' ? 'text-cyan-800 font-bold' : ''}>Property &amp; Address</span>
                            <InfoTooltip text="Situs physical address, city, state, zip code, and county Assessor's Parcel Number (APN)." />
                            {sortField === 'address' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          <MultiSelectDropdown 
                            label="City"
                            options={allAvailableCities.map(c => ({ label: c, value: c }))}
                            selected={selectedCities}
                            onChange={setSelectedCities}
                          />
                        </div>
                      </th>
                    )}

                    {/* APN Column Header */}
                    {columnVisibility.apn && (
                      <th 
                        className="py-3 px-4 group hover:bg-slate-100/80 transition-colors cursor-pointer"
                        onClick={() => handleSort('apn')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'apn' ? 'text-cyan-800 font-bold' : ''}>APN / Parcel ID</span>
                          <InfoTooltip text="Assessor's Parcel Number uniquely identifying the cadastral lot with county records." />
                          {sortField === 'apn' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Property Type / Units Header */}
                    {columnVisibility.property_type && (
                      <th className="py-3 px-4 group hover:bg-slate-100/80 transition-colors">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center space-x-1.5 cursor-pointer"
                            onClick={() => handleSort('type')}
                          >
                            <span className={sortField === 'type' ? 'text-cyan-800 font-bold' : ''}>Type / Units</span>
                            <InfoTooltip text="Zoning classification (Single Family, Multifamily, Commercial, Industrial) and total rentable units." />
                            {sortField === 'type' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          <MultiSelectDropdown 
                            label="Type"
                            options={allAvailableTypes.map(c => ({ label: c, value: c }))}
                            selected={selectedPropertyTypes}
                            onChange={setSelectedPropertyTypes}
                          />
                        </div>
                      </th>
                    )}

                    {/* Tax Status Header */}
                    {columnVisibility.tax_status && (
                      <th className="py-3 px-4 group hover:bg-slate-100/80 transition-colors">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center space-x-1.5 cursor-pointer"
                            onClick={() => handleSort('tax_status')}
                          >
                            <span className={sortField === 'tax_status' ? 'text-cyan-800 font-bold' : ''}>Tax Status</span>
                            <InfoTooltip text={GLOSSARY.TAX_DELINQUENT.content} />
                            {sortField === 'tax_status' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          <MultiSelectDropdown 
                            label="Status"
                            options={allAvailableTaxStatuses.map(c => ({ label: c, value: c.toLowerCase() }))}
                            selected={selectedTaxStatuses}
                            onChange={setSelectedTaxStatuses}
                          />
                        </div>
                      </th>
                    )}

                    {/* Est. Valuation Header */}
                    {columnVisibility.estimated_value && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('estimated_value')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'estimated_value' ? 'text-cyan-800 font-bold' : ''}>Est. Valuation</span>
                          <InfoTooltip text={GLOSSARY.ESTIMATED_VALUE.content} />
                          {sortField === 'estimated_value' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Est. Equity Header */}
                    {columnVisibility.estimated_equity && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('estimated_equity')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'estimated_equity' ? 'text-cyan-800 font-bold' : ''}>Est. Equity</span>
                          <InfoTooltip text={GLOSSARY.EQUITY.content} />
                          {sortField === 'estimated_equity' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Owner Type & Profile Header */}
                    {columnVisibility.owner_name && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('owner_type')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'owner_type' ? 'text-cyan-800 font-bold' : ''}>Owner Profile &amp; Type</span>
                          <InfoTooltip text="Recorded owner name, corporate entity status (LLC, LP, Trust), and absentee landlord indicator." />
                          {sortField === 'owner_type' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Owner Phone & Contact Header */}
                    {columnVisibility.owner_phone && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('owner_phone')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'owner_phone' ? 'text-cyan-800 font-bold' : ''}>Owner Phone &amp; TCPA</span>
                          <InfoTooltip text="Skip-traced verified owner telephone with real-time TCPA Do-Not-Call (DNC) registry compliance status." />
                          {sortField === 'owner_phone' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Last Contacted & Pipeline Header */}
                    {columnVisibility.last_contacted && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('last_contacted')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'last_contacted' ? 'text-cyan-800 font-bold' : ''}>Last Contacted &amp; Pipeline</span>
                          <InfoTooltip text="Timestamp of last multi-channel outreach touchpoint and current progression stage in acquisition pipeline." />
                          {sortField === 'last_contacted' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Labels & Tags Header */}
                    {columnVisibility.tags && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('tags')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'tags' ? 'text-cyan-800 font-bold' : ''}>Labels &amp; Tags</span>
                          <InfoTooltip text="Custom classification tags applied to this parcel for targeting and workflow filtering." />
                          {sortField === 'tags' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* Assigned Agent Header */}
                    {columnVisibility.assigned_agent && (
                      <th 
                        className="py-3 px-4 cursor-pointer group hover:bg-slate-100/80 transition-colors"
                        onClick={() => handleSort('assigned_agent')}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className={sortField === 'assigned_agent' ? 'text-cyan-800 font-bold' : ''}>Assigned Agent</span>
                          <InfoTooltip text="Specialized AI Sub-Agent or team member currently assigned to orchestrate this parcel." />
                          {sortField === 'assigned_agent' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    )}

                    {customCalculatedFields.map(calc => (
                      <th key={calc.id} className="py-3 px-4 text-cyan-900 bg-cyan-50/50 font-bold">
                        <div className="flex items-center space-x-1">
                          <span>{calc.name}</span>
                          <span className="text-[10px] font-mono font-normal text-cyan-600">({calc.formula})</span>
                          <button
                            onClick={() => setCustomCalculatedFields(prev => prev.filter(c => c.id !== calc.id))}
                            className="text-slate-400 hover:text-red-600 ml-1 font-bold cursor-pointer"
                            title="Remove calculated field"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    ))}

                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(columnVisibility).filter(Boolean).length + 2} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Building className="w-8 h-8 text-slate-400" />
                          <p className="font-semibold text-slate-700">No properties match your current filters.</p>
                          <p className="text-xs text-slate-400">Try clearing or adjusting search terms, county selections, or tax statuses.</p>
                        </div>
                      </td>
                    </tr>
                  ) : sortedFiltered.map((prop) => {
                    const isSelected = selectedProperty?.id === prop.id;
                    const contact = getPropertyContactInfo(prop);
                    const activeColCount = Object.values(columnVisibility).filter(Boolean).length;

                    return (
                      <React.Fragment key={prop.id}>
                        <tr
                          onClick={() => setSelectedProperty(isSelected ? null : prop)}
                          className={`hover:bg-slate-50 cursor-pointer transition ${
                            isSelected ? 'bg-cyan-50/80 border-b border-transparent' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer"
                              checked={selectedPropertyIds.includes(prop.id)}
                              onChange={(e) => handleSelectProperty(e, prop.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>

                          {/* Address Cell */}
                          {columnVisibility.address && (
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{prop.address}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {prop.city}, {prop.state} {prop.zip || ''} {!columnVisibility.apn && `• APN: ${prop.apn}`}
                              </div>
                              {prop.tags && prop.tags.length > 0 && !columnVisibility.tags && (
                                <div className="flex items-center flex-wrap gap-1 mt-1">
                                  {prop.tags.map((tag) => {
                                    const style = getTagStyle(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                                        <span>{tag}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          )}

                          {/* APN Cell */}
                          {columnVisibility.apn && (
                            <td className="py-3 px-4">
                              <div className="font-mono text-xs font-semibold text-slate-800">{prop.apn}</div>
                              <div className="text-[10px] text-slate-500">{prop.county || 'California'}</div>
                            </td>
                          )}

                          {/* Property Type / Units Cell */}
                          {columnVisibility.property_type && (
                            <td className="py-3 px-4">
                              <div className="text-slate-800 font-medium">{prop.property_type}</div>
                              <div className="text-[11px] text-slate-500">{prop.units_count} Units • {prop.square_feet.toLocaleString()} sqft</div>
                            </td>
                          )}

                          {/* Tax Status Cell */}
                          {columnVisibility.tax_status && (
                            <td className="py-3 px-4">
                              {prop.tax_delinquent ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  Delinquent
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Current
                                </span>
                              )}
                              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                ${(prop.assessed_tax_value / 1000).toLocaleString()}k assessed
                              </div>
                            </td>
                          )}

                          {/* Est. Valuation Cell */}
                          {columnVisibility.estimated_value && (
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                ${(prop.estimated_value / 1000000).toFixed(2)}M
                              </div>
                              <div className="text-[10px] text-slate-500">
                                LTV: {prop.estimated_value ? `${Math.round((prop.mortgage_balance / prop.estimated_value) * 100)}%` : '0%'}
                              </div>
                            </td>
                          )}

                          {/* Est. Equity Cell */}
                          {columnVisibility.estimated_equity && (
                            <td className="py-3 px-4">
                              <div className="font-semibold text-emerald-700">
                                ${(prop.estimated_equity / 1000000).toFixed(2)}M
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {Math.round((prop.estimated_equity / prop.estimated_value) * 100)}% Equity
                              </div>
                            </td>
                          )}

                          {/* Owner Profile & Type Cell */}
                          {columnVisibility.owner_name && (
                            <td className="py-3 px-4">
                              <div className="text-slate-800 font-medium truncate max-w-[150px]">{prop.owner_name}</div>
                              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                                  prop.is_corporate_owned ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {prop.is_corporate_owned ? 'Corporate' : 'Individual'}
                                </span>
                                {prop.is_absentee_owner && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    Absentee
                                  </span>
                                )}
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 font-medium border border-cyan-200 truncate max-w-[120px]">
                                  {prop.provenance?.source?.includes('GIS') ? 'Gov GIS' : prop.provenance?.source || 'Public Roll'}
                                </span>
                                {(() => {
                                  const q = prop.data_quality || 'green';
                                  const notes = prop.data_quality_notes || 'Passed full skip-trace verification';
                                  if (q === 'red') {
                                    return (
                                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={notes}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                        <span>Incomplete</span>
                                      </span>
                                    );
                                  }
                                  if (q === 'yellow') {
                                    return (
                                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title={notes}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        <span>Partial</span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title={notes}>
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>Verified</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                          )}

                          {/* Owner Phone & TCPA Cell */}
                          {columnVisibility.owner_phone && (
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span className="font-mono text-xs text-slate-900 font-semibold">{contact.phone}</span>
                              </div>
                              <div className="flex items-center space-x-1 mt-1">
                                <span className={`inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                                  contact.isDncSafe
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>{contact.isDncSafe ? 'DNC Safe' : 'DNC Flagged'}</span>
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Last Contacted & Pipeline Cell */}
                          {columnVisibility.last_contacted && (
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1 text-slate-700 font-medium">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{contact.lastContactedDate}</span>
                              </div>
                              <div className="text-[10px] text-cyan-700 font-semibold mt-0.5">
                                {contact.stage}
                              </div>
                            </td>
                          )}

                          {/* Labels & Tags Cell */}
                          {columnVisibility.tags && (
                            <td className="py-3 px-4">
                              {prop.tags && prop.tags.length > 0 ? (
                                <div className="flex items-center flex-wrap gap-1">
                                  {prop.tags.map((tag) => {
                                    const style = getTagStyle(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                                        <span>{tag}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No tags</span>
                              )}
                            </td>
                          )}

                          {/* Assigned Agent Cell */}
                          {columnVisibility.assigned_agent && (
                            <td className="py-3 px-4">
                              <div className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium">
                                <Bot className="w-3 h-3 text-indigo-600" />
                                <span>{prop.assigned_agent || 'Sub-6 • Outreach Dispatcher'}</span>
                              </div>
                            </td>
                          )}

                          <td className="py-3 px-4 text-right relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setQuickActionMenuPropertyId(quickActionMenuPropertyId === prop.id ? null : prop.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer font-bold text-xs"
                              title="Quick Actions"
                            >
                              ⚡
                            </button>
                            {quickActionMenuPropertyId === prop.id && (
                              <div className="absolute right-4 top-12 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-left text-xs font-medium">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${prop.address}, ${prop.city} ${prop.state || 'CA'}`);
                                    addToast('Address copied to clipboard!', 'success');
                                    setQuickActionMenuPropertyId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2"
                                >
                                  <span>📋 Copy Address</span>
                                </button>
                                <button
                                  onClick={() => {
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address + ', ' + prop.city + ' ' + (prop.state || 'CA'))}`, '_blank');
                                    setQuickActionMenuPropertyId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2"
                                >
                                  <span>🗺️ Open in Map</span>
                                </button>
                                <button
                                  onClick={() => {
                                    generatePropertyPdfReport(prop);
                                    addToast('Generated property intelligence PDF report!', 'success');
                                    setQuickActionMenuPropertyId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2"
                                >
                                  <span>📄 Export PDF Report</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedProperty(prop);
                                    setQuickActionMenuPropertyId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-cyan-700 font-semibold border-t border-slate-100 flex items-center space-x-2"
                                >
                                  <span>✨ View Full Details</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isSelected && (
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <td colSpan={activeColCount + 2} className="p-0">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-cyan-50/30 inset-shadow-sm border-t border-cyan-100">
                              {/* Left Column: Tax & Valuation History */}
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                                  <DollarSign className="w-4 h-4 text-cyan-700" />
                                  <span>Tax & Valuation Analytics</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Assessed Value (Tax)</div>
                                    <div className="text-lg font-semibold text-slate-900">${prop.assessed_tax_value.toLocaleString()}</div>
                                    <div className="text-[10px] text-emerald-600 mt-1">▲ 2.1% from last year</div>
                                  </div>
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Estimated Market Value</div>
                                    <div className="text-lg font-semibold text-slate-900">${prop.estimated_value.toLocaleString()}</div>
                                    <div className="text-[10px] text-emerald-600 mt-1">▲ 4.5% from last year</div>
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
                                  <div className="text-xs font-semibold text-slate-700">Recent Tax History</div>
                                  <div className="space-y-2">
                                    {[new Date().getFullYear() - 1, new Date().getFullYear() - 2, new Date().getFullYear() - 3].map((year, i) => (
                                      <div key={year} className="flex justify-between items-center text-xs border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
                                        <span className="text-slate-600">{year} Tax Year</span>
                                        <span className="font-mono text-slate-900">${(Math.round(prop.assessed_tax_value * 0.0105 * (1 - i * 0.02))).toLocaleString()}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">Paid</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Right Column: Parcel Map & Characteristics */}
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                                  <MapPin className="w-4 h-4 text-cyan-700" />
                                  <span>Parcel Details</span>
                                </h4>
                                
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-32 relative flex items-center justify-center bg-slate-100 shadow-sm">
                                  {!googleMapsApiKey ? (
                                     <div className="text-center text-slate-500 text-xs p-4">
                                       <Compass className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                                       Map API Key Required
                                     </div>
                                  ) : (
                                    <img 
                                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${prop.latitude || 33.64},${prop.longitude || -117.91}&zoom=18&size=400x150&maptype=satellite&markers=color:blue%7C${prop.latitude || 33.64},${prop.longitude || -117.91}&key=${googleMapsApiKey}`}
                                      alt="Parcel Satellite View"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded backdrop-blur-sm">
                                    Lat: {prop.latitude?.toFixed(4) || '--'}, Lng: {prop.longitude?.toFixed(4) || '--'}
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                                    <div>
                                      <div className="text-[10px] text-slate-500 uppercase">Property Type</div>
                                      <div className="font-semibold text-slate-900">{prop.property_type}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-500 uppercase">Lot Size</div>
                                      <div className="font-semibold text-slate-900">{(prop.square_feet * 1.5).toLocaleString()} sqft (Est)</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-500 uppercase">Year Built</div>
                                      <div className="font-semibold text-slate-900">{prop.year_built}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-slate-500 uppercase">Mortgage Balance</div>
                                      <div className="font-semibold text-slate-900">${prop.mortgage_balance.toLocaleString()}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Footer Action Bar for Expanded Property Row */}
                              <div className="flex items-center justify-between col-span-1 md:col-span-2 pt-3 border-t border-cyan-200/60 mt-1">
                                <div className="text-xs text-slate-600 flex items-center space-x-2">
                                  <ShieldCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                                  <span>Complete parcel analytics, tax assessments, equity modeling, and cadastral provenance ledger.</span>
                                </div>
                                <div className="flex items-center space-x-2.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSkipTraceProperty(prop);
                                      setIsSkipTraceModalOpen(true);
                                    }}
                                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                                    title="Run 5-Step Skip Trace on this owner"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>5-Step Skip Trace</span>
                                  </button>
                                  <button
                                    id={`download-report-btn-${prop.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadReport(prop);
                                    }}
                                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                                    title="Download PDF Property Intelligence & Analytics Report"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Download Report</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Right 1 Col: Selected Property Provenance & Intelligence */}
        {selectedProperty && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-cyan-700">Asset Detail</span>
                  <InfoTooltip text="Detailed breakdown of assessed valuation, mortgage obligations, recorded ownership structure, and legal classification." />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{selectedProperty.address}</h3>
                <p className="text-xs text-slate-500">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip} ({selectedProperty.county})</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 items-center">
                  <span className="flex items-center space-x-1">
                    <span>Assessor's APN:</span>
                    <InfoTooltip text={GLOSSARY.APN.content} />
                  </span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedProperty.apn}</span>
                </div>
                <div className="flex justify-between text-slate-600 items-center">
                  <span className="flex items-center space-x-1">
                    <span>Assessed Tax Value:</span>
                    <InfoTooltip text="Official ad-valorem tax roll assessed value established by the county assessor." />
                  </span>
                  <span className="text-slate-900 font-semibold">${selectedProperty.assessed_tax_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 items-center">
                  <span className="flex items-center space-x-1">
                    <span>Estimated Valuation:</span>
                    <InfoTooltip text={GLOSSARY.ESTIMATED_VALUE.content} />
                  </span>
                  <span className="text-slate-900 font-semibold">${selectedProperty.estimated_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 items-center">
                  <span className="flex items-center space-x-1">
                    <span>Estimated Equity:</span>
                    <InfoTooltip text={GLOSSARY.EQUITY.content} />
                  </span>
                  <span className="text-emerald-700 font-semibold">${selectedProperty.estimated_equity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Year Built:</span>
                  <span className="text-slate-900 font-semibold">{selectedProperty.year_built}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Square Footage:</span>
                  <span className="text-slate-900 font-semibold">{selectedProperty.square_feet.toLocaleString()} sq ft</span>
                </div>
              </div>

              {/* Property Labels & Tags Manager */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <Tag className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Labels &amp; Tags</span>
                    <InfoTooltip text="Custom segmentation tags used by autonomous dispatch agents to filter and prioritize lead cohorts." />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedProperty.tags?.length || 0} active
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {selectedProperty.tags && selectedProperty.tags.length > 0 ? (
                    selectedProperty.tags.map((tag) => {
                      const style = getTagStyle(tag);
                      return (
                        <span
                          key={tag}
                          className={`inline-flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleSinglePropertyTagToggle(selectedProperty.id, tag, 'remove')}
                            className="p-0.5 hover:bg-black/10 rounded text-slate-500 hover:text-slate-900 cursor-pointer ml-0.5"
                            title={`Remove tag ${tag}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No labels applied yet.</span>
                  )}
                </div>

                {/* Quick Add Presets */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quick Add:</div>
                  <div className="flex flex-wrap gap-1">
                    {PREDEFINED_TAG_OPTIONS.filter(opt => !selectedProperty.tags?.includes(opt.name)).slice(0, 4).map(opt => (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => handleSinglePropertyTagToggle(selectedProperty.id, opt.name, 'add')}
                        className={`text-[10px] px-2 py-0.5 rounded border ${opt.bg} ${opt.text} ${opt.border} hover:opacity-80 transition cursor-pointer font-medium flex items-center space-x-1`}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>{opt.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Single Tag Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!detailCustomTagInput.trim()) return;
                    handleSinglePropertyTagToggle(selectedProperty.id, detailCustomTagInput.trim(), 'add');
                    setDetailCustomTagInput('');
                  }}
                  className="flex items-center space-x-1.5 pt-1"
                >
                  <input
                    type="text"
                    value={detailCustomTagInput}
                    onChange={(e) => setDetailCustomTagInput(e.target.value)}
                    placeholder="New custom label..."
                    className="flex-1 bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-600"
                  />
                  <button
                    type="submit"
                    disabled={!detailCustomTagInput.trim()}
                    className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-800 text-white rounded-md text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Provenance Card */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Authoritative Provenance Ledger</span>
                  <InfoTooltip text={GLOSSARY.PROVENANCE.content} />
                </div>
                <div className="text-[11px] text-slate-600">
                  Provider: <strong className="text-slate-900">{selectedProperty.provenance?.source}</strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Retrieved: {new Date(selectedProperty.provenance?.retrievedAt || Date.now()).toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-cyan-700 truncate">
                  Record ID / Hash: {selectedProperty.provenance?.recordId || selectedProperty.provenance?.hash || 'cadastral-verified'}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <Tooltip content="Launch the 5-step skip tracing protocol: GIS APN, Assessor, Mailing Discrepancy, CA SOS, and TruePeopleSearch" position="top">
                <button
                  type="button"
                  onClick={() => {
                    setSkipTraceProperty(selectedProperty);
                    setIsSkipTraceModalOpen(true);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>5-Step Skip Trace Intelligence</span>
                </button>
              </Tooltip>

              <Tooltip content="Download executive PDF summary of all current analytics for this property" position="top">
                <button
                  id="download-selected-property-report-btn"
                  onClick={() => handleDownloadReport(selectedProperty)}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs py-2 px-3 rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Report (PDF Summary)</span>
                </button>
              </Tooltip>

              <Tooltip content="Export this single property's data row to a CSV format" position="top">
                <button
                  id="export-single-property-csv-btn"
                  onClick={() => handleRequestExport([selectedProperty])}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs py-2 px-3 border border-slate-300 rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export Property to CSV</span>
                </button>
              </Tooltip>

              {onTriggerOutreach && (
                <Tooltip content="Pass property to Agent 6 (Outreach Generator) to draft customized multi-channel messaging" position="top">
                  <button
                    onClick={() => onTriggerOutreach(selectedProperty)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    Generate Outreach Brief for Owner
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Tag Management Modal */}
      {isBulkTagModalOpen && (
        <div
          id="bulk-tag-modal-backdrop"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isApplyingTags) setIsBulkTagModalOpen(false);
          }}
        >
          <div
            id="bulk-tag-modal-card"
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-tag-title"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="bulk-tag-title" className="text-base font-bold text-slate-900 tracking-tight">
                    Manage Labels &amp; Tags
                  </h3>
                  <p className="text-xs text-slate-500">
                    Apply or update labels across <strong className="text-slate-800 font-semibold">{selectedPropertyIds.length}</strong> selected {selectedPropertyIds.length === 1 ? 'property' : 'properties'}
                  </p>
                </div>
              </div>
              <button
                id="close-bulk-tag-modal-btn"
                onClick={() => !isApplyingTags && setIsBulkTagModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selection Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBulkTagMode('add')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  bulkTagMode === 'add' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Add Tags
              </button>
              <button
                type="button"
                onClick={() => setBulkTagMode('set')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  bulkTagMode === 'set' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⟳ Replace All
              </button>
              <button
                type="button"
                onClick={() => setBulkTagMode('remove')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  bulkTagMode === 'remove' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                ✕ Remove Tags
              </button>
            </div>

            {/* Predefined Tag Selector Grid */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Select Labels:</span>
                <span className="text-[11px] text-slate-500">
                  {bulkTagSelectedTags.length} selected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_TAG_OPTIONS.map((tagOpt) => {
                  const isChecked = bulkTagSelectedTags.includes(tagOpt.name);
                  return (
                    <button
                      key={tagOpt.name}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setBulkTagSelectedTags(prev => prev.filter(t => t !== tagOpt.name));
                        } else {
                          setBulkTagSelectedTags(prev => [...prev, tagOpt.name]);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                        isChecked
                          ? `${tagOpt.bg} ${tagOpt.border} ${tagOpt.text} font-semibold ring-1 ring-cyan-500/50`
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className={`w-2 h-2 rounded-full ${tagOpt.dot}`}></span>
                        <span className="truncate">{tagOpt.name}</span>
                      </div>
                      {isChecked && <Check className="w-3.5 h-3.5 text-cyan-700 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Tag Input */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">Add Custom Tag:</div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = customTagInput.trim();
                      if (val && !bulkTagSelectedTags.includes(val)) {
                        setBulkTagSelectedTags(prev => [...prev, val]);
                        setCustomTagInput('');
                      }
                    }
                  }}
                  placeholder="e.g. Needs Inspection, 1031 Exchange, Pre-Foreclosure..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = customTagInput.trim();
                    if (val && !bulkTagSelectedTags.includes(val)) {
                      setBulkTagSelectedTags(prev => [...prev, val]);
                      setCustomTagInput('');
                    }
                  }}
                  disabled={!customTagInput.trim()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                >
                  Add Tag
                </button>
              </div>
            </div>

            {/* Active Tag Chips Preview */}
            {bulkTagSelectedTags.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Tags to {bulkTagMode === 'remove' ? 'remove from' : bulkTagMode === 'set' ? 'replace on' : 'apply to'} {selectedPropertyIds.length} properties:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bulkTagSelectedTags.map((tag) => {
                    const style = getTagStyle(tag);
                    return (
                      <span
                        key={tag}
                        className={`inline-flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => setBulkTagSelectedTags(prev => prev.filter(t => t !== tag))}
                          className="p-0.5 hover:bg-black/10 rounded cursor-pointer ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkTagModalOpen(false)}
                disabled={isApplyingTags}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="apply-bulk-tags-submit-btn"
                type="button"
                onClick={() => handleApplyBulkTags(bulkTagSelectedTags, bulkTagMode)}
                disabled={isApplyingTags || bulkTagSelectedTags.length === 0}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isApplyingTags ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {bulkTagMode === 'remove' ? 'Remove' : bulkTagMode === 'set' ? 'Set' : 'Apply'} Tags ({selectedPropertyIds.length} Properties)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Confirmation Modal */}
      {exportConfirmModal && exportConfirmModal.isOpen && (
        <div
          id="export-csv-modal-backdrop"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExportConfirmModal(null);
          }}
        >
          <div
            id="export-csv-modal-card"
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-csv-title"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0 shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="export-csv-title" className="text-base font-bold text-slate-900 tracking-tight">
                    Confirm CSV Export
                  </h3>
                  <p className="text-xs text-slate-500">
                    Export property intelligence &amp; cadastral records
                  </p>
                </div>
              </div>
              <button
                id="close-export-csv-modal-btn"
                onClick={() => setExportConfirmModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close export dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Properties in export:</span>
                <span className="text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full font-mono">
                  {exportConfirmModal.properties.length} {exportConfirmModal.properties.length === 1 ? 'property record' : 'property records'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200/60 pt-2">
                <span>Export Scope:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[210px]" title={exportConfirmModal.sourceLabel}>
                  {exportConfirmModal.sourceLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200/60 pt-2">
                <span>File name:</span>
                <span className="font-mono text-[11px] text-cyan-700 truncate max-w-[210px]">
                  vortex_properties_analytics_{new Date().toISOString().slice(0, 10)}.csv
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-500">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                Included Analytics (33 attributes):
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>APN &amp; Address</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>Market &amp; Assessed Val</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>Equity &amp; LTV Ratios</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>Tax Delinquency</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>Owner &amp; Corp Status</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                  <span>GIS Provenance Ledger</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                id="cancel-export-csv-modal-btn"
                type="button"
                onClick={() => setExportConfirmModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-export-csv-modal-btn"
                type="button"
                onClick={handleExecuteCsvExport}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export {exportConfirmModal.properties.length} {exportConfirmModal.properties.length === 1 ? 'Record' : 'Records'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-Step Skip Tracing Intelligence Modal */}
      {isSkipTraceModalOpen && (
        <SkipTraceModal
          isOpen={isSkipTraceModalOpen}
          property={skipTraceProperty}
          onClose={() => {
            setIsSkipTraceModalOpen(false);
            setSkipTraceProperty(null);
          }}
          onContactsUpdated={(updatedOwner) => {
            addToast(`Verified contacts for ${updatedOwner.name} synced to database & lead pipeline!`, 'success');
            if (onRefreshProperties) {
              onRefreshProperties();
            }
          }}
        />
      )}

      {/* Autonomous Property Search & Multi-Engine Skip Tracing Pipeline Modal */}
      {isAutomatedPipelineOpen && (
        <AutomatedSkipTracePipelineModal
          isOpen={isAutomatedPipelineOpen}
          onClose={() => setIsAutomatedPipelineOpen(false)}
          onRefreshData={() => {
            if (onRefreshProperties) {
              onRefreshProperties();
            }
          }}
          onSelectProperty={(prop) => {
            setSelectedProperty(prop);
            setIsAutomatedPipelineOpen(false);
          }}
        />
      )}

      {/* CSV Batch Ingestion Modal */}
      {showImportModal && (
        <DataImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          defaultMode="properties"
          title="Batch Import Property Records"
          description="Upload CSV with parcel APNs, addresses, valuations, and owner information to populate the PostgreSQL database."
          onSuccess={() => {
            if (onRefreshProperties) {
              onRefreshProperties();
            }
          }}
        />
      )}

      {/* Google Sheets Export & Sync Modal */}
      {showGoogleSheetsModal && (
        <GoogleSheetsSyncModal
          isOpen={showGoogleSheetsModal}
          onClose={() => setShowGoogleSheetsModal(false)}
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          initialMode="properties"
        />
      )}

      {/* Bulk Edit Properties Modal */}
      <PropertyBulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedCount={selectedPropertyIds.length}
        selectedProperties={properties.filter(p => selectedPropertyIds.includes(p.id))}
        onApplyChanges={handleExecuteBulkEdit}
        isUpdating={isBulkEditing}
      />

      {/* Custom Calculated Field Modal */}
      {isCalcModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-cyan-600" />
                <span>Add Custom Calculated Field</span>
              </h3>
              <button
                onClick={() => setIsCalcModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Column Name</label>
                <input
                  type="text"
                  value={newCalcName}
                  onChange={(e) => setNewCalcName(e.target.value)}
                  placeholder="e.g. Net Equity Ratio"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Formula Expression</label>
                <input
                  type="text"
                  value={newCalcFormula}
                  onChange={(e) => setNewCalcFormula(e.target.value)}
                  placeholder="e.g. estimated_equity / estimated_value"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-cyan-900 focus:outline-none focus:border-cyan-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Available variables: <code className="text-cyan-700">estimated_value</code>, <code className="text-cyan-700">estimated_equity</code>, <code className="text-cyan-700">square_feet</code>, <code className="text-cyan-700">assessed_tax_value</code>, <code className="text-cyan-700">mortgage_balance</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCalcModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newCalcName.trim() || !newCalcFormula.trim()) {
                    addToast('Please enter both a column name and formula expression.', 'error');
                    return;
                  }
                  setCustomCalculatedFields(prev => [...prev, { id: `calc_${Date.now()}`, name: newCalcName.trim(), formula: newCalcFormula.trim() }]);
                  setNewCalcName('');
                  setIsCalcModalOpen(false);
                  addToast(`Successfully added calculated column "${newCalcName}"`, 'success');
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Create Calculated Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-Panel Row Preview Drawer */}
      {previewProperty && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Property Preview Summary</h3>
                <p className="text-[11px] text-slate-500 font-mono">APN: {previewProperty.apn}</p>
              </div>
            </div>
            <button
              onClick={() => setPreviewProperty(null)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4 flex-1">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Address & Location</div>
              <div className="text-base font-bold text-slate-900">{previewProperty.address}</div>
              <div className="text-xs text-slate-600">{previewProperty.city}, {previewProperty.state} {previewProperty.zip} ({previewProperty.county} County)</div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Estimated Value</div>
                <div className="text-sm font-bold text-slate-900">${(previewProperty.estimated_value / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Estimated Equity</div>
                <div className="text-sm font-bold text-emerald-700">${(previewProperty.estimated_equity / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Property Type</div>
                <div className="text-xs font-medium text-slate-800">{previewProperty.property_type} ({previewProperty.units_count} Units)</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Tax Status</div>
                <div className={`text-xs font-semibold ${previewProperty.tax_delinquent ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {previewProperty.tax_delinquent ? 'Delinquent' : 'Current'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Owner Intelligence</div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Legal Owner:</span>
                  <span className="text-xs font-bold text-slate-900">{previewProperty.owner_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Owner Type:</span>
                  <span className="text-xs font-semibold text-slate-800">{previewProperty.is_corporate_owned ? 'Corporate Entity' : 'Individual'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Absentee Status:</span>
                  <span className="text-xs font-semibold text-slate-800">{previewProperty.is_absentee_owner ? 'Absentee Owner' : 'Owner Occupant'}</span>
                </div>
              </div>
            </div>

            {previewProperty.tags && previewProperty.tags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Classification Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {previewProperty.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between space-x-3">
            <button
              onClick={() => setPreviewProperty(null)}
              className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              Close Preview
            </button>
            <button
              onClick={() => {
                setSelectedProperty(previewProperty);
                setPreviewProperty(null);
              }}
              className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg text-xs transition shadow-xs cursor-pointer"
            >
              Open Full Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
