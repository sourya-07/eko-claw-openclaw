# Eko Support Operations Client Dashboard

React Single Page Application (SPA) dashboard UI for **eko_claw**, the Autonomous AI support operations agent for Eko.

## Features
- **Modern Dashboard**: Visually rich indicators detailing total anomalies, critical escalations, open operations, and resolved logs.
- **Threat Timeline**: Area charts detailing velocity and distribution of payment failures over time using Recharts.
- **Interactive Timelines**: Timelines visualizing step-by-step agent tool logs during active inquiries.
- **Kanban Board**: Drag-and-drop workflow grouping support tickets by operational state (Open, In Progress, Escalated, Resolved).
- **Manual Overrides**: Operational tools for locking wallets, changing severity, and manually assigning agents.

## Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```
   Modify `VITE_API_URL` to point to your local server:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
