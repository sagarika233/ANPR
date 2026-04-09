import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StopCircle, 
  PlayCircle,
  CloudUpload, 
  Activity, 
  Database, 
  ExternalLink,
  CameraOff
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
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/detect`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'NEW_DETECTION') {
        setLiveDetections(prev => [message.data, ...prev].slice(0, 50));
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  // Real-time Detection Loop
  useEffect(() => {
    if (isDetecting && !isInitializing && !isCoolingDown) {
      detectionIntervalRef.current = window.setInterval(async () => {
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
              const result = await detectPlate(base64Image);
              setQuotaUsed(prev => prev + 1);
              
              if (result) {
                setIsQuotaExceeded(false);
                setIsCoolingDown(false);
                setHasNetworkError(false);
                setQuotaRetryTime(null);
                if (result.confidence * 100 >= settings.confidenceThreshold) {
                  setCurrentDetection(result);
                  await saveDetectionToBackend(result);
                  
                  // Clear detection overlay after 2 seconds
                  setTimeout(() => setCurrentDetection(null), 2000);
                }
              } else {
                // If result is null, it might be a network error or other transient issue
                setIsCoolingDown(true);
                setHasNetworkError(true);
                setTimeout(() => setIsCoolingDown(false), 15000);
              }
            } catch (error: any) {
              if (error.message === "QUOTA_EXCEEDED") {
                setIsQuotaExceeded(true);
                setIsDetecting(false); // Stop auto-detection to save remaining quota if any
              } else {
                setHasNetworkError(true);
              }
            }
          }
        }
      }, 60000); // Increased to 60 seconds to handle extremely restrictive 20-request-per-day limits
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      setCurrentDetection(null);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isDetecting, isInitializing]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      if (isDetecting) {
        setIsInitializing(true);
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API not available in this browser/context");
          }
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
          });
          
          if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setHasCameraError(false);
          setIsInitializing(false);
        } catch (err) {
          console.error("Error accessing camera:", err);
          if (mounted) {
            setHasCameraError(true);
            setIsDetecting(false);
            setIsInitializing(false);
          }
        }
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isDetecting]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setUploadedImage(base64);
        setIsDetecting(false); // Stop camera if it was on
        setCurrentDetection(null);
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

    setCurrentDetection(null);
    setIsProcessing(true);
    try {
      const result = await detectPlate(imageToDetect);
      setQuotaUsed(prev => prev + 1);
      if (result) {
        setIsQuotaExceeded(false);
        setHasNetworkError(false);
        setCurrentDetection(result);
        if (result.confidence * 100 >= settings.confidenceThreshold) {
          await saveDetectionToBackend(result);
        }
        // For manual detection, we might want to keep the overlay visible longer or until cleared
      }
    } catch (error: any) {
      console.error("Manual detection failed:", error);
      if (error?.message?.includes("429") || error?.message?.includes("Quota")) {
        setIsQuotaExceeded(true);
        // Try to parse retry delay
        try {
          const errorData = typeof error.message === 'string' ? JSON.parse(error.message) : error;
          const retryDelay = errorData?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
          if (retryDelay) {
            const seconds = parseInt(retryDelay.replace('s', ''));
            if (!isNaN(seconds)) {
              setQuotaRetryTime(seconds);
            }
          }
        } catch (e) {}
      } else if (error?.message?.includes("fetch") || error?.message?.includes("Network")) {
        setHasNetworkError(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const detections = [
    { plate: 'KNT-4042', time: '14:02:45.021', confidence: 98, status: 'Clearance', color: 'emerald' },
    { plate: 'X-772-PL', time: '14:03:12.894', confidence: 82, status: 'Watchlist', color: 'error' },
    { plate: 'AM-1929-B', time: '14:03:55.102', confidence: 99, status: 'Unknown', color: 'slate' },
  ];

  const handleExportCSV = () => {
    const headers = ['Plate Recognition', 'Make', 'Model', 'Timestamp', 'Confidence', 'Security Status'];
    const csvContent = [
      headers.join(','),
      ...liveDetections.map(det => `${det.plate},${det.make || ''},${det.model || ''},${det.timestamp},${det.confidence * 100}%,${det.status}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lpr_detections_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Hero Grid: Video Feed & Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Feed Canvas */}
        <section className="lg:col-span-2 relative group rounded-xl overflow-hidden bg-surface-container-lowest shadow-2xl">
          <div className="aspect-video w-full bg-slate-950 relative flex items-center justify-center">
            {uploadedImage ? (
              <div className="relative w-full h-full">
                <img 
                  src={uploadedImage} 
                  alt="Uploaded for detection" 
                  className="w-full h-full object-contain"
                />
                <button 
                  onClick={() => setUploadedImage(null)}
                  className="absolute top-4 right-4 bg-error/80 hover:bg-error text-white p-2 rounded-full shadow-lg transition-all"
                >
                  <CameraOff size={16} />
                </button>
              </div>
            ) : isDetecting ? (
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                <CameraOff size={48} className="opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-40">System Standby</p>
                <img 
                  alt="Live ANPR Traffic Feed Placeholder" 
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8kG5viSSPd6AWrhatzOs0BelPinlz7CIeAGB1XhTJeFEepj7_JV4m_wPvepZaUcCv53tOL0tnSDBxzRloQojbvrjlQcB3sSF_xPv2h5wyXSo_ltqddfvBh8-1JUNRuKONjMf179ZPU495MEDB0Niw4l6vMi6BgljrM52GaROdGql7DyPquLTwkujB7XsS5qs2EhBLpJsLxbVnYP_fhN-J4q-waIEKTp7SaswgHX5Q9S4qxdCAR6-GqCUgDnylSCmVRwWEceBasAE"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {hasCameraError && (
              <div className="absolute inset-0 bg-error/20 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                <div className="glass-panel p-6 rounded-2xl border border-error/30 max-w-xs">
                  <CameraOff className="text-error mx-auto mb-4" size={32} />
                  <h4 className="text-white font-bold mb-2">Camera Access Denied</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">Please ensure camera permissions are granted in your browser settings to enable real-time detection.</p>
                </div>
              </div>
            )}

            {hasNetworkError && (
              <div className="absolute inset-0 bg-error/20 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                <div className="glass-panel p-6 rounded-2xl border border-error/30 max-w-xs">
                  <Activity className="text-error mx-auto mb-4" size={32} />
                  <h4 className="text-white font-bold mb-2">Connectivity Issue</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">
                    The system is having trouble reaching the AI engine. 
                    Please check your internet connection or ensure no ad-blockers are restricting 'generativelanguage.googleapis.com'.
                  </p>
                  <button 
                    onClick={() => setHasNetworkError(false)}
                    className="mt-4 px-4 py-2 bg-error text-white text-[10px] font-bold rounded-lg uppercase"
                  >
                    Retry Now
                  </button>
                </div>
              </div>
            )}

            {isQuotaExceeded && (
              <div className="absolute inset-0 bg-yellow-500/20 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                <div className="glass-panel p-6 rounded-2xl border border-yellow-500/30 max-w-xs">
                  <Activity className="text-yellow-500 mx-auto mb-4" size={32} />
                  <h4 className="text-white font-bold mb-2">Daily Quota Reached</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">
                    The AI engine has reached its free tier limit (20 requests/day). 
                    Auto-detection is paused. {quotaRetryTime ? `Please retry in ${quotaRetryTime}s.` : 'Detection will resume automatically once the quota resets.'}
                  </p>
                  <button 
                    onClick={() => {
                      setIsQuotaExceeded(false);
                      setQuotaRetryTime(null);
                    }}
                    className="mt-4 px-4 py-2 bg-yellow-500 text-surface text-[10px] font-bold rounded-lg uppercase"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* AI Overlay: Bounding Boxes */}
            <AnimatePresence>
              {(isDetecting || uploadedImage) && currentDetection && currentDetection.bbox && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <div 
                    className="absolute border-2 border-tertiary/50 shadow-[0_0_15px_rgba(76,214,255,0.4)]"
                    style={{
                      left: `${(currentDetection.bbox.x / 1000) * 100}%`,
                      top: `${(currentDetection.bbox.y / 1000) * 100}%`,
                      width: `${(currentDetection.bbox.width / 1000) * 100}%`,
                      height: `${(currentDetection.bbox.height / 1000) * 100}%`,
                    }}
                  >
                    <div className="hud-bracket hud-bracket-tl"></div>
                    <div className="hud-bracket hud-bracket-tr"></div>
                    <div className="hud-bracket hud-bracket-bl"></div>
                    <div className="hud-bracket hud-bracket-br"></div>
                    <div className="absolute -top-10 left-0 bg-tertiary text-surface text-[10px] px-2 py-1 font-bold uppercase tracking-tighter whitespace-nowrap rounded shadow-lg">
                      <div className="flex flex-col">
                        <span>{currentDetection.plate} • {(currentDetection.confidence * 100).toFixed(1)}%</span>
                        {currentDetection.make && (
                          <span className="text-[8px] opacity-80">{currentDetection.make} {currentDetection.model}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-20 animate-pulse"></div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Hidden Canvas for Frame Capture */}
            <canvas ref={canvasRef} className="hidden" />
            {/* Video Controls Overlay */}
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  setIsDetecting(!isDetecting);
                  if (!isDetecting) setUploadedImage(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shadow-lg transition-all active:scale-95 ${
                  isDetecting ? 'bg-error text-surface shadow-error/20' : 'bg-emerald-500 text-surface shadow-emerald-500/20'
                }`}
              >
                {isDetecting ? (
                  <>
                    <StopCircle size={14} />
                    Stop Detection
                  </>
                ) : (
                  <>
                    <PlayCircle size={14} />
                    Start Detection
                  </>
                )}
              </button>

              {(isDetecting || uploadedImage) && (
                <button 
                  onClick={handleManualDetect}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold shadow-lg transition-all active:scale-95 bg-primary text-white shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isProcessing ? (
                    <>
                      <Activity size={14} className="animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Activity size={14} />
                      Detect Now
                    </>
                  )}
                </button>
              )}

              <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 border border-white/10">
                {hasCameraError ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                    <span className="text-[10px] font-bold text-error uppercase tracking-widest">System Error</span>
                  </>
                ) : isInitializing ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Initializing</span>
                  </>
                ) : isDetecting ? (
                  <>
                    <span className={`w-2 h-2 rounded-full ${hasNetworkError ? 'bg-error' : isCoolingDown ? 'bg-yellow-500' : 'bg-emerald-500 animate-ping'}`}></span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${hasNetworkError ? 'text-error' : isCoolingDown ? 'text-yellow-500' : 'text-white'}`}>
                      {hasNetworkError ? 'Network Error' : isCoolingDown ? 'Cooling Down' : 'Running'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paused</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Manual Upload & Status Bento */}
        <div className="space-y-6">
          <div 
            className={`glass-panel p-6 rounded-xl border flex flex-col items-center justify-center text-center group transition-all border-dashed border-2 ${
              uploadedImage ? 'border-primary bg-primary/5' : 'border-white/5 hover:bg-white/10 cursor-pointer'
            }`}
            onClick={!uploadedImage ? handleUploadClick : undefined}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
            {uploadedImage ? (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                  <Activity size={24} className="text-primary" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Image Loaded</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedImage(null);
                    setCurrentDetection(null);
                  }}
                  className="text-[10px] font-bold text-error hover:underline mt-2"
                >
                  Remove Image
                </button>
              </>
            ) : (
              <>
                <CloudUpload size={32} className="text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm font-bold text-white mb-1">Manual Plate Ingest</h3>
                <p className="text-[11px] text-on-surface-variant px-4">Click to upload high-res frames for specialized forensic analysis</p>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-surface-highest p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Daily Quota (Est.)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <div className={`text-2xl font-bold font-headline ${quotaUsed >= 20 ? 'text-error' : 'text-primary'}`}>{quotaUsed}</div>
                <div className="text-xs text-on-surface-variant">/ 20</div>
              </div>
            </div>
            <div className="bg-surface-highest p-4 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Avg Confidence</span>
              <div className="text-2xl font-bold text-tertiary font-headline mt-1">94.2%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Detection Log */}
      <section className="glass-panel rounded-xl overflow-hidden border border-white/5 shadow-xl">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Database size={14} className="text-blue-400" />
            Real-time Detection Log
          </h3>
          <button 
            onClick={handleExportCSV}
            className="text-[10px] font-bold text-blue-400 hover:underline"
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant bg-surface-high/50">
                <th className="px-6 py-4 font-bold">Plate Recognition</th>
                <th className="px-6 py-4 font-bold">Visual ID</th>
                <th className="px-6 py-4 font-bold">Timestamp</th>
                <th className="px-6 py-4 font-bold">Confidence</th>
                <th className="px-6 py-4 font-bold">Security Status</th>
                <th className="px-6 py-4 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {liveDetections.length > 0 ? (
                liveDetections.map((det, i) => (
                  <tr key={det.id || i} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="bg-surface-bright px-3 py-1 rounded inline-block border border-white/10 shadow-inner w-fit">
                          <span className="text-lg font-black text-white tracking-widest">{det.plate}</span>
                        </div>
                        {(det.make || det.model) && (
                          <span className="text-[10px] text-on-surface-variant font-bold uppercase mt-1">
                            {det.make} {det.model}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-10 h-6 bg-slate-800 rounded flex items-center justify-center text-[8px] text-slate-500 font-bold border border-white/5">
                        IMG
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-on-surface-variant">
                      {new Date(det.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${det.confidence * 100}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-blue-400">{(det.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                        det.status === 'Authorized' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        det.status === 'Unauthorized' ? 'bg-error/10 text-error border-error/20' :
                        'bg-slate-500/20 text-slate-400 border-white/5'
                      }`}>
                        {det.status || 'Detected'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-on-surface-variant hover:text-white transition-colors">
                        <ExternalLink size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant text-xs italic">
                    Waiting for detections...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
