import React, { useEffect, useState } from 'react';
import client from '../api/client';
import AnomalyTable from '../components/anomalies/AnomalyTable';
import { Loader, Filter, Search, ShieldAlert } from 'lucide-react';

const Anomalies = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAnomalies();
  }, [severityFilter, statusFilter]);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      let url = '/api/anomalies/';
      const params = {};
      if (severityFilter !== 'ALL') params.severity = severityFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      
      const res = await client.get(url, { params });
      setAnomalies(res.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching anomalies:", err);
      setError("Failed to fetch anomalies. Please verify that the server is online.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (anomalyId, newStatus) => {
    try {
      const res = await client.post(`/api/anomalies/${anomalyId}/status`, null, {
        params: { status: newStatus }
      });
      setAnomalies((prev) =>
        prev.map((item) =>
          item.anomaly_id === anomalyId ? res.data : item
        )
      );
    } catch (err) {
      console.error("Failed to update anomaly status:", err);
      alert("Failed to update status on server. Please verify connection.");
    }
  };

  const filteredAnomalies = anomalies.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.merchant.toLowerCase().includes(term) ||
      item.anomaly_id.toLowerCase().includes(term) ||
      item.transaction_id.toLowerCase().includes(term) ||
      item.type.toLowerCase().includes(term)
    );
  });

  if (loading && anomalies.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-400 gap-3">
        <Loader className="w-6 h-6 animate-spin text-electricBlue" />
        <span className="font-semibold">Querying Anomaly Ledgers...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title & Stats */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Threat & Failure Logs</h3>
          <p className="text-xs text-slate-400 mt-1">Autonomous payment audits & biometric mismatch telemetry</p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Merchant, Txn ID, Anomaly ID..."
            className="w-full text-xs bg-slate-900 border border-slate-800 focus:border-electricBlue rounded-lg pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none"
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-3 py-1">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-300 py-1.5 focus:outline-none cursor-pointer font-semibold"
          >
            <option value="ALL">All Threat Severities</option>
            <option value="LOW">LOW Severity</option>
            <option value="MEDIUM">MEDIUM Severity</option>
            <option value="HIGH">HIGH Severity</option>
            <option value="CRITICAL">CRITICAL Severity</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-3 py-1">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-300 py-1.5 focus:outline-none cursor-pointer font-semibold"
          >
            <option value="ALL">All Review Statuses</option>
            <option value="OPEN">OPEN / Active</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="glass-card border-red-500/20 p-8 text-center text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <AnomalyTable 
          anomalies={filteredAnomalies} 
          onStatusChange={handleStatusChange} 
        />
      )}
    </div>
  );
};

export default Anomalies;
