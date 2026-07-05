import React, { useState } from 'react';
import SeverityBadge from '../anomalies/SeverityBadge';
import { X, User, Calendar, ShieldAlert, ArrowUpRight, CheckCircle } from 'lucide-react';

const TicketDetail = ({ ticket, onClose, onEscalate, onResolve }) => {
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationSeverity, setEscalationSeverity] = useState(ticket.severity || 'HIGH');
  const [showEscalateForm, setShowEscalateForm] = useState(false);

  if (!ticket) return null;

  const handleEscalateSubmit = (e) => {
    e.preventDefault();
    if (!escalationReason.trim()) return;
    onEscalate(ticket.ticket_id, {
      reason: escalationReason,
      severity: escalationSeverity,
    });
    setEscalationReason('');
    setShowEscalateForm(false);
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col h-full transform transition-transform duration-300">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-electricBlue">{ticket.ticket_id}</span>
          <SeverityBadge severity={ticket.severity} />
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Ticket Query */}
        <div className="space-y-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Merchant Inquiry</span>
          <h3 className="text-white font-semibold text-base leading-relaxed bg-slate-800/20 border border-slate-800/80 rounded-xl p-4">
            "{ticket.query}"
          </h3>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-800/10 border border-slate-800/30 p-4 rounded-xl">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Intent Category</span>
            <span className="text-sm font-bold text-slate-200 block mt-0.5">{ticket.intent}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Assigned Owner</span>
            <span className="text-sm font-semibold text-slate-200 block mt-0.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-electricBlue" />
              {ticket.assigned_to || 'Support Staff'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Created On</span>
            <span className="text-xs text-slate-300 block mt-0.5">{formatDate(ticket.created_at)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Last Updated</span>
            <span className="text-xs text-slate-300 block mt-0.5">{formatDate(ticket.updated_at)}</span>
          </div>
        </div>

        {/* Escalation Trace */}
        {ticket.escalation_note && (
          <div className="space-y-2">
            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Escalation History & Logs</span>
            </span>
            <pre className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-xs text-red-300/80 font-mono whitespace-pre-wrap leading-relaxed">
              {ticket.escalation_note}
            </pre>
          </div>
        )}

        {/* Actions Form */}
        {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
          <div className="pt-4 border-t border-slate-800 space-y-4">
            {!showEscalateForm ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEscalateForm(true)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-950/40 hover:bg-red-950/60 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  Escalate Support Ticket
                </button>
                <button
                  onClick={() => onResolve(ticket.ticket_id)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Resolved
                </button>
              </div>
            ) : (
              <form onSubmit={handleEscalateSubmit} className="bg-slate-800/15 border border-slate-850 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-slate-200">Escalate Issue Details</h4>
                  <button 
                    type="button"
                    onClick={() => setShowEscalateForm(false)}
                    className="text-[10px] text-slate-500 font-bold hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Escalation Reason</label>
                  <textarea
                    required
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Provide operational reason (e.g. high balance hold, customer escalation)..."
                    className="w-full text-xs bg-slate-900 border border-slate-800 focus:border-electricBlue rounded-lg p-2.5 text-slate-200 focus:outline-none min-h-[70px] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Assign Escalation Severity</label>
                  <select
                    value={escalationSeverity}
                    onChange={(e) => setEscalationSeverity(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 focus:border-electricBlue rounded-lg p-2.5 text-slate-200 focus:outline-none"
                  >
                    <option value="LOW">LOW Severity</option>
                    <option value="MEDIUM">MEDIUM Severity</option>
                    <option value="HIGH">HIGH Severity</option>
                    <option value="CRITICAL">CRITICAL Severity</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Confirm Escalation
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetail;
