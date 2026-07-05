import React from 'react';
import { useLocation } from 'react-router-dom';
import { Wifi, Shield, Server } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  const getPageTitle = (path) => {
    switch (path) {
      case '/':
        return 'Dashboard Summary';
      case '/anomalies':
        return 'Anomaly Center';
      case '/tickets':
        return 'Operations Support Tickets';
      case '/agent':
        return 'Agent Console Gateway';
      default:
        return 'eko_claw Console';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-darkNavy-dark/40 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide">
          {getPageTitle(location.pathname)}
        </h2>
      </div>

      {/* Top right details */}
      <div className="flex items-center gap-6">
        {/* System Health Indicators */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>FastAPI: Online</span>
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Security: Active</span>
          </span>
        </div>

        {/* Network status */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-6">
          <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">Local Node</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
