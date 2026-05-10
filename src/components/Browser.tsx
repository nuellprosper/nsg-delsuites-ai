import React, { useState, useEffect, useRef } from 'react';
import { Share, ArrowLeft, RefreshCw, Shield, Bell, Camera, Mic, MapPin, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BrowserProps {
  onClose: () => void;
  targetUrl?: string;
}

const Browser: React.FC<BrowserProps> = ({ onClose, targetUrl = 'https://nuellstudyguide.name.ng' }) => {
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    camera: 'pending',
    mic: 'pending',
    location: 'pending',
    notifications: 'pending'
  });
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Block text selection and context menu globally for the browser shell
  useEffect(() => {
    const blockActions = (e: Event) => {
      // Allow if specifically tagged for copying (user mentioned "only with buttons")
      const target = e.target as HTMLElement;
      if (target.dataset.allowCopy === 'true') return;
      e.preventDefault();
    };

    document.addEventListener('contextmenu', blockActions);
    document.addEventListener('selectstart', blockActions);
    
    return () => {
      document.removeEventListener('contextmenu', blockActions);
      document.removeEventListener('selectstart', blockActions);
    };
  }, []);

  // Request permissions on mount
  useEffect(() => {
    const requestAll = async () => {
      try {
        // Notifications
        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          setPermissions(prev => ({ ...prev, notifications: res }));
        }
        
        // Location
        navigator.geolocation.getCurrentPosition(
          () => setPermissions(prev => ({ ...prev, location: 'granted' })),
          () => setPermissions(prev => ({ ...prev, location: 'denied' }))
        );
        
        // Media (Cam/Mic) - we don't activate them now, just check permissions if possible
        // Actually best to wait until needed, but we can signal the browser "readiness"
      } catch (err) {
        console.error("Permission request failed", err);
      }
    };
    
    requestAll();
  }, []);

  const handleBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.back();
    } else {
      onClose();
    }
  };

  const handleScreenShare = async () => {
    try {
      // @ts-ignore
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      console.log("Screen share started", stream);
      // In a real native bridge, we would pass this stream to the native side
    } catch (err) {
      console.error("Screen share failed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col font-sans select-none overflow-hidden">
      {/* Native-like Status Bar (Dummy for aesthetics) */}
      <div className="h-6 bg-black flex items-center justify-between px-4">
        <div className="flex gap-2 items-center">
          <Shield size={12} className="text-emerald-500" />
          <span className="text-[10px] text-white/60 font-medium tabular-nums tracking-wider uppercase">NSG Encrypted Tunnel</span>
        </div>
        <div className="flex gap-3 items-center opacity-60">
          <Bell size={10} className="text-white" />
          <div className="w-3 h-3 rounded-full border border-white/20 bg-emerald-500/20 flex items-center justify-center">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Browser Toolbar */}
      <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white tracking-tight uppercase">NSG Native Wrapper</span>
            <span className="text-[10px] text-white/40 font-mono truncate max-w-[150px]">{targetUrl.replace('https://', '')}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={handleScreenShare}
            className="flex flex-col items-center gap-0.5 p-2 px-3 hover:bg-white/10 rounded-xl transition-all"
          >
            <Share size={18} className="text-emerald-400 font-bold" />
            <span className="text-[8px] text-white/60 font-bold uppercase">Cast</span>
          </button>
          
          <button 
            className="p-2 hover:bg-white/10 rounded-full text-white/60"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Main Iframe Viewer */}
      <div className="flex-1 relative bg-white">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center gap-6">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            />
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-white font-bold tracking-widest text-sm uppercase">Optimizing Secure Tunnel</h2>
              <div className="flex gap-4 opacity-40">
                <Camera size={14} className="text-white" />
                <Mic size={14} className="text-white" />
                <MapPin size={14} className="text-white" />
              </div>
            </div>
          </div>
        )}
        
        <iframe 
          ref={iframeRef}
          src={targetUrl}
          className="w-full h-full border-none shadow-2xl"
          onLoad={() => setIsLoading(false)}
          allow="camera; microphone; display-capture; geolocation; notifications;"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Native Permission Indicators */}
      <AnimatePresence>
        {!isLoading && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 p-2 px-6 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl items-center"
          >
            <div className="flex gap-4 border-r border-white/10 pr-4">
               <Camera size={14} className={permissions.camera === 'granted' ? 'text-emerald-400' : 'text-white/20'} />
               <Mic size={14} className={permissions.mic === 'granted' ? 'text-emerald-400' : 'text-white/20'} />
               <MapPin size={14} className={permissions.location === 'granted' ? 'text-emerald-400' : 'text-white/20'} />
            </div>
            <button 
               onClick={onClose}
               className="text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-wider"
            >
              Exit Framework
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Copy-protected overlay for specific zones if needed */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </div>
  );
};

export default Browser;
