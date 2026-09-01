import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Lock,
  LogIn,
  Layers,
  Users,
  Building2,
  TableProperties,
} from 'lucide-react';
import { Property, LeadRecord } from '../types';
import {
  exportPropertiesToGoogleSheet,
  exportLeadsToGoogleSheet,
  listSpreadsheets,
  GoogleSpreadsheetInfo,
} from '../lib/sheetsService';
import { getCachedToken, signInWithGoogle, getOAuthUser } from '../lib/driveAuth';
import { User } from 'firebase/auth';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties?: Property[];
  leads?: LeadRecord[];
  selectedPropertyIds?: string[];
  selectedLeadIds?: string[];
  initialMode?: 'properties' | 'leads' | 'list';
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  properties = [],
  leads = [],
  selectedPropertyIds = [],
  selectedLeadIds = [],
  initialMode = 'properties',
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'leads' | 'spreadsheets'>(
    initialMode === 'leads' ? 'leads' : initialMode === 'list' ? 'spreadsheets' : 'properties'
  );
  const [user, setUser] = useState<User | null>(getOAuthUser());
  const [token, setToken] = useState<string | null>(getCachedToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTitle, setExportTitle] = useState('');
  const [exportResult, setExportResult] = useState<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    totalExported: number;
  } | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetInfo[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentToken = getCachedToken();
      setToken(currentToken);
      setUser(getOAuthUser());
      setError(null);
      setExportResult(null);

      if (activeTab === 'properties') {
        const count = selectedPropertyIds.length > 0 ? selectedPropertyIds.length : properties.length;
        setExportTitle(`Vortex One - Properties Portfolio (${count} Records)`);
      } else if (activeTab === 'leads') {
        const count = selectedLeadIds.length > 0 ? selectedLeadIds.length : leads.length;
        setExportTitle(`Vortex One - CRM Pipeline Leads (${count} Records)`);
      }

      if (currentToken && activeTab === 'spreadsheets') {
        loadSpreadsheetList(currentToken);
      }
    }
  }, [isOpen, activeTab, properties.length, leads.length, selectedPropertyIds.length, selectedLeadIds.length]);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      setUser(result.user);
      setToken(result.accessToken);
      if (activeTab === 'spreadsheets') {
        loadSpreadsheetList(result.accessToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Google Workspace authentication was cancelled or failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadSpreadsheetList = async (accessToken: string) => {
    setLoadingSpreadsheets(true);
    try {
      const list = await listSpreadsheets(accessToken);
      setSpreadsheets(list);
    } catch (err: any) {
      console.warn('Failed to load spreadsheets:', err);
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  const handleExportProperties = async () => {
    if (!token) return;
    setIsExporting(true);
    setError(null);
    try {
      const dataToExport =
        selectedPropertyIds.length > 0
          ? properties.filter((p) => selectedPropertyIds.includes(p.id))
          : properties;

      const result = await exportPropertiesToGoogleSheet(
        token,
        dataToExport,
        exportTitle || 'Vortex One - Properties Portfolio'
      );

      setExportResult(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to export properties to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLeads = async () => {
    if (!token) return;
    setIsExporting(true);
    setError(null);
    try {
      const dataToExport =
        selectedLeadIds.length > 0
          ? leads.filter((l) => selectedLeadIds.includes(l.id))
          : leads;

      const result = await exportLeadsToGoogleSheet(
        token,
        dataToExport,
        exportTitle || 'Vortex One - CRM Pipeline Leads'
      );

      setExportResult(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to export CRM leads to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                Google Sheets Integration
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  Real Google Workspace API v4
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Direct two-way synchronization and 1-click formatted spreadsheet exports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/70">
          <button
            onClick={() => {
              setActiveTab('properties');
              setExportResult(null);
              setError(null);
            }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'properties'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Export Properties ({selectedPropertyIds.length > 0 ? `${selectedPropertyIds.length} Selected` : `${properties.length} Total`})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('leads');
              setExportResult(null);
              setError(null);
            }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'leads'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Export CRM Leads ({selectedLeadIds.length > 0 ? `${selectedLeadIds.length} Selected` : `${leads.length} Total`})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('spreadsheets');
              setExportResult(null);
              setError(null);
              if (token) loadSpreadsheetList(token);
            }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'spreadsheets'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            <span>Recent Spreadsheets</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Auth Banner if not authenticated */}
          {!token ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Google Workspace Authorization Required</h4>
                  <p className="text-xs text-amber-700">
                    Connect your Google account with Sheets & Drive permissions to create and export live spreadsheets.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-2 transition shrink-0 disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{isAuthenticating ? 'Connecting...' : 'Connect Google Sheets'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-semibold text-emerald-900">Connected:</span>
                <span className="text-xs font-medium text-emerald-800">{user?.email || 'Google Workspace User'}</span>
              </div>
              <button
                onClick={handleSignIn}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
              >
                Switch Account
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-rose-800 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {exportResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Spreadsheet Created Successfully!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Exported <strong>{exportResult.totalExported}</strong> rows with complete parcel, tax, valuation, and owner intelligence attributes.
              </p>
              <div className="flex items-center space-x-3 pt-1">
                <a
                  href={exportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center space-x-2 transition"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Tab 1: Export Properties */}
          {activeTab === 'properties' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter spreadsheet title..."
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h5 className="text-xs font-bold text-slate-800">Included Attributes (23 Columns):</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px] text-slate-600">
                  <span>• APN / Parcel ID</span>
                  <span>• Property Address & City</span>
                  <span>• Verified Owner Names</span>
                  <span>• Use Code & Units Count</span>
                  <span>• Building & Lot SqFt</span>
                  <span>• Year Built</span>
                  <span>• Assessed Value ($)</span>
                  <span>• Land & Improvement Values</span>
                  <span>• Estimated Equity (%)</span>
                  <span>• Tax Delinquency Flag</span>
                  <span>• Last Sale Date & Price</span>
                  <span>• Lead & Opportunity Score</span>
                  <span>• Coordinates (Lat/Lng)</span>
                  <span>• Zoning Classification</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  {selectedPropertyIds.length > 0
                    ? `Exporting ${selectedPropertyIds.length} selected properties`
                    : `Exporting all ${properties.length} properties`}
                </span>
                <button
                  onClick={handleExportProperties}
                  disabled={!token || isExporting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center space-x-2 transition disabled:opacity-50"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isExporting ? 'Creating Google Sheet...' : 'Export to Google Sheets'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Export Leads */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter CRM export title..."
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h5 className="text-xs font-bold text-slate-800">Included CRM Pipeline Fields (19 Columns):</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px] text-slate-600">
                  <span>• Lead Record ID</span>
                  <span>• Prospect / Owner Name</span>
                  <span>• Subject Property Address</span>
                  <span>• Phone & Email Contacts</span>
                  <span>• AI Lead Score & Tier</span>
                  <span>• 8-Stage Pipeline Stage</span>
                  <span>• Telephony Disposition</span>
                  <span>• Assigned Sub-Agent</span>
                  <span>• TCPA Compliance Flag</span>
                  <span>• Absentee Landlord Status</span>
                  <span>• High Equity Indicator</span>
                  <span>• Multi-Unit Indicator</span>
                  <span>• Tax Delinquency Indicator</span>
                  <span>• Tags & Activity Notes</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  {selectedLeadIds.length > 0
                    ? `Exporting ${selectedLeadIds.length} selected leads`
                    : `Exporting all ${leads.length} leads`}
                </span>
                <button
                  onClick={handleExportLeads}
                  disabled={!token || isExporting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center space-x-2 transition disabled:opacity-50"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isExporting ? 'Creating CRM Sheet...' : 'Export Leads to Google Sheets'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Recent Spreadsheets */}
          {activeTab === 'spreadsheets' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Google Drive Spreadsheets</span>
                <button
                  onClick={() => token && loadSpreadsheetList(token)}
                  disabled={!token || loadingSpreadsheets}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded transition"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSpreadsheets ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingSpreadsheets ? (
                <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span>Loading Google Spreadsheets...</span>
                </div>
              ) : spreadsheets.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  {token ? 'No spreadsheets found in your Google Drive.' : 'Sign in to view your Google Spreadsheets.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {spreadsheets.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between transition"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Modified: {s.modifiedTime ? new Date(s.modifiedTime).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <a
                        href={s.webViewLink || `https://docs.google.com/spreadsheets/d/${s.id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shrink-0"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Google Sheets v4 API • Vortex One Intelligence Export</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
