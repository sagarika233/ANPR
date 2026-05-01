import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Clock, 
  MapPin, 
  AlertCircle, 
  X,
  FolderOpen,
  CheckCircle2,
  Image as ImageIcon,
  Activity,
  History as HistoryIcon,
  Database
} from 'lucide-react';

interface HistoryProps {
  initialSearch?: string;
}

export default function History({ initialSearch = '' }: HistoryProps) {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [presentResults, setPresentResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isSearching, setIsSearching] = useState(false);
  const [noDataMessage, setNoDataMessage] = useState('');
  const [viewMode, setViewMode] = useState<'present' | 'search'>(initialSearch ? 'search' : 'present');

  // WebSocket for Live "Present" Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION' || message.type === 'ALERT') {
        const newDet = message.data;
        setPresentResults(prev => {
          // Deduplicate locally
          const isDuplicate = prev.some(d => 
            d.plate === newDet.plate && 
            Math.abs(new Date(newDet.timestamp).getTime() - new Date(d.timestamp).getTime()) < 5000
          );
          if (isDuplicate) return prev;
          return [newDet, ...prev].slice(0, 50);
        });
      }
    };

    return () => ws.close();
  }, []);

  const fetchSearchResult = async (query: string) => {
    setIsSearching(true);
    setNoDataMessage('');
    setViewMode(query.trim() ? 'search' : 'present');
    
    try {
      const url = query.trim() 
        ? `/api/search?plate=${encodeURIComponent(query)}`
        : `/api/search`; // Gets last 20 results if no query
      const response = await fetch(url);
      const data = await response.json();
      
      const results = Array.isArray(data) ? data : (data.data || []);
      
      if (query.trim() && results.length === 0) {
        setNoDataMessage(`No records found for "${query}" in database.`);
        setHistoryData([]);
      } else {
        setHistoryData(results);
      }
    } catch (error) {
      console.error("Error searching records:", error);
      setNoDataMessage('Database integration failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // On mount, fetch recent records to populate "present" results if empty
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const response = await fetch('/api/search');
        const data = await response.json();
        const results = Array.isArray(data) ? data : (data.data || []);
        setPresentResults(results.map(r => ({
          ...r,
          plate: r.plate_number || r.plate,
          id: r.id,
          timestamp: r.timestamp,
          image: r.image_url || r.image,
          confidence: r.confidence
        })));
      } catch (err) {
        console.error("Failed to fetch initial present results");
      }
    };
    
    if (initialSearch) {
      fetchSearchResult(initialSearch);
    } else {
      fetchRecent();
    }
  }, []);

  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
      fetchSearchResult(initialSearch);
    }
  }, [initialSearch]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setViewMode('present');
      return;
    }
    fetchSearchResult(searchQuery);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setViewMode('present');
    setNoDataMessage('');
  };

  const currentDisplayData = viewMode === 'present' ? presentResults : historyData;
  const displayTitle = viewMode === 'present' 
    ? 'Present Session Logs (Live)' 
    : `Search Results for "${searchQuery}" (Database)`;

  return (
    <div className="space-y-8 pb-32 sm:pb-24 md:pb-12 px-1">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-2">Supabase Records Integration</p>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface">System History</h1>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10">
            <div className={`w-2 h-2 rounded-full ${viewMode === 'present' ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status: {viewMode === 'present' ? 'Streaming' : 'Filtered'}</span>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <section className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-4 sm:p-6 shadow-md">
        <div className="flex flex-row gap-3 sm:gap-6 items-center">
          <div className="flex-1 relative group min-w-0">
            <button 
              onClick={handleSearch}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-all z-10 p-1"
            >
              <Search size={18} className="sm:w-5 sm:h-5" />
            </button>
            <input 
              type="text"
              placeholder="Search historical plates in database..."
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 sm:pl-13 pr-4 py-2.5 sm:py-3.5 text-xs sm:text-sm text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner truncate"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {searchQuery && (
              <button 
                onClick={handleClearAll}
                className="p-2 sm:p-3 text-error hover:bg-error/5 rounded-xl transition-colors"
                title="Clear filter"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
            
            <button 
              onClick={handleSearch}
              className="bg-on-surface text-surface px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] hover:opacity-90 transition-all shadow-xl active:scale-95 whitespace-nowrap flex items-center gap-2"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Result Section */}
      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-lg">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
                <p className="text-[10px] font-black text-outline uppercase tracking-[0.4em]">Querying Past Records...</p>
              </div>
            </div>
          ) : currentDisplayData.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="p-6 border-b border-outline-variant/5 bg-surface-container-low/30 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                    {displayTitle}
                  </p>
                  <p className="text-[9px] text-outline-variant font-bold uppercase tracking-tight opacity-60">Result count: {currentDisplayData.length}</p>
                </div>
                {viewMode === 'present' && <Activity size={16} className="text-primary animate-pulse" />}
              </div>
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Evidence</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">License Plate</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Vehicle Model</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Sensor Zone</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Captured Time</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Accuracy</th>
                    <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {currentDisplayData.map((row, i) => (
                    <motion.tr 
                      key={row.id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      className="hover:bg-surface-container-low transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="w-20 h-12 bg-black rounded border border-outline-variant/10 overflow-hidden shadow-sm">
                          {(row.image_url || row.image) ? (
                            <img 
                              src={row.image_url || row.image} 
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              referrerPolicy="no-referrer"
                              alt="Vehicle Capture" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-container-low">
                               <ImageIcon size={14} className="text-outline-variant opacity-20" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-4 py-1.5 bg-on-surface text-surface rounded-lg font-headline font-black text-sm tracking-widest shadow-md inline-block">
                          {row.plate_number || row.plate}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="min-w-[150px]">
                          <p className="text-xs font-black text-on-surface tracking-tight uppercase">
                            {row.make || 'General'} <span className="text-primary">{row.model || ''}</span>
                          </p>
                          <p className="text-[10px] font-bold text-outline-variant uppercase mt-0.2 opacity-60">{row.vehicle_type || 'Vehicle'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                          <MapPin size={12} className="text-outline-variant" />
                          {row.location || 'Entrance-01'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-black text-on-surface-variant/80 uppercase">
                        {new Date(row.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${row.confidence > 0.8 ? 'bg-primary' : row.confidence > 0.5 ? 'bg-amber-500' : 'bg-error'}`}
                              style={{ width: `${(row.confidence || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-on-surface">{Math.round((row.confidence || 0) * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${
                          row.status === 'Valid'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                            : row.status === 'Low Confidence'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                              : 'bg-error/10 border-error/20 text-error'
                        }`}>
                          {row.status === 'Valid' && <CheckCircle2 size={10} />}
                          {row.status || 'VERIFIED'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : noDataMessage ? (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6">
                  <AlertCircle size={48} className="text-error" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-black text-on-surface tracking-tighter uppercase mb-2">{noDataMessage}</p>
                <p className="text-sm text-on-surface-variant font-medium opacity-60 max-w-sm mx-auto">No matching records found in the database. Try searching for partial plate numbers.</p>
              </div>
            </div>
          ) : (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6">
                  <HistoryIcon size={48} className="text-outline-variant opacity-40" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-black text-on-surface tracking-tighter uppercase mb-2">No Past Results</p>
                <p className="text-sm text-on-surface-variant font-medium opacity-60">No vehicle records found. New license plate scans will appear here automatically as they are detected.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
