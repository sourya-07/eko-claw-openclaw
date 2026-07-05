import React from 'react';

const SeverityBadge = ({ severity }) => {
  const getStyles = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/25';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25';
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
    }
  };

  return (
    <span className={`px-2 py-1 text-[11px] font-bold uppercase rounded-md border tracking-wider ${getStyles(severity)}`}>
      {severity}
    </span>
  );
};

export default SeverityBadge;
