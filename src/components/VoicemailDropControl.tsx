import React, { useState } from 'react';
import {
  Voicemail,
  Volume2,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
  Play,
} from 'lucide-react';
import { VoicemailFile, CallRecord } from '../types';

interface VoicemailDropControlProps {
  voicemails: VoicemailFile[];
  activeCallId?: string;
  phoneNumber?: string;
  contactName?: string;
  onDropVoicemail: (voicemail: VoicemailFile) => Promise<void>;
  onOpenLibrary?: () => void;
  disabled?: boolean;
}

export const VoicemailDropControl: React.FC<VoicemailDropControlProps> = ({
  voicemails,
  activeCallId,
  phoneNumber,
  contactName,
  onDropVoicemail,
  onOpenLibrary,
  disabled = false,
}) => {
  const [selectedVoicemailId, setSelectedVoicemailId] = useState<string>(
    voicemails[0]?.id || 'vm_1'
  );
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [droppedSuccess, setDroppedSuccess] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const selectedVoicemail =
    voicemails.find((v) => v.id === selectedVoicemailId) ||
    voicemails[0] || {
      id: 'default_vm',
      label: 'Standard Professional Voicemail',
      url: 'https://actions.google.com/sounds/v1/speech/greeting.ogg',
      organization_id: '',
      created_at: new Date().toISOString(),
    };

  const handleDrop = async () => {
    if (disabled || isDropping) return;
    setIsDropping(true);
    setDroppedSuccess(false);

    try {
      await onDropVoicemail(selectedVoicemail);
      setDroppedSuccess(true);
      setTimeout(() => setDroppedSuccess(false), 3000);
    } catch (err) {
      console.error('Voicemail drop failed:', err);
    } finally {
      setIsDropping(false);
    }
  };

  return (
    <div className="w-full bg-linear-to-r from-cyan-950 via-slate-900 to-indigo-950 border border-cyan-500/40 rounded-xl p-3.5 shadow-md space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-2xs">
            <Voicemail className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white tracking-tight">
                Instant Voicemail Drop
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                1-Click Disengage
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Plays message to carrier beep and disconnects your line instantly.
            </p>
          </div>
        </div>

        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-medium cursor-pointer"
          >
            Manage ({voicemails.length})
          </button>
        )}
      </div>

      {/* Template Selector & Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Voicemail Audio Selector */}
        <div className="relative flex-1">
          <select
            value={selectedVoicemail.id}
            onChange={(e) => setSelectedVoicemailId(e.target.value)}
            disabled={disabled || isDropping}
            aria-label="Select pre-recorded voicemail template"
            className="w-full bg-slate-950 border border-slate-700 hover:border-cyan-500/50 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-medium outline-none focus:ring-1 focus:ring-cyan-400 transition"
          >
            {voicemails.length === 0 ? (
              <option value="default">Standard Multi-Family Pitch (Default)</option>
            ) : (
              voicemails.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleDrop}
          disabled={disabled || isDropping}
          className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
            isDropping
              ? 'bg-cyan-700 text-cyan-100 animate-pulse cursor-wait'
              : droppedSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-900/40'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-950/50 hover:shadow-md'
          }`}
        >
          {isDropping ? (
            <>
              <Zap className="w-3.5 h-3.5 animate-spin text-cyan-200" />
              <span>Dropping Audio...</span>
            </>
          ) : droppedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span>Dropped &amp; Freed!</span>
            </>
          ) : (
            <>
              <Voicemail className="w-3.5 h-3.5" />
              <span>Drop Voicemail &amp; Next</span>
            </>
          )}
        </button>
      </div>

      {droppedSuccess && (
        <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-[11px] text-emerald-200 flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Voicemail left for {contactName || 'Lead'}. Line released immediately.
          </span>
          <span className="text-[10px] font-bold text-emerald-300">Ready for next lead</span>
        </div>
      )}
    </div>
  );
};
