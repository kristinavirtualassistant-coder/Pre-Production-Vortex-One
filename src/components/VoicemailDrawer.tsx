import React, { useState } from 'react';
import { X, Upload, Trash2, Play, Pause, Volume2, CheckCircle2, Mic } from 'lucide-react';
import { VoicemailFile } from '../types';

interface VoicemailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  voicemails: VoicemailFile[];
  onUpload: (file: File, label: string) => void;
  onDelete: (id: string) => void;
  selectedVoicemailId?: string;
  onSelectVoicemail?: (id: string) => void;
}

export const VoicemailDrawer: React.FC<VoicemailDrawerProps> = ({
  isOpen,
  onClose,
  voicemails,
  onUpload,
  onDelete,
  selectedVoicemailId,
  onSelectVoicemail,
}) => {
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTogglePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      // Automatically reset playing state after simulated/audio duration
      setTimeout(() => setPlayingId(null), 3500);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl p-6 transform transition-transform border-l border-slate-200 overflow-y-auto">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Pre-recorded Voicemails</h2>
            <p className="text-xs text-slate-500">1-Click Automated Voicemail Drop Library</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Upload New Voicemail */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Upload New Pre-recorded Audio
        </h3>
        <input
          type="text"
          placeholder="e.g. Costa Mesa Multi-Family Pitch"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
        />
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
        />
        <button
          onClick={() => {
            if (file && label) {
              onUpload(file, label);
              setFile(null);
              setLabel('');
            }
          }}
          disabled={!file || !label}
          className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            file && label
              ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload Audio Template
        </button>
      </div>

      {/* Voicemails List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Available Library ({voicemails.length})
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Click to set default</span>
        </div>

        {voicemails.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
            No voicemail templates uploaded yet.
          </div>
        ) : (
          voicemails.map((vm) => {
            const isSelected = selectedVoicemailId === vm.id;
            const isPlaying = playingId === vm.id;

            return (
              <div
                key={vm.id}
                className={`p-3.5 border rounded-xl transition ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectVoicemail && onSelectVoicemail(vm.id)}
                      className={`text-xs font-bold text-left transition ${
                        isSelected ? 'text-cyan-900' : 'text-slate-800 hover:text-cyan-700'
                      }`}
                    >
                      {vm.label}
                    </button>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(vm.id)}
                    title="Delete voicemail"
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <button
                    onClick={() => handleTogglePlay(vm.id)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3 h-3 text-cyan-600" /> : <Play className="w-3 h-3" />}
                    {isPlaying ? 'Playing...' : 'Audio Preview'}
                  </button>

                  <span className="text-[10px] font-mono text-slate-400">
                    {vm.created_at ? new Date(vm.created_at).toLocaleDateString() : 'Active'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
