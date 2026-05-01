import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StopCircle, 
  PlayCircle,
  CloudUpload, 
  Download,
  Activity, 
  Database, 
  ExternalLink,
  AlertOctagon,
  LineChart,
  CameraOff,
  Camera,
  Maximize2,
  Settings as SettingsIcon,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  Shield,
  Zap,
  Grid,
  Square,
  Layers,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  Car,
  Video,
  ShieldCheck,
  CheckCircle2,
  Focus,
  Sliders,
  ScanEye,
  Loader2
} from 'lucide-react';
import { detectPlate, saveDetectionToBackend, DetectionResult } from '../services/anprService';
import { lookupRegistryDetails } from '../services/registryService';
import { noiseReduction, adaptiveThresholding, sharpenImage, enhanceContrast, binarizeImage } from '../utils/imageUtils';
import { useSettings } from '../context/SettingsContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActiveCamera {
  id: string;
  name: string;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isSelected: boolean;
}

interface QueueItem {
  id: string;
  name: string;
  base64: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  results?: DetectionResult[];
}

export default function LiveView() {
  const { settings, updateSettings } = useSettings();
  const [activeCameras, setActiveCameras] = useState<ActiveCamera[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeFiltersTab, setActiveFiltersTab] = useState<'tools' | 'presets'>('tools');
  const [hasCameraError, setHasCameraError] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [quotaRetryTime, setQuotaRetryTime] = useState<number | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [liveDetections, setLiveDetections] = useState<any[]>([]);
  const [currentDetections, setCurrentDetections] = useState<DetectionResult[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Batch processing state
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(0);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
    detectionsChange: 0,
    confidenceChange: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  // WebSocket Connection
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    const fetchRecentDetections = async () => {
      try {
        const res = await fetch('/api/search');
        const data = await res.json();
        const detections = Array.isArray(data) ? data : (data.data || []);
        
        // Transform back to the format expected by liveDetections
        const formatted = detections.map((d: any) => ({
          ...d,
          plate: d.plate_number,
          id: d.id,
          timestamp: d.timestamp,
          image: d.image_url,
          confidence: d.confidence
        }));
        
        setLiveDetections(formatted.slice(0, 10));
      } catch (err) {
        console.error("Error fetching recent detections:", err);
      }
    };

    fetchStats();
    fetchRecentDetections();
    
    // Enumerate devices
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        // Initially select the first one
        if (videoDevices.length > 0 && selectedDeviceIds.length === 0) {
          setSelectedDeviceIds([videoDevices[0].deviceId]);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };
    getDevices();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        const newDet = message.data;
        
        setLiveDetections(prev => {
          // Temporal Deduplication: Ignore if same plate logged in last 2 seconds
          const isDuplicate = prev.some(d => 
            d.plate === newDet.plate && 
            (new Date(newDet.timestamp).getTime() - new Date(d.timestamp).getTime() < 2000)
          );
          
          if (isDuplicate) return prev;
          return [newDet, ...prev].slice(0, 10);
        });
        
        // Refresh stats when new detection arrives
        fetchStats();
      } else if (message.type === 'ALERT') {
        const alertDet = message.data;
        // Add to live detections first
        setLiveDetections(prev => [alertDet, ...prev].slice(0, 10));
        
        // Add to active alerts overlay
        setActiveAlerts(prev => [alertDet, ...prev].slice(0, 3));
        
        // Auto-remove alert from UI after 10 seconds
        setTimeout(() => {
          setActiveAlerts(prev => prev.filter(a => a.id !== alertDet.id));
        }, 10000);

        // Visual/Audio Cue (simulated)
        if (typeof window !== 'undefined') {
          console.warn(`SURVEILLANCE ALERT: ${alertDet.plate} matches ${alertDet.alertType}`);
        }
        
        fetchStats();
      } else if (message.type === 'SYSTEM_HEALTH') {
        setSystemHealth(message.data);
      }
    };

    wsRef.current = ws;
    return () => {
      ws.close();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const processBatch = async () => {
      if (isProcessingQueue || !isQueueRunning || uploadQueue.length === 0) return;
      
      const nextIndex = uploadQueue.findIndex(item => item.status === 'pending');
      if (nextIndex === -1) {
        setIsProcessingQueue(false);
        setIsQueueRunning(false);
        return;
      }

      setIsProcessingQueue(true);
      setCurrentQueueIndex(nextIndex);
      
      setUploadQueue(prev => prev.map((item, idx) => 
        idx === nextIndex ? { ...item, status: 'processing' } : item
      ));

      const item = uploadQueue[nextIndex];
      setUploadedImage(item.base64);
      setCurrentDetections([]);

      try {
        const results = await detectPlate(item.base64);
        setQuotaUsed(prev => prev + 1);
        
        const validDetections = results ? results.filter(r => r.confidence * 100 >= settings.confidenceThreshold) : [];
        
        for (const det of validDetections) {
          await saveDetectionToBackend({ ...det, image: item.base64 });
        }

        setUploadQueue(prev => prev.map((qItem, idx) => 
          idx === nextIndex ? { ...qItem, status: 'done', results: validDetections } : qItem
        ));
        
        if (validDetections.length > 0) {
          setCurrentDetections(validDetections);
        }
      } catch (error) {
        console.error("Batch processing error:", error);
        setUploadQueue(prev => prev.map((qItem, idx) => 
          idx === nextIndex ? { ...qItem, status: 'error' } : qItem
        ));
      } finally {
        setIsProcessingQueue(false);
      }
    };

    if (isQueueRunning && !isProcessingQueue) {
      if (!uploadQueue.some(item => item.status === 'pending')) {
        setIsQueueRunning(false);
      } else {
        processBatch();
      }
    }
  }, [uploadQueue, isProcessingQueue, isQueueRunning, settings.confidenceThreshold]);

  // Real-time Detection Loop
  const isDectectingCurrentRef = useRef(false);

  useEffect(() => {
    let interval: number | null = null;

    const runDetection = async () => {
      if (isDectectingCurrentRef.current) return;
      
      const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
      if (activeCam?.videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = activeCam.videoRef.current;
        const context = canvas.getContext('2d');
        
        if (context && video.videoWidth > 0) {
          isDectectingCurrentRef.current = true;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          let base64Image = canvas.toDataURL('image/jpeg', 0.8);

          try {
            const results = await detectPlate(base64Image);
            setQuotaUsed(prev => prev + 1);
            
            if (results && results.length > 0) {
              setIsQuotaExceeded(false);
              setIsCoolingDown(false);
              setHasNetworkError(false);
              setQuotaRetryTime(null);
              
              const validDetections = results.filter(r => r.confidence * 100 >= settings.confidenceThreshold);
              
              for (const det of validDetections) {
                await saveDetectionToBackend({ ...det, image: base64Image });
              }

              if (validDetections.length > 0) {
                setCurrentDetections(validDetections);
                
                // Clear detection overlay after 4 seconds
                setTimeout(() => setCurrentDetections([]), 4000);
              }
            } else {
              setHasNetworkError(false);
            }
          } catch (error: any) {
            if (error.message === "QUOTA_EXCEEDED") {
              setIsQuotaExceeded(true);
              setIsDetecting(false);
            } else {
              setHasNetworkError(true);
            }
          } finally {
            isDectectingCurrentRef.current = false;
          }
        }
      }
    };

    if (isDetecting && !isInitializing && !isCoolingDown) {
      // Run immediately
      runDetection();
      // Then set interval - Decreased to 3s for "Correct & Fast" results
      interval = window.setInterval(runDetection, 3000);
      detectionIntervalRef.current = interval;
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      setCurrentDetections([]);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isDetecting, isInitializing, isCoolingDown, settings.confidenceThreshold]);

  // Effect to attach streams when video elements become available
  useEffect(() => {
    activeCameras.forEach(cam => {
      if (isDetecting && cam.stream && cam.videoRef.current) {
        cam.videoRef.current.srcObject = cam.stream;
      }
    });
  }, [isDetecting, activeCameras]);

  const broadcastActivity = (_message: string, _type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    // Activity logging removed per user request
  };

  const startCamera = async () => {
    setIsInitializing(true);
    setHasCameraError(false);
    try {
      // Use selectedDeviceIds or fallback to first available
      let idsToOpen = selectedDeviceIds.filter(id => id && id !== "");
      
      if (idsToOpen.length === 0 && availableDevices.length > 0) {
        const firstId = availableDevices[0].deviceId;
        if (firstId) idsToOpen = [firstId];
      }

      const newActiveCameras: ActiveCamera[] = [];
      
      if (idsToOpen.length === 0) {
        // Fallback: No device IDs found, request generic video to trigger permission and discovery
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
        newActiveCameras.push({
          id: 'default',
          name: 'Primary Camera',
          stream,
          videoRef: React.createRef(),
          isSelected: true
        });
      } else {
        for (const deviceId of idsToOpen) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                deviceId: { exact: deviceId },
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              } 
            });
            
            const deviceInfo = availableDevices.find(d => d.deviceId === deviceId);
            
            newActiveCameras.push({
              id: deviceId,
              name: deviceInfo?.label || `Camera ${newActiveCameras.length + 1}`,
              stream,
              videoRef: React.createRef(),
              isSelected: newActiveCameras.length === 0
            });
          } catch (e) {
            console.warn(`Failed to open camera ${deviceId}, trying fallback:`, e);
            // Even if specific ID failed, try generic for this slot if it's the first one
            if (newActiveCameras.length === 0) {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              newActiveCameras.push({
                id: 'fallback',
                name: 'Main Camera',
                stream,
                videoRef: React.createRef(),
                isSelected: true
              });
            }
          }
        }
      }
      
      setActiveCameras(newActiveCameras);
      setUploadedImage(null);
      setUploadQueue([]);
      setIsQueueRunning(false);
      setCurrentQueueIndex(-1);
      setIsDetecting(true);

      // Refresh devices after permission is granted to get labels
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraError(true);
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleCameraSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId) 
        : [...prev, deviceId]
    );
  };

  const stopCamera = () => {
    activeCameras.forEach(cam => {
      if (cam.stream) {
        cam.stream.getTracks().forEach(track => track.stop());
      }
      if (cam.videoRef.current) {
        cam.videoRef.current.srcObject = null;
      }
    });
    setIsDetecting(false);
    setCurrentDetections([]);
  };

  const applyPreset = async (preset: any) => {
    setZoom(preset.zoom || 1);
    setFocus(preset.focus || 0);
    
    const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
    if (activeCam?.stream) {
      const track = activeCam.stream.getVideoTracks()[0];
      if (track) {
        try {
          const constraints: any = {
            advanced: [{ zoom: preset.zoom }]
          };
          
          if (preset.pan) constraints.advanced[0].pan = preset.pan;
          if (preset.tilt) constraints.advanced[0].tilt = preset.tilt;

          await track.applyConstraints(constraints);
        } catch (e) {
          console.warn("Hardware constraints not supported, using simulated zoom/focus");
        }
      }
    }
  };

  const addPreset = () => {
    const name = prompt("Preset Identifier (e.g., Perimeter North):");
    if (!name) return;
    
    const newPreset = {
      id: Date.now().toString(),
      name,
      zoom: zoom,
      focus: focus,
    };
    
    updateSettings({ cameraPresets: [...settings.cameraPresets, newPreset] });
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsDetecting(false);
      setCurrentDetections([]);
      
      const newItems: QueueItem[] = [];
      const readFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      };

      for (let i = 0; i < files.length; i++) {
        const base64 = await readFile(files[i]);
        newItems.push({
          id: `${Date.now()}-${i}`,
          name: files[i].name,
          base64,
          status: 'pending'
        });
      }

      setUploadQueue(prev => [...prev, ...newItems]);
      setIsQueueRunning(false);
      
      // If single file, set it as active immediately for preview
      if (files.length === 1) {
        setUploadedImage(newItems[0].base64);
      }
    }
  };

  const handleManualDetect = async () => {
    if (uploadQueue.some(i => i.status === 'pending')) {
      setIsQueueRunning(true);
      return;
    }

    let imageToDetect = uploadedImage;

    if (!imageToDetect && isDetecting) {
      const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
      if (activeCam?.videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = activeCam.videoRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageToDetect = canvas.toDataURL('image/jpeg', 0.8);
        }
      }
    }

    if (!imageToDetect) return;

    setCurrentDetections([]);
    setIsProcessing(true);
    try {
      const results = await detectPlate(imageToDetect);
      setQuotaUsed(prev => prev + 1);
      if (results && results.length > 0) {
        setIsQuotaExceeded(false);
        setHasNetworkError(false);
        
        const validDetections = results.filter(r => r.confidence * 100 >= settings.confidenceThreshold);
        
        for (const det of validDetections) {
          // Remove registry enrichment per user request (Privacy focus)
          await saveDetectionToBackend({ ...det, image: imageToDetect });
        }
        
        setCurrentDetections(validDetections);
      }
    } catch (error: any) {
      console.error("Manual detection failed:", error);
      if (error?.message?.includes("429") || error?.message?.includes("Quota")) {
        setIsQuotaExceeded(true);
      } else if (error?.message?.includes("fetch") || error?.message?.includes("Network")) {
        setHasNetworkError(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = () => {
    const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
    if (activeCam?.videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = activeCam.videoRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const captured = canvas.toDataURL('image/jpeg', 0.9);
        setUploadedImage(captured);
        stopCamera();
      }
    }
  };

  const handleCaptureAndDetect = async () => {
    const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
    if (activeCam?.videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = activeCam.videoRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const captured = canvas.toDataURL('image/jpeg', 0.9);
        setUploadedImage(captured);
        stopCamera();
        
        // Now detect on the captured image
        setCurrentDetections([]);
        setIsProcessing(true);
        try {
          const results = await detectPlate(captured);
          setQuotaUsed(prev => prev + 1);
          if (results && results.length > 0) {
            const validDetections = results.filter(r => r.confidence * 100 >= settings.confidenceThreshold);
            
            for (const det of validDetections) {
              // Remove registry enrichment per user request (Privacy focus)
              await saveDetectionToBackend({ ...det, image: captured });
            }
            
            setCurrentDetections(validDetections);
          }
        } catch (error) {
          console.error("Capture & Detect failed:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    }
  };

  const handleDownloadFrame = () => {
    let imageToDownload = uploadedImage;

    if (!imageToDownload && isDetecting && canvasRef.current) {
      const activeCam = activeCameras.find(c => c.isSelected) || activeCameras[0];
      if (activeCam?.videoRef.current) {
        const canvas = canvasRef.current;
        const video = activeCam.videoRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageToDownload = canvas.toDataURL('image/jpeg', 0.9);
        }
      }
    }

    if (!imageToDownload) return;

    const link = document.createElement('a');
    link.href = imageToDownload;
    link.download = `lpr_frame_${new Date().getTime()}.jpg`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 md:pb-12 px-1">
      {/* Analytics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { 
            label: "Scans", 
            value: (stats?.todayDetections ?? 0).toLocaleString(), 
            change: "Today", 
            icon: Car, 
            bg: "bg-primary-fixed",
            text: "text-on-primary-fixed",
            iconBg: "bg-primary/10",
            iconColor: "text-primary"
          },
          { 
            label: "Cameras", 
            value: (stats?.activeCameras ?? 0).toString(), 
            change: "Active", 
            icon: Video, 
            bg: "bg-tertiary-fixed",
            text: "text-on-tertiary-fixed",
            iconBg: "bg-tertiary/10",
            iconColor: "text-tertiary"
          },
          { 
            label: "Alerts", 
            value: (stats?.watchlistHits ?? 0).toString(), 
            change: "Hits", 
            icon: AlertOctagon, 
            bg: "bg-error-container",
            text: "text-on-error-container",
            iconBg: "bg-error/10",
            iconColor: "text-error"
          },
          { 
            label: "Conf", 
            value: `${((stats?.avgConfidence || 0) * 100).toFixed(0)}%`, 
            change: "Avg", 
            icon: LineChart, 
            bg: "bg-secondary-container",
            text: "text-on-secondary-container",
            iconBg: "bg-secondary/10",
            iconColor: "text-secondary"
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            transition={{ delay: i * 0.1, duration: 0.2 }}
            className={`p-3.5 sm:p-5 rounded-2xl shadow-sm border border-outline-variant/10 hover:shadow-xl transition-all card-shadow flex flex-col justify-between relative overflow-hidden group ${stat.bg} ${stat.text}`}
          >
            <div className="flex justify-between items-start mb-2 sm:mb-4 relative z-10">
              <div className={`p-2 sm:p-3 rounded-xl ${stat.iconBg} ${stat.iconColor} transition-transform group-hover:rotate-12`}>
                <stat.icon size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
                {stat.change}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-xl sm:text-3xl font-black tracking-tight leading-none mb-1">{stat.value}</p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-70">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8">
        {/* Main Monitor Section */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-4 sm:space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-md relative group">
            {/* Header */}
            <div className="px-4 sm:px-8 py-3 sm:py-5 border-b border-outline-variant/5 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-surface-container-lowest relative z-20 gap-3 sm:gap-0">
              <div className="flex flex-wrap items-center gap-3 sm:gap-5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isDetecting ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></div>
                <h3 className="text-xs sm:text-lg font-black text-on-surface tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis">LIVE FEED - CAM 01</h3>
                <span className="text-[7px] sm:text-[10px] text-primary font-black uppercase tracking-[0.2em] px-2 sm:px-3 py-1 bg-primary-container/10 rounded-full border border-primary/5 shrink-0">
                  {isDetecting ? 'Live' : 'Standby'}
                </span>
                <span className="hidden sm:flex items-center gap-2 text-[9px] text-on-surface-variant font-bold uppercase tracking-widest pl-4 border-l border-outline-variant/10 opacity-60">
                   <Clock size={12} className="text-primary" />
                   {currentTime}
                </span>
                
                {systemHealth && (
                  <div className="flex items-center gap-4 sm:gap-6 sm:pl-6 sm:border-l border-outline-variant/10">
                    <div className="flex flex-col">
                       <span className="text-[6px] sm:text-[7px] font-black uppercase text-on-surface-variant/40 tracking-widest">Engine</span>
                       <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[8px] sm:text-[9px] font-black text-on-surface uppercase tracking-tight">{systemHealth.dbStatus}</span>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Display Area */}
            <div className="relative aspect-[4/3] sm:aspect-video bg-black group overflow-hidden">
              {/* Active Alerts Overlay */}
              <div className="absolute top-2 right-2 sm:top-6 sm:right-6 z-50 flex flex-col gap-2 sm:gap-4 pointer-events-none w-full max-w-[200px] sm:max-w-[320px]">
                <AnimatePresence>
                  {activeAlerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 50, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.8 }}
                      className="bg-error/95 backdrop-blur-md text-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 pointer-events-auto"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="p-2 bg-white/20 rounded-xl shrink-0">
                          <AlertCircle size={18} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-80 truncate">WATCHLIST</span>
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm sm:text-2xl font-black tracking-widest mb-1 truncate">{alert.plate}</p>
                          <p className="text-[9px] sm:text-[11px] font-bold opacity-90 leading-tight uppercase tracking-tight line-clamp-1">{alert.reason}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {!isDetecting && !uploadedImage ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-lowest text-center p-6 sm:p-12">
                  <div className="w-20 h-20 sm:w-40 sm:h-40 bg-surface-container-high rounded-3xl flex items-center justify-center mb-6 sm:mb-10 shadow-sm border border-outline-variant/10 relative">
                    <CameraOff size={40} className="text-outline-variant sm:w-20 sm:h-20" strokeWidth={1} />
                    <div className="absolute inset-x-0 -bottom-3 sm:-bottom-5 flex justify-center">
                      <div className="px-3 py-1 bg-surface-container-lowest border border-outline-variant/20 rounded-full shadow-sm text-[8px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-wider">
                        Ready to Scan
                      </div>
                    </div>
                  </div>
                  <h4 className="text-lg sm:text-3xl font-black text-on-surface mb-3 tracking-tighter uppercase whitespace-nowrap">Camera Ready</h4>
                  <p className="text-[10px] sm:text-sm text-on-surface-variant max-w-[240px] sm:max-w-md font-medium leading-relaxed opacity-60 uppercase tracking-tight">
                    Start the camera or upload an image to begin automatic plate detection and logging.
                  </p>
                </div>
              ) : (
                <div className="w-full h-full relative group/feed">
                  {/* HUD Brackets - Only relevant on larger screens for tech vibe */}
                  <div className="absolute inset-6 sm:inset-12 pointer-events-none z-20 transition-all duration-1000 group-hover/feed:inset-4 sm:group-hover/feed:inset-8 hidden sm:block">
                    <div className="hud-bracket hud-bracket-tl"></div>
                    <div className="hud-bracket hud-bracket-tr"></div>
                    <div className="hud-bracket hud-bracket-bl"></div>
                    <div className="hud-bracket hud-bracket-br"></div>
                  </div>


                  {/* Overlays */}
                  <div className="absolute inset-0 z-30 pointer-events-none p-4 sm:p-10 flex flex-col justify-between overflow-hidden">
                    <AnimatePresence>
                      {isQuotaExceeded && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="absolute top-4 sm:top-10 left-1/2 -translate-x-1/2 bg-error text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col items-center gap-1 sm:gap-2 pointer-events-auto z-50 border-2 sm:border-4 border-white/20 w-[90%] max-w-sm"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <AlertCircle size={18} className="sm:w-6 sm:h-6" />
                            <span className="font-black uppercase tracking-widest text-[10px] sm:text-sm">API Limit Reached</span>
                          </div>
                          <p className="text-[8px] sm:text-[10px] font-bold opacity-90 uppercase tracking-tight text-center leading-tight">
                            Gemini AI Limit Exhausted (20/day). Sensor processing is paused.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex justify-between items-start w-full">
                      {/* Floating Info Panel - Hidden on small mobile */}
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl w-48 sm:w-72 pointer-events-auto shadow-2xl hidden xs:block"
                      >
                        <div className="flex items-center gap-3 mb-2 sm:mb-4">
                          <Focus size={16} className="text-primary shrink-0" />
                          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface truncate">Live Analytics</span>
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                          <div>
                            <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 leading-none opacity-60">Last Detection</p>
                            <p className="text-lg sm:text-3xl font-black tracking-widest text-on-surface font-headline uppercase leading-none truncate">
                              {currentDetections[0]?.plate || '-- --- --'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[7px] font-black uppercase tracking-widest text-on-surface-variant mb-1 leading-none opacity-60">Status</p>
                              <p className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md truncate ${
                                currentDetections[0]?.status === 'Valid' ? 'bg-tertiary-container/30 text-tertiary shadow-sm' :
                                currentDetections[0]?.status === 'Low Confidence' ? 'bg-amber-100 text-amber-700' :
                                'bg-error-container text-error'
                              }`}>
                                {currentDetections[0]?.status || 'Scanning'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[7px] font-black uppercase tracking-widest text-on-surface-variant mb-1 leading-none opacity-60">Conf</p>
                              <p className="text-[12px] sm:text-sm font-black text-primary font-headline">{currentDetections[0]?.confidence ? `${Math.round(currentDetections[0]?.confidence * 100)}%` : '0%'}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Right Settings Toggle Panel removed as per user request */}
                    </div>

                    {/* Bottom Status Panel removed as per user request */}
                  </div>

                  {uploadedImage ? (
                    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
                      <div className="relative" style={{ aspectRatio: 'auto' }}>
                        <img 
                          src={uploadedImage} 
                          className="max-w-full max-h-full object-contain transition-all duration-500" 
                          style={{ 
                            transform: `scale(${zoom})`,
                            filter: `blur(${focus}px)`
                          }}
                          alt="Captured Frame" 
                          referrerPolicy="no-referrer" 
                        />
                        {/* Overlay for uploaded image */}
                        <div className="absolute inset-0 pointer-events-none z-40">
                          <AnimatePresence>
                            {currentDetections.map((det, idx) => {
                              if (!det.bbox) return null;
                              
                              const aspectRatio = det.bbox.width / det.bbox.height;
                              const centerX = det.bbox.x + det.bbox.width / 2;
                              const centerY = det.bbox.y + det.bbox.height / 2;
                              
                              // Dynamic Sizing: Harmonize with standard HSRP aspect ratios
                              // Long: 4.1, Short/Motorcycle: 1.7
                              const isLong = aspectRatio > 3.0;
                              const pad = det.confidence > 0.95 ? 1.04 : 1.08;
                              
                              const drawWidth = det.bbox.width * pad;
                              const drawHeight = det.bbox.height * pad;

                              return (
                                <motion.div 
                                  key={`${det.plate}-${idx}`}
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ 
                                    opacity: 1, 
                                    scale: 1,
                                    boxShadow: activeAlerts.some(a => a.plate === det.plate) 
                                      ? ['0 0 10px #ef4444', '0 0 30px #ef4444', '0 0 10px #ef4444'] 
                                      : '0 0 15px rgba(59,130,246,0.25)'
                                  }}
                                  transition={{ 
                                    boxShadow: { repeat: Infinity, duration: 1.5 }
                                  }}
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  className={`absolute transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
                                    activeAlerts.some(a => a.plate === det.plate)
                                      ? 'border-error border-[1.5px] z-50'
                                      : 'border-blue-400/70 border-[1px] z-40'
                                  }`}
                                  style={{
                                    left: `${(centerX / 1000) * 100}%`,
                                    top: `${(centerY / 1000) * 100}%`,
                                    width: `${(drawWidth / 1000) * 100}%`,
                                    height: `${(drawHeight / 1000) * 100}%`,
                                    borderRadius: '0px'
                                  }}
                                >
                                  {/* Technical Framing Brackets */}
                                  <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-inherit" />
                                  <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-inherit" />
                                  <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-inherit" />
                                  <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-inherit" />

                                  {/* Scanning Beam for tech feel */}
                                  <motion.div 
                                    initial={{ top: '0%' }}
                                    animate={{ top: '100%' }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-[1px] bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10"
                                  />

                                  <div className={`absolute -top-16 left-1/2 -translate-x-1/2 text-white text-[10px] px-3 py-1.5 font-bold rounded-lg shadow-xl flex flex-col items-center gap-0.5 whitespace-nowrap border border-white/20 backdrop-blur-xl ${
                                    activeAlerts.some(a => a.plate === det.plate)
                                      ? 'bg-error/95 ring-2 ring-error/50 animate-pulse'
                                      : 'bg-slate-900/90'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <span className="tracking-widest uppercase font-black text-xs">
                                        {det.plate}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[8px] opacity-80">
                                      <span className={`w-1.5 h-1.5 rounded-full ${det.confidence > 0.85 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                      {Math.round(det.confidence * 100)}% Match
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full h-full ${settings.viewLayout === 'grid' && activeCameras.length > 1 ? 'grid grid-cols-2 gap-0.5' : 'flex'}`}>
                      {activeCameras.map((cam) => (
                        <div 
                          key={cam.id} 
                          onClick={() => setActiveCameras(prev => prev.map(c => ({ ...c, isSelected: c.id === cam.id })))}
                          className={`relative flex-1 h-full overflow-hidden cursor-pointer group/cam ${settings.viewLayout === 'single' && !cam.isSelected ? 'hidden' : ''} ${cam.isSelected ? 'ring-2 ring-inset ring-blue-600 z-10' : ''}`}
                        >
                          <video 
                            ref={cam.videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover bg-black transition-all duration-500" 
                            style={{ 
                              transform: `scale(${cam.isSelected ? zoom : 1})`,
                              filter: `blur(${cam.isSelected ? focus : 0}px)`
                            }}
                          />
                          {/* Overlay for live camera (only on selected/detecting cam) */}
                          {cam.isSelected && (
                            <div className="absolute inset-0 pointer-events-none z-40">
                              <AnimatePresence>
                                  {currentDetections.map((det, idx) => {
                                    if (!det.bbox) return null;
                                    
                                    const aspectRatio = det.bbox.width / det.bbox.height;
                                    const centerX = det.bbox.x + det.bbox.width / 2;
                                    const centerY = det.bbox.y + det.bbox.height / 2;
                                    
                                    // Dynamic Sizing
                                    const isLong = aspectRatio > 3.0;
                                    const pad = det.confidence > 0.95 ? 1.04 : 1.08;
                                    
                                    const drawWidth = det.bbox.width * pad;
                                    const drawHeight = det.bbox.height * pad;

                                    return (
                                      <motion.div 
                                        key={`${det.plate}-${idx}`}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ 
                                          opacity: 1, 
                                          scale: 1,
                                          boxShadow: activeAlerts.some(a => a.plate === det.plate) 
                                            ? ['0 0 10px #ef4444', '0 0 30px #ef4444', '0 0 10px #ef4444'] 
                                            : '0 0 15px rgba(59,130,246,0.25)'
                                        }}
                                        transition={{ 
                                          boxShadow: { repeat: Infinity, duration: 1.5 }
                                        }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        className={`absolute transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
                                          activeAlerts.some(a => a.plate === det.plate)
                                            ? 'border-error border-[1.5px] z-50'
                                            : 'border-blue-400/70 border-[1px] z-40'
                                        }`}
                                        style={{
                                          left: `${(centerX / 1000) * 100}%`,
                                          top: `${(centerY / 1000) * 100}%`,
                                          width: `${(drawWidth / 1000) * 100}%`,
                                          height: `${(drawHeight / 1000) * 100}%`,
                                          borderRadius: '0px'
                                        }}
                                      >
                                        {/* Technical Framing Brackets */}
                                        <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-inherit" />
                                        <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-inherit" />
                                        <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-inherit" />
                                        <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-inherit" />

                                        {/* Scanning Beam */}
                                        <motion.div 
                                          initial={{ top: '0%' }}
                                          animate={{ top: '100%' }}
                                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                          className="absolute left-0 right-0 h-[1px] bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10"
                                        />

                                        <div className={`absolute -top-16 left-1/2 -translate-x-1/2 text-white text-[10px] px-3 py-1.5 font-bold rounded-lg shadow-xl flex flex-col items-center gap-0.5 whitespace-nowrap border border-white/20 backdrop-blur-xl ${
                                          activeAlerts.some(a => a.plate === det.plate)
                                            ? 'bg-error/95 ring-2 ring-error/50 animate-pulse'
                                            : 'bg-slate-900/90'
                                        }`}>
                                          <div className="flex items-center gap-2">
                                            <span className="tracking-widest uppercase font-black text-xs">
                                              {det.plate}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[8px] opacity-80">
                                            <span className={`w-1.5 h-1.5 rounded-full ${det.confidence > 0.85 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                            {Math.round(det.confidence * 100)}% Match
                                          </div>
                                        </div>
                                      </motion.div>
                                    );
                                })}
                              </AnimatePresence>
                            </div>
                          )}
                          {!cam.isSelected && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cam:opacity-100 transition-opacity">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Select Node</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Primary Actions */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-t border-outline-variant/10 bg-surface-container-lowest relative z-20">
              {/* Lens & Preset Control - Adjusted for mobile */}
              <AnimatePresence>
                {isDetecting && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:gap-10 overflow-hidden"
                  >
                    <div className="flex-1 w-full space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        <span className="flex items-center gap-2">
                           <Maximize2 size={14} className="text-primary" />
                           Zoom ({zoom.toFixed(1)}x)
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        step="0.1" 
                        value={zoom} 
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        <span className="flex items-center gap-2">
                           <Focus size={14} className="text-primary" />
                           Focus ({focus}px)
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="1" 
                        value={focus} 
                        onChange={(e) => setFocus(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
                {isDetecting ? (
                  <>
                    <button 
                      onClick={stopCamera}
                      className="px-5 py-4 bg-error-container text-error border border-error/10 rounded-2xl sm:rounded-3xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 flex-1 min-w-[140px]"
                    >
                      <StopCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                      Stop
                    </button>
                    <button 
                      onClick={handleCapture}
                      className="px-5 py-4 bg-on-surface text-surface rounded-2xl sm:rounded-3xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-md active:scale-95 flex-1 min-w-[140px]"
                    >
                      <Camera size={16} className="sm:w-[18px] sm:h-[18px]" />
                      Capture
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={startCamera}
                    className="signature-gradient text-white px-8 py-5 rounded-2xl sm:rounded-3xl font-black text-[10px] uppercase tracking-widest translate-z-0 shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all group w-full sm:w-auto min-w-[240px]"
                  >
                    <Video size={18} className="group-hover:scale-110 transition-transform" />
                    Start Camera
                  </button>
                )}
                
                <button 
                  onClick={handleFileUpload}
                  className="px-6 py-4 bg-surface-container-high text-on-surface border border-outline-variant/10 rounded-2xl sm:rounded-3xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 w-full sm:w-auto min-w-[200px]"
                >
                  <CloudUpload size={16} className="sm:w-[18px] sm:h-[18px]" />
                  Upload Image
                </button>

                <button 
                  onClick={isDetecting ? handleCaptureAndDetect : (isQueueRunning ? () => setIsQueueRunning(false) : handleManualDetect)}
                  disabled={(isProcessing || isProcessingQueue) || (!isDetecting && !uploadedImage && uploadQueue.length === 0)}
                  className={`px-6 py-4 rounded-2xl sm:rounded-3xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto min-w-[220px] ${
                    (isProcessing || isProcessingQueue) 
                      ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed border border-outline-variant/10' 
                      : (isDetecting || uploadedImage || uploadQueue.length > 0)
                        ? (isQueueRunning ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-primary text-white hover:opacity-90 shadow-primary/20')
                        : 'bg-surface-container-low text-on-surface-variant/30 cursor-not-allowed border border-outline-variant/5'
                  }`}
                >
                  {(isProcessing || isProcessingQueue) ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Analyzing</span>
                    </div>
                  ) : (
                    <>
                      {isQueueRunning ? <StopCircle size={16} /> : <ScanEye size={16} />}
                      <span>{isQueueRunning ? 'Abort Batch' : 'Initiate Scan'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Recent Detections */}
        <div className="space-y-4 sm:space-y-6">
          {/* Batch Processing Queue */}
          {uploadQueue.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-sm flex flex-col max-h-[300px] overflow-hidden">
              <div className="p-4 border-b border-outline-variant/5 bg-surface-container-low/50 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface leading-none">Processing Queue ({uploadQueue.filter(i => i.status === 'done').length}/{uploadQueue.length})</h3>
                <button 
                  onClick={() => {
                    setUploadQueue([]);
                    setUploadedImage(null);
                    setCurrentDetections([]);
                    setCurrentQueueIndex(-1);
                  }}
                  className="text-error hover:text-error/80 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {uploadQueue.map((item, idx) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      if (item.status === 'done' || item.status === 'error') {
                        setUploadedImage(item.base64);
                        setCurrentDetections(item.results || []);
                        setCurrentQueueIndex(idx);
                      }
                    }}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer border ${
                      currentQueueIndex === idx ? 'bg-primary/5 border-primary/20' : 'hover:bg-surface-container-low border-transparent'
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                      <img src={item.base64} className="w-full h-full object-cover opacity-60" alt="" referrerPolicy="no-referrer" />
                      {item.status === 'processing' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 size={16} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-on-surface truncate uppercase tracking-tight">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[7px] font-black uppercase tracking-widest ${
                          item.status === 'done' ? 'text-tertiary' :
                          item.status === 'processing' ? 'text-primary' :
                          item.status === 'error' ? 'text-error' : 'text-outline-variant'
                        }`}>
                          {item.status}
                        </span>
                        {item.status === 'done' && item.results && (
                          <span className="text-[7px] font-bold text-on-surface-variant bg-surface-container-highest px-1.5 py-0.5 rounded">
                            {item.results.length} PLATES
                          </span>
                        )}
                      </div>
                    </div>
                    {item.status === 'done' && (
                      <CheckCircle2 size={14} className="text-tertiary" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle size={14} className="text-error" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-sm flex flex-col max-h-[500px] sm:max-h-[600px] xl:max-h-[85vh] overflow-hidden transition-all duration-300">
            <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-outline-variant/5 bg-surface-container-low/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-on-surface leading-none mb-0.5">Recent Detections</h3>
                <p className="text-[8px] sm:text-[9px] text-on-surface-variant font-medium uppercase tracking-tight opacity-60">Real-time stream</p>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-600 animate-pulse" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 custom-scrollbar">
              {liveDetections.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-8 opacity-40 min-h-[200px]">
                  <Database size={40} className="mb-4 text-slate-300" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Awaiting Detections...</p>
                </div>
              ) : (
                liveDetections.map((det, i) => (
                    <motion.div 
                      key={det.id || i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 sm:p-4 bg-surface-container-lowest border border-outline-variant/5 rounded-2xl hover:bg-surface-container-low hover:scale-[1.01] transition-all cursor-pointer group shadow-sm ${
                        det.status === 'Valid' ? 'border-l-4 border-l-primary' : 
                        det.status === 'Low Confidence' ? 'border-l-4 border-l-amber-500' : 
                        'border-l-4 border-l-error'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                        <span className={`text-lg font-bold tracking-widest group-hover:text-primary transition-colors flex items-center gap-2 font-headline leading-none ${
                          det.status === 'Valid' ? 'text-on-surface' :
                          det.status === 'Low Confidence' ? 'text-amber-700' :
                          'text-error'
                        }`}>
                          {det.plate}
                          {det.is_enhanced && <Zap size={12} className="text-primary fill-primary animate-pulse" />}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                            det.status === 'Valid' ? 'bg-primary text-white' : 
                            det.status === 'Low Confidence' ? 'bg-amber-500 text-white' : 
                            'bg-error text-white'
                          }`}>
                            {Math.round(det.confidence * 100)}%
                          </span>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-60 text-outline">
                            {det.status}
                          </span>
                        </div>
                      </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-bold uppercase tracking-tight opacity-70">
                        <Clock size={12} className="text-primary/60" />
                        <span>{new Date(det.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-bold uppercase tracking-tight opacity-70">
                        <MapPin size={12} className="text-primary/60" />
                        <span className="truncate">{det.location || 'Entrance A'}</span>
                      </div>
                    </div>

                    {det.make && (
                      <div className="pt-3 border-t border-outline-variant/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight leading-none truncate pr-2 opacity-80">
                            {det.vehicle_type ? `${det.vehicle_type}` : 'VEHICLE'} • <span className="text-primary font-black uppercase">{det.make} {det.model}</span>
                          </span>
                          <ExternalLink size={12} className="text-outline-variant group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'history' }))}
              className="p-3.5 sm:p-4 text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.2em] border-t border-outline-variant/10 hover:bg-surface-container-low transition-all bg-surface-container-lowest"
            >
              View Full History
            </button>
          </div>
        </div>
      </div>

      {/* Full-width System Logs Table Section */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-md border border-outline-variant/5 overflow-hidden mt-6">
        <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-on-surface">System Logs</h3>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5">History of scanned plates</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button 
              onClick={() => {
                const doc = new jsPDF();
                doc.setFontSize(22);
                doc.setTextColor(30, 41, 59);
                doc.text('Security System: Status Report', 14, 22);
                
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
                doc.text(`Summary of Recent Detections`, 14, 35);
                
                const tableHeaders = [['Plate', 'Make', 'Model', 'Location', 'Timestamp', 'Confidence', 'Status']];
                const tableData = liveDetections.slice(0, 20).map(row => [
                  row.plate || 'N/A',
                  row.make || 'N/A',
                  row.model || 'N/A',
                  row.location || 'Entrance A',
                  new Date(row.timestamp).toLocaleString(),
                  `${((row.confidence || 0) * 100).toFixed(1)}%`,
                  row.status || 'N/A'
                ]);

                autoTable(doc, {
                  startY: 45,
                  head: tableHeaders,
                  body: tableData,
                  theme: 'striped',
                  headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10, fontStyle: 'bold' },
                  bodyStyles: { fontSize: 9, textColor: 51 },
                  alternateRowStyles: { fillColor: [248, 250, 252] },
                  margin: { top: 45 }
                });

                doc.save(`system_logs_${new Date().getTime()}.pdf`);
              }}
              className="px-5 py-2.5 bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-surface-dim transition-colors flex items-center gap-2"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'history' }))}
              className="px-5 py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg shadow-primary/20 transition-all"
            >
              Full History
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10 hidden md:table-cell">Record ID</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Vehicle Details</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">License Plate</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10 hidden lg:table-cell">Region</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10 hidden sm:table-cell">Confidence</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {liveDetections.length > 0 ? (
                liveDetections.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-[11px] font-mono font-bold text-on-surface-variant hidden md:table-cell selection:bg-primary selection:text-white">#{String(row.id || '').slice(-6).toUpperCase() || 'UNKSYS'}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-7 sm:w-12 sm:h-8 bg-black rounded border border-outline-variant/10 overflow-hidden shrink-0">
                          {row.image_url || row.image ? (
                            <img src={row.image_url || row.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-container-low">
                               <Car size={10} className="text-outline-variant opacity-20" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-on-surface uppercase truncate max-w-[80px] sm:max-w-[120px] leading-tight">{row.make || 'Vehicle'}</span>
                          <span className="text-[8px] font-medium text-on-surface-variant/60 uppercase">{row.model || 'Unknown'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <span className="inline-block px-2 sm:px-3 py-1 bg-on-surface text-surface rounded sm:rounded-lg font-headline font-black text-[11px] sm:text-sm tracking-widest shadow-sm">
                        {row.plate}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] font-bold text-on-surface-variant uppercase hidden lg:table-cell">{row.location || 'Entrance A'}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden hidden xl:block">
                          <div 
                            className={`h-full ${row.confidence > 0.8 ? 'bg-primary' : row.confidence > 0.5 ? 'bg-amber-500' : 'bg-error'}`}
                            style={{ width: `${(row.confidence || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-on-surface">{Math.round((row.confidence || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${
                        row.status === 'Valid' ? 'bg-primary/10 text-primary border border-primary/10' : 
                        row.status === 'Low Confidence' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/10' : 
                        'bg-error/10 text-error border border-error/10'
                      }`}>
                        {row.status || 'Scanned'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-10 py-12 text-center opacity-40">
                    <Activity size={32} className="mx-auto mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">No plate records found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hidden Elements */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        multiple
        className="hidden" 
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
