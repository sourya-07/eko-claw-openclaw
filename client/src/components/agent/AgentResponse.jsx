import React from 'react';
import SeverityBadge from '../anomalies/SeverityBadge';
import { 
  Terminal, ShieldCheck, Ticket, AlertTriangle, 
  Settings, Database, CheckCircle2, UserCheck 
} from 'lucide-react';

const AgentResponse = ({ response }) => {
  if (!response) return null;

  const { query, intent, severity, outcome, ticket_id, response_given, reasoning_trace } = response;

  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'classify_intent':
        return <Terminal className="w-4 h-4 text-purple-400" />;
      case 'classify_severity':
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case 'search_knowledge_base':
        return <Database className="w-4 h-4 text-yellow-400" />;
      case 'create_ticket':
        return <Ticket className="w-4 h-4 text-cyan-400" />;
      case 'escalate_issue':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'log_interaction':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <Settings className="w-4 h-4 text-slate-400" />;
    }
  };

  const getOutcomeBadge = (out) => {
    switch (out?.toUpperCase()) {
      case 'ANSWERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'TICKETED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ESCALATED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Status Bar */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Outcome</span>
            <span className={`px-2.5 py-0.5 text-xs font-extrabold rounded-md border tracking-wider capitalize ${getOutcomeBadge(outcome)}`}>
              {outcome}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Intent</span>
            <span className="text-xs font-bold text-slate-300 capitalize">{intent?.replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Severity</span>
            <SeverityBadge severity={severity} />
          </div>
        </div>

        {ticket_id && (
          <div className="bg-electricBlue/10 border border-electricBlue/20 rounded-lg px-4 py-1.5 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-electricBlue" />
            <div className="text-right">
              <span className="text-[9px] text-slate-400 font-bold block">CREATED TICKET</span>
              <span className="font-mono text-xs font-bold text-white">{ticket_id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Agent Answer */}
      <div className="glass-card p-6 border-l-4 border-electricBlue space-y-3 bg-slate-900/15">
        <span className="text-[10px] text-electricBlue font-extrabold uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 animate-pulse" />
          <span>Eko Claw Response</span>
        </span>
        <p className="text-white text-sm leading-relaxed font-medium">
          {response_given}
        </p>
      </div>

      {/* Reasoning Trace timeline */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Settings className="w-4 h-4 text-slate-500 animate-spin" style={{ animationDuration: '6s' }} />
          <h4 className="text-xs font-bold text-slate-200">Autonomous Reasoning Trace Flow</h4>
        </div>

        <div className="relative pl-6 border-l-2 border-slate-800/80 space-y-6 py-2 ml-3">
          {reasoning_trace?.map((step, idx) => (
            <div key={idx} className="relative">
              {/* Tool Icon anchor */}
              <span className="absolute -left-[35px] top-1 bg-slate-900 border border-slate-850 p-1.5 rounded-lg flex items-center justify-center shadow-lg shadow-black/30">
                {getToolIcon(step.tool)}
              </span>

              {/* Step info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200 font-mono">
                    {step.tool}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                    Step {idx + 1}
                  </span>
                </div>

                {/* Sub arguments and returns */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 text-[11px] font-mono space-y-2 max-w-full overflow-hidden">
                  {step.args && Object.keys(step.args).length > 0 && (
                    <div>
                      <span className="text-slate-500 block font-bold text-[9px] uppercase tracking-wider mb-1">ARGS:</span>
                      <span className="text-purple-300 break-words">{JSON.stringify(step.args)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block font-bold text-[9px] uppercase tracking-wider mb-1">RETURN:</span>
                    <span className="text-emerald-300 break-words">{JSON.stringify(step.result)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentResponse;
