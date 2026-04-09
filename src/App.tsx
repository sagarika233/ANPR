/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Layout from './components/Layout';
import LiveView from './components/LiveView';
import Analytics from './components/Analytics';
import History from './components/History';
import Settings from './components/Settings';
import { SettingsProvider } from './context/SettingsContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('live');

  const renderContent = () => {
    switch (activeTab) {
      case 'live':
        return <LiveView />;
      case 'analytics':
        return <Analytics />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <LiveView />;
    }
  };

  return (
    <SettingsProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </SettingsProvider>
  );
}
