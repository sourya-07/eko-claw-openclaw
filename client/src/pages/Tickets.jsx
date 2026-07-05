import React, { useEffect, useState } from 'react';
import client from '../api/client';
import TicketList from '../components/tickets/TicketList';
import TicketDetail from '../components/tickets/TicketDetail';
import { Loader, Info, Search, RefreshCw } from 'lucide-react';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await client.get('/api/tickets/');
      setTickets(res.data);
      setError(null);
    } catch (err) {
      console.error("Error loading tickets:", err);
      setError("Failed to sync ticket registry. Please ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateTicket = async (ticketId, escalationData) => {
    try {
      // POST to `/api/tickets/{id}/escalate`
      const res = await client.post(`/api/tickets/${ticketId}/escalate`, {
        reason: escalationData.reason,
        severity: escalationData.severity,
      });
      
      // Update local state
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticketId ? res.data : t))
      );
      
      // Update selected ticket drawer
      setSelectedTicket(res.data);
    } catch (err) {
      console.error("Failed to escalate ticket:", err);
      alert("Escalation failed. Please verify connection and parameters.");
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      const res = await client.post(`/api/tickets/${ticketId}/resolve`);
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticketId ? res.data : t))
      );
      setSelectedTicket(res.data);
    } catch (err) {
      console.error("Failed to resolve ticket:", err);
      alert("Resolution failed. Please verify connection.");
    }
  };

  const handleStartWorking = async (ticketId) => {
    try {
      const res = await client.post(`/api/tickets/${ticketId}/inprogress`);
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticketId ? res.data : t))
      );
      setSelectedTicket(res.data);
    } catch (err) {
      console.error("Failed to start progress on ticket:", err);
      alert("Failed to move ticket to In Progress. Please verify connection.");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const queryLower = t.query.toLowerCase();
    const idLower = t.ticket_id.toLowerCase();
    const intentLower = t.intent.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    return (
      queryLower.includes(searchLower) ||
      idLower.includes(searchLower) ||
      intentLower.includes(searchLower)
    );
  });

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-400 gap-3">
        <Loader className="w-6 h-6 animate-spin text-electricBlue" />
        <span className="font-semibold">Loading Kanban Boards...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto relative min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Operations Board</h3>
          <p className="text-xs text-slate-400 mt-1">Manage active escalations, support assignments, and SLA response targets</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID or details..."
              className="w-full text-xs bg-slate-900 border border-slate-800 focus:border-electricBlue rounded-lg pl-9 pr-4 py-2 focus:outline-none"
            />
          </div>
          <button
            onClick={fetchTickets}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-lg text-slate-400 transition-colors"
            title="Refresh tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="glass-card border-red-500/20 p-8 text-center text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <TicketList 
          tickets={filteredTickets} 
          onSelectTicket={setSelectedTicket} 
        />
      )}

      {/* Ticket Detail Drawer Overlay */}
      {selectedTicket && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedTicket(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          />
          <TicketDetail
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onEscalate={handleEscalateTicket}
            onResolve={handleResolveTicket}
            onStartWorking={handleStartWorking}
          />
        </>
      )}
    </div>
  );
};

export default Tickets;
