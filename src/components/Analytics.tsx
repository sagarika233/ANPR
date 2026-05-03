import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Eye, 
  Car, 
  AlertTriangle, 
  Download, 
  ChevronRight, 
  Info,
  Calendar,
  TrendingUp,
  Activity,
  Zap,
  Shield
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
import { supabase } from '../lib/supabase';

export default function Analytics() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('live');
  const [statsSummary, setStatsSummary] = useState({
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
    detectionsChange: 0,
    confidenceChange: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setStatsSummary(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

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
    fetchStats();

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);
    
    const handleNewRecord = (record: any) => {
      const formatted = {
        ...record,
        plate: record.plate_number || record.plate,
        image: record.image_url || record.image
      };
      setHistoryData(prev => [formatted, ...prev]);
      fetchStats();
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        handleNewRecord(message.data);
      }
    };

    // Supabase Real-time Fallback
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('analytics_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_records' }, (payload) => {
          handleNewRecord(payload.new);
        })
        .subscribe();
    }

    return () => {
      ws.close();
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const total = statsSummary.todayDetections;
    const uniquePlates = new Set(historyData.map(d => d.plate)).size;
    const alerts = statsSummary.watchlistHits;
    
    return { total, uniquePlates, alerts };
  }, [historyData, statsSummary]);

  const chartData = useMemo(() => {
    if (timeRange === 'live') {
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

      return days.map((time, i) => ({ time, value: counts[i] }));
    } else {
      const weeks = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
      const counts = new Array(4).fill(0);
      
      const now = new Date();
      historyData.forEach(item => {
        const date = new Date(item.timestamp);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const weekIdx = Math.min(Math.floor(diffDays / 7), 3);
        counts[3 - weekIdx]++;
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
          <p className="text-primary font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Data Overview</p>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Analytics Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <div className="bg-surface border border-surface-highest p-1 rounded-xl flex">
            {['live', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  timeRange === range 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {range === 'live' ? '24h' : range}
              </button>
            ))}
          </div>
          <button 
            onClick={handleExportReport}
            className="bg-surface border border-surface-highest hover:bg-surface-high transition-colors text-on-surface px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </header>

      {/* Key Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { 
            label: "Total Detections", 
            value: stats.total, 
            change: (statsSummary.detectionsChange || 0) === 0 ? "Live" : `${(statsSummary.detectionsChange || 0) > 0 ? '+' : ''}${(statsSummary.detectionsChange || 0).toFixed(1)}%`, 
            icon: Eye, 
            color: "text-primary", 
            bg: "bg-primary/5" 
          },
          { 
            label: "Unique Vehicles", 
            value: stats.uniquePlates, 
            change: "Stable", 
            icon: Car, 
            color: "text-tertiary", 
            bg: "bg-tertiary/5" 
          },
          { 
            label: "Security Alerts", 
            value: stats.alerts, 
            change: stats.alerts > 0 ? "Critical" : "Clear", 
            icon: AlertTriangle, 
            color: stats.alerts > 0 ? "text-error" : "text-success", 
            bg: stats.alerts > 0 ? "bg-error/5" : "bg-success/5" 
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface border border-surface-highest p-6 rounded-2xl shadow-sm relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-surface-low ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  stat.change.includes('+') ? 'bg-success/10 text-success' : 
                  stat.change === 'Critical' ? 'bg-error/10 text-error' : 'bg-surface-highest text-on-surface-variant'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-4xl font-black text-on-surface mb-1">
                {isLoading ? '...' : (stat.value ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Velocity */}
        <div className="lg:col-span-2 bg-surface border border-surface-highest rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest">Scanning Speed</h4>
              <p className="text-xs text-on-surface-variant">Scan records for {getTimeRangeLabel()}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Volume</span>
              </div>
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-highest)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--color-on-surface-variant)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ dy: 10 }}
                />
                <YAxis 
                  stroke="var(--color-on-surface-variant)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-surface)', 
                    border: '1px solid var(--color-surface-highest)', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: 'var(--color-on-surface)', fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Classification */}
        <div className="bg-surface border border-surface-highest rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-1">Vehicle Types</h4>
          <p className="text-xs text-on-surface-variant mb-8">Percentage of each vehicle type</p>
          <div className="space-y-6">
            {[
              { label: 'Sedan / Compact', value: 64, color: 'bg-primary' },
              { label: 'SUV / Truck', value: 22, color: 'bg-tertiary' },
              { label: 'Commercial', value: 9, color: 'bg-secondary' },
              { label: 'Motorcycle', value: 5, color: 'bg-on-surface-variant' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-on-surface">{item.label}</span>
                  <span className="text-on-surface-variant">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-surface-low rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className={`h-full ${item.color}`}
                  ></motion.div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 p-4 rounded-xl bg-surface-low border border-surface-highest flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap size={16} />
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">
              AI Confidence Score is averaging <strong className="text-on-surface">98.4%</strong> across all classifications.
            </p>
          </div>
        </div>
      </div>

      {/* Flagged Entities */}
      <section className="bg-surface border border-surface-highest rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-surface-highest flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest">Watchlist History</h4>
            <p className="text-xs text-on-surface-variant">Vehicles recently found on your watchlist</p>
          </div>
          <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View All</button>
        </div>
        <div className="divide-y divide-surface-highest">
          {historyData.filter(d => d.status === 'Unauthorized' || d.status === 'Watchlist').slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 hover:bg-surface-low transition-colors cursor-pointer group">
              <div className="flex items-center gap-6">
                <div className="bg-surface-high px-3 py-1.5 rounded-lg border border-surface-highest font-black text-on-surface tracking-wider text-sm">
                  {item.plate}
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">{item.location || 'Main Entrance'}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium">Last seen: {new Date(item.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-1 rounded-full uppercase tracking-widest">
                  {item.status}
                </span>
                <ChevronRight size={16} className="text-on-surface-variant group-hover:text-on-surface transition-colors" />
              </div>
            </div>
          ))}
          {historyData.filter(d => d.status === 'Unauthorized' || d.status === 'Watchlist').length === 0 && (
            <div className="p-12 text-center">
              <Shield size={32} className="mx-auto mb-2 text-on-surface-variant opacity-20" />
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">No active threats detected</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
