import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Calendar, 
  Download, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Activity
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

  const handleFilterDateClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try {
        ref.current.click();
      } catch (err) {
        try {
          ref.current.showPicker?.();
        } catch (e) {}
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
    <div className="space-y-6">
      {/* Hidden Date Inputs */}
      <input type="date" ref={dateInputRef} className="hidden" onChange={(e) => setSelectedDate(e.target.value || null)} />
      <input type="date" ref={startDateInputRef} className="hidden" onChange={(e) => setStartDate(e.target.value || null)} />
      <input type="date" ref={endDateInputRef} className="hidden" onChange={(e) => setEndDate(e.target.value || null)} />

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-primary font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Audit Log</p>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Detection History</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="bg-surface border border-surface-highest hover:bg-surface-high transition-colors text-on-surface px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <section className="bg-surface border border-surface-highest rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="text"
              placeholder="Search by plate, make, or location..."
              className="w-full bg-surface-low border border-surface-highest rounded-xl pl-12 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-surface-low border border-surface-highest p-1 rounded-xl flex">
              <button 
                onClick={() => setFilterMode('single')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'single' ? 'bg-surface-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Day
              </button>
              <button 
                onClick={() => setFilterMode('range')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'range' ? 'bg-surface-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Range
              </button>
            </div>

            {filterMode === 'single' ? (
              <button 
                onClick={() => handleFilterDateClick(dateInputRef)}
                className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  selectedDate ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-low border-surface-highest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Calendar size={14} />
                {selectedDate ? formatDateForDisplay(selectedDate) : 'Select Date'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleFilterDateClick(startDateInputRef)}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    startDate ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-low border-surface-highest text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {startDate ? formatDateForDisplay(startDate) : 'Start'}
                </button>
                <span className="text-on-surface-variant text-[10px] font-bold uppercase">to</span>
                <button 
                  onClick={() => handleFilterDateClick(endDateInputRef)}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                    endDate ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-low border-surface-highest text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {endDate ? formatDateForDisplay(endDate) : 'End'}
                </button>
              </div>
            )}

            {(activeSearch || selectedDate || startDate || endDate) && (
              <button 
                onClick={handleClearAll}
                className="p-2 text-error hover:bg-error/10 rounded-xl transition-colors"
                title="Clear all filters"
              >
                <X size={18} />
              </button>
            )}
            
            <button 
              onClick={handleSearch}
              className="bg-primary text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary-container transition-all shadow-lg shadow-primary/20"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </section>

      {/* Table Section */}
      <div className="bg-surface border border-surface-highest rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-low border-b border-surface-highest">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Vehicle & Plate</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Confidence</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highest">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Activity className="mx-auto mb-2 text-primary animate-spin" size={24} />
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Synchronizing records...</p>
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((row, i) => (
                    <motion.tr 
                      key={row.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-surface-low transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="bg-surface-high px-3 py-1.5 rounded-lg border border-surface-highest font-black text-on-surface tracking-wider text-sm">
                            {row.plate}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-on-surface uppercase">{row.make || 'Unknown'} {row.model || ''}</p>
                            <p className="text-[10px] text-on-surface-variant font-medium">Record ID: {row.id?.toString().padStart(5, '0') || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-on-surface">
                          <MapPin size={14} className="text-on-surface-variant" />
                          {row.location || 'Main Entrance'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-low rounded-full overflow-hidden max-w-[60px]">
                            <div 
                              className={`h-full ${row.confidence > 0.9 ? 'bg-success' : 'bg-warning'}`} 
                              style={{ width: `${row.confidence * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-on-surface">{((row.confidence || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-on-surface">
                          <Clock size={14} className="text-on-surface-variant" />
                          <span>{new Date(row.timestamp).toLocaleDateString()}</span>
                          <span className="text-on-surface-variant">•</span>
                          <span className="text-on-surface-variant">{new Date(row.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          row.status === 'Authorized' || row.status === 'Clearance' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-error/10 text-error'
                        }`}>
                          {row.status === 'Authorized' || row.status === 'Clearance' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {row.status || 'Detected'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-high rounded-lg transition-all">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Search className="mx-auto mb-2 text-on-surface-variant opacity-20" size={32} />
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">No records found</p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-surface-low border-t border-surface-highest flex items-center justify-between">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Showing {paginatedData.length} of {filteredData.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
