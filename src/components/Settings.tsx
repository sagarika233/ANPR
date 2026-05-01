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
  Filter,
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
      title: 'Plate Detection',
      icon: Cpu,
      description: 'Adjust how the system detects and reads number plates.',
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
      id: 'processing',
      title: 'Advanced Processing',
      icon: Filter,
      description: 'Configure intelligent image enhancement and multi-sensor behavior.',
      controls: [
        {
          label: 'Multi-Camera Mode',
          description: 'Aggregate all available video inputs into a unified grid.',
          type: 'toggle',
          value: localSettings.multiCameraEnabled,
          onChange: (val: boolean) => setLocalSettings(prev => ({ ...prev, multiCameraEnabled: val }))
        },
        {
          label: 'Edge Sharpening',
          description: 'Apply high-pass filter to clarify license plate characters.',
          type: 'toggle',
          value: localSettings.imageFilters.sharpen,
          onChange: (val: boolean) => setLocalSettings(prev => ({ 
            ...prev, 
            imageFilters: { ...prev.imageFilters, sharpen: val } 
          }))
        },
        {
          label: 'Noise Reduction',
          description: 'Use median filtering to stabilize low-light grainy feeds.',
          type: 'toggle',
          value: localSettings.imageFilters.noiseReduction,
          onChange: (val: boolean) => setLocalSettings(prev => ({ 
            ...prev, 
            imageFilters: { ...prev.imageFilters, noiseReduction: val } 
          }))
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
    <div className="max-w-4xl mx-auto space-y-8 pb-32 sm:pb-24 md:pb-12 px-1">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-tertiary text-white px-8 py-4 rounded-2xl shadow-[0px_16px_48px_rgba(25,28,29,0.2)] flex items-center gap-4 border border-white/10"
          >
            <div className="bg-white/20 p-1.5 rounded-lg">
              <CheckCircle2 size={18} />
            </div>
            <span className="font-black text-xs uppercase tracking-widest">Settings Saved</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-2">Manage Settings</p>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface">System Configuration</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleReset}
            className="bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-high transition-all text-secondary px-6 py-3 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest"
          >
            <RefreshCw size={16} />
            Factory Reset
          </button>
          <button 
            onClick={handleApply}
            className="bg-on-surface text-surface px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl active:scale-95 flex items-center gap-3"
          >
            <Zap size={16} className="text-primary" />
            Save Settings
          </button>
        </div>
      </header>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <motion.section 
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm card-shadow"
          >
            <div className="p-8 border-b border-outline-variant/10 bg-surface-container-low/30 flex items-start gap-6">
              <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 text-primary shadow-sm rotate-3 group-hover:rotate-0 transition-transform">
                <section.icon size={28} />
              </div>
              <div>
                <h2 className="text-xs font-black text-on-surface uppercase tracking-[0.2em]">{section.title}</h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-1.5 leading-relaxed max-w-lg">{section.description}</p>
              </div>
            </div>

            <div className="divide-y divide-outline-variant/5">
              {section.controls.map((control, idx) => (
                <div key={idx} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 hover:bg-surface-container-low/20 transition-colors">
                  <div className="max-w-md">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">{control.label}</h3>
                    <p className="text-[11px] text-on-surface-variant font-bold mt-1.5 opacity-60 leading-relaxed">{control.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-8 min-w-[280px] justify-end">
                    {control.type === 'range' ? (
                      <div className="w-full space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-outline uppercase tracking-widest">Target Sensitivity</span>
                          <span className="text-sm font-black text-primary font-mono">{control.value}{control.unit}</span>
                        </div>
                        <input 
                          type="range"
                          min={control.min}
                          max={control.max}
                          value={control.value as number}
                          onChange={(e) => control.onChange?.(parseInt(e.target.value))}
                          className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary shadow-inner"
                        />
                      </div>
                    ) : (
                      <button 
                        disabled={control.disabled}
                        onClick={() => control.onChange?.(!(control.value as boolean))}
                        className={`w-14 h-7 rounded-full relative transition-all flex items-center p-1 ${control.disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'} ${control.value ? 'bg-primary' : 'bg-surface-container-highest shadow-inner'}`}
                      >
                        <motion.div 
                          animate={{ x: control.value ? 28 : 0 }}
                          className="w-5 h-5 bg-white rounded-full shadow-lg"
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
      <section className="bg-error-container/5 border border-error/20 rounded-2xl p-8 relative overflow-hidden group">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-error/5 rounded-full group-hover:scale-150 transition-transform duration-700 blur-3xl"></div>
        <div className="flex items-start gap-6 relative z-10">
          <div className="p-4 rounded-2xl bg-error-container text-error shadow-lg shadow-error/10">
            <AlertCircle size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-xs font-black text-error uppercase tracking-[0.2em]">Restricted Access Area</h2>
            <p className="text-[11px] text-on-surface-variant font-bold mt-1.5 opacity-60">Important system maintenance and delete options.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="px-6 py-2.5 bg-error/10 hover:bg-error text-error hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-error/20 shadow-sm active:scale-95">
                Purge Data Lake
              </button>
              <button className="px-6 py-2.5 bg-error/10 hover:bg-error text-error hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-error/20 shadow-sm active:scale-95">
                Reset Node Credentials
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
