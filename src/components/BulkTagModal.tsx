import React, { useState } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { LeadRecord } from '../types';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTags: (tags: string[]) => void;
  selectedCount: number;
  isApplying: boolean;
}

const COMMON_TAG_SUGGESTIONS = [
  'High Equity',
  'Absentee Owner',
  'Commercial Focus',
  'Tax Delinquent',
  'Ready to Sell',
  'Probate / Trust',
  '1031 Exchange Target',
  'Out-of-State Landlord',
  'Sub-Agent Verified',
  'DNC Scrubbed',
];

export const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  onApplyTags,
  selectedCount,
  isApplying,
}) => {
  const [tagInput, setTagInput] = useState('');
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tagsToAdd.includes(trimmed)) {
      setTagsToAdd([...tagsToAdd, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTagsToAdd(tagsToAdd.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleApply = () => {
    if (tagsToAdd.length === 0 && tagInput.trim()) {
      onApplyTags([tagInput.trim()]);
    } else if (tagsToAdd.length > 0) {
      onApplyTags(tagsToAdd);
    }
  };

  return (
    <div
      id="bulk-tag-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="bulk-tag-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Tags in Bulk</h3>
              <p className="text-xs text-indigo-700 font-medium mt-0.5">
                Apply tags to {selectedCount} selected lead{selectedCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            id="close-bulk-tag-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="p-1 rounded-lg hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Enter Tag Name &amp; Press Enter
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 1031 Exchange, Absentee..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Tags queued */}
          {tagsToAdd.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Tags to Add ({tagsToAdd.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tagsToAdd.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-semibold"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-indigo-950 cursor-pointer ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Popular Suggestions */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              Popular Tag Suggestions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAG_SUGGESTIONS.map((tag) => {
                const isSelected = tagsToAdd.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) handleRemoveTag(tag);
                      else handleAddTag(tag);
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center space-x-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 mr-0.5" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            id="cancel-bulk-tag-btn"
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-bulk-tag-btn"
            type="button"
            onClick={handleApply}
            disabled={isApplying || (tagsToAdd.length === 0 && !tagInput.trim())}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Applying Tags...</span>
              </>
            ) : (
              <>
                <Tag className="w-3.5 h-3.5" />
                <span>Apply to {selectedCount} Lead{selectedCount > 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
