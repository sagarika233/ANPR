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
  CameraOff,
  Camera,
  Maximize2,
  Settings as SettingsIcon,
  Clock,
  MapPin,
  AlertCircle,
  TrendingUp,
  Shield,
  Zap
} from 'lucide-react';
import { detectPlate, saveDetectionToBackend, DetectionResult } from '../services/anprService';
import { useSettings } from '../context/SettingsContext';

export default function LiveView() {
  const { settings } = useSettings();
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
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
  const [systemActivities, setSystemActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayDetections: 0,
    activeCameras: 1,
    watchlistHits: 0,
    avgConfidence: 0,
    detectionsChange: 0,
    confidenceChange: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  // WebSocket Connection
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    fetchStats();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        setLiveDetections(prev => [message.data, ...prev].slice(0, 10));
        // Refresh stats when new detection arrives
        fetchStats();
      } else if (message.type === 'SYSTEM_ACTIVITY') {
        setSystemActivities(prev => [message.data, ...prev].slice(0, 15));
        
        // Add notification
        const newNotif = { ...message.data, id: Date.now() };
        setNotifications(prev => [...prev, newNotif]);
        
        // Auto-remove notification after 5s
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
        }, 5000);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  // Real-time Detection Loop
  useEffect(() => {
    let interval: number | null = null;

    const runDetection = async () => {
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64Image = canvas.toDataURL('image/jpeg', 0.8);
          try {
            const results = await detectPlate(base64Image);
            setQuotaUsed(prev => prev + 1);
            
            if (results && results.length > 0) {
              setIsQuotaExceeded(false);
              setIsCoolingDown(false);
              setHasNetworkError(false);
              setQuotaRetryTime(null);
              
              const validDetections = results.filter(r => r.confidence * 100 >= settings.confidenceThreshold);
              if (validDetections.length > 0) {
                setCurrentDetections(validDetections);
                for (const det of validDetections) {
                  await saveDetectionToBackend(det);
                }
                
                // Clear detection overlay after 4 seconds to ensure it stays visible until next pass
                setTimeout(() => setCurrentDetections([]), 4000);
              }
            } else {
              // No detections is fine, just continue
              setHasNetworkError(false);
            }
          } catch (error: any) {
            if (error.message === "QUOTA_EXCEEDED") {
              setIsQuotaExceeded(true);
              setIsDetecting(false);
            } else {
              setHasNetworkError(true);
            }
          }
        }
      }
    };

    if (isDetecting && !isInitializing && !isCoolingDown) {
      // Run immediately
      runDetection();
      // Then set interval
      interval = window.setInterval(runDetection, 5000);
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

  // Effect to attach stream when video element becomes available
  useEffect(() => {
    if (isDetecting && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isDetecting]);

  const startCamera = async () => {
    setIsInitializing(true);
    setHasCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      streamRef.current = stream;
      setUploadedImage(null);
      setIsDetecting(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraError(true);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsDetecting(false);
    setCurrentDetections([]);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setUploadedImage(base64);
        setIsDetecting(false);
        setCurrentDetections([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualDetect = async () => {
    let imageToDetect = uploadedImage;

    if (!imageToDetect && isDetecting && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageToDetect = canvas.toDataURL('image/jpeg', 0.8);
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
        setCurrentDetections(validDetections);
        for (const det of validDetections) {
          await saveDetectionToBackend(det);
        }
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
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
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
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
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
            setCurrentDetections(validDetections);
            for (const det of validDetections) {
              await saveDetectionToBackend(det);
            }
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

    if (!imageToDownload && isDetecting && videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageToDownload = canvas.toDataURL('image/jpeg', 0.9);
      }
    }

    if (!imageToDownload) return;

    const link = document.createElement('a');
    link.href = imageToDownload;
    link.download = `lpr_frame_${new Date().getTime()}.jpg`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: "Today's Detections", 
            value: stats.todayDetections.toLocaleString(), 
            change: (stats.detectionsChange || 0) === 0 ? "Live" : `${(stats.detectionsChange || 0) > 0 ? '+' : ''}${(stats.detectionsChange || 0).toFixed(1)}%`, 
            icon: Zap, 
            color: "text-primary" 
          },
          { 
            label: "Active Cameras", 
            value: stats.activeCameras.toString(), 
            change: "Stable", 
            icon: Activity, 
            color: "text-success" 
          },
          { 
            label: "Watchlist Hits", 
            value: stats.watchlistHits.toString(), 
            change: stats.watchlistHits > 0 ? "Critical" : "Clear", 
            icon: Shield, 
            color: stats.watchlistHits > 0 ? "text-error" : "text-success" 
          },
          { 
            label: "Average Confidence", 
            value: `${((stats.avgConfidence || 0) * 100).toFixed(1)}%`, 
            change: (stats.confidenceChange || 0) === 0 ? "Real-time" : `${(stats.confidenceChange || 0) > 0 ? '+' : ''}${(stats.confidenceChange || 0).toFixed(1)}%`, 
            icon: TrendingUp, 
            color: "text-tertiary" 
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface border border-surface-highest p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-lg bg-surface-low ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                stat.change.includes('+') ? 'bg-success/10 text-success' : 
                stat.change === 'Critical' ? 'bg-error/10 text-error' : 'bg-surface-highest text-on-surface-variant'
              }`}>
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-on-surface">{stat.value}</p>
            <p className="text-xs text-on-surface-variant font-medium">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Monitor Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-surface-highest rounded-2xl overflow-hidden shadow-lg group relative">
            {/* Camera Info Overlay */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <div className="bg-surface/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isDetecting ? 'bg-success animate-pulse' : 'bg-on-surface-variant'}`}></div>
                <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">
                  CAM-01 • MAIN ENTRANCE
                </span>
              </div>
              <div className="bg-surface/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Camera Actions Overlay */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {isDetecting && (
                <button 
                  onClick={stopCamera}
                  className="p-2 bg-error/20 backdrop-blur-md border border-error/20 rounded-lg text-error hover:bg-error/30 transition-colors"
                  title="Turn Off Camera"
                >
                  <CameraOff size={16} />
                </button>
              )}
              <button className="p-2 bg-surface/80 backdrop-blur-md border border-white/10 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                <Maximize2 size={16} />
              </button>
              <button className="p-2 bg-surface/80 backdrop-blur-md border border-white/10 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                <SettingsIcon size={16} />
              </button>
            </div>

            {/* Video Stage */}
            <div className="aspect-video bg-surface-low relative flex items-center justify-center overflow-hidden">
              {!isDetecting && !uploadedImage ? (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-surface-high rounded-2xl flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
                    <CameraOff size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface mb-1">Camera Offline</h3>
                  <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
                    Waiting for camera input. Connect a live feed or upload an image to begin detection.
                  </p>
                  <button 
                    onClick={startCamera}
                    disabled={isInitializing}
                    className="mt-6 px-6 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2 mx-auto"
                  >
                    {isInitializing ? <Activity size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                    Initialize Camera
                  </button>
                </div>
              ) : (
                <>
                  {uploadedImage ? (
                    <img src={uploadedImage} className="w-full h-full object-contain" alt="Uploaded" />
                  ) : (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* AI Detection Overlay */}
                  <AnimatePresence>
                    {currentDetections.map((det, idx) => det.bbox && (
                      <motion.div 
                        key={`${det.plate}-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 pointer-events-none z-10"
                      >
                        <div 
                          className="absolute border-2 border-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] rounded-sm"
                          style={{
                            left: `${(det.bbox.x / 1000) * 100}%`,
                            top: `${(det.bbox.y / 1000) * 100}%`,
                            width: `${(det.bbox.width / 1000) * 100}%`,
                            height: `${(det.bbox.height / 1000) * 100}%`,
                          }}
                        >
                          <div className="hud-bracket hud-bracket-tl"></div>
                          <div className="hud-bracket hud-bracket-tr"></div>
                          <div className="hud-bracket hud-bracket-bl"></div>
                          <div className="hud-bracket hud-bracket-br"></div>
                          
                          <div className="absolute -top-12 left-0 bg-primary text-white text-[10px] px-3 py-1.5 font-bold rounded-lg shadow-xl flex flex-col min-w-[120px]">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="tracking-widest">{det.plate}</span>
                              <span className="opacity-80">{((det.confidence || 0) * 100).toFixed(0)}%</span>
                            </div>
                            {det.make && (
                              <span className="text-[8px] opacity-70 uppercase tracking-wider">{det.make} {det.model}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </>
              )}

              {/* Status Bar */}
              <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between items-center">
                <div className="flex gap-2">
                  {uploadedImage && (
                    <button 
                      onClick={() => {
                        setUploadedImage(null);
                        setCurrentDetections([]);
                        startCamera();
                      }}
                      className="bg-primary/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-lg hover:bg-primary transition-all"
                    >
                      <Camera size={14} />
                      BACK TO LIVE
                    </button>
                  )}
                  {isQuotaExceeded && (
                    <div className="bg-error/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-lg">
                      <AlertCircle size={14} />
                      QUOTA LIMIT REACHED
                    </div>
                  )}
                  {hasNetworkError && (
                    <div className="bg-warning/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-lg">
                      <Activity size={14} />
                      NETWORK UNSTABLE
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="p-4 bg-surface border-t border-surface-highest flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isDetecting ? (
                  <button 
                    onClick={stopCamera}
                    className="px-4 py-2 bg-surface-low border border-surface-highest text-on-surface hover:bg-surface-high rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                  >
                    <StopCircle size={16} className="text-error" />
                    Stop & Turn Off Camera
                  </button>
                ) : (
                  <button 
                    onClick={startCamera}
                    className="px-4 py-2 bg-primary text-white hover:bg-primary-container rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/10"
                  >
                    <PlayCircle size={16} />
                    Start Monitoring
                  </button>
                )}
                <button 
                  onClick={handleFileUpload}
                  className="px-4 py-2 bg-surface-low border border-surface-highest text-on-surface hover:bg-surface-high rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <CloudUpload size={16} className="text-primary" />
                  Upload Frame
                </button>
                {isDetecting && (
                  <button 
                    onClick={handleCapture}
                    className="px-4 py-2 bg-surface-low border border-surface-highest text-on-surface hover:bg-surface-high rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                  >
                    <Camera size={16} className="text-tertiary" />
                    Capture
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Confidence</p>
                  <p className="text-xs font-black text-primary">{settings.confidenceThreshold}%</p>
                </div>
                <button 
                  onClick={handleDownloadFrame}
                  disabled={!isDetecting && !uploadedImage}
                  className="p-2 bg-surface-low border border-surface-highest text-on-surface hover:bg-surface-high rounded-xl transition-all disabled:opacity-30"
                  title="Download Current Frame"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={isDetecting ? handleCaptureAndDetect : handleManualDetect}
                  disabled={isProcessing || (!isDetecting && !uploadedImage)}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                    isProcessing 
                      ? 'bg-surface-highest text-on-surface-variant' 
                      : 'bg-primary text-white hover:bg-primary-container shadow-lg shadow-primary/20'
                  }`}
                >
                  {isProcessing ? 'Processing...' : (isDetecting ? 'Capture & Detect' : 'Analyze Frame')}
                </button>
              </div>
            </div>
          </div>

          {/* System Activity Feed */}
          <div className="bg-surface border border-surface-highest rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-surface-highest flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest">System Activity</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Auto-refresh: 60s</span>
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-surface-highest custom-scrollbar">
              {systemActivities.length > 0 ? (
                systemActivities.map((activity) => (
                  <div key={activity.id} className="p-3 flex items-start gap-4 hover:bg-surface-low transition-colors">
                    <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap pt-0.5">
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour12: false })}
                    </span>
                    <p className="text-xs text-on-surface font-medium leading-relaxed">
                      {activity.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50">
                    Waiting for system events...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Recent Detections */}
        <div className="space-y-6">
          <div className="bg-surface border border-surface-highest rounded-2xl shadow-lg flex flex-col h-[calc(100vh-280px)] lg:h-[600px]">
            <div className="p-4 border-b border-surface-highest flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Live Detections</h3>
              <Activity size={14} className="text-primary animate-pulse" />
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {liveDetections.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                  <Database size={32} className="mb-2" />
                  <p className="text-xs font-medium">No recent activity</p>
                </div>
              ) : (
                liveDetections.map((det, i) => (
                  <motion.div 
                    key={det.id || i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-surface-low border border-surface-highest rounded-xl hover:border-primary/30 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-black text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        {det.plate}
                      </span>
                      <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded">
                        {Math.round(det.confidence * 100)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                        <Clock size={10} />
                        <span>{new Date(det.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                        <MapPin size={10} />
                        <span>{det.location || 'Main Entrance'}</span>
                      </div>
                    </div>
                    {det.make && (
                      <div className="mt-2 pt-2 border-t border-surface-highest flex items-center justify-between">
                        <span className="text-[9px] font-bold text-on-surface uppercase">{det.make} {det.model}</span>
                        <ExternalLink size={10} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
            
            <button className="p-4 text-[10px] font-bold text-primary uppercase tracking-widest border-t border-surface-highest hover:bg-surface-low transition-all">
              View Full History
            </button>
          </div>

          {/* Quick Actions / Tools */}
          <div className="bg-surface border border-surface-highest rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Quick Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  const headers = ['Plate', 'Timestamp', 'Confidence'];
                  const csvContent = [
                    headers.join(','),
                    ...liveDetections.map(det => `${det.plate},${det.timestamp},${det.confidence}`)
                  ].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `live_detections_${new Date().toISOString()}.csv`);
                  link.click();
                }}
                className="p-3 bg-surface-low hover:bg-surface-high border border-surface-highest rounded-xl text-center transition-all group"
              >
                <Database size={18} className="mx-auto mb-1 text-on-surface-variant group-hover:text-primary" />
                <span className="text-[10px] font-bold text-on-surface">Export Log</span>
              </button>
              <button className="p-3 bg-surface-low hover:bg-surface-high border border-surface-highest rounded-xl text-center transition-all group">
                <Shield size={18} className="mx-auto mb-1 text-on-surface-variant group-hover:text-error" />
                <span className="text-[10px] font-bold text-on-surface">Watchlist</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Elements */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Real-time Notifications Overlay */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="pointer-events-auto bg-surface-high border border-surface-highest shadow-2xl rounded-xl p-4 flex items-center gap-4 min-w-[300px] max-w-md"
            >
              <div className={`p-2 rounded-lg ${
                notif.type === 'success' ? 'bg-success/10 text-success' : 
                notif.type === 'warning' ? 'bg-warning/10 text-warning' :
                notif.type === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
              }`}>
                <Zap size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-on-surface leading-tight">{notif.message}</p>
                <p className="text-[10px] text-on-surface-variant mt-1 font-medium">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <Maximize2 size={14} className="rotate-45" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
