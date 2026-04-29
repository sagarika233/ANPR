import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  BarChart3, 
  History, 
  Settings, 
  Bell, 
  HelpCircle, 
  Search,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Menu,
  User,
  LayoutDashboard,
  BellRing,
  Activity
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab, searchQuery, setSearchQuery }: LayoutProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewSearch, setShowNewSearch] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'info', title: 'System Initialized', message: 'Vigilant ALPR engine is active and monitoring.', time: 'Just now', icon: ShieldCheck, color: 'text-primary' },
  ]);
  const [hasUnread, setHasUnread] = useState(false);

  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        const detection = message.data;
        const newNotification = {
          id: Date.now(),
          type: detection.status === 'Alert' ? 'alert' : 'success',
          title: detection.status === 'Alert' ? 'Watchlist Hit' : 'Vehicle Detected',
          message: `${detection.plate} detected at ${detection.location || 'Site Alpha'}.`,
          time: 'Just now',
          icon: detection.status === 'Alert' ? AlertTriangle : CheckCircle2,
          color: detection.status === 'Alert' ? 'text-error' : 'text-tertiary'
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 20));
        setHasUnread(true);
      }
    };

    return () => socket.close();
  }, []);

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) setHasUnread(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live Monitor', icon: Video },
    { id: 'history', label: 'History', icon: History },
    { id: 'alerts', label: 'Alert Rules', icon: BellRing },
    { id: 'health', label: 'System Health', icon: Activity },
  ];

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('history');
      setShowNewSearch(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface overflow-x-hidden">
      {/* Navigation Drawer (Desktop) */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 z-50 bg-surface-container-low flex-col overflow-y-auto pt-8 pb-4 border-r border-outline-variant/10">
        <div className="px-8 mb-10">
          <h2 className="text-xl font-black tracking-tighter text-on-surface font-headline uppercase leading-none">
            Vigilant <span className="text-primary group-hover:text-primary-container transition-colors">ALPR</span>
          </h2>
          <p className="text-[10px] font-bold text-outline uppercase tracking-[0.3em] mt-2">Secure Node Auto</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3.5 rounded-2xl transition-all duration-300 group ${
                activeTab === item.id 
                  ? 'text-primary bg-surface-container shadow-sm' 
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-high/40'
              }`}
            >
              <item.icon 
                size={18} 
                className={activeTab === item.id ? 'text-primary' : 'text-secondary group-hover:text-on-surface transition-colors'} 
              />
              <span className="font-headline text-[11px] uppercase tracking-[0.12em] font-bold">
                {item.label}
              </span>
            </button>
          ))}
        </nav>
        <div className="px-6 py-6 mt-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-tertiary-container/10 rounded-lg">
            <div className="pulse-dot"></div>
            <span className="text-[10px] font-bold text-tertiary tracking-wider uppercase">System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 flex-1 flex flex-col min-h-screen relative">
        {/* TopAppBar */}
        <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0px_1px_0px_rgba(25,28,29,0.06)] flex items-center justify-between px-4 sm:px-6 h-16 transition-all duration-300">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
            <button 
              className="md:hidden p-2 hover:bg-surface-container rounded-full transition-colors shrink-0"
              onClick={() => setActiveTab('dashboard')}
            >
              <Menu size={20} className="text-on-surface" />
            </button>
            <div className="flex items-baseline gap-2 sm:gap-4 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tighter text-on-surface font-headline leading-none truncate shrink-0">Vigilant ALPR</h1>
              <span className="hidden md:block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none shrink-0 opacity-70">v2.4</span>
            </div>
          </div>

          <div className="flex-1 max-w-sm mx-4 sm:mx-8 hidden lg:block min-w-0">
            <div className="relative flex items-center group">
              <Search className="absolute left-3 text-outline group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search plate intelligence..." 
                className="w-full bg-surface-container-high/50 border-none focus:ring-1 focus:ring-primary/20 text-sm py-2 pl-10 pr-4 rounded-xl shadow-inner placeholder:text-outline-variant font-medium transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewSearch(e)}
              />
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-4 shrink-0 ml-auto">
            <button 
              onClick={() => setShowNewSearch(true)}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-surface-container rounded-full transition-colors shrink-0"
            >
              <Search size={18} className="text-primary sm:w-5 sm:h-5" />
            </button>
            
            <button 
              onClick={handleToggleNotifications}
              className="p-1.5 sm:p-2 hover:bg-surface-container rounded-full transition-colors relative shrink-0"
            >
              <Bell size={18} className={(hasUnread ? "text-primary" : "text-secondary") + " sm:w-5 sm:h-5"} />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-error rounded-full border-2 border-surface-container-lowest animate-pulse"></span>
              )}
            </button>


          </div>
          
          {/* Notifications Popover (Repositioned for the new header) */}
          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)}></div>
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="absolute right-4 sm:right-8 top-16 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-surface-container-lowest border border-outline-variant/10 rounded-3xl shadow-2xl overflow-hidden z-[60]"
                >
                  <div className="p-4 sm:p-6 border-b border-surface-container flex justify-between items-center bg-surface-container-low/50">
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-on-surface">Recent Scans</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-outline hover:text-on-surface">
                      <X size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>
                  <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-4 sm:p-6 border-b border-surface-container/50 hover:bg-surface-container-low transition-colors cursor-pointer group">
                        <div className="flex gap-3 sm:gap-4">
                          <div className={`mt-0.5 sm:mt-1 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-surface-container-low ${n.color}`}>
                            <n.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                              <span className="text-xs sm:text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">{n.title}</span>
                              <span className="text-[8px] sm:text-[10px] text-outline font-black uppercase whitespace-nowrap ml-2">{n.time}</span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-on-surface-variant leading-relaxed line-clamp-2 font-medium">{n.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setShowNotifications(false); setActiveTab('history'); }} className="w-full py-3 sm:py-4 text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.3em] hover:bg-surface-container-low transition-all border-t border-outline-variant/10">
                    See All History
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </header>

        {/* Scrollable Content */}
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>



        {/* Mobile Bottom NavBar */}
        <nav className="md:hidden sticky bottom-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/10 flex items-center justify-around h-16 w-full px-2">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                activeTab === item.id ? 'text-primary' : 'text-secondary'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {item.id === 'dashboard' ? 'Dash' : item.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </nav>
      </main>

      {/* Manual Search Modal */}
      <AnimatePresence>
        {showNewSearch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
              onClick={() => setShowNewSearch(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-8 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-bold text-on-surface">Search Records</h2>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">Search for any vehicle in the database</p>
                </div>
                <button onClick={() => setShowNewSearch(false)} className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-container transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleNewSearch} className="space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" size={20} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Enter plate number..."
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-4 pl-12 pr-4 text-base text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowNewSearch(false)}
                    className="flex-1 py-3.5 rounded-xl border border-outline-variant text-on-surface font-bold text-sm uppercase tracking-wider hover:bg-surface-container-low transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Search Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
