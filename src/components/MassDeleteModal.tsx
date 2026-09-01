import React from 'react';
import { AlertTriangle, Trash2, X, Users, Building, ShieldAlert } from 'lucide-react';
import { LeadRecord } from '../types';

interface MassDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  selectedLeads: LeadRecord[];
  isDeleting: boolean;
}

export const MassDeleteModal: React.FC<MassDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  selectedLeads,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="mass-delete-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="mass-delete-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-rose-100 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Confirm Mass Deletion</h3>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                Permanently remove {selectedCount} selected lead{selectedCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            id="close-mass-delete-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg hover:bg-rose-100 text-rose-400 hover:text-rose-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">This action cannot be undone.</p>
              <p className="text-amber-800 mt-0.5">
                The selected owner prospects, CRM activity histories, and score factor logs will be purged from the active pipeline.
              </p>
            </div>
          </div>

          {/* Preview of target leads */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className="uppercase tracking-wider text-[10px]">Leads queued for deletion:</span>
              <span className="font-mono text-slate-700">{selectedCount} Record{selectedCount > 1 ? 's' : ''}</span>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
              {selectedLeads.slice(0, 6).map((lead) => (
                <div key={lead.id} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-800 truncate">{lead.owner_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{lead.property_address}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 shrink-0">
                    {lead.stage}
                  </span>
                </div>
              ))}
              {selectedLeads.length > 6 && (
                <div className="p-2 text-center text-[11px] text-slate-500 italic bg-slate-100/60 font-medium">
                  + {selectedLeads.length - 6} more leads selected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            id="cancel-mass-delete-btn"
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-mass-delete-btn"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deleting {selectedCount} Leads...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete {selectedCount} Lead{selectedCount > 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
