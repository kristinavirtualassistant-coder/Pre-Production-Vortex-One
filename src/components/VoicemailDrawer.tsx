import React, { useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { VoicemailFile } from '../types';

interface VoicemailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  voicemails: VoicemailFile[];
  onUpload: (file: File, label: string) => void;
  onDelete: (id: string) => void;
}

export const VoicemailDrawer: React.FC<VoicemailDrawerProps> = ({ isOpen, onClose, voicemails, onUpload, onDelete }) => {
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-xl p-6 transform transition-transform">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold">Voicemail Library</h2>
        <button onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-4 mb-8">
        <input type="text" placeholder="Voicemail Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border rounded p-2 text-sm" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
        <button
          onClick={() => { if (file && label) { onUpload(file, label); setFile(null); setLabel(''); } }}
          className="w-full bg-cyan-600 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" /> Upload Voicemail
        </button>
      </div>
      <div className="space-y-2">
        {voicemails.map((vm) => (
          <div key={vm.id} className="flex justify-between items-center p-2 border rounded text-sm">
            <span>{vm.label}</span>
            <button onClick={() => onDelete(vm.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
