import React, { useState, useEffect } from 'react';
import { OrbitalView } from './components/OrbitalView';
import { WorldMap } from './components/WorldMap';
import { Dashboard } from './components/Dashboard';
import { Satellite, Shield, Globe, LayoutDashboard, Settings, Activity } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<any>({ satellites: 0, debris: 0, time: 0 });
  const [risks, setRisks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'dash'>('3d');

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Step simulation
        const stepRes = await fetch('/api/simulate/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dt: 60 }) // 1 minute per step
        });
        
        if (!stepRes.ok) {
          const errorText = await stepRes.text();
          throw new Error(`Server error (${stepRes.status}): ${errorText.substring(0, 100)}`);
        }

        const stepData = await stepRes.json();
        setRisks(stepData.risks);
        setStats({ ...stepData.stats, time: stepData.currentTime });

        // Get snapshot for visualization
        const snapRes = await fetch('/api/visualization/snapshot');
        if (!snapRes.ok) throw new Error(`Snapshot error (${snapRes.status})`);
        
        const snapData = await snapRes.json();
        setData(snapData);
      } catch (err) {
        console.error("Simulation error:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <Activity className="animate-spin text-blue-500" size={48} />
          <p className="animate-pulse">Initializing Autonomous Constellation Manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Satellite size={24} />
          </div>
          <h1 className="font-bold text-xl hidden md:block tracking-tight">ACM <span className="text-blue-500">v1.0</span></h1>
        </div>

        <nav className="flex flex-col gap-2">
          <NavButton active={activeTab === '3d'} onClick={() => setActiveTab('3d')} icon={<Shield size={20} />} label="Orbital View" />
          <NavButton active={activeTab === '2d'} onClick={() => setActiveTab('2d')} icon={<Globe size={20} />} label="Ground Tracks" />
          <NavButton active={activeTab === 'dash'} onClick={() => setActiveTab('dash')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavButton active={false} onClick={() => {}} icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="mt-auto p-4 bg-slate-800/50 rounded-xl hidden md:block border border-slate-700">
          <p className="text-xs text-slate-400 uppercase font-bold mb-2">System Status</p>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Autonomous
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md">
          <h2 className="text-lg font-medium text-slate-300">
            {activeTab === '3d' ? '3D Orbital Visualization' : activeTab === '2d' ? 'Ground Track Map' : 'System Analytics'}
          </h2>
          <div className="flex items-center gap-4 text-sm font-mono text-slate-400">
            <span>EPOCH: {new Date(stats.time * 1000).toISOString()}</span>
            <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">LIVE</span>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          {activeTab === '3d' && <OrbitalView objects={data.objects} />}
          {activeTab === '2d' && <WorldMap objects={data.objects} />}
          {activeTab === 'dash' && <Dashboard stats={stats} risks={risks} objects={data.objects} />}
        </div>
      </main>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="font-medium hidden md:block">{label}</span>
  </button>
);
