import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  File,
  Upload,
  FolderPlus,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  HardDrive,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Home,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  Share2,
  Eye,
  Building2,
  Sparkles,
  FolderDown,
  FileSpreadsheet as FileSpreadsheetIcon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  SCOPES,
} from '../lib/driveAuth';
import {
  driveService,
  DriveFileItem,
  DriveAboutInfo,
} from '../lib/driveService';
import { Property, LeadRecord } from '../types';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';

interface GoogleDriveViewProps {
  properties: Property[];
  leads: LeadRecord[];
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  properties,
  leads,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive state
  const [aboutInfo, setAboutInfo] = useState<DriveAboutInfo | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreateDocOpen, setIsCreateDocOpen] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [newDocContent, setNewDocContent] = useState<string>('');
  const [isExportReportOpen, setIsExportReportOpen] = useState<boolean>(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Mandatory Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Drag & drop upload
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        loadDriveData();
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        loadDriveData();
      }
    } catch (err: any) {
      const isCancellation =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request';
      if (isCancellation) {
        console.info('Google sign-in popup dismissed.');
        setAuthError('Google sign-in popup was closed before completion. Click "Sign in with Google" when you are ready to connect.');
      } else {
        console.warn('Sign in issue:', err?.message || err);
        setAuthError(err.message || 'Failed to sign in with Google. Please ensure popups are allowed in your browser.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFiles([]);
    setAboutInfo(null);
    setNeedsAuth(true);
  };

  // Load drive about & files
  const loadDriveData = async (folderId: string = currentFolderId) => {
    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      const [about, fileList] = await Promise.all([
        driveService.getAbout().catch((err) => {
          console.warn('Could not fetch about info:', err);
          return null;
        }),
        driveService.listFiles({
          folderId,
          query: searchQuery.trim() || undefined,
        }),
      ]);

      if (about) setAboutInfo(about);
      setFiles(fileList.files || []);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      setStatusMessage({
        text: err.message || 'Failed to load Google Drive files. You may need to sign in again.',
        type: 'error',
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && token) {
      loadDriveData(currentFolderId);
    }
  }, [currentFolderId, typeFilter]);

  const handleFolderClick = (folder: DriveFileItem) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await driveService.createFolder(newFolderName.trim(), currentFolderId);
      setNewFolderName('');
      setIsCreateFolderOpen(false);
      setStatusMessage({ text: `Created folder "${newFolderName}"`, type: 'success' });
      loadDriveData(currentFolderId);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to create folder', type: 'error' });
    }
  };

  // Create or Open Dedicated "Vortex Imported Files" Folder
  const handleOpenOrCreateImportedFolder = async () => {
    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      const { folder, created } = await driveService.getOrCreateFolder('Vortex Imported Files', 'root');
      setCurrentFolderId(folder.id);
      setBreadcrumbs([
        { id: 'root', name: 'My Drive' },
        { id: folder.id, name: folder.name },
      ]);
      setStatusMessage({
        text: created
          ? 'Created and opened dedicated folder "Vortex Imported Files" in Google Drive'
          : 'Opened dedicated "Vortex Imported Files" folder in Google Drive',
        type: 'success',
      });
      loadDriveData(folder.id);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to access Imported Files folder', type: 'error' });
      setIsLoadingFiles(false);
    }
  };

  // Create Document
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    try {
      const title = newDocTitle.endsWith('.txt') || newDocTitle.endsWith('.md')
        ? newDocTitle
        : `${newDocTitle}.md`;
      await driveService.createDocument(title, newDocContent, 'text/markdown', currentFolderId);
      setNewDocTitle('');
      setNewDocContent('');
      setIsCreateDocOpen(false);
      setStatusMessage({ text: `Created document "${title}" in Google Drive`, type: 'success' });
      loadDriveData(currentFolderId);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to create document', type: 'error' });
    }
  };

  // Export Property Intelligence Dossier to Drive
  const handleExportPropertyDossier = async () => {
    const prop = properties.find((p) => p.id === selectedPropertyId) || properties[0];
    if (!prop) return;

    try {
      const markdownDossier = `# Property Intelligence Dossier: ${prop.address}
**City/State/Zip**: ${prop.city}, ${prop.state} ${prop.zip} (${prop.county} County)
**Assessor Parcel Number (APN)**: ${prop.apn}
**Owner of Record**: ${prop.owner_name}
**Absentee Owner**: ${prop.is_absentee_owner ? 'YES (High Priority Outreach)' : 'NO'}

---
### Valuation & Financial Metrics
* **Estimated Market Value**: $${prop.estimated_value.toLocaleString()}
* **Assessed Tax Value**: $${prop.assessed_tax_value.toLocaleString()}
* **Estimated Equity**: $${prop.estimated_equity.toLocaleString()}
* **Mortgage Balance**: $${prop.mortgage_balance.toLocaleString()}
* **Year Built / Area**: ${prop.year_built} • ${prop.square_feet.toLocaleString()} sqft (${prop.units_count} units)

---
### AI Property Management Outreach Strategy
* Target Owner: ${prop.owner_name}
* Recommended Pitch: Full-service asset repositioning, tenant screening, and preventive maintenance automation for Costa Mesa / Orange County portfolio.
* Data Provenance: ${prop.provenance.source} (Confidence: ${Math.round(prop.provenance.confidence * 100)}%)

*Generated by Vortex One Multi-Agent System on ${new Date().toLocaleString()}*
`;

      const fileName = `Property_Dossier_${prop.address.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
      await driveService.createDocument(fileName, markdownDossier, 'text/markdown', currentFolderId);
      setIsExportReportOpen(false);
      setStatusMessage({
        text: `Exported property intelligence dossier for ${prop.address} to Google Drive!`,
        type: 'success',
      });
      loadDriveData(currentFolderId);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Export failed', type: 'error' });
    }
  };

  // Upload file handler
  const handleFileUpload = async (filesToUpload: FileList | null) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setIsLoadingFiles(true);
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        await driveService.uploadFile(filesToUpload[i], currentFolderId);
      }
      setStatusMessage({
        text: `Successfully uploaded ${filesToUpload.length} file(s) to Google Drive.`,
        type: 'success',
      });
      loadDriveData(currentFolderId);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Upload failed', type: 'error' });
      setIsLoadingFiles(false);
    }
  };

  // Perform Destructive Delete (With mandatory confirmation)
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await driveService.deleteFile(fileToDelete.id);
      setStatusMessage({
        text: `Deleted "${fileToDelete.name}" from Google Drive.`,
        type: 'success',
      });
      setFileToDelete(null);
      loadDriveData(currentFolderId);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Deletion failed', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for rendering file type icons
  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    }
    if (mimeType.includes('document') || mimeType.includes('text')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileCheck className="w-5 h-5 text-rose-400" />;
    }
    if (mimeType.includes('image')) {
      return <FileImage className="w-5 h-5 text-purple-400" />;
    }
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '—';
    const num = Number(bytes);
    if (isNaN(num)) return '—';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatBytesToGB = (bytes?: string) => {
    if (!bytes) return '0 GB';
    const num = Number(bytes);
    if (isNaN(num)) return '0 GB';
    return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const filteredFiles = files.filter((file) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'folders') return file.mimeType === 'application/vnd.google-apps.folder';
    if (typeFilter === 'docs') return file.mimeType.includes('document') || file.mimeType.includes('text');
    if (typeFilter === 'sheets') return file.mimeType.includes('spreadsheet') || file.mimeType.includes('csv');
    if (typeFilter === 'pdf') return file.mimeType.includes('pdf');
    if (typeFilter === 'images') return file.mimeType.includes('image');
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & OAuth Connection State */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-50 via-blue-50 to-emerald-50 border border-slate-200 flex items-center justify-center shadow-xs">
              <HardDrive className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Google Drive Integration</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                  Google Workspace API
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Access, manage, and sync property intelligence dossiers, deed scans, and CRM records with your Google Drive.
              </p>
            </div>
          </div>

          {/* User Profile / Google Sign-In Status */}
          <div>
            {user ? (
              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-8 h-8 rounded-full border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-xs">
                    {user.displayName?.charAt(0) || <UserIcon className="w-4 h-4" />}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-900 flex items-center space-x-1.5">
                    <span>{user.displayName || 'Google Account'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-slate-500">{user.email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition cursor-pointer ml-2"
                  title="Disconnect Google Drive"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="gsi-material-button flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs px-4 py-2 rounded-lg shadow-xs transition border border-slate-300 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isAuthenticating ? 'Connecting to Drive...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quota & Storage Telemetry if connected */}
        {aboutInfo?.storageQuota && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="text-slate-700 font-medium">Drive Storage:</span>
              <span>
                {formatBytesToGB(aboutInfo.storageQuota.usageInDrive)} used of{' '}
                {aboutInfo.storageQuota.limit ? formatBytesToGB(aboutInfo.storageQuota.limit) : 'Unlimited'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-[11px] text-slate-500">
                Scopes: {SCOPES.length} Google Workspace APIs Authorized
              </span>
            </div>
          </div>
        )}
      </div>

      {authError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{authError}</span>
          </div>
          <button
            onClick={handleSignIn}
            className="text-amber-800 font-semibold underline hover:text-amber-900 shrink-0 cursor-pointer text-xs"
          >
            Try Again
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-xs flex items-center space-x-2 border shadow-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-cyan-50 border-cyan-200 text-cyan-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Drive Content View */}
      {needsAuth ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-cyan-50 border border-cyan-200 mx-auto flex items-center justify-center">
            <HardDrive className="w-8 h-8 text-cyan-600" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-semibold text-slate-900">Google Drive Authentication Required</h3>
            <p className="text-xs text-slate-500">
              Sign in with your Google Workspace or Gmail account to view files, sync property documents, and store AI-generated investment dossiers in your Google Drive.
            </p>
          </div>
          <div>
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="inline-flex items-center space-x-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
            >
              <span>{isAuthenticating ? 'Connecting...' : 'Authorize Google Drive Access'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action Toolbar & Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            {/* Search & Type Filters */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search files and documents in Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadDriveData(currentFolderId);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                />
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-[11px]">
                {['all', 'folders', 'docs', 'sheets', 'pdf', 'images'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded capitalize font-medium transition cursor-pointer ${
                      typeFilter === t
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="create-imported-folder-btn"
                onClick={handleOpenOrCreateImportedFolder}
                className="flex items-center space-x-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition border border-cyan-200 cursor-pointer shadow-2xs"
                title="Create or open the dedicated 'Vortex Imported Files' folder in Google Drive"
              >
                <FolderDown className="w-3.5 h-3.5 text-cyan-600" />
                <span>Imported Files Folder</span>
              </button>

              <button
                onClick={() => setIsExportReportOpen(true)}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Export Property Dossier</span>
              </button>

              <button
                onClick={() => setIsSheetsModalOpen(true)}
                className="flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition border border-emerald-300 shadow-2xs cursor-pointer"
                title="Create Google Sheets spreadsheets or export live datasets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Sheets</span>
              </button>

              <button
                onClick={() => setIsCreateFolderOpen(true)}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                <span>New Folder</span>
              </button>

              <button
                onClick={() => setIsCreateDocOpen(true)}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-600" />
                <span>New Document</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload</span>
              </button>

              <button
                onClick={() => loadDriveData(currentFolderId)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition border border-slate-200 cursor-pointer"
                title="Refresh Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Folder Breadcrumb Hierarchy */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 px-1">
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={b.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <button
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`flex items-center space-x-1 hover:text-cyan-600 transition cursor-pointer ${
                    idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {idx === 0 && <Home className="w-3.5 h-3.5 mr-1" />}
                  <span>{b.name}</span>
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Files Grid / Dropzone Container */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            className={`bg-white border rounded-xl overflow-hidden transition shadow-xs ${
              isDragging ? 'border-cyan-500 bg-cyan-50/50 ring-2 ring-cyan-500/20' : 'border-slate-200'
            }`}
          >
            {isLoadingFiles ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-600" />
                <span>Loading Google Drive items...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-3">
                <Folder className="w-8 h-8 text-slate-400 mx-auto" />
                <p>No files or folders found in this location.</p>
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-cyan-600 hover:underline cursor-pointer font-medium"
                  >
                    Upload a file
                  </button>
                  <span>or</span>
                  <button
                    onClick={() => setIsCreateDocOpen(true)}
                    className="text-cyan-600 hover:underline cursor-pointer font-medium"
                  >
                    Create a new document
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold text-slate-600 bg-slate-50 uppercase tracking-wider">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-2">Modified</div>
                  <div className="col-span-2">File Size</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filteredFiles.map((file) => {
                  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                  return (
                    <div
                      key={file.id}
                      className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-slate-50 transition group"
                    >
                      {/* Name & Icon */}
                      <div className="col-span-6 flex items-center space-x-3 truncate pr-2">
                        <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                        <div className="truncate">
                          {isFolder ? (
                            <button
                              onClick={() => handleFolderClick(file)}
                              className="font-medium text-slate-900 hover:text-cyan-600 transition truncate text-left cursor-pointer"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-900 truncate">{file.name}</span>
                          )}
                          {file.owners && file.owners.length > 0 && (
                            <div className="text-[10px] text-slate-500 truncate">
                              Owned by {file.owners[0].displayName || file.owners[0].emailAddress}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modified Date */}
                      <div className="col-span-2 text-slate-500 text-[11px]">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleDateString()
                          : '—'}
                      </div>

                      {/* Size */}
                      <div className="col-span-2 text-slate-500 text-[11px]">
                        {isFolder ? 'Folder' : formatFileSize(file.size)}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end space-x-1.5">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-cyan-600 hover:bg-slate-100 rounded transition"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {/* Delete Action (Triggers Confirmation Modal) */}
                        <button
                          onClick={() => setFileToDelete(file)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create New Folder */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <FolderPlus className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Create New Drive Folder</h3>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g., Orange County Property Analysis"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create New Document */}
      {isCreateDocOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-900">Create New Document in Drive</h3>
            </div>
            <form onSubmit={handleCreateDocument} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g., Acquisition_Memo_1204_Pacific.md"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Content (Markdown / Text)</label>
                <textarea
                  rows={6}
                  placeholder="Type or paste notes, property briefs, or market analysis here..."
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDocOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDocTitle.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  Save to Google Drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Export Property Intelligence Dossier */}
      {isExportReportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-900">Export Property Dossier to Drive</h3>
            </div>
            <p className="text-xs text-slate-500">
              Select a property record to generate an AI property intelligence dossier and save directly to your Google Drive.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Select Property</label>
                <select
                  value={selectedPropertyId || (properties[0]?.id || '')}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.city} (${(p.estimated_equity / 1000000).toFixed(2)}M Equity)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportReportOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportPropertyDossier}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Export to Drive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION MODAL: Destructive File Deletion */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-xl p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Confirm File Deletion</h3>
            </div>
            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-slate-900">"{fileToDelete.name}"</span> from Google Drive?
              </p>
              <p className="text-[11px] text-slate-500">
                This action mutates your Google Drive data and cannot be undone through this interface.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Modal */}
      {isSheetsModalOpen && (
        <GoogleSheetsSyncModal
          isOpen={isSheetsModalOpen}
          onClose={() => {
            setIsSheetsModalOpen(false);
            loadDriveData(currentFolderId);
          }}
          properties={properties}
          leads={leads}
          initialMode="list"
        />
      )}
    </div>
  );
};
