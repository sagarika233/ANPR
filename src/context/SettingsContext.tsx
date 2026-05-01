import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CameraPreset {
  id: string;
  name: string;
  zoom?: number;
  focusMode?: string;
  exposureMode?: string;
}

interface ImageFilters {
  sharpen: boolean;
  enhanceContrast: boolean;
  noiseReduction: boolean;
  adaptiveThreshold: boolean;
  binarize: boolean;
}

interface Settings {
  confidenceThreshold: number;
  watchlistAlerts: boolean;
  systemUpdates: boolean;
  audibleAlerts: boolean;
  imageFilters: ImageFilters;
  cameraPresets: CameraPreset[];
  viewLayout: 'single' | 'grid';
  multiCameraEnabled: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  confidenceThreshold: 70,
  watchlistAlerts: true,
  systemUpdates: true,
  audibleAlerts: false,
  imageFilters: {
    sharpen: true,
    enhanceContrast: true,
    noiseReduction: false,
    adaptiveThreshold: false,
    binarize: false,
  },
  cameraPresets: [
    { id: '1', name: 'Standard Wide', zoom: 1 },
    { id: '2', name: 'Close Range', zoom: 2.5 },
  ],
  viewLayout: 'single',
  multiCameraEnabled: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
