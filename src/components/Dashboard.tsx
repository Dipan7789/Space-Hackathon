import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Shield, Zap, Database, Activity, AlertTriangle, Fuel } from 'lucide-react';

interface Props {
  stats: any;
  risks: any[];
  objects: any[];
}

export const Dashboard: React.FC<Props> = ({ stats, risks, objects }) => {
  const satellites = objects.filter(o => o.type === 'satellite');
  const fuelData = satellites.map(s => ({ name: s.id, fuel: s.fuel }));

  const riskRadarData = [
    { subject: 'Proximity', A: risks.length > 0 ? 80 : 20, fullMark: 100 },
    { subject: 'Velocity', A: 65, fullMark: 100 },
    { subject: 'Density', A: 45, fullMark: 100 },
    { subject: 'Maneuverability', A: 90, fullMark: 100 },
    { subject: 'Communication', A: 85, fullMark: 100 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 h-full overflow-y-auto">
      {/* Stats Cards */}
      <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Shield className="text-blue-400" />} label="Active Satellites" value={stats.satellites} />
        <StatCard icon={<Database className="text-orange-400" />} label="Tracked Debris" value={stats.debris} />
        <StatCard icon={<Activity className="text-green-400" />} label="Sim Time (s)" value={Math.floor(stats.time)} />
        <StatCard icon={<AlertTriangle className={risks.length > 0 ? "text-red-500 animate-pulse" : "text-slate-400"} />} label="Collision Risks" value={risks.length} />
      </div>

      {/* Risk Radar */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
          <Zap size={18} className="text-yellow-400" /> Collision Risk Radar
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={riskRadarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              <Radar name="Risk" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fuel Heatmap (Area Chart) */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
          <Fuel size={18} className="text-blue-400" /> Fuel Levels
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fuelData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
              <Area type="monotone" dataKey="fuel" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maneuver Timeline / Alert Feed */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm overflow-hidden flex flex-col">
        <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
          <Activity size={18} className="text-purple-400" /> Event Log
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono">
          {risks.map((r, i) => (
            <div key={i} className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400">
              [CRITICAL] Potential collision: {r.obj1Id} & {r.obj2Id}
            </div>
          ))}
          {fuelData.filter(f => f.fuel < 20).map((f, i) => (
            <div key={i} className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400">
              [WARNING] Low fuel: {f.name} ({f.fuel.toFixed(1)}kg)
            </div>
          ))}
          <div className="p-2 bg-slate-800/50 rounded text-slate-400">
            [INFO] System nominal. Propagating orbits...
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm flex items-center gap-4">
    <div className="p-3 bg-slate-800 rounded-lg">{icon}</div>
    <div>
      <p className="text-slate-400 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-slate-100 text-xl font-bold">{value}</p>
    </div>
  </div>
);
