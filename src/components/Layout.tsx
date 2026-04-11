import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  BarChart3, 
  History, 
  Settings, 
  Bell, 
  HelpCircle, 
  Plus,
  Search,
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewSearch, setShowNewSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { settings, updateSettings } = useSettings();

  const navItems = [
    { id: 'live', label: 'Monitor', icon: Video },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const notifications = [
    { id: 1, type: 'alert', title: 'Watchlist Hit', message: 'Plate BN-482-XA detected at North Dock.', time: '2m ago', icon: AlertTriangle, color: 'text-error' },
    { id: 2, type: 'info', title: 'System Update', message: 'ANPR Engine updated to v2.4.1.', time: '1h ago', icon: Info, color: 'text-blue-400' },
    { id: 3, type: 'success', title: 'Backup Complete', message: 'Daily audit log synced to cloud.', time: '4h ago', icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveTab('history');
      setShowNewSearch(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-low">
      {/* Top Navbar */}
      <header className="h-16 border-b border-surface-highest bg-surface/80 backdrop-blur-md flex justify-between items-center px-6 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShieldCheck size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight text-on-surface">
            Sentinel<span className="text-primary">LPR</span>
          </span>
          <div className="hidden md:flex ml-8 items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
              <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
              <span className="text-[10px] font-semibold text-success uppercase tracking-wider">System Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center relative mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
            <input 
              type="text" 
              placeholder="Quick search..." 
              className="bg-surface-high border border-surface-highest rounded-lg py-1.5 pl-9 pr-4 text-xs text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all w-48"
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 rounded-lg transition-all relative ${showNotifications ? 'bg-surface-high text-primary' : 'hover:bg-surface-high text-on-surface-variant'}`}
            >
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-error rounded-full border-2 border-surface"></span>
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-surface border border-surface-highest rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-surface-highest bg-surface-low flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notifications</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-on-surface-variant hover:text-on-surface">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-surface-highest hover:bg-surface-low transition-colors cursor-pointer group">
                          <div className="flex gap-3">
                            <div className={`mt-0.5 ${n.color}`}>
                              <n.icon size={16} />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-0.5">
                                <span className="text-xs font-bold text-on-surface">{n.title}</span>
                                <span className="text-[9px] text-on-surface-variant">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant leading-relaxed">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-3 text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-surface-low transition-all">
                      View All Activity
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="w-8 h-8 rounded-full bg-surface-highest border border-surface-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">
            <HelpCircle size={18} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-surface-highest bg-surface fixed h-[calc(100vh-64px)] z-40">
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group ${
                  activeTab === item.id 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
                }`}
              >
                <item.icon size={18} className={activeTab === item.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'} />
                <span className="text-sm font-medium">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div layoutId="activeNav" className="ml-auto w-1 h-4 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </nav>
          
          <div className="p-4 mt-auto border-t border-surface-highest">
            <button 
              onClick={() => setShowNewSearch(true)}
              className="w-full py-2.5 bg-primary hover:bg-primary-container text-white rounded-lg font-semibold text-xs shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Manual Search
            </button>
            <div className="mt-4 flex items-center justify-between px-2">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">v2.4.1-stable</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                <span className="text-[10px] font-medium text-on-surface-variant">Cloud Sync</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-6 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-surface-highest flex justify-around items-center h-16 z-50 px-4 shadow-lg">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Search Modal */}
      <AnimatePresence>
        {showNewSearch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-low/80 backdrop-blur-sm"
              onClick={() => setShowNewSearch(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-surface-highest rounded-2xl p-6 shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-on-surface">Manual Search</h2>
                <button onClick={() => setShowNewSearch(false)} className="text-on-surface-variant hover:text-on-surface">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleNewSearch} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Plate number or vehicle model..."
                    className="w-full bg-surface-low border border-surface-highest rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowNewSearch(false)}
                    className="flex-1 py-2.5 rounded-xl border border-surface-highest text-on-surface font-semibold text-sm hover:bg-surface-low transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-container transition-all shadow-lg shadow-primary/10"
                  >
                    Search
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
