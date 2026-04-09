import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  Volume2, 
  Zap, 
  Database, 
  Cpu,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync local state when global settings change (e.g. on reset)
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleApply = () => {
    updateSettings(localSettings);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleReset = () => {
    resetSettings();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const sections = [
    {
      id: 'detection',
      title: 'Detection Engine',
      icon: Cpu,
      description: 'Configure the ANPR recognition parameters.',
      controls: [
        {
          label: 'Confidence Threshold',
          description: 'Minimum confidence score required to record a detection.',
          type: 'range',
          min: 50,
          max: 100,
          value: localSettings.confidenceThreshold,
          onChange: (val: number) => setLocalSettings(prev => ({ ...prev, confidenceThreshold: val })),
          unit: '%'
        }
      ]
    },
    {
      id: 'alerts',
      title: 'Alerts & Notifications',
      icon: Bell,
      description: 'Manage how the system notifies you of critical events.',
      controls: [
        {
          label: 'Watchlist Alerts',
          description: 'Trigger notifications for blacklisted license plates.',
          type: 'toggle',
          value: localSettings.watchlistAlerts,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, watchlistAlerts: val }))
        },
        {
          label: 'Audible Alerts',
          description: 'Play a sound when a high-priority detection occurs.',
          type: 'toggle',
          value: localSettings.audibleAlerts,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, audibleAlerts: val }))
        },
        {
          label: 'System Updates',
          description: 'Receive alerts about engine status and API connectivity.',
          type: 'toggle',
          value: localSettings.systemUpdates,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, systemUpdates: val }))
        }
      ]
    },
    {
      id: 'system',
      title: 'System Configuration',
      icon: Database,
      description: 'Global system and storage settings.',
      controls: [
        {
          label: 'Auto-Archive',
          description: 'Automatically archive detections older than 30 days.',
          type: 'toggle',
          value: true,
          disabled: true
        },
        {
          label: 'Real-time Sync',
          description: 'Synchronize detections with the central database instantly.',
          type: 'toggle',
          value: true,
          disabled: true
        }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 relative">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-emerald-500/20 flex items-center gap-3 border border-emerald-400/30 backdrop-blur-md"
          >
            <CheckCircle2 size={20} />
            <span className="font-bold text-sm">Settings updated successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-primary-container/20 text-primary">
          <SettingsIcon size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white font-headline">System Settings</h1>
          <p className="text-on-surface-variant">Configure your ANPR environment and detection preferences.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section) => (
          <motion.section 
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-8 border border-white/5 shadow-xl"
          >
            <div className="flex items-start gap-6 mb-8">
              <div className="p-3 rounded-xl bg-white/5 text-blue-400">
                <section.icon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{section.title}</h2>
                <p className="text-sm text-on-surface-variant">{section.description}</p>
              </div>
            </div>

            <div className="space-y-6">
              {section.controls.map((control, idx) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white mb-1">{control.label}</h3>
                    <p className="text-xs text-on-surface-variant max-w-md">{control.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 min-w-[200px] justify-end">
                    {control.type === 'range' ? (
                      <div className="w-full space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-primary uppercase tracking-widest">
                          <span>Sensitivity</span>
                          <span>{control.value}{control.unit}</span>
                        </div>
                        <input 
                          type="range"
                          min={control.min}
                          max={control.max}
                          value={control.value as number}
                          onChange={(e) => control.onChange?.(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-surface-highest rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    ) : (
                      <button 
                        disabled={control.disabled}
                        onClick={() => control.onChange?.(!(control.value as boolean))}
                        className={`w-12 h-6 rounded-full relative transition-all ${control.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${control.value ? 'bg-primary' : 'bg-surface-highest'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${control.value ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <button 
          onClick={handleReset}
          className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-all flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Reset to Defaults
        </button>
        <button 
          onClick={handleApply}
          className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
        >
          <Zap size={16} />
          Apply Changes
        </button>
      </div>
    </div>
  );
}
