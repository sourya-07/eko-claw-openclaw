import React, { useEffect, useState } from 'react';
import client from '../api/client';
import StatsCard from '../components/dashboard/StatsCard';
import AnomalyChart from '../components/dashboard/AnomalyChart';
import SeverityBadge from '../components/anomalies/SeverityBadge';
import { 
  AlertTriangle, ShieldAlert, Ticket, CheckCircle, 
  ArrowUpRight, ListCollapse, Loader, Clock 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await client.get('/api/dashboard/stats');
      setStats(res.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
      setError("Unable to connect to the backend server. Make sure it is running locally on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-400 gap-3">
        <Loader className="w-6 h-6 animate-spin text-electricBlue" />
        <span className="font-semibold">Syncing Operations Hub...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12">
        <div className="glass-card border-red-500/20 p-8 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
          <h3 className="text-white text-lg font-bold">Connection Offline</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
          <button 
            onClick={() => { setLoading(true); fetchStats(); }}
            className="px-4 py-2 bg-electricBlue hover:bg-electricBlue-hover text-white text-xs font-bold rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Anomalies"
          value={stats?.total_anomalies || 0}
          icon={AlertTriangle}
          description="Flagged suspicious payments"
          trendColor="text-blue-400"
        />
        <StatsCard
          title="Critical Alerts"
          value={stats?.critical_alerts || 0}
          icon={ShieldAlert}
          description="Awaiting immediate review"
          trendColor="text-red-400"
        />
        <StatsCard
          title="Open Tickets"
          value={stats?.open_tickets || 0}
          icon={Ticket}
          description="Active support requests"
          trendColor="text-cyan-400"
        />
        <StatsCard
          title="Resolved Today"
          value={stats?.resolved_today || 0}
          icon={CheckCircle}
          description="Total closures in last 24h"
          trendColor="text-emerald-400"
        />
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Anomaly Frequency (Last 7 Days)
            </h4>
          </div>
          <AnomalyChart data={stats?.anomalies_over_time} />
        </div>

        {/* Dynamic Summary Panel */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-slate-800/80 pb-3">
              Automated SLA Health
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Critical Response (30m)</span>
                <span className="text-emerald-400 font-bold">100% Met</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">High Response (2h)</span>
                <span className="text-emerald-400 font-bold">98.2% Met</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Medium Response (8h)</span>
                <span className="text-emerald-400 font-bold">94.5% Met</span>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-850 pt-4 mt-4">
            <Link
              to="/agent"
              className="w-full py-2.5 bg-electricBlue hover:bg-electricBlue-hover text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/20"
            >
              Open Eko Claw AI Agent Console
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Anomalies */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Recent Anomalies
            </h4>
            <Link to="/anomalies" className="text-xs text-electricBlue font-bold hover:underline">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {stats?.recent_anomalies?.map((item) => (
              <div key={item.anomaly_id} className="py-3 flex items-center justify-between text-xs gap-3">
                <div className="space-y-1 truncate">
                  <p className="text-white font-semibold truncate">{item.merchant}</p>
                  <p className="text-slate-400 font-mono text-[10px]">{item.transaction_id} • {item.type}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-slate-300 font-bold">₹{item.amount.toLocaleString('en-IN')}</span>
                  <SeverityBadge severity={item.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Recent Support Tickets
            </h4>
            <Link to="/tickets" className="text-xs text-electricBlue font-bold hover:underline">
              View Board
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {stats?.recent_tickets?.map((item) => (
              <div key={item.ticket_id} className="py-3 flex items-center justify-between text-xs gap-3">
                <div className="space-y-1 truncate">
                  <p className="text-white font-semibold truncate">"{item.query}"</p>
                  <p className="text-slate-400 font-mono text-[10px]">
                    {item.ticket_id} • {item.intent?.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {item.status?.replace('_', ' ')}
                  </span>
                  <SeverityBadge severity={item.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
