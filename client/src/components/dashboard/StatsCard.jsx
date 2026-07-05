import React from 'react';

const StatsCard = ({ title, value, icon: Icon, description, trendColor }) => {
  return (
    <div className="glass-card p-6 glass-card-hover flex items-center justify-between">
      <div className="space-y-2">
        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
          {title}
        </span>
        <h3 className="text-3xl font-extrabold text-white tracking-tight leading-none">
          {value}
        </h3>
        {description && (
          <span className="text-[10px] text-slate-400 font-semibold block">
            {description}
          </span>
        )}
      </div>
      <div className={`p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 ${trendColor || 'text-electricBlue'}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};

export default StatsCard;
