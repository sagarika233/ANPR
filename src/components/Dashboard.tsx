import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Car, 
  Video, 
  AlertCircle, 
  BarChart3, 
  Activity, 
  MoreVertical,
  Download,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const [timestamp, setTimestamp] = useState(new Date().toLocaleString());
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleString());
    }, 1000);

    const fetchData = async () => {
      try {
        const [historyRes, statsRes] = await Promise.all([
          fetch('/api/history'),
          fetch('/api/stats')
        ]);
        const history = await historyRes.json();
        const statsData = await statsRes.json();
        setHistoryData(history);
        setStats(statsData);
      } catch (err) {
        console.error("Dashboard sync error:", err);
      }
    };

    fetchData();

    // WebSocket link for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        setHistoryData(prev => [message.data, ...prev].slice(0, 100));
        // Update stats summary as well
        fetchData();
      }
    };

    return () => {
      clearInterval(timer);
      socket.close();
    };
  }, []);

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // PDF Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Vigilant Security: Dashboard Status Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Summary of Recent Recognition Activity`, 14, 35);
    
    const tableHeaders = [['Plate', 'Manufacturer', 'Model', 'Location', 'Timestamp', 'Confidence', 'Status']];
    const tableData = historyData.slice(0, 20).map(row => [
      row.plate,
      row.make || 'Unknown',
      row.model || '-',
      row.location || 'Entrance A',
      new Date(row.timestamp).toLocaleString(),
      `${((row.confidence || 0) * 100).toFixed(1)}%`,
      row.status || 'LOGGED'
    ]);

    autoTable(doc, {
      startY: 45,
      head: tableHeaders,
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: 51 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 45 }
    });

    doc.save(`dashboard_intelligence_${new Date().getTime()}.pdf`);
  };

  const summaryStats = [
    { label: "Today", title: "Total Detections", value: (stats?.todayDetections ?? 0).toLocaleString(), icon: Car, color: "text-primary", bg: "bg-primary-fixed", trend: "Latest" },
    { label: "Live", title: "Active Cameras", value: (stats?.activeCameras ?? 0).toString(), icon: Video, color: "text-tertiary", bg: "bg-tertiary-fixed", trend: "+0%" },
    { label: "Alert", title: "Watchlist Hits", value: (stats?.watchlistHits ?? 0).toString(), icon: AlertCircle, color: "text-error", bg: "bg-error-container", border: "border-l-4 border-error", trend: "Critical" },
    { label: "Quality", title: "Avg Confidence", value: `${((stats?.avgConfidence ?? 0) * 100).toFixed(1)}%`, icon: BarChart3, color: "text-secondary", bg: "bg-secondary-container", trend: "High" },
  ];

  const recentDetections = historyData.slice(0, 6).map(item => ({
    plate: item.plate,
    vehicle: item.make ? `${item.make} ${item.model || ''}` : "Unknown Vehicle",
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    confidence: `${(item.confidence * 100).toFixed(0)}%`,
    image: item.image || `https://picsum.photos/seed/${item.plate}/200/200`,
    hit: item.status !== 'Authorized' && item.status !== 'Clearance' && item.status !== 'Detected'
  }));

  const systemLogs = historyData.slice(0, 10).map(item => ({
    id: `#${item.id}${item.plate.substring(0, 2)}`,
    meta: item.location || "Main Entrance",
    plate: item.plate,
    region: item.region || "Unknown",
    confidence: Math.round(item.confidence * 100),
    status: item.status || "Verified",
    image: item.image
  }));

  return (
    <div className="space-y-6 sm:space-y-10 pb-24">
      {/* Summary Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {summaryStats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-surface-container-lowest p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-outline-variant/10 ${stat.border || ''} hover:shadow-md transition-shadow group`}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-6">
              <div className={`${stat.bg} ${stat.color} p-2 sm:p-2.5 rounded-xl transition-transform group-hover:scale-110`}>
                <stat.icon size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${stat.color === 'text-error' ? 'bg-error/10 text-error' : 'bg-surface-container-high text-outline'}`}>{stat.trend}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-on-surface font-headline leading-none mb-1">{stat.value}</div>
            <div className="text-[10px] sm:text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60 leading-none">{stat.title}</div>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-8 items-start">
        {/* Recent Detections Activity Stream */}
        <section>
          <div className="bg-surface-container-lowest rounded-2xl shadow-md border border-outline-variant/5 flex flex-col overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-on-surface">Recent Detections</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Real-time processing stream</p>
            </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/5">
              {recentDetections.length > 0 ? recentDetections.map((det, i) => (
                <div key={i} className={`flex items-center gap-4 p-5 hover:bg-surface-container-low transition-colors cursor-pointer border-l-4 ${det.hit ? 'border-error bg-error/10' : 'border-transparent'}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-black flex-shrink-0 shadow-sm border border-outline-variant/10">
                    <img className="w-full h-full object-cover opacity-80" src={det.image} alt="Vehicle Crop" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-lg font-black tracking-widest truncate font-headline leading-none mb-1 ${det.hit ? 'text-error' : 'text-on-surface'}`}>{det.plate}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">{det.vehicle}</span>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-outline uppercase tracking-tight">
                        <Clock size={10} className="text-outline-variant" />
                        <span>{det.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {det.hit ? (
                      <span className="bg-error text-white text-[8px] px-2 py-0.5 rounded-lg font-black tracking-widest">ALERT</span>
                    ) : (
                      <span className="text-tertiary text-[10px] font-black font-headline">{det.confidence}</span>
                    )}
                    <p className="text-[7px] font-black text-outline uppercase tracking-widest opacity-60 leading-none">Confidence</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center opacity-40">
                  <Car size={40} className="mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">Awaiting First Detection...</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-surface-container-low/50 text-center border-t border-outline-variant/5">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'history' }))}
                className="text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:underline"
              >
                Open History Records
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* System Logs & Validation Table */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-md border border-outline-variant/5 overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10">
          <div>
            <h3 className="text-lg font-bold text-on-surface">System Logs & Validation</h3>
            <p className="text-xs text-on-surface-variant font-medium mt-1">Authenticated capture history</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportPDF}
              className="px-5 py-2.5 bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-surface-dim transition-colors flex items-center gap-2"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'history' }))}
              className="px-5 py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg shadow-primary/20 transition-all"
            >
              Full History
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">Record ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">Picture Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">License Plate</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">Region</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">Confidence</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {systemLogs.length > 0 ? systemLogs.map((log, i) => (
                <tr key={i} className="hover:bg-surface-container-high/20 transition-colors">
                  <td className="px-6 py-5 text-xs font-mono font-bold text-on-surface-variant">{log.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-surface-container-high rounded-md overflow-hidden border border-outline-variant/20 shadow-sm">
                        {log.image ? (
                          <img 
                            className="w-full h-full object-cover" 
                            src={log.image} 
                            alt="Plate Detail" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-container-low text-[8px] font-bold text-outline-variant">N/A</div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest line-clamp-1 italic">{log.meta}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-base font-black text-on-surface tracking-tight">{log.plate}</td>
                  <td className="px-6 py-5 text-[10px] font-black text-outline-variant uppercase tracking-widest">{log.region}</td>
                  <td className="px-6 py-5 min-w-[120px]">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${log.confidence > 90 ? 'bg-tertiary' : 'bg-secondary'}`} 
                          style={{ width: `${log.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-black text-on-surface">{log.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      log.status === 'Verified' || log.status === 'Authorized' || log.status === 'Clearance' ? 'bg-tertiary-container/10 text-tertiary' : 'bg-secondary-container text-on-secondary-container'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-10 py-12 text-center opacity-40">
                    <Activity size={32} className="mx-auto mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">No captured intelligence logged.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
