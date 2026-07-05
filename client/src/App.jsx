import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Dashboard from './pages/Dashboard';
import Anomalies from './pages/Anomalies';
import Tickets from './pages/Tickets';
import AgentConsole from './pages/AgentConsole';

function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header Navbar */}
          <Navbar />

          {/* Subpage View scrollable */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/anomalies" element={<Anomalies />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/agent" element={<AgentConsole />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
