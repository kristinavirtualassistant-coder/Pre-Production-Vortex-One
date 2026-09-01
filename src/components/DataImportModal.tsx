import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Users,
  Building2,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Download,
  FileText,
  Check,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Sliders,
  Folder,
  FolderPlus,
  FolderOpen,
  Trash2,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultMode?: 'properties' | 'leads' | 'all';
  title?: string;
  description?: string;
}

interface ParsedRecordPreview {
  index: number;
  apn: string;
  address: string;
  city: string;
  ownerName: string;
  phone: string;
  estimatedValue: number;
  estimatedEquity: number;
  propertyType: string;
  raw: Record<string, any>;
}

export interface ArchivedImportFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  recordCount: number;
  organizationId: string;
  importedAt: string;
  status: string;
  reconciliationSummary?: {
    propertiesCreated: number;
    propertiesUpdated: number;
    ownersCreated: number;
    ownersUpdated: number;
    leadsGenerated: number;
    portfolioValue: number;
    portfolioEquity: number;
  };
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultMode = 'all',
  title,
  description,
}) => {
  const [modalTab, setModalTab] = useState<'upload' | 'folder'>('upload');
  const [activeTab, setActiveTab] = useState<'properties' | 'leads' | 'all'>(defaultMode);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawFileText, setRawFileText] = useState<string>('');
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [previews, setPreviews] = useState<ParsedRecordPreview[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Folder & Archive State
  const [archivedFiles, setArchivedFiles] = useState<ArchivedImportFile[]>([]);
  const [folderInfo, setFolderInfo] = useState<{ folderPath: string; totalFiles: number } | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);

  // Import options
  const [autoScoreLeads, setAutoScoreLeads] = useState(true);
  const [enforceDnc, setEnforceDnc] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userProfile, getAuthHeaders } = useAuth();
  const { addToast } = useToast();

  const organizationId = userProfile?.organization_id || 'org_cmc_realty';
  const orgName = userProfile?.organization_name || 'CMC Realty & Property Management';

  const resetState = () => {
    setFile(null);
    setRawFileText('');
    setParsedData([]);
    setParsedHeaders([]);
    setPreviews([]);
    setError(null);
    setResult(null);
    setIsParsing(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchImportedFiles = useCallback(async () => {
    setIsLoadingFolder(true);
    try {
      const res = await fetch(`/api/imported-files?organizationId=${organizationId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedFiles(data.files || []);
        setFolderInfo({ folderPath: data.folderPath, totalFiles: data.totalFiles || 0 });
      }
    } catch (err) {
      console.warn('Failed to load imported files:', err);
    } finally {
      setIsLoadingFolder(false);
    }
  }, [organizationId, getAuthHeaders]);

  const handleCreateFolder = async () => {
    setIsLoadingFolder(true);
    try {
      const res = await fetch('/api/imported-files/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ organizationId }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Imported files folder verified', 'success');
        fetchImportedFiles();
      } else {
        throw new Error(data.error || 'Failed to create folder');
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoadingFolder(false);
    }
  };

  const handleDeleteArchivedFile = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from the imported files folder?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/imported-files/${id}?organizationId=${organizationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        addToast(`Deleted "${name}" from imported files folder`, 'info');
        fetchImportedFiles();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete file');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to delete file', 'error');
    }
  };

  const handleReingestFile = async (fileMeta: ArchivedImportFile) => {
    try {
      setIsParsing(true);
      const res = await fetch(`/api/imported-files/${fileMeta.id}/download?organizationId=${organizationId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to retrieve file content');
      const csvText = await res.text();
      const pseudoFile = new File([csvText], fileMeta.originalName || fileMeta.fileName, { type: 'text/csv' });
      setModalTab('upload');
      processCsvFile(pseudoFile);
      addToast(`Loaded ${fileMeta.originalName} from imported files folder`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to load file', 'error');
      setIsParsing(false);
    }
  };

  const handleDownloadFile = (id: string, fileName: string) => {
    const url = `/api/imported-files/${id}/download?organizationId=${organizationId}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Downloading ${fileName}`, 'info');
  };

  useEffect(() => {
    if (isOpen) {
      fetchImportedFiles();
    }
  }, [isOpen, fetchImportedFiles]);

  const processCsvFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv' && selectedFile.type !== 'application/vnd.ms-excel') {
      setError('Please select a valid CSV (.csv) file.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsParsing(true);

    // Read raw text for archival
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawFileText(e.target?.result as string || '');
    };
    reader.readAsText(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsing(false);
        const data = (results.data || []) as Record<string, any>[];
        if (data.length === 0) {
          setError('The uploaded CSV file contains no data rows.');
          return;
        }

        const headers = results.meta.fields || Object.keys(data[0] || {});
        setParsedHeaders(headers);
        setParsedData(data);

        // Build first 10 preview rows with normalized fields
        const previewRows: ParsedRecordPreview[] = data.slice(0, 10).map((row, idx) => {
          const norm: Record<string, any> = {};
          Object.entries(row).forEach(([k, v]) => {
            norm[k.trim().toLowerCase().replace(/[\s-]+/g, '_')] = v;
          });

          const address = (
            norm.address ||
            norm.property_address ||
            norm.street_address ||
            norm.site_address ||
            norm.street ||
            'Address Missing'
          ).toString();

          let apn = (
            norm.apn ||
            norm.parcel_number ||
            norm.parcel_id ||
            norm.property_id ||
            norm.lead_id ||
            ''
          ).toString();

          if (!apn && address) {
            let hash = 0;
            for (let i = 0; i < address.length; i++) hash = ((hash << 5) - hash) + address.charCodeAt(i);
            apn = `APN-${Math.abs(hash).toString().slice(0, 8)}`;
          }

          const ownerName = (
            norm.owner_name ||
            norm.owner ||
            norm.owner_id ||
            norm.taxpayer_name ||
            norm.contact_name ||
            norm.grantee ||
            'Private Owner'
          ).toString();

          const phone = (
            norm.phone_number ||
            norm.phone ||
            norm.owner_phone ||
            norm.mobile ||
            norm.cell ||
            '—'
          ).toString();

          const parseNum = (val: any, fallback: number): number => {
            if (!val) return fallback;
            const cleaned = val.toString().replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? fallback : parsed;
          };

          const estimatedValue = parseNum(norm.estimated_value || norm.value || norm.avm || norm.market_value || norm.price, 2500000);
          const estimatedEquity = parseNum(norm.estimated_equity || norm.equity || norm.net_equity, Math.round(estimatedValue * 0.7));
          const propertyType = (norm.property_type || norm.use_type || 'Multi-Family').toString();
          const city = (norm.city || norm.property_city || norm.municipality || 'Costa Mesa').toString();

          return {
            index: idx + 1,
            apn: apn || `APN-${idx + 1}`,
            address,
            city,
            ownerName,
            phone,
            estimatedValue,
            estimatedEquity,
            propertyType,
            raw: row,
          };
        });

        setPreviews(previewRows);
      },
      error: (err) => {
        setIsParsing(false);
        setError(`CSV Parsing Error: ${err.message}`);
      },
    });
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedData.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': organizationId,
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          records: parsedData,
          fileName: file?.name || 'imported_dataset.csv',
          rawContent: rawFileText,
          options: {
            autoScoreLeads,
            enforceDncVerification: enforceDnc,
            sourceSystem: `CSV Drag-and-Drop Batch Import (${file?.name || 'File'})`,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to ingest batch records into database');
      }

      setResult(data);
      addToast(`Successfully imported ${data.total_records_processed || parsedData.length} records into SQL database!`, 'success');
      fetchImportedFiles();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Import transaction encountered an unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadSampleCsv = (type: 'properties' | 'leads') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (type === 'properties') {
      filename = `sample_vortex_properties_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = [
        'apn',
        'address',
        'city',
        'state',
        'zip',
        'county',
        'property_type',
        'units_count',
        'square_feet',
        'year_built',
        'estimated_value',
        'estimated_equity',
        'mortgage_balance',
        'owner_name',
        'entity_type',
        'mailing_address',
        'mailing_city',
        'mailing_state',
        'mailing_zip',
        'phone_number',
        'email',
        'tax_delinquent',
      ];
      rows = [
        [
          '042-182-09',
          '3200 Harbor Blvd',
          'Costa Mesa',
          'CA',
          '92626',
          'Orange County',
          'Multi-Family',
          '8',
          '7200',
          '1984',
          '3850000',
          '2700000',
          '1150000',
          'Pacific Gateway Holdings LLC',
          'llc',
          '1201 Dover Dr Ste 300',
          'Newport Beach',
          'CA',
          '92660',
          '949-555-0182',
          'invest@pacificgateway.com',
          'false',
        ],
        [
          '118-290-14',
          '1420 Superior Ave',
          'Newport Beach',
          'CA',
          '92663',
          'Orange County',
          'Commercial/Multi-Family',
          '12',
          '11500',
          '1978',
          '5600000',
          '3920000',
          '1680000',
          'Sterling Family Trust',
          'trust',
          'PO Box 8840',
          'Corona del Mar',
          'CA',
          '92625',
          '949-555-0199',
          'sterlingtrust@gmail.com',
          'false',
        ],
        [
          '482-109-02',
          '740 W 19th St',
          'Costa Mesa',
          'CA',
          '92627',
          'Orange County',
          'Multi-Family',
          '6',
          '5400',
          '1990',
          '2900000',
          '2100000',
          '800000',
          'Robert Chen',
          'individual',
          '4820 Campus Dr',
          'Irvine',
          'CA',
          '92612',
          '714-555-0143',
          'rchen.properties@yahoo.com',
          'false',
        ],
      ];
    } else {
      filename = `sample_vortex_leads_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = [
        'lead_id',
        'owner_name',
        'property_address',
        'city',
        'state',
        'zip',
        'county',
        'units_count',
        'estimated_value',
        'estimated_equity',
        'phone_number',
        'email',
        'lead_score',
        'classification',
        'stage',
        'next_recommended_action',
      ];
      rows = [
        [
          'LEAD-901',
          'Margaret Vance',
          '1890 Placentia Ave',
          'Costa Mesa',
          'CA',
          '92627',
          'Orange County',
          '4',
          '2200000',
          '1650000',
          '949-555-0142',
          'mvance@gmail.com',
          '88',
          'High Priority',
          'Outreach Scheduled',
          'Deliver Sub-Agent 6 customized property management pitch',
        ],
        [
          'LEAD-902',
          'Harbor West Properties LLC',
          '410 E 17th St',
          'Costa Mesa',
          'CA',
          '92627',
          'Orange County',
          '10',
          '4800000',
          '3360000',
          '949-555-0193',
          'harborwest@gmail.com',
          '84',
          'High Priority',
          'Discovery',
          'Schedule owner exploratory portfolio assessment',
        ],
        [
          'LEAD-903',
          'David & Elena Rodriguez',
          '2205 Newport Blvd',
          'Costa Mesa',
          'CA',
          '92627',
          'Orange County',
          '6',
          '3100000',
          '2400000',
          '714-555-0177',
          'rodriguez.costamesa@gmail.com',
          '76',
          'Opportunity',
          'Underwriting',
          'Run Sub-Agent 3 Cash-Flow Cap Rate Pro Forma',
        ],
      ];
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Downloaded ${type === 'properties' ? 'Properties' : 'Leads'} sample CSV template`, 'info');
  };

  if (!isOpen) return null;

  return (
    <div
      id="csv-import-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleClose();
      }}
    >
      <div
        id="csv-import-modal-container"
        className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 my-8 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {title || (activeTab === 'leads' ? 'Batch Import Leads & Contacts' : activeTab === 'properties' ? 'Batch Import Property Records' : 'Batch CSV Ingestion Hub')}
                </h2>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  SQL PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {description || `Reconcile and persist CSV datasets with multi-tenant isolation, DNC verification, and automated lead scoring.`}
              </p>
            </div>
          </div>

          <button
            id="close-csv-import-modal-btn"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Mode Tabs: Upload vs Imported Files Folder */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              id="tab-upload-csv"
              type="button"
              onClick={() => setModalTab('upload')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                modalTab === 'upload'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV Dataset</span>
            </button>
            <button
              id="tab-imported-files-folder"
              type="button"
              onClick={() => {
                setModalTab('folder');
                fetchImportedFiles();
              }}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                modalTab === 'folder'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Imported Files Folder</span>
              {archivedFiles.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    modalTab === 'folder' ? 'bg-white text-cyan-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {archivedFiles.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-cyan-600" />
            <span>Folder: data/imported_files/{organizationId}</span>
          </div>
        </div>

        {/* Modal Body Container with Scroll */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {modalTab === 'folder' ? (
            /* Imported Files Folder View */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Folder Status and Action Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="w-4 h-4 text-cyan-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Imported Files Storage Partition
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Persistent Local Folder
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {folderInfo?.folderPath || `data/imported_files/${organizationId}`} • {archivedFiles.length} {archivedFiles.length === 1 ? 'archived dataset' : 'archived datasets'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    id="create-server-imported-folder-btn"
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={isLoadingFolder}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-700 hover:text-cyan-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition cursor-pointer disabled:opacity-50"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Verify / Create Folder</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchImportedFiles}
                    disabled={isLoadingFolder}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition cursor-pointer disabled:opacity-50"
                    title="Refresh folder files"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingFolder ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* File List */}
              {isLoadingFolder ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
                  <span>Loading archived imported files...</span>
                </div>
              ) : archivedFiles.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3 bg-slate-50/50">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">No imported files saved in this folder yet</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Whenever you upload and reconcile a CSV dataset, it is automatically archived into your organization's imported files directory for auditing and fast re-ingestion.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setModalTab('upload')}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Your First Dataset</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {archivedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-200 transition hover:shadow-2xs"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0 mt-0.5">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">
                              {f.originalName || f.fileName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {(f.fileSize / 1024).toFixed(1)} KB
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold">
                              {f.recordCount} records
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>Imported: {new Date(f.importedAt).toLocaleString()}</span>
                            {f.reconciliationSummary && (
                              <span className="text-slate-400">•</span>
                            )}
                            {f.reconciliationSummary && (
                              <span className="text-emerald-700 font-medium">
                                +{f.reconciliationSummary.propertiesCreated} props, +{f.reconciliationSummary.ownersCreated} owners, +{f.reconciliationSummary.leadsGenerated} leads
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleReingestFile(f)}
                          className="inline-flex items-center space-x-1 text-xs text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                          title="Load dataset into ingestion preview"
                        >
                          <RefreshCw className="w-3 h-3 text-cyan-600" />
                          <span>Re-ingest</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(f.id, f.originalName || f.fileName)}
                          className="inline-flex items-center space-x-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer"
                          title="Download archived raw file"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArchivedFile(f.id, f.originalName || f.fileName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete from imported folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Standard Upload and Reconcile View */
            <>
              {/* Tenant and Mode Selection */}
              {!result && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-center space-x-2 text-xs">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    <span className="text-slate-600 font-medium">Tenant Partition:</span>
                    <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                      {orgName} ({organizationId})
                    </span>
                  </div>

                  {/* Sample Download Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => downloadSampleCsv('properties')}
                      className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-cyan-700 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Sample Properties CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSampleCsv('leads')}
                      className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-blue-700 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Sample Leads CSV</span>
                    </button>
                  </div>
                </div>
              )}

          {/* Success Result View */}
          {result ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950">Batch CSV Ingestion Successful</h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    Processed {result.total_records_processed || parsedData.length} records into PostgreSQL database with live lead scoring and DNC compliance.
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Properties</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {result.properties_created || 0}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      (+{result.properties_updated || 0} updated)
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Owners</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {result.owners_created || 0}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      (+{result.owners_updated || 0} updated)
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Leads Generated</span>
                  </div>
                  <div className="text-xl font-bold text-amber-600">
                    {result.leads_generated || 0}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>DNC Suppressed</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-700">
                    {result.dnc_suppressed_phones_count || 0}
                  </div>
                </div>
              </div>

              {/* Portfolio Value Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total Reconciled Asset Value
                  </span>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    ${((result.portfolio_value_reconciled || 0) / 1000000).toFixed(2)}M
                    <span className="text-xs font-medium text-emerald-700 ml-2">
                      (${((result.portfolio_equity_reconciled || 0) / 1000000).toFixed(2)}M Net Equity)
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Audit ID: {result.audit_id || 'rec_auto_verified'}
                </div>
              </div>

              {/* Warnings / Errors if any */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Reconciliation Warnings ({result.warnings.length}):</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                    {result.warnings.slice(0, 5).map((w: string, idx: number) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {result.warnings.length > 5 && <li>...and {result.warnings.length - 5} more warnings</li>}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Drag and Drop Zone */}
              <div
                id="csv-drag-drop-zone"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-50/70 scale-[1.01]'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-cyan-400 bg-slate-50/60 hover:bg-cyan-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                      file
                        ? 'bg-emerald-100 text-emerald-700'
                        : isDragging
                        ? 'bg-cyan-100 text-cyan-700 scale-110'
                        : 'bg-white text-slate-600 shadow-sm border border-slate-200'
                    }`}
                  >
                    {file ? (
                      <FileSpreadsheet className="w-7 h-7" />
                    ) : (
                      <Upload className={`w-7 h-7 ${isDragging ? 'animate-bounce' : ''}`} />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {file ? file.name : isDragging ? 'Drop your CSV file here...' : 'Drag & Drop CSV File, or Click to Browse'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {file
                        ? `${(file.size / 1024).toFixed(1)} KB • ${parsedData.length} records parsed`
                        : 'Supports standard Property, Lead, Assessor, CoStar, BatchLeads, and CRM export CSVs'}
                    </p>
                  </div>

                  {file && (
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        <Check className="w-3.5 h-3.5" />
                        <span>Ready for Ingestion</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetState();
                        }}
                        className="text-xs text-slate-500 hover:text-rose-600 underline font-medium cursor-pointer"
                      >
                        Choose another file
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Parsing State */}
              {isParsing && (
                <div className="flex items-center justify-center space-x-2 text-xs text-cyan-700 bg-cyan-50 p-3 rounded-xl border border-cyan-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
                  <span>Parsing and structuring CSV dataset...</span>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Import Error:</strong> {error}
                  </div>
                </div>
              )}

              {/* Column Mapping & Data Preview Section */}
              {parsedData.length > 0 && (
                <div className="space-y-4">
                  {/* Column Badges Summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Detected CSV Headers ({parsedHeaders.length}):</span>
                      </span>
                      <span className="font-mono text-cyan-800 font-bold bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded text-[11px]">
                        {parsedData.length} Total Rows
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                      {parsedHeaders.map((hdr) => (
                        <span
                          key={hdr}
                          className="text-[11px] font-mono bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                        >
                          {hdr}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Preview Table of First 10 Records */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Dataset Preview (First {previews.length} of {parsedData.length} Records)
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Mapped to PostgreSQL tables: <code>properties</code>, <code>property_owners</code>, <code>leads</code>
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="max-h-56 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">APN / ID</th>
                              <th className="py-2 px-3">Property Address</th>
                              <th className="py-2 px-3">City</th>
                              <th className="py-2 px-3">Owner Name</th>
                              <th className="py-2 px-3">Phone</th>
                              <th className="py-2 px-3 text-right">Est. Value</th>
                              <th className="py-2 px-3 text-right">Est. Equity</th>
                              <th className="py-2 px-3">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previews.map((row) => (
                              <tr key={row.index} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{row.index}</td>
                                <td className="py-2 px-3 font-mono text-cyan-800 font-semibold">{row.apn}</td>
                                <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[180px]" title={row.address}>
                                  {row.address}
                                </td>
                                <td className="py-2 px-3 text-slate-600">{row.city}</td>
                                <td className="py-2 px-3 text-slate-800 font-medium truncate max-w-[140px]" title={row.ownerName}>
                                  {row.ownerName}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{row.phone}</td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                  ${row.estimatedValue.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  ${row.estimatedEquity.toLocaleString()}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                                    {row.propertyType}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Processing Options */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Ingestion Pipeline Options</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-cyan-50/30 transition">
                        <input
                          type="checkbox"
                          checked={autoScoreLeads}
                          onChange={(e) => setAutoScoreLeads(e.target.checked)}
                          className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <div>
                          <strong className="text-slate-900 block font-semibold">Auto-Score Leads (Sub-Agent 2)</strong>
                          <span className="text-[11px] text-slate-500">
                            Calculates explainable 0–100 motivation score and classifies into High Priority / Opportunity tiers.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-emerald-50/30 transition">
                        <input
                          type="checkbox"
                          checked={enforceDnc}
                          onChange={(e) => setEnforceDnc(e.target.checked)}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div>
                          <strong className="text-slate-900 block font-semibold">TCPA / DNC Suppression Check</strong>
                          <span className="text-[11px] text-slate-500">
                            Validates phone numbers against Do-Not-Call registries and marks compliance status.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {modalTab === 'folder' ? (
              <span>Managing archived imports in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">data/imported_files/{organizationId}</code></span>
            ) : result ? (
              <span className="text-emerald-700 font-semibold">✓ Database synchronization completed</span>
            ) : file ? (
              <span>Ready to ingest {parsedData.length} records into PostgreSQL</span>
            ) : (
              <span>Please drop or select a CSV file to continue</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {modalTab === 'folder' ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('upload')}
                  className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-md shadow-cyan-600/20 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload New CSV</span>
                </button>
              </>
            ) : result ? (
              <>
                <button
                  type="button"
                  onClick={resetState}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  Import Another CSV
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>Done &amp; View Records</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="submit-csv-batch-btn"
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!file || parsedData.length === 0 || isSubmitting || isParsing}
                  className="flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-md shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reconciling &amp; Ingesting SQL...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        Import &amp; Reconcile ({parsedData.length} {parsedData.length === 1 ? 'Record' : 'Records'})
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

