import React, { useState } from 'react';
import client from '../api/client';
import QueryInput from '../components/agent/QueryInput';
import AgentResponse from '../components/agent/AgentResponse';
import { Loader, Terminal, HelpCircle, AlertTriangle } from 'lucide-react';

const AgentConsole = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleQuerySubmit = async (queryText) => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      // POST to `/api/agent/query`
      const res = await client.post('/api/agent/query', { query: queryText });
      setResponse(res.data);
    } catch (err) {
      console.error("Agent query failed:", err);
      setError("The Eko Claw agent encountered an issue formulating a response. Check that your Google API Key is valid and the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Console Info Header */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
        <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
          <Terminal className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Eko Claw AI Console</h3>
          <p className="text-xs text-slate-400 mt-1">
            Simulate real-time merchant support interactions and inspect LangGraph routing steps
          </p>
        </div>
      </div>

      {/* Query Input section */}
      <div className="glass-card p-6 space-y-4">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-electricBlue" />
          <span>Ask Eko Claw a Merchant Query</span>
        </h4>
        <QueryInput onSubmit={handleQuerySubmit} isLoading={loading} />
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <Loader className="w-8 h-8 text-electricBlue animate-spin" />
          <div className="space-y-1">
            <p className="text-sm text-white font-bold tracking-wide">Evaluating Compliance & Ledger Rules</p>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Triggering intent parser, calculating RAG similarity thresholds, and assigning resolution SLAs...
            </p>
          </div>
        </div>
      )}

      {/* Error alert panel */}
      {error && (
        <div className="glass-card p-6 border-l-4 border-red-500 bg-red-500/5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-red-400">Agent Processing Timeout</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Output Response Section */}
      {!loading && response && (
        <div className="space-y-6">
          <h4 className="text-xs font-bold text-slate-300">Agent Execution Results</h4>
          <AgentResponse response={response} />
        </div>
      )}
    </div>
  );
};

export default AgentConsole;
