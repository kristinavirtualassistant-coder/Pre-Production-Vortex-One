import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  AlertTriangle,
  FileText,
  UserCheck,
} from 'lucide-react';
import { ApprovalRequest } from '../types';

interface ApprovalsViewProps {
  approvals: ApprovalRequest[];
  onDecideApproval: (id: string, decision: 'approve' | 'reject' | 'modify', modifications?: any) => Promise<any>;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  onDecideApproval,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'decided'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingList = approvals.filter((a) => a.status === 'pending');
  const decidedList = approvals.filter((a) => a.status !== 'pending');

  const handleAction = async (id: string, decision: 'approve' | 'reject' | 'modify') => {
    setProcessingId(id);
    try {
      await onDecideApproval(id, decision);
    } catch (err) {
      console.error('Approval action error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 font-bold">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Human Approval &amp; Governance Center</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Step 4 in Workflow
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Sub-Agent 7 (Compliance &amp; Risk) gatekeeper enforcing operator sign-off on bulk outreach, high-risk actions, and external mutations.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>Pending Review</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
              {pendingList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('decided')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'decided'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            History &amp; Audit ({decidedList.length})
          </button>
        </div>
      </div>

      {/* Plain-English Easy Explainer Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-xs">
            🛡️
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">Why Approvals Keep You Safe:</h4>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              Vortex One operates with <strong>Human-in-the-Loop governance</strong>. AI agents will never send cold emails, text messages, or trigger dialer campaigns without your green light. Review each prepared campaign below and click <strong>Approve</strong> to send or <strong>Reject</strong> to cancel.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0 text-[11px]">
          <span className="bg-white/80 border border-amber-200 px-2.5 py-1 rounded-md text-amber-800 font-semibold">
            🔒 Operator Control
          </span>
          <span className="bg-white/80 border border-amber-200 px-2.5 py-1 rounded-md text-amber-800 font-semibold">
            ⚖️ TCPA Enforced
          </span>
        </div>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {activeTab === 'pending' && (
          <>
            {pendingList.map((appr) => (
              <div
                key={appr.approval_id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs hover:border-amber-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {appr.risk_level} Risk
                    </span>
                    <span className="text-xs font-mono text-slate-500">{appr.approval_id}</span>
                    <span className="text-xs text-slate-500">• Proposed by {appr.proposed_by}</span>
                  </div>

                  <span className="text-xs text-slate-500">
                    Created: {new Date(appr.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{appr.description}</h3>
                  <p className="text-xs text-slate-600 mt-1">{appr.reason}</p>
                </div>

                {appr.issues && appr.issues.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                    <div className="font-semibold flex items-center space-x-1.5 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Compliance Review Flags:</span>
                    </div>
                    {appr.issues.map((issue, idx) => (
                      <div key={idx} className="text-[11px] text-amber-800 pl-5">
                        • {issue}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => handleAction(appr.approval_id, 'reject')}
                    disabled={processingId === appr.approval_id}
                    className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border border-rose-200 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reject Action</span>
                  </button>

                  <button
                    onClick={() => handleAction(appr.approval_id, 'approve')}
                    disabled={processingId === appr.approval_id}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Execute</span>
                  </button>
                </div>
              </div>
            ))}

            {pendingList.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2 shadow-xs">
                <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No Pending Approvals</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All multi-agent workflows are currently compliant. When Sub-Agent 7 flags high-risk or bulk operations, they will appear here for sign-off.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'decided' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Action ID &amp; Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Decided By</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {decidedList.map((appr) => (
                  <tr key={appr.approval_id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-cyan-700 font-medium">{appr.approval_id}</td>
                    <td className="py-3 px-4 text-slate-800">{appr.description}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          appr.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {appr.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{appr.decided_by || 'Operator'}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(appr.decided_at || appr.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
