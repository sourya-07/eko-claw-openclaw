import React, { useState } from 'react';
import { Send, Sparkles, Terminal } from 'lucide-react';

const QueryInput = ({ onSubmit, isLoading }) => {
  const [query, setQuery] = useState('');

  const suggestions = [
    "Insufficient funds error 51 on UPI app, what to say?",
    "How long for a Gold tier onboarding to get approval?",
    "UPI server gateway has crashed, all transactions timeout!",
    "Merchant Aadhaar biometric scanner fingerprint mismatch error."
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit(query.trim());
    setQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-slate-900 border border-slate-800 focus-within:border-electricBlue rounded-xl p-2 transition-all duration-150">
          <Terminal className="w-5 h-5 text-slate-500 ml-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder="Query Eko Claw agent (e.g. UPI failures, KYC issues, timeouts)..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-3 py-2 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="p-2.5 rounded-lg bg-electricBlue hover:bg-electricBlue-hover disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="dot-flashing" />
              </div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      {/* Suggested prompts */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-electricBlue" />
          <span>Recommended Queries to Test Heuristics & Agent Logic</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => setQuery(s)}
              className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-750 bg-slate-900/35 hover:bg-slate-900/60 text-xs text-slate-400 hover:text-white transition-all text-left"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QueryInput;
