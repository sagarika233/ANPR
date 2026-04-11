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
  CheckCircle2,
  Lock,
  Eye,
  Smartphone,
  Globe,
  AlertCircle
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [showSuccess, setShowSuccess] = useState(false);

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
      title: 'Recognition Engine',
      icon: Cpu,
      description: 'Fine-tune the ANPR core parameters and sensitivity.',
      controls: [
        {
          label: 'Confidence Threshold',
          description: 'Minimum accuracy required for a valid detection.',
          type: 'range',
          min: 50,
          max: 100,
          value: localSettings.confidenceThreshold,
          onChange: (val: number) => setLocalSettings(prev => ({ ...prev, confidenceThreshold: val })),
          unit: '%'
        },
        {
          label: 'Enhanced OCR Pass',
          description: 'Enable multi-pass analysis for low-light frames.',
          type: 'toggle',
          value: true,
          disabled: false
        }
      ]
    },
    {
      id: 'alerts',
      title: 'Notifications',
      icon: Bell,
      description: 'Configure how you receive critical system alerts.',
      controls: [
        {
          label: 'Watchlist Alerts',
          description: 'Instant notification for blacklisted plates.',
          type: 'toggle',
          value: localSettings.watchlistAlerts,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, watchlistAlerts: val }))
        },
        {
          label: 'Audible Feedback',
          description: 'Play a sound on high-confidence detections.',
          type: 'toggle',
          value: localSettings.audibleAlerts,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, audibleAlerts: val }))
        },
        {
          label: 'System Health',
          description: 'Alerts for camera connectivity and API status.',
          type: 'toggle',
          value: localSettings.systemUpdates,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, systemUpdates: val }))
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Access',
      icon: Shield,
      description: 'Manage data privacy and system permissions.',
      controls: [
        {
          label: 'Data Encryption',
          description: 'Encrypt stored plate numbers in the database.',
          type: 'toggle',
          value: true,
          disabled: true
        },
        {
          label: 'Face Masking',
          description: 'Automatically blur faces in detection frames.',
          type: 'toggle',
          value: false,
          disabled: false
        }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-success text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10"
          >
            <CheckCircle2 size={20} />
            <span className="font-bold text-sm">Configuration saved successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-primary font-bold uppercase tracking-[0.2em] text-[10px] mb-1">System Control</p>
          <h1 className="text-3xl font-black tracking-tight text-on-surface">Settings</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            className="bg-surface border border-surface-highest hover:bg-surface-high transition-colors text-on-surface px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          <button 
            onClick={handleApply}
            className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary-container transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Zap size={14} />
            Save Changes
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section, i) => (
          <motion.section 
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface border border-surface-highest rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="p-6 border-b border-surface-highest bg-surface-low/50 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-surface border border-surface-highest text-primary">
                <section.icon size={24} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">{section.title}</h2>
                <p className="text-xs text-on-surface-variant mt-1">{section.description}</p>
              </div>
            </div>

            <div className="divide-y divide-surface-highest">
              {section.controls.map((control, idx) => (
                <div key={idx} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-surface-low/30 transition-colors">
                  <div className="max-w-md">
                    <h3 className="text-sm font-bold text-on-surface">{control.label}</h3>
                    <p className="text-xs text-on-surface-variant mt-1">{control.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 min-w-[240px] justify-end">
                    {control.type === 'range' ? (
                      <div className="w-full space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                          <span>Sensitivity</span>
                          <span className="text-primary">{control.value}{control.unit}</span>
                        </div>
                        <input 
                          type="range"
                          min={control.min}
                          max={control.max}
                          value={control.value as number}
                          onChange={(e) => control.onChange?.(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-surface-low rounded-full appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    ) : (
                      <button 
                        disabled={control.disabled}
                        onClick={() => control.onChange?.(!(control.value as boolean))}
                        className={`w-12 h-6 rounded-full relative transition-all flex items-center ${control.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${control.value ? 'bg-primary' : 'bg-surface-highest'}`}
                      >
                        <motion.div 
                          animate={{ x: control.value ? 26 : 4 }}
                          className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Danger Zone */}
      <section className="bg-error/5 border border-error/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-error/10 text-error">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-error uppercase tracking-widest">Danger Zone</h2>
            <p className="text-xs text-on-surface-variant mt-1">Irreversible actions that affect system data.</p>
            <div className="mt-6 flex flex-wrap gap-4">
              <button className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-xs font-bold transition-all border border-error/20">
                Purge Detection History
              </button>
              <button className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-xs font-bold transition-all border border-error/20">
                Reset System Credentials
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
