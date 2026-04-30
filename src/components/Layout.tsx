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
  BellRing,
  Activity,
  LayoutDashboard
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    { id: 'history', label: 'History', icon: History },
    { id: 'alerts', label: 'Alert Rules', icon: BellRing },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('history');
      setShowNewSearch(false);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="px-6 mb-4 sm:mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-on-surface font-headline uppercase leading-none">
            Vigilant <span className="text-primary group-hover:text-primary-container transition-colors">ALPR</span>
          </h2>
          <p className="text-[9px] font-bold text-outline uppercase tracking-[0.3em] mt-1.5 text-on-surface-variant/60">Smart Plate System</p>
        </div>
        <button className="md:hidden p-2 hover:bg-surface-container rounded-full" onClick={() => setIsSidebarOpen(false)}>
          <X size={20} className="text-on-surface-variant" />
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-xl transition-all duration-300 group ${
              activeTab === item.id 
                ? 'text-primary bg-primary/10 shadow-sm border border-primary/10' 
                : 'text-secondary hover:text-on-surface hover:bg-surface-container-high/40'
            }`}
          >
            <item.icon 
              size={18} 
              className={activeTab === item.id ? 'text-primary animate-pulse-slow' : 'text-secondary group-hover:text-on-surface transition-colors'} 
            />
            <span className="font-headline text-[10px] uppercase tracking-[0.1em] font-bold">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
      <div className="px-5 py-4 mt-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary-container/10 rounded-lg border border-tertiary/10">
          <div className="pulse-dot"></div>
          <span className="text-[9px] font-bold text-tertiary tracking-wider uppercase">System Secured</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-[280px] z-[70] bg-surface-container-low flex flex-col pt-8 pb-4 border-r border-outline-variant/10 shadow-2xl md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Navigation Drawer (Desktop) */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 z-50 bg-surface-container-low flex-col overflow-y-auto pt-8 pb-4 border-r border-outline-variant/10">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 flex-1 flex flex-col min-h-screen relative transition-all duration-300">
        {/* TopAppBar */}
        <header className="sticky top-0 z-50 w-full bg-surface-container-lowest/80 backdrop-blur-2xl border-b border-outline-variant/5 flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <button 
              className="md:hidden p-2 bg-surface-container-high/50 hover:bg-surface-container rounded-xl transition-all active:scale-95"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={18} className="text-on-surface" />
            </button>
            <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
              <h1 className="text-base sm:text-lg font-black tracking-tighter text-on-surface font-headline leading-none truncate">
                {navItems.find(i => i.id === activeTab)?.label || 'Vigilant'}
              </h1>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-6 hidden lg:block">
            <div className="relative group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within/search:text-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Query database..." 
                className="w-full bg-surface-container-high/30 border border-transparent focus:border-primary/20 focus:bg-surface-container-high text-xs py-2 pl-10 pr-4 rounded-xl transition-all placeholder:text-on-surface-variant/40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewSearch(e)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button 
              onClick={() => setShowNewSearch(true)}
              className="lg:hidden p-2 hover:bg-surface-container rounded-xl transition-all text-on-surface-variant active:scale-95"
            >
              <Search size={18} />
            </button>
            
            <button 
              onClick={handleToggleNotifications}
              className="p-2 bg-surface-container-high/30 hover:bg-surface-container rounded-xl transition-all relative active:scale-95"
            >
              <Bell size={18} className={hasUnread ? "text-primary fill-primary/10" : "text-on-surface-variant"} />
              {hasUnread && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface-container-lowest animate-pulse"></span>
              )}
            </button>

            <div className="h-6 w-px bg-outline-variant/10 mx-1 hidden sm:block" />
            
            <button className="hidden sm:flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-surface-container transition-all group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 overflow-hidden shadow-inner font-bold text-xs">
                <User size={16} />
              </div>
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
                    <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-on-surface">Recent Detections</h3>
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
        <div className="p-4 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full flex-1">
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
                {item.label.split(' ')[0]}
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
