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
  Image as ImageIcon
} from 'lucide-react';

interface HistoryProps {
  initialSearch?: string;
}

export default function History({ initialSearch = '' }: HistoryProps) {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isSearching, setIsSearching] = useState(false);
  const [noDataMessage, setNoDataMessage] = useState('');

  const fetchSearchResult = async (query: string) => {
    setIsSearching(true);
    setNoDataMessage('');
    try {
      const url = query.trim() 
        ? `/api/search?plate=${encodeURIComponent(query)}`
        : `/api/search`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.message && (!data.data || data.data.length === 0)) {
        setNoDataMessage(data.message);
        setHistoryData([]);
      } else {
        setHistoryData(Array.isArray(data) ? data : (data.data || []));
      }
    } catch (error) {
      console.error("Error searching records:", error);
      setNoDataMessage('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchSearchResult(searchQuery);
  }, []);

  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
      fetchSearchResult(initialSearch);
    }
  }, [initialSearch]);

  const handleSearch = () => {
    fetchSearchResult(searchQuery);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setHistoryData([]);
    setNoDataMessage('');
  };

  return (
    <div className="space-y-8 pb-24 md:pb-12 px-1">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-2">Logs & Records</p>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface">Search Records</h1>
        </div>
      </header>

      {/* Search Bar */}
      <section className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-4 sm:p-6 shadow-sm">
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
              placeholder="Search plate..."
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
                title="Clear search"
              >
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
            
            <button 
              onClick={handleSearch}
              className="bg-on-surface text-surface px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] hover:opacity-90 transition-all shadow-xl active:scale-95 whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Result Section */}
      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-md">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
                <p className="text-[10px] font-black text-outline uppercase tracking-[0.4em]">Querying Database...</p>
              </div>
            </div>
          ) : historyData.length > 0 ? (
            <div className="p-8">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'Most Recent Records'}
              </p>
              <div className="divide-y divide-outline-variant/10">
                {historyData.map((row, i) => (
                <motion.div 
                  key={row.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 py-5 px-4 sm:px-6 hover:bg-surface-container-low transition-all duration-300 first:rounded-t-2xl last:rounded-b-2xl border-b border-outline-variant/5 last:border-0"
                >
                  {/* Compact Preview */}
                  <div className="w-full sm:w-28 lg:w-36 aspect-video bg-black rounded-lg border border-outline-variant/10 overflow-hidden shadow-sm shrink-0">
                    {row.image_url ? (
                      <img 
                        src={row.image_url} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                        alt="Capture" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-container-low text-outline-variant uppercase font-black text-[8px]">
                        No Img
                      </div>
                    )}
                  </div>

                  {/* Identification */}
                  <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-4 min-w-0 sm:w-48 lg:w-72">
                    <div className="bg-on-surface text-surface px-4 py-1.5 rounded-lg font-headline font-black text-sm sm:text-base tracking-widest shadow-md shrink-0">
                      {row.plate_number || row.plate}
                    </div>
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-black text-on-surface tracking-tight uppercase truncate">
                        {row.make || 'Unknown'} <span className="text-primary">{row.model || ''}</span>
                      </p>
                    </div>
                  </div>

                  {/* Metadata - Desktop Row */}
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 w-full items-center">
                    <div className="hidden lg:block">
                      <p className="text-[8px] font-black text-outline uppercase tracking-widest opacity-60 mb-0.5">Type</p>
                      <p className="text-[10px] sm:text-xs font-bold text-on-surface truncate tracking-tight uppercase">{row.vehicle_type || 'Vehicle'}</p>
                    </div>
                    
                    <div>
                      <p className="text-[8px] font-black text-outline uppercase tracking-widest opacity-60 mb-0.5">Confidence</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1 bg-surface-container-high rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${(row.confidence || 0) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] sm:text-xs font-black text-on-surface">{((row.confidence || 0) * 100).toFixed(0)}%</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[8px] font-black text-outline uppercase tracking-widest opacity-60 mb-0.5">Detected At</p>
                      <div className="flex items-center gap-1.5 text-on-surface font-black text-[9px] sm:text-[10px] uppercase tracking-tighter">
                        <Clock size={12} className="text-primary shrink-0" />
                        <span className="truncate">{new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="text-right sm:text-left">
                      <p className="text-[8px] font-black text-outline uppercase tracking-widest opacity-60 mb-0.5">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all duration-300 ${
                        row.status === 'Valid'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                          : row.status === 'Low Confidence'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                            : 'bg-error/10 border-error/20 text-error'
                      }`}>
                        {row.status === 'Valid' && <CheckCircle2 size={10} className="shrink-0" />}
                        {row.status === 'Low Confidence' && <AlertCircle size={10} className="shrink-0 text-amber-500" />}
                        {row.status === 'Blurry Image' && <ImageIcon size={10} className="shrink-0" />}
                        {row.status || 'LOGGED'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              </div>
            </div>
          ) : noDataMessage ? (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6">
                  <AlertCircle size={48} className="text-error" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-black text-on-surface tracking-tighter uppercase mb-2">{noDataMessage}</p>
                <p className="text-sm text-on-surface-variant font-medium opacity-60">Try searching for a different plate number or ensure the format is correct.</p>
              </div>
            </div>
          ) : (
            <div className="px-10 py-40 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6">
                  <FolderOpen size={48} className="text-outline-variant" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-black text-on-surface tracking-tighter uppercase mb-2">No Records Available</p>
                <p className="text-sm text-on-surface-variant font-medium opacity-60">Enter a plate number above to search the database.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
