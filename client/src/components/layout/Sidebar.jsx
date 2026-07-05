import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Ticket, Terminal, ShieldAlert } from 'lucide-react';

const Sidebar = () => {
  const links = [
    { to: '/', name: 'Dashboard', icon: LayoutDashboard },
    { to: '/anomalies', name: 'Anomaly Detection', icon: AlertTriangle },
    { to: '/tickets', name: 'Support Tickets', icon: Ticket },
    { to: '/agent', name: 'Agent Console', icon: Terminal },
  ];

  return (
    <aside className="w-64 bg-darkNavy-dark border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0">
      <div className="flex flex-col">
        {/* Header Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <ShieldAlert className="text-electricBlue w-6 h-6 glow-indicator rounded-full" />
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">eko_claw</h1>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Support Ops AI</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 px-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 gap-3 ${
                    isActive
                      ? 'bg-electricBlue text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{link.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Details */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/25">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-electricBlue">
            EC
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Eko Agent Node</p>
            <p className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online / Offline-Safe
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
