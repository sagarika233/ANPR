import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Calendar, 
  Download, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

export default function History() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const itemsPerPage = 10;

  const dateInputRef = useRef<HTMLInputElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const filteredData = useMemo(() => {
    return historyData.filter(item => {
      const matchesSearch = 
        item.plate.toLowerCase().includes(activeSearch.toLowerCase()) ||
        (item.location && item.location.toLowerCase().includes(activeSearch.toLowerCase()));
      
      let matchesDate = true;
      const itemDateObj = new Date(item.timestamp);
      
      if (filterMode === 'single' && selectedDate) {
        const filterDate = new Date(selectedDate);
        matchesDate = 
          itemDateObj.getFullYear() === filterDate.getFullYear() &&
          itemDateObj.getMonth() === filterDate.getMonth() &&
          itemDateObj.getDate() === filterDate.getDate();
      } else if (filterMode === 'range' && (startDate || endDate)) {
        const itemTime = itemDateObj.getTime();
        const start = startDate ? new Date(startDate).getTime() : -Infinity;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
        
        matchesDate = itemTime >= start && itemTime <= end;
      }
      
      return matchesSearch && matchesDate;
    });
  }, [historyData, activeSearch, filterMode, selectedDate, startDate, endDate]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSearch = () => {
    setActiveSearch(searchQuery);
    setCurrentPage(1);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setActiveSearch('');
    setSelectedDate(null);
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headers = ['Plate', 'Make', 'Model', 'Location', 'Confidence', 'Date', 'Time', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => `${row.plate},${row.make || ''},${row.model || ''},${row.location},${row.confidence}%,${row.date},${row.time},${row.status}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lpr_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (!dateValue) {
      setSelectedDate(null);
      return;
    }
    
    // Convert YYYY-MM-DD to "MMM DD, YYYY" to match INITIAL_HISTORY format
    const date = new Date(dateValue);
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    setSelectedDate(formatted);
    setCurrentPage(1);
  };

  const handleFilterDateClick = (ref: React.RefObject<HTMLInputElement>) => {
    // showPicker() is often blocked in cross-origin iframes (SecurityError).
    // We use .click() on a visually hidden (but not display:none) input as the most compatible workaround.
    if (ref.current) {
      try {
        ref.current.click();
      } catch (err) {
        // Fallback to showPicker if click fails, but catch any security errors silently
        try {
          ref.current.showPicker?.();
        } catch (e) {
          console.warn("Native date picker could not be triggered in this environment.");
        }
      }
    }
  };

  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-10">
      {/* Visually Hidden Date Inputs */}
      <label htmlFor="history-date-input" className="sr-only">Filter history by date</label>
      <input 
        id="history-date-input"
        type="date" 
        ref={dateInputRef} 
        className="absolute opacity-0 pointer-events-none -z-50 w-0 h-0" 
        onChange={(e) => {
          const val = e.target.value;
          setSelectedDate(val ? formatDateForDisplay(val) : null);
          setCurrentPage(1);
        }}
        aria-label="Select date to filter history"
      />

      <input 
        type="date" 
        ref={startDateInputRef} 
        className="absolute opacity-0 pointer-events-none -z-50 w-0 h-0" 
        onChange={(e) => {
          setStartDate(e.target.value || null);
          setCurrentPage(1);
        }}
      />

      <input 
        type="date" 
        ref={endDateInputRef} 
        className="absolute opacity-0 pointer-events-none -z-50 w-0 h-0" 
        onChange={(e) => {
          setEndDate(e.target.value || null);
          setCurrentPage(1);
        }}
      />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="font-headline uppercase tracking-widest text-[10px] text-tertiary mb-1">Audit Log</p>
          <h1 className="text-4xl font-extrabold font-headline text-white tracking-tight">LPR History</h1>
          <p className="text-on-surface-variant mt-2 max-w-xl">Search through historical license plate data, filtered by location, status, and custom timeframes.</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center bg-surface-highest/50 p-1 rounded-xl self-end">
            <button 
              onClick={() => {
                setFilterMode('single');
                setStartDate(null);
                setEndDate(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'single' ? 'bg-primary-container text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-white'}`}
            >
              Single Day
            </button>
            <button 
              onClick={() => {
                setFilterMode('range');
                setSelectedDate(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'range' ? 'bg-primary-container text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-white'}`}
            >
              Date Range
            </button>
          </div>

          <div className="flex items-center gap-3">
            {filterMode === 'single' ? (
              <button 
                onClick={() => handleFilterDateClick(dateInputRef)}
                aria-haspopup="grid"
                aria-controls="history-date-input"
                aria-label={selectedDate ? `Change date filter, currently ${selectedDate}` : 'Open date picker to filter history'}
                className={`px-5 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-2 transition-all focus:ring-2 focus:ring-primary focus:outline-none ${
                  selectedDate ? 'bg-primary-container text-white border-primary/50' : 'bg-surface-highest border-white/10 text-on-surface hover:bg-surface-bright'
                }`}
              >
                <Calendar size={14} aria-hidden="true" />
                <span>{selectedDate ? `Date: ${selectedDate}` : 'Filter by Date'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleFilterDateClick(startDateInputRef)}
                  className={`px-4 py-2.5 rounded-xl border font-semibold text-xs flex items-center gap-2 transition-all ${
                    startDate ? 'bg-primary-container text-white border-primary/50' : 'bg-surface-highest border-white/10 text-on-surface hover:bg-surface-bright'
                  }`}
                >
                  <Calendar size={12} />
                  <span>{startDate ? formatDateForDisplay(startDate) : 'Start Date'}</span>
                </button>
                <span className="text-on-surface-variant text-xs font-bold">to</span>
                <button 
                  onClick={() => handleFilterDateClick(endDateInputRef)}
                  className={`px-4 py-2.5 rounded-xl border font-semibold text-xs flex items-center gap-2 transition-all ${
                    endDate ? 'bg-primary-container text-white border-primary/50' : 'bg-surface-highest border-white/10 text-on-surface hover:bg-surface-bright'
                  }`}
                >
                  <Calendar size={12} />
                  <span>{endDate ? formatDateForDisplay(endDate) : 'End Date'}</span>
                </button>
              </div>
            )}
            <button 
              onClick={handleExportCSV}
              className="px-5 py-2.5 rounded-xl bg-surface-highest border border-white/10 text-on-surface font-semibold text-sm flex items-center gap-2 hover:bg-surface-bright transition-all"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-surface-high rounded-2xl glass-panel p-1 flex items-center gap-2 shadow-lg">
          <div className="flex-1 flex items-center px-4 gap-3">
            <Search size={18} className="text-on-surface-variant" />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant text-sm py-3" 
              placeholder="Search by Plate Number, Brand, or Location..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button 
            onClick={handleSearch}
            className="px-6 py-2.5 rounded-xl bg-primary-container text-white font-bold text-sm m-1 hover:opacity-90 transition-all"
          >
            Search
          </button>
        </div>
        <div className="bg-surface-high rounded-2xl glass-panel p-4 flex items-center justify-between border border-white/5">
          <div className="flex flex-col">
            <span className="font-headline uppercase tracking-widest text-[9px] text-on-surface-variant">Active Filters</span>
            <span className="text-sm font-bold text-on-surface">
              {[activeSearch, selectedDate, startDate, endDate].filter(Boolean).length} Selected
            </span>
          </div>
          <button 
            onClick={handleClearAll}
            className="text-xs font-bold text-primary hover:underline"
          >
            Clear All
          </button>
        </div>
      </section>

      {/* Table Section */}
      <div className="bg-surface-low rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-highest/50">
              <tr>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Vehicle & Plate</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Location</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant text-center">Confidence</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Date/Time</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Status</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-on-surface-variant font-medium">
                      Loading history records...
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((row, i) => (
                    <motion.tr 
                      key={row.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-10 bg-surface-bright rounded border border-white/10 overflow-hidden flex items-center justify-center p-1">
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500 font-bold">
                              IMG
                            </div>
                          </div>
                          <div>
                            <span className="text-base font-bold text-white tracking-wider">{row.plate}</span>
                            <p className="text-[10px] text-on-surface-variant uppercase font-semibold">
                              {row.make ? `${row.make} ${row.model}` : (row.model || 'Unknown Vehicle')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-on-surface">{row.location || 'Main Entrance'}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${
                          (row.confidence * 100) > 90 ? 'bg-tertiary/10 border-tertiary/20 text-tertiary' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                        }`}>
                          <span className="text-xs font-bold">{(row.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-on-surface">{new Date(row.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-on-surface-variant">{new Date(row.timestamp).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          row.status === 'Authorized' ? 'bg-green-500/10 text-green-400' : 'bg-error/10 text-error'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Authorized' ? 'bg-green-500' : 'bg-error'}`}></span>
                          {row.status || 'Detected'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button className="text-on-surface-variant hover:text-white transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="px-6 py-20 text-center text-on-surface-variant font-medium">
                      No detection records found matching your criteria.
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-surface-highest/30 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-on-surface-variant">
            Showing <span className="text-white font-bold">
              {filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredData.length)}
            </span> of <span className="text-white font-bold">{filteredData.length}</span> results
          </p>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  currentPage === page ? 'bg-primary-container text-white' : 'text-on-surface hover:bg-white/5'
                }`}
              >
                {page}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Section: Dynamic Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Search Hits', value: filteredData.length.toLocaleString(), trend: '+12% vs last wk', trendColor: 'text-green-400' },
          { label: 'Alert Rate', value: '4.2%', trend: '+0.5% drift', trendColor: 'text-error' },
          { label: 'Avg. Confidence', value: '97.8%', progress: 80 },
          { label: 'Peak Hour', value: '08:42', trend: 'Morning Rush', trendColor: 'text-on-surface-variant' },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl bg-surface-low border border-white/5 glass-panel">
            <span className="font-headline uppercase tracking-widest text-[9px] text-on-surface-variant block mb-1">{stat.label}</span>
            <div className="flex items-end gap-3">
              <h3 className="text-2xl font-bold text-white font-headline">{stat.value}</h3>
              {stat.trend && <span className={`text-[10px] font-bold mb-1 ${stat.trendColor}`}>{stat.trend}</span>}
              {stat.progress && (
                <div className="w-16 h-1 bg-surface-bright rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-tertiary" style={{ width: `${stat.progress}%` }}></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
