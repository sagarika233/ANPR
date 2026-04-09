import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eye, 
  Car, 
  AlertTriangle, 
  Download, 
  ChevronRight, 
  Info,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function Analytics() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('live');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/history');
        const data = await response.json();
        setHistoryData(data);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        setHistoryData(prev => [message.data, ...prev]);
      }
    };

    return () => ws.close();
  }, []);

  const stats = useMemo(() => {
    const total = historyData.length;
    const uniquePlates = new Set(historyData.map(d => d.plate)).size;
    const alerts = historyData.filter(d => d.status === 'Unauthorized' || d.status === 'Watchlist').length;
    
    return { total, uniquePlates, alerts };
  }, [historyData]);

  const chartData = useMemo(() => {
    if (timeRange === 'live') {
      // Last 24 hours grouped by 4-hour intervals
      const intervals = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
      const counts = new Array(intervals.length).fill(0);
      
      historyData.forEach(item => {
        const date = new Date(item.timestamp);
        const hour = date.getHours();
        const idx = Math.min(Math.floor(hour / 4), intervals.length - 1);
        counts[idx]++;
      });

      return intervals.map((time, i) => ({ time, value: counts[i] }));
    } else if (timeRange === '7d') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const counts = new Array(7).fill(0);
      
      historyData.forEach(item => {
        const date = new Date(item.timestamp);
        const dayIdx = date.getDay();
        counts[dayIdx]++;
      });

      // Reorder to start from 7 days ago? For simplicity just return Sun-Sat
      return days.map((time, i) => ({ time, value: counts[i] }));
    } else {
      // 30d - group by week
      const weeks = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
      const counts = new Array(4).fill(0);
      
      const now = new Date();
      historyData.forEach(item => {
        const date = new Date(item.timestamp);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const weekIdx = Math.min(Math.floor(diffDays / 7), 3);
        counts[3 - weekIdx]++; // Reverse so Wk 4 is most recent
      });

      return weeks.map((time, i) => ({ time, value: counts[i] }));
    }
  }, [historyData, timeRange]);

  const handleExportReport = () => {
    if (!chartData) return;
    
    const headers = ['Timeframe', 'Detection Count'];
    const csvContent = [
      headers.join(','),
      ...chartData.map(d => `${d.time},${d.value}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lpr_analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTimeRangeLabel = () => {
    switch(timeRange) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      default: return 'Last 24 Hours';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-primary font-headline font-bold uppercase tracking-[0.2em] text-[10px] mb-2 block">System Pulse</span>
          <h1 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface">LPR Analytics</h1>
        </div>
        <div className="flex gap-3">
          <div 
            onClick={() => {
              const ranges = ['live', '7d', '30d'];
              const nextIndex = (ranges.indexOf(timeRange) + 1) % ranges.length;
              setTimeRange(ranges[nextIndex]);
            }}
            className="glass-panel px-4 py-2 rounded-xl border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all select-none"
          >
            <Calendar size={14} className="text-primary" />
            <span className="text-sm font-medium text-on-surface-variant font-body">{getTimeRangeLabel()}</span>
          </div>
          <button 
            onClick={handleExportReport}
            className="bg-surface-bright/50 hover:bg-surface-bright transition-colors text-white px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 text-sm"
          >
            <Download size={14} />
            Export Report
          </button>
        </div>
      </header>

      {/* Key Metrics Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Detections Card */}
        <div className="relative glass-panel rounded-xl p-8 border border-white/5 overflow-hidden group">
          <div className="hud-bracket hud-bracket-tl"></div><div className="hud-bracket hud-bracket-tr"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Eye className="text-primary" size={24} />
            </div>
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">+12.5%</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Total Detections</p>
          <h3 className="text-5xl font-black font-headline text-white mb-2 tabular-nums">
            {isLoading ? '...' : stats.total.toLocaleString()}
          </h3>
          <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: '75%' }}></div>
          </div>
        </div>

        {/* Unique Vehicles Card */}
        <div className="relative glass-panel rounded-xl p-8 border border-white/5 overflow-hidden group">
          <div className="hud-bracket hud-bracket-tl"></div><div className="hud-bracket hud-bracket-tr"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="bg-tertiary/10 p-3 rounded-xl">
              <Car className="text-tertiary" size={24} />
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">Steady</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Unique Vehicles</p>
          <h3 className="text-5xl font-black font-headline text-white mb-2 tabular-nums">
            {isLoading ? '...' : stats.uniquePlates.toLocaleString()}
          </h3>
          <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
            <div className="h-full bg-tertiary" style={{ width: '45%' }}></div>
          </div>
        </div>

        {/* Alerts Today Card */}
        <div className="relative glass-panel rounded-xl p-8 border border-white/5 overflow-hidden group">
          <div className="hud-bracket hud-bracket-tl"></div><div className="hud-bracket hud-bracket-tr"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="bg-error/10 p-3 rounded-xl">
              <AlertTriangle className="text-error" size={24} />
            </div>
            <span className="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-full">High Risk</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Security Alerts</p>
          <h3 className="text-5xl font-black font-headline text-white mb-2 tabular-nums">
            {isLoading ? '...' : stats.alerts.toLocaleString()}
          </h3>
          <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
            <div className="h-full bg-error w-[20%]"></div>
          </div>
        </div>
      </section>

      {/* Main Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Detections Over Time */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-8 border border-white/5 relative">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-xl font-bold text-white font-headline">Detection Velocity</h4>
              <p className="text-sm text-on-surface-variant">Real-time throughput metrics ({getTimeRangeLabel()})</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setTimeRange('live')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${timeRange === 'live' ? 'bg-primary-container text-white' : 'hover:bg-white/5 text-slate-400'}`}
              >
                Live
              </button>
              <button 
                onClick={() => setTimeRange('7d')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${timeRange === '7d' ? 'bg-primary-container text-white' : 'hover:bg-white/5 text-slate-400'}`}
              >
                7d
              </button>
              <button 
                onClick={() => setTimeRange('30d')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${timeRange === '30d' ? 'bg-primary-container text-white' : 'hover:bg-white/5 text-slate-400'}`}
              >
                30d
              </button>
            </div>
          </div>
          
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006aff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#006aff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#c2c6d8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ dy: 10 }}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f3266', border: '1px solid #006aff', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  labelStyle={{ color: '#b2c5ff', fontSize: '10px', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#006aff" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Vehicle Frequency/Type */}
        <div className="glass-panel rounded-xl p-8 border border-white/5">
          <h4 className="text-xl font-bold text-white font-headline mb-1">Vehicle Classification</h4>
          <p className="text-sm text-on-surface-variant mb-8">Distribution of detected types</p>
          <div className="space-y-6">
            {[
              { label: 'Sedan/Compact', value: 64, color: 'from-blue-600 to-indigo-600' },
              { label: 'SUV/Truck', value: 22, color: 'from-purple-500 to-secondary-container' },
              { label: 'Commercial', value: 9, color: 'from-cyan-400 to-tertiary-container' },
              { label: 'Motorcycle', value: 5, color: 'from-slate-500 to-slate-600' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-on-surface">{item.label}</span>
                  <span className="text-primary">{item.value}%</span>
                </div>
                <div className="w-full h-3 bg-surface-highest rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 p-4 rounded-xl bg-surface-highest border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Info size={16} className="text-blue-500" />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              AI Confidence Score is averaging <strong>98.4%</strong> across all types.
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Insights: Frequent Visitors */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 md:pb-0">
        <div className="glass-panel rounded-xl p-8 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-white font-headline">Flagged Entities</h4>
            <span className="text-[10px] font-bold text-error uppercase tracking-widest px-2 py-1 bg-error/10 rounded">Priority Watch</span>
          </div>
          <div className="space-y-4">
            {historyData.filter(d => d.status === 'Unauthorized' || d.status === 'Watchlist').slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-surface-highest rounded-xl hover:bg-surface-bright transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="bg-surface-bright px-3 py-1 rounded border border-white/10 font-bold text-white tracking-wider">{item.plate}</div>
                  <div>
                    <p className="text-sm font-bold text-white">{item.location || 'Unknown Location'}</p>
                    <p className="text-xs text-on-surface-variant">Last seen: {new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-on-surface-variant" />
              </div>
            ))}
            {historyData.filter(d => d.status === 'Unauthorized' || d.status === 'Watchlist').length === 0 && (
              <p className="text-center text-on-surface-variant text-sm py-4">No high-priority alerts today.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
