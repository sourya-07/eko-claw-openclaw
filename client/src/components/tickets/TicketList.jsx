import React from 'react';
import SeverityBadge from '../anomalies/SeverityBadge';
import { Calendar, User, ArrowUpRight, CheckCircle2, Ticket } from 'lucide-react';

const TicketList = ({ tickets, onSelectTicket }) => {
  const columns = [
    { id: 'OPEN', title: 'Open', color: 'border-blue-500/30 text-blue-400 bg-blue-500/5' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' },
    { id: 'ESCALATED', title: 'Escalated', color: 'border-red-500/30 text-red-400 bg-red-500/5' },
    { id: 'RESOLVED', title: 'Resolved', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' },
  ];

  const getTicketsByStatus = (status) => {
    return tickets.filter((t) => t.status?.toUpperCase() === status.toUpperCase());
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {columns.map((col) => {
        const colTickets = getTicketsByStatus(col.id);
        return (
          <div key={col.id} className="flex flex-col h-[calc(100vh-220px)] min-w-[250px]">
            {/* Column Header */}
            <div className={`p-4 border rounded-t-xl flex items-center justify-between font-bold text-sm tracking-wide ${col.color}`}>
              <div className="flex items-center gap-2">
                <span>{col.title}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-slate-800 border border-slate-700/50">
                  {colTickets.length}
                </span>
              </div>
            </div>

            {/* Column Body / Scrollable */}
            <div className="flex-1 bg-slate-900/10 border-x border-b border-slate-800/80 rounded-b-xl p-3 space-y-3 overflow-y-auto min-h-[150px]">
              {colTickets.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No tickets
                </div>
              ) : (
                colTickets.map((ticket) => (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => onSelectTicket(ticket)}
                    className="glass-card p-4 cursor-pointer hover:border-slate-700/85 hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
                  >
                    {/* Severity highlight border */}
                    <div 
                      className={`absolute top-0 left-0 w-1 h-full ${
                        ticket.severity === 'CRITICAL' ? 'bg-red-500' :
                        ticket.severity === 'HIGH' ? 'bg-orange-500' :
                        ticket.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                    />

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400 group-hover:text-electricBlue transition-colors">
                        {ticket.ticket_id}
                      </span>
                      <SeverityBadge severity={ticket.severity} />
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 mb-4 leading-relaxed group-hover:text-white transition-colors">
                      {ticket.query}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-800/50 pt-2.5">
                      <span className="flex items-center gap-1 text-slate-400">
                        <User className="w-3.5 h-3.5 text-electricBlue/70" />
                        <span className="truncate max-w-[90px]">{ticket.assigned_to || 'Unassigned'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>{formatDate(ticket.created_at)}</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TicketList;
