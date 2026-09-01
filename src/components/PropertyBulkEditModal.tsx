import React, { useState } from 'react';
import { X, Check, Edit3, Shield, User, Home, Building2 } from 'lucide-react';
import { Property } from '../types';

interface PropertyBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedProperties: Property[];
  onApplyChanges: (updates: {
    status?: string;
    assignedAgent?: string;
    propertyType?: string;
    county?: string;
    taxDelinquent?: boolean;
  }) => Promise<void>;
  isUpdating: boolean;
}

export const PropertyBulkEditModal: React.FC<PropertyBulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  selectedProperties,
  onApplyChanges,
  isUpdating,
}) => {
  const [statusChoice, setStatusChoice] = useState<string>('');
  const [agentChoice, setAgentChoice] = useState<string>('');
  const [typeChoice, setTypeChoice] = useState<string>('');
  const [taxChoice, setTaxChoice] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (statusChoice) updates.status = statusChoice;
    if (agentChoice) updates.assignedAgent = agentChoice;
    if (typeChoice) updates.propertyType = typeChoice;
    if (taxChoice !== '') updates.taxDelinquent = taxChoice === 'true';

    await onApplyChanges(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm">Bulk Edit Properties</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-xs text-cyan-900">
            <span className="font-bold">{selectedCount} properties selected</span> for bulk modification. Choose the fields you wish to update across all selected records.
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Update Status / Tax Status</label>
              <select
                value={taxChoice}
                onChange={(e) => setTaxChoice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="">-- Leave Unchanged --</option>
                <option value="false">Tax Current (Good Standing)</option>
                <option value="true">Tax Delinquent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assign Agent / Responsible Specialist</label>
              <select
                value={agentChoice}
                onChange={(e) => setAgentChoice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="">-- Leave Unchanged --</option>
                <option value="Sub-Agent 2 (CRM Lead Scorer)">Sub-Agent 2 (CRM Lead Scorer)</option>
                <option value="Sub-Agent 6 (Outreach Specialist)">Sub-Agent 6 (Outreach Specialist)</option>
                <option value="Sub-Agent 5 (Skip Trace & Intel)">Sub-Agent 5 (Skip Trace & Intel)</option>
                <option value="Sub-Agent 7 (Analytics Engine)">Sub-Agent 7 (Analytics Engine)</option>
                <option value="Kristina Madrigal (Senior Acquisition)">Kristina Madrigal (Senior Acquisition)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Type / Zoning</label>
              <select
                value={typeChoice}
                onChange={(e) => setTypeChoice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="">-- Leave Unchanged --</option>
                <option value="Single Family Residence">Single Family Residence</option>
                <option value="Multifamily Apartment">Multifamily Apartment</option>
                <option value="Commercial Retail / Office">Commercial Retail / Office</option>
                <option value="Industrial Warehouse">Industrial Warehouse</option>
                <option value="Vacant Land">Vacant Land</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating || (!taxChoice && !agentChoice && !typeChoice && !statusChoice)}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Bulk Updates</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
