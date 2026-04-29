/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LiveView from './components/LiveView';
import History from './components/History';
import { SettingsProvider } from './context/SettingsContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  useEffect(() => {
    // Listen for custom tab change events from sub-components
    const handleTabChange = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'live':
        return <LiveView />;
      case 'history':
        return <History initialSearch={globalSearchQuery} />;
      case 'alerts':
        return (
          <div className="flex flex-col items-center justify-center p-6 sm:p-24 bg-surface-container-low rounded-3xl sm:rounded-[3rem] border border-dashed border-outline-variant/40 space-y-6 sm:space-y-8 overflow-hidden w-full max-w-4xl mx-auto min-h-[350px] sm:min-h-[450px]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-high flex items-center justify-center text-outline-variant shadow-inner">
              <span className="material-symbols-outlined text-3xl sm:text-5xl">notifications_active</span>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-on-surface font-headline uppercase tracking-tight">Smart Alerts</h2>
              <p className="text-[10px] sm:text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Automatic Watchlist</p>
            </div>
            <p className="text-on-surface-variant text-sm sm:text-base max-w-md text-center leading-relaxed opacity-70 font-medium px-2 sm:px-0">
              Set up alerts to find specific license plates automatically. Connect your security list to get notified instantly when a match is found.
            </p>
            <button className="px-10 py-4 bg-primary text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest hover:shadow-xl transition-all active:scale-95 hover:-translate-y-1">
              Set Up Alerts
            </button>
          </div>
        );
      case 'health':
        return (
          <div className="flex flex-col items-center justify-center p-6 sm:p-24 bg-surface-container-low rounded-3xl sm:rounded-[3rem] border border-dashed border-outline-variant/40 space-y-6 sm:space-y-8 overflow-hidden w-full max-w-4xl mx-auto min-h-[350px] sm:min-h-[450px]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-high flex items-center justify-center text-outline-variant shadow-inner">
              <span className="material-symbols-outlined text-3xl sm:text-5xl">monitoring</span>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-on-surface font-headline uppercase tracking-tight">System Health</h2>
              <p className="text-[10px] sm:text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Live Performance status</p>
            </div>
            <p className="text-on-surface-variant text-sm sm:text-base max-w-md text-center leading-relaxed opacity-70 font-medium px-2 sm:px-0">
              Check if your cameras and sensors are working correctly. See how well the system is running and if there are any connection issues.
            </p>
            <button className="px-10 py-4 bg-surface-container-highest text-on-surface-variant border border-outline-variant/20 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest hover:bg-surface-dim transition-all active:scale-95 hover:-translate-y-1">
              Refresh status
            </button>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <SettingsProvider>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        searchQuery={globalSearchQuery}
        setSearchQuery={setGlobalSearchQuery}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </SettingsProvider>
  );
}
