import React from 'react';
import { FileText } from 'lucide-react';

interface CallScriptsRepositoryProps {
  leadStatus: string;
  propertyAddress: string;
  propertyType?: string;
  leadScore: number;
}

export const CallScriptsRepository: React.FC<CallScriptsRepositoryProps> = ({ 
  leadStatus, 
  propertyAddress, 
  propertyType, 
  leadScore 
}) => {
  
  const getScript = () => {
    if (leadScore > 80) {
      return `Hi, I'm calling about ${propertyAddress}. Given your high portfolio activity, I wanted to discuss potential off-market opportunities for your ${propertyType || 'property'}.`;
    }
    if (leadStatus === 'qualified') {
      return `Following up on our recent communication regarding ${propertyAddress}. Are you still considering options for this property?`;
    }
    return `I'm reaching out to property owners in the area regarding ${propertyAddress}. Are you open to discussing potential acquisition or management services?`;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-cyan-600" />
        Suggested Call Scripts
      </h2>
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-700 italic">
          {getScript()}
        </p>
      </div>
    </div>
  );
};
