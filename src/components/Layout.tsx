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
  const [showSettings, setShowSettings] = useState(false);
  const [showNewSearch, setShowNewSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { settings, updateSettings } = useSettings();

  const navItems = [
    { id: 'live', label: 'Live View', icon: Video },
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
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="w-full h-16 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex justify-between items-center px-6 fixed top-0 z-50 shadow-2xl shadow-blue-900/20">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent font-headline">
            License Plate Recognition
          </span>
          <nav className="hidden md:flex gap-6">
            <a className="text-blue-400 font-bold border-b-2 border-blue-500 font-headline text-sm tracking-tight py-5" href="#">
              API: Online
            </a>
            <a className="text-slate-400 font-medium font-headline text-sm tracking-tight hover:bg-white/5 transition-colors py-5 px-2 rounded" href="#">
              Cameras: 24/24
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowSettings(false);
              }}
              className={`p-2 rounded-full transition-all relative ${showNotifications ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-on-surface-variant'}`}
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-surface"></span>
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 glass-panel rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-widest text-white">
                        {showSettings ? 'Alert Preferences' : 'Notifications'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setShowSettings(!showSettings)}
                          className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-primary-container text-white' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}
                        >
                          <Settings size={14} />
                        </button>
                        <button onClick={() => setShowNotifications(false)} className="text-on-surface-variant hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {showSettings ? (
                        <div className="p-5 space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">Watchlist Alerts</span>
                                <span className="text-[10px] text-on-surface-variant">Notify on blacklisted plates</span>
                              </div>
                              <button 
                                onClick={() => updateSettings({ watchlistAlerts: !settings.watchlistAlerts })}
                                className={`w-8 h-4 rounded-full relative transition-colors ${settings.watchlistAlerts ? 'bg-primary-container' : 'bg-surface-highest'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.watchlistAlerts ? 'left-4.5' : 'left-0.5'}`}></div>
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">System Updates</span>
                                <span className="text-[10px] text-on-surface-variant">Engine & API status alerts</span>
                              </div>
                              <button 
                                onClick={() => updateSettings({ systemUpdates: !settings.systemUpdates })}
                                className={`w-8 h-4 rounded-full relative transition-colors ${settings.systemUpdates ? 'bg-primary-container' : 'bg-surface-highest'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.systemUpdates ? 'left-4.5' : 'left-0.5'}`}></div>
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">Audible Alerts</span>
                                <span className="text-[10px] text-on-surface-variant">Play sound on critical hits</span>
                              </div>
                              <button 
                                onClick={() => updateSettings({ audibleAlerts: !settings.audibleAlerts })}
                                className={`w-8 h-4 rounded-full relative transition-colors ${settings.audibleAlerts ? 'bg-primary-container' : 'bg-surface-highest'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.audibleAlerts ? 'left-4.5' : 'left-0.5'}`}></div>
                              </button>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-bold text-white">Confidence Threshold</span>
                              <span className="text-xs font-black text-primary">{settings.confidenceThreshold}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="50" 
                              max="100" 
                              value={settings.confidenceThreshold}
                              onChange={(e) => updateSettings({ confidenceThreshold: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-surface-highest rounded-lg appearance-none cursor-pointer accent-primary-container"
                            />
                            <p className="text-[9px] text-on-surface-variant mt-2 leading-relaxed">
                              Alerts will only be triggered for detections meeting or exceeding this confidence level.
                            </p>
                          </div>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex gap-3">
                              <div className={`mt-0.5 ${n.color}`}>
                                <n.icon size={16} />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-white">{n.title}</span>
                                  <span className="text-[9px] text-on-surface-variant">{n.time}</span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant leading-relaxed">{n.message}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {!showSettings && (
                      <button className="w-full py-3 text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:bg-white/5 transition-all">
                        View All Alerts
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 transition-all text-on-surface-variant">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Side Navigation Bar */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/5 bg-slate-950/40 backdrop-blur-2xl flex flex-col pt-20 pb-6 z-40 hidden md:flex shadow-[40px_0_40px_-20px_rgba(0,11,46,0.15)]">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-white">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white font-headline leading-tight">LPR Control</h2>
              <p className="font-headline uppercase tracking-widest text-[10px] text-blue-400">Kinetic Security</p>
            </div>
          </div>
        </div>
        <nav className="flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-400 border-r-4 border-blue-500' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span className="font-headline uppercase tracking-widest text-[10px] font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 mt-auto">
          <button 
            onClick={() => setShowNewSearch(true)}
            className="w-full py-3 bg-gradient-to-br from-primary-container to-secondary-container text-white rounded-xl font-bold text-xs uppercase tracking-tighter shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            New Search
          </button>
          <div className="mt-4 pt-4 border-t border-white/5">
            <a className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:text-white transition-all text-[10px] uppercase tracking-widest" href="#">
              <HelpCircle size={14} />
              Support
            </a>
          </div>
        </div>
      </aside>

      {/* New Search Modal */}
      <AnimatePresence>
        {showNewSearch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
              onClick={() => setShowNewSearch(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg glass-panel rounded-3xl p-8 shadow-2xl border border-white/10 relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white font-headline">Quick Search</h2>
                <button onClick={() => setShowNewSearch(false)} className="text-on-surface-variant hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleNewSearch} className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Enter plate number, model, or location..."
                    className="w-full bg-surface-high border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowNewSearch(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-primary-container text-white font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Start Search
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 pt-20 p-6 min-h-screen overflow-y-auto bg-surface-low">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900/80 backdrop-blur-xl flex justify-around items-center h-16 z-50 border-t border-white/10 px-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 ${activeTab === item.id ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <item.icon size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
