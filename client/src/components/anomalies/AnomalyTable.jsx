import React, { useState } from 'react';
import SeverityBadge from './SeverityBadge';
import { Calendar, DollarSign, ArrowRight, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

const AnomalyTable = ({ anomalies, onStatusChange }) => {
  const [expandedId, setExpandedId] = useState(null);

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'RESOLVED':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'UNDER_REVIEW':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
    }
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (anomalies.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <ShieldAlert className="w-10 h-10 text-slate-600 animate-pulse" />
        <p className="font-semibold text-lg">No anomalies found</p>
        <p className="text-sm text-slate-500">All payment nodes are currently operating within parameters.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-900/40">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Merchant</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {anomalies.map((item) => {
              const isExpanded = expandedId === item.anomaly_id;
              return (
                <React.Fragment key={item.anomaly_id}>
                  <tr 
                    onClick={() => toggleExpand(item.anomaly_id)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-slate-800/25 ${
                      isExpanded ? 'bg-slate-800/10' : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-xs font-bold text-electricBlue">
                      {item.anomaly_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-white">
                      {item.merchant}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {item.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-mono">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {formatDate(item.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-semibold capitalize text-slate-300">
                        {getStatusIcon(item.status)}
                        <span>{item.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-8 py-5 bg-slate-900/30 border-b border-slate-800/80">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Details */}
                          <div className="md:col-span-2 space-y-3">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Description</span>
                              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{item.description}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recommended Action</span>
                              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-xs text-orange-300/90 leading-relaxed mt-1 flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                <span>{item.recommended_action}</span>
                              </div>
                            </div>
                          </div>
                          {/* Parameters */}
                          <div className="space-y-4 border-l border-slate-800/80 pl-6 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Transaction ID</span>
                                <span className="font-mono text-xs text-slate-300 font-semibold">{item.transaction_id}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Severity Score Rating</span>
                                <span className="text-xs font-semibold text-slate-300 capitalize">{item.severity} Level Threat</span>
                              </div>
                            </div>

                            {/* Actions */}
                            {onStatusChange && item.status !== 'RESOLVED' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(item.anomaly_id, 'RESOLVED');
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors duration-150 shadow-md shadow-emerald-950/20"
                                >
                                  Mark Resolved
                                </button>
                                {item.status === 'OPEN' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onStatusChange(item.anomaly_id, 'UNDER_REVIEW');
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors duration-150"
                                  >
                                    Set Under Review
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnomalyTable;
