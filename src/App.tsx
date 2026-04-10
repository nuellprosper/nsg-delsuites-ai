import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings, UserPlus, CreditCard,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText, AlertCircle,
  Sun, Moon, ArrowDown, PlusCircle, Copy, User, Clock, Lock, ShieldCheck, FileDown, LayoutDashboard, ListChecks,
  Pin, Edit3, Share2, Trophy, LogOut, Plus, Menu, Camera, Monitor, X, Activity, MessageSquare, BookOpen, Calendar, Send, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { HfInference } from "@huggingface/inference";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { usePaystackPayment } from 'react-paystack';
import { toPng } from 'html-to-image';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, orderBy,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  FirestoreOperation, handleFirestoreError
} from './firebase';

/**
 * NSG (Nuell Study Guide) V4.0 - PROFESSIONAL CBT & AI UPGRADE
 * \u{2705} Professional CBT Infrastructure (Exam Lobby, Info Page, Exam Engine)
 * \u{2705} Admin Backend Control (Score Sheet, Timer Restart, Results Download)
 * \u{2705} Advanced AI Chat (Copy Response, History Sidebar)
 * \u{2705} Enhanced Quiz (Customization, Deep Assessment, Report to AI)
 * \u{2705} Paystack Payment Integration
 */

const getApiKey = () => {
  // Only use Vite env (for Render/Production)
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const finalKey = (key || "").trim();
  if (!finalKey) {
    console.warn("Gemini API Key is missing. Ensure VITE_GEMINI_API_KEY is set in your environment.");
  }
  return finalKey;
};

const getHfKey = () => {
  // Only use Vite env (for Render/Production)
  const key = import.meta.env.VITE_HUGGINGFACE_API_KEY;
  const finalKey = (key || "").trim();
  if (!finalKey) {
    console.warn("HuggingFace API Key is missing. Ensure VITE_HUGGINGFACE_API_KEY is set in your environment.");
  }
  return finalKey;
};

// Lazy initialization helpers with validation
const getAiInstance = () => {
  const key = getApiKey();
  if (!key) throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
  return new GoogleGenAI({ apiKey: key });
};

const getHfInstance = () => {
  const key = getHfKey();
  if (!key) throw new Error("HuggingFace API Key is missing. Please set VITE_HUGGINGFACE_API_KEY in your environment.");
  return new HfInference(key);
};

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

const formatAiError = (error: any) => {
  const message = error.message || "Unknown error";
  if (message.toLowerCase().includes("model") || message.includes("404") || message.includes("not found")) {
    return `Model Error: The selected AI model (${MODEL_NAME}) might be unavailable or retired. Please check the configuration. Original error: ${message}`;
  }
  return `AI Error: ${message}`;
};

const HF_MODELS = {
  TEXT: "Qwen/Qwen2.5-72B-Instruct",
  VISION: "meta-llama/Llama-3.2-11B-Vision-Instruct",
  IMAGE: "black-forest-labs/FLUX.1-schnell"
};

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_14a5b8ee0a06e063a8b0e46fc7e0e76ed66f2746";

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'audio';
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  image?: string;
}

interface ChatSession {
  id: string;
  title: string;
  history: ChatMessage[];
  timestamp: string;
  isPinned?: boolean;
  uid: string;
}

interface LectureSession {
  id: string;
  title: string;
  date: string;
  duration: string;
  imageCount: number;
  summary: string;
  fullAnalysis: string;
  images: string[]; 
  audioUrl?: string;
  isPinned?: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface ExamQuestion extends QuizQuestion {
  id: string;
}

interface StudentResult {
  matric: string;
  name: string;
  score: number;
  total: number;
  timestamp: string;
  hostUid?: string;
}

interface RegisteredStudent {
  matric: string;
  name: string;
  paymentEnabled: boolean;
  isActive?: boolean;
  lastActive?: number;
}

interface ExamConfig {
  questionCount: number;
  duration: number; // in seconds
  price: number; // in Naira
  poolCount?: number;
}

async function fileToGenerativePart(file: File | Blob) {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result && result.includes(',')) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Failed to parse file data."));
      }
    };
    reader.onerror = () => reject(new Error("File reading failed."));
    reader.readAsDataURL(file);
  });
  
  // Ensure we have a valid mimeType for Gemini
  let mimeType = file.type;
  if (!mimeType || mimeType === "") {
    mimeType = "audio/webm"; // Default fallback for recorded blobs
  }

  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType },
  };
}

const compressImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/jpeg', 0.8);
      };
    };
  });
};

const BlinkingBrain = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <motion.div
    animate={{ opacity: [1, 0.4, 1] }}
    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
    className={className}
  >
    <Brain size={size} />
  </motion.div>
);

const GeminiLive = ({ onClose, setUserNotification, theme }: { onClose: () => void, setUserNotification: (msg: string | null) => void, theme: string }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [videoSource, setVideoSource] = useState<'camera' | 'screen' | 'none'>('none');
  const videoSourceRef = useRef<'camera' | 'screen' | 'none'>('none');
  const [transcript, setTranscript] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef<number>(0);

  useEffect(() => {
    const startLive = async () => {
      if (!getApiKey()) {
        setUserNotification("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
        onClose();
        return;
      }
      try {
        const aiInstance = getAiInstance();
        const session = await aiInstance.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: "You are Omni AI in Live Mode. You can see and hear the user. Be helpful, concise, and academic.",
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          },
          callbacks: {
            onopen: () => setIsConnecting(false),
            onmessage: async (msg: LiveServerMessage) => {
              const serverContent = (msg as any).serverContent;
              if (serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                const audioData = serverContent.modelTurn.parts[0].inlineData.data;
                playAudio(audioData);
              }
              if (serverContent?.modelTurn?.parts?.[0]?.text) {
                setTranscript(prev => [...prev, `AI: ${serverContent.modelTurn.parts[0].text!}`]);
              }
              if (serverContent?.userTurn?.parts?.[0]?.text) {
                setTranscript(prev => [...prev, `You: ${serverContent.userTurn.parts[0].text!}`]);
              }
            },
            onerror: (err) => console.error("Live Error:", err),
            onclose: () => onClose()
          }
        });
        sessionRef.current = session;
        startAudioInput();
      } catch (err) {
        console.error("Failed to connect Live:", err);
        onClose();
      }
    };

    startLive();
    return () => {
      sessionRef.current?.close();
      audioContextRef.current?.close();
    };
  }, []);

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    const binary = atob(base64);
    const buffer = new Int16Array(binary.length / 2);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = (binary.charCodeAt(i * 2) & 0xFF) | (binary.charCodeAt(i * 2 + 1) << 8);
    }
    const floatBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) floatBuffer[i] = buffer[i] / 32768;

    const audioBuffer = audioContextRef.current.createBuffer(1, floatBuffer.length, 24000);
    audioBuffer.getChannelData(0).set(floatBuffer);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    const startTime = Math.max(audioContextRef.current.currentTime, nextAudioTimeRef.current);
    source.start(startTime);
    nextAudioTimeRef.current = startTime + audioBuffer.duration;
  };

  const startAudioInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isMicOn || !sessionRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
        sessionRef.current.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const toggleVideo = async (type: 'camera' | 'screen') => {
    if (videoSourceRef.current === type) {
      setVideoSource('none');
      videoSourceRef.current = 'none';
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    try {
      let stream: MediaStream;
      if (type === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser or environment.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } else {
        // Fallback for older browsers or specific iframe restrictions
        const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices) || 
                                (navigator as any).getDisplayMedia?.bind(navigator);
        
        if (!getDisplayMedia) {
          throw new Error("Screen sharing is not supported in this browser or environment (try opening in a new tab).");
        }
        stream = await getDisplayMedia({ video: true });
      }
      
      if (videoRef.current) videoRef.current.srcObject = stream;
      setVideoSource(type);
      videoSourceRef.current = type;

      // 1fps frame capture for 2GB RAM optimization
      const interval = setInterval(() => {
        if (videoSourceRef.current === 'none' || !sessionRef.current || !videoRef.current || !canvasRef.current) {
          clearInterval(interval);
          return;
        }
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          sessionRef.current.sendRealtimeInput({ video: { data: base64, mimeType: 'image/jpeg' } });
        }
      }, 1000);
    } catch (err: any) {
      console.error("Video error:", err);
      const msg = err.message || String(err);
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setUserNotification("Permission denied. Please allow camera/screen access in your browser settings.");
      } else if (msg.includes("getDisplayMedia is not a function")) {
        setUserNotification("Screen sharing is not supported in this iframe. Please open the app in a new tab.");
      } else {
        setUserNotification(`Video error: ${msg}`);
      }
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} p-3 sm:p-6 space-y-4 sm:space-y-6`}>
      <div className="flex-1 flex gap-6">
        <div className={`flex-1 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} rounded-3xl border relative overflow-hidden flex flex-col`}>
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <div className="bg-[#DC2626] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase animate-pulse">Live</div>
            {videoSource !== 'none' && <div className={`${theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-zinc-100 text-zinc-500'} px-3 py-1 rounded-full text-[10px] font-black uppercase`}>{videoSource} active</div>}
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            {videoSource === 'none' ? (
              <div className="text-center space-y-8">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-32 h-32 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto border border-[#DC2626]/20 shadow-[0_0_50px_rgba(220,38,38,0.2)]"
                >
                  <Brain size={64} className="text-[#DC2626]" />
                </motion.div>
                <div>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Omni AI is Listening</p>
                  <div className="flex gap-1 justify-center mt-4">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-1 bg-[#DC2626] rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} width="320" height="240" className="hidden" />
          </div>

          <div className={`p-6 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-slate-100/40 border-slate-200'} backdrop-blur-xl border-t max-h-40 overflow-y-auto`}>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Transcript</p>
            <div className="space-y-2">
              {transcript.map((t, i) => (
                <p key={i} className="text-xs text-white/60 leading-relaxed">{t}</p>
              ))}
              {isConnecting && <p className="text-xs text-[#DC2626] animate-pulse">Initializing WebSocket Connection...</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-6">
        <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 sm:p-6 rounded-full transition-all shadow-2xl ${isMicOn ? 'bg-[#DC2626] text-white' : `${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}`}>
          {isMicOn ? <Mic size={20} className="sm:size-[28px]" /> : <Mic size={20} className="sm:size-[28px] opacity-20" />}
        </button>
        <button onClick={() => toggleVideo('camera')} className={`p-4 sm:p-6 rounded-full transition-all shadow-2xl ${videoSource === 'camera' ? 'bg-[#DC2626] text-white' : `${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}`}>
          <Camera size={20} className="sm:size-[28px]" />
        </button>
        <button onClick={() => toggleVideo('screen')} className={`p-4 sm:p-6 rounded-full transition-all shadow-2xl ${videoSource === 'screen' ? 'bg-[#DC2626] text-white' : `${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}`}>
          <Monitor size={20} className="sm:size-[28px]" />
        </button>
        <button onClick={() => window.open(window.location.href, '_blank')} className={`p-4 sm:p-6 ${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'} rounded-full hover:bg-[#DC2626]/10 transition-all border`} title="Open in new tab for screen sharing">
          <Share2 size={20} className="sm:size-[28px]" />
        </button>
        <button onClick={onClose} className={`p-4 sm:p-6 ${theme === 'dark' ? 'bg-white/5 text-white/40 border-white/10' : 'bg-zinc-100 text-zinc-500 border-zinc-200'} rounded-full hover:bg-[#DC2626] hover:text-white transition-all border`}>
          <X size={20} className="sm:size-[28px]" />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  // --- \u{1F510} AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeExamHostUid, setActiveExamHostUid] = useState<string | null>(null);
  const [isHostPaid, setIsHostPaid] = useState(false);
  const [isTakingPaid, setIsTakingPaid] = useState(false);
  const [hostExamId, setHostExamId] = useState<string | null>(null);

  // --- \u{1F4F1} APP STATE ---
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz' | 'blog' | 'exam' | 'profile'>('record');
  const [showRecordSidebar, setShowRecordSidebar] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisInRecord, setShowAnalysisInRecord] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto-close auth modal when user is logged in
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
    }
  }, [user, showAuthModal]);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authDOB, setAuthDOB] = useState('');
  const [authMatric, setAuthMatric] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareName, setShareName] = useState('');
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGodMode, setShowGodMode] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [godModeNotification, setGodModeNotification] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [legalPage, setLegalPage] = useState<'about' | 'terms' | 'contact' | 'privacy' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userNotification, setUserNotification] = useState<string | null>(null);
  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  // --- \u{1F4E6} PWA STATE ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallTimer, setShowInstallTimer] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstallTimer(false);
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
    window.addEventListener('focus', checkStandalone);
    return () => window.removeEventListener('focus', checkStandalone);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setUserNotification("To use in app, open your browser menu and select 'Add to Home Screen' or 'Install App'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // --- \u{1F48E} PREMIUM STATE ---
  const [isPremium, setIsPremium] = useState(false);
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // --- \u{1F451} GOD MODE LOGIC ---
  useEffect(() => {
    if (currentUserData) {
      const isGod = currentUserData.bypassAllPayments || currentUserData.bypassTakingPayment || currentUserData.bypassHostingPayment;
      
      if (currentUserData.bypassAllPayments || currentUserData.bypassTakingPayment) {
        setIsTakingPaid(true);
      } else {
        setIsTakingPaid(false);
      }
      
      if (currentUserData.bypassAllPayments || currentUserData.bypassHostingPayment) {
        setIsHostPaid(true);
      } else {
        setIsHostPaid(false);
      }

      // Premium logic
      if (currentUserData.bypassAllPayments || isGod) {
        setIsPremium(true);
        setPremiumTimeLeft("GOD MODE ACTIVE");
      } else if (currentUserData.premiumUntil) {
        const until = new Date(currentUserData.premiumUntil).getTime();
        const now = new Date().getTime();
        if (until > now) {
          setIsPremium(true);
          const updateTimer = () => {
            const diff = until - new Date().getTime();
            if (diff <= 0) {
              setIsPremium(false);
              setPremiumTimeLeft("");
              return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setPremiumTimeLeft(`${days}d ${hours}h ${mins}m`);
          };
          updateTimer();
          const interval = setInterval(updateTimer, 60000);
          return () => clearInterval(interval);
        } else {
          setIsPremium(false);
          setPremiumTimeLeft("");
        }
      } else {
        setIsPremium(false);
        setPremiumTimeLeft("");
      }
    } else {
      setIsTakingPaid(false);
      setIsHostPaid(false);
      setIsPremium(false);
      setPremiumTimeLeft("");
    }
  }, [currentUserData]);

  useEffect(() => {
    if (showGodMode && user?.email === "nuellkelechi@gmail.com") {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(usersList);
      });
      return () => unsubscribe();
    }
  }, [showGodMode, user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'blogPosts'), orderBy('timestamp', 'desc')), (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBlogPosts(posts);
    });
    return () => unsubscribe();
  }, []);

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("\u{1F680} Attempting to publish blog post...", newPost);
    
    if (!newPost.title || !newPost.content) {
      setGodModeNotification("Title and content are required.");
      return;
    }

    try {
      const postData = {
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        timestamp: serverTimestamp(),
        author: "NSG Admin"
      };

      console.log("\u{1F4E6} Sending to Firestore:", postData);
      
      const docRef = await addDoc(collection(db, 'blogPosts'), postData);
      console.log("\u{2705} Blog post published with ID:", docRef.id);
      
      setNewPost({ title: '', content: '' });
      setIsAddingPost(false);
      setGodModeNotification("Blog post published successfully!");
    } catch (error: any) {
      console.error("\u{274C} Error adding post:", error);
      setGodModeNotification(`Failed to publish: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      await updateDoc(doc(db, 'blogPosts', editingPost.id), {
        title: editingPost.title,
        content: editingPost.content,
        lastUpdated: serverTimestamp()
      });
      setIsEditingPost(false);
      setEditingPost(null);
      setGodModeNotification("Post updated successfully!");
    } catch (error) {
      console.error("Error updating post:", error);
    }
  };

  const handleReaction = async (postId: string, emoji: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      const postRef = doc(db, 'blogPosts', postId);
      const post = blogPosts.find(p => p.id === postId);
      const reactions = post.reactions || {};
      const currentCount = reactions[emoji] || 0;
      
      await updateDoc(postRef, {
        [`reactions.${emoji}`]: currentCount + 1
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const deletePost = async (id: string) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'blogPosts', id));
      setGodModeNotification("Post deleted.");
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const userToToggle = allUsers.find(u => u.id === userId);
    const newStatus = currentStatus === 'deleted' ? 'active' : 'deleted';
    
    if (userToToggle?.email === 'nuellkelechi@gmail.com' && newStatus === 'deleted') {
      setGodModeNotification("CRITICAL: God Mode account cannot be deactivated!");
      setTimeout(() => setGodModeNotification(null), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setGodModeNotification(`User account ${newStatus === 'deleted' ? 'deactivated' : 'revived'} successfully`);
      setTimeout(() => setGodModeNotification(null), 3000);
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  const updateUserPermissions = async (userId: string, field: string, value: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { [field]: value });
      setGodModeNotification("Permissions updated successfully");
      setTimeout(() => setGodModeNotification(null), 3000);
    } catch (error) {
      console.error("Error updating permissions:", error);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        fullName: editingUser.fullName || editingUser.displayName || '',
        matric: editingUser.matric || '',
        email: editingUser.email || '',
        dob: editingUser.dob || ''
      });
      setEditingUser(null);
      setGodModeNotification("User information updated successfully");
      setTimeout(() => setGodModeNotification(null), 3000);
    } catch (error) {
      console.error("Error editing user:", error);
    }
  };

  // --- \u{1F399}\u{FE0F} RECORDING ENGINE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- \u{1F4C2} MEDIA & UPLOAD ---
  const [uploadedImages, setUploadedImages] = useState<MediaFile[]>([]);

  // --- \u{1F916} AI CHAT SYSTEM ---
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [chatMode, setChatMode] = useState<'General' | 'Vision' | 'Creative' | 'Live'>('General');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [aiUsage, setAiUsage] = useState(45); // Mock usage percentage
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);

  // --- \u{1F4DA} PERSISTENCE ---
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LectureSession | null>(null);

  // --- \u{1F4DD} QUIZ STATE ---
  const [quizTopic, setQuizTopic] = useState('');
  const [shareQuizLink, setShareQuizLink] = useState<string | null>(null);
  const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Professional'>('Medium');
  const [quizQuestionCount, setQuizQuestionCount] = useState(25);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'finished' | 'review'>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // --- \u{1F393} CBT EXAM STATE ---
  const [matricNumber, setMatricNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [examLobbyState, setExamLobbyState] = useState<'login' | 'briefing' | 'exam' | 'result'>('login');
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examTimer, setExamTimer] = useState(3600); // 1 hour default
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [currentExamIndex, setCurrentExamIndex] = useState(0);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- \u{1F6E0}\u{FE0F} ADMIN STATE ---
  const [adminMode, setAdminMode] = useState(false);
  const [adminQuestionsRaw, setAdminQuestionsRaw] = useState('');
  const [scoreSheet, setScoreSheet] = useState<StudentResult[]>([]);
  const [isGeneratingAdminQuestions, setIsGeneratingAdminQuestions] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    questionCount: 25,
    duration: 3600,
    price: 2000,
    poolCount: 50
  });
  const [newStudentMatric, setNewStudentMatric] = useState('');
  const [newStudentName, setNewStudentName] = useState('');

  const handleAdminLogin = () => {
    if (adminPin === '286900') {
      setAdminMode(true);
      setShowAdminLogin(false);
      setAdminPin('');
    } else {
      setAdminNotification("Invalid Admin PIN");
    }
  };

  // --- \u{1F4B3} PAYSTACK INTEGRATION ---
  const handleSubscriptionSuccess = async (plan: 'monthly' | 'yearly') => {
    if (!user) return;
    const duration = plan === 'monthly' ? 30 : 365;
    const newUntil = new Date();
    newUntil.setDate(newUntil.getDate() + duration);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        premiumUntil: newUntil.toISOString()
      });
      setUserNotification(`Subscription successful! Premium active until ${newUntil.toLocaleDateString()}`);
      setShowPremiumModal(false);
    } catch (error) {
      console.error("Error updating premium status:", error);
      setUserNotification("Payment successful, but failed to update status. Contact support.");
    }
  };

  const configMonthly = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "user@example.com",
    amount: 300 * 100, // 300 Naira
    publicKey: PAYSTACK_PUBLIC_KEY,
    onSuccess: () => handleSubscriptionSuccess('monthly'),
    onClose: () => setUserNotification("Payment cancelled.")
  };

  const configYearly = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "user@example.com",
    amount: 3600 * 100, // 3600 Naira
    publicKey: PAYSTACK_PUBLIC_KEY,
    onSuccess: () => handleSubscriptionSuccess('yearly'),
    onClose: () => setUserNotification("Payment cancelled.")
  };

  const initializeMonthly = usePaystackPayment(configMonthly);
  const initializeYearly = usePaystackPayment(configYearly);

  const PremiumModal = () => (
    <AnimatePresence>
      {showPremiumModal && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-6 sm:p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
            <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-yellow-500 transition-colors"><XCircle size={24} /></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-yellow-500" />
              </div>
              <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white">Upgrade to Premium</h2>
              <p className="text-xs text-white/40 mt-1">Unlock all features and remove limitations</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>No Ads & Unlimited Tokens</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>Access to all CBT Exams</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>Advanced AI Image Generation</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>Priority Support</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => initializeMonthly({ onSuccess: () => handleSubscriptionSuccess('monthly'), onClose: () => setUserNotification("Payment cancelled.") })}
                className={`${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-100 border-zinc-200'} border p-4 rounded-2xl hover:border-yellow-500/50 transition-all text-center group`}
              >
                <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-zinc-400'} uppercase mb-1`}>Monthly</p>
                <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>N300</p>
                <p className="text-[8px] font-bold text-yellow-500 uppercase mt-1">Save 0%</p>
              </button>
              <button 
                onClick={() => initializeYearly({ onSuccess: () => handleSubscriptionSuccess('yearly'), onClose: () => setUserNotification("Payment cancelled.") })}
                className="bg-yellow-500 text-black p-4 rounded-2xl hover:bg-yellow-400 transition-all text-center group"
              >
                <p className="text-[10px] font-black text-black/40 uppercase mb-1">Yearly</p>
                <p className="text-xl font-black text-black">N3,600</p>
                <p className="text-[8px] font-bold text-black/60 uppercase mt-1">Best Value</p>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  // --- \u{1F4F1} INITIALIZATION & FIREBASE SYNC ---
  useEffect(() => {
    console.log("App Initialized. Checking API Keys...");
    console.log("Gemini Key Found:", !!getApiKey());
    console.log("HF Key Found:", !!getHfKey());
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Real-time sync for current user data
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setCurrentUserData({ id: doc.id, ...data });
            setIsAdminUser(data.role === 'admin' || currentUser.email === "nuellkelechi@gmail.com");
            
            if (data.status === 'deleted') {
              if (currentUser.email === "nuellkelechi@gmail.com") {
                updateDoc(userDocRef, { status: 'active' });
                return;
              }
              signOut(auth);
              setUserNotification("Your account has been deactivated.");
            }
          } else {
            const isDefaultAdmin = currentUser.email === "nuellkelechi@gmail.com";
            const userData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: isDefaultAdmin ? 'admin' : 'student',
              createdAt: new Date().toISOString(),
              status: 'active',
              bypassHostingPayment: false,
              bypassTakingPayment: false,
              bypassAllPayments: false
            };
            setDoc(userDocRef, userData);
          }
          setIsAuthLoading(false);
        }, (error) => {
          console.error("Auth Snapshot Error:", error);
          setIsAuthLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setIsAdminUser(false);
        setCurrentUserData(null);
      }
    });

    // Global Data Sync
    // Check for shared quiz or exam in URL
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');
    if (quizId) {
      loadSharedQuiz(quizId);
    }

    const examId = urlParams.get('examId');
    if (examId) {
      setActiveExamId(examId);
      setActiveTab('exam');
      loadSharedExam(examId);
    }

    // Local UI persistence
    const savedTheme = localStorage.getItem('nsg_theme');
    if (savedTheme) setTheme(savedTheme as 'dark' | 'light');

    // Load hosted exam state if exists
    const savedHostExamId = localStorage.getItem('nsg_host_exam_id');
    if (savedHostExamId) {
      setHostExamId(savedHostExamId);
      setIsHostPaid(true);
      
      const savedConfig = localStorage.getItem('nsg_host_config');
      if (savedConfig) setExamConfig(JSON.parse(savedConfig));
      
      const savedStudents = localStorage.getItem('nsg_host_students');
      if (savedStudents) setRegisteredStudents(JSON.parse(savedStudents));
      
      const savedQuestions = localStorage.getItem('nsg_host_questions');
      if (savedQuestions) setExamQuestions(JSON.parse(savedQuestions));
    }

    const hasSeenWelcome = localStorage.getItem('nsg_welcome_seen');
    if (!hasSeenWelcome) setShowWelcome(true);

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Theme Sync
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Config Sync
  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, 'config', 'exam'), (doc) => {
      if (doc.exists()) setExamConfig(doc.data() as ExamConfig);
    }, (error) => console.error("Config Sync Error:", error));

    return () => unsubConfig();
  }, [user]);

  // Admin-specific Data Sync
  useEffect(() => {
    if (!user || !adminMode) {
      setRegisteredStudents([]);
      setExamQuestions([]);
      setScoreSheet([]);
      return;
    }

    // If we have a hostExamId, we should listen to its specific results
    let unsubScores = () => {};
    if (hostExamId) {
      unsubScores = onSnapshot(collection(db, 'exams', hostExamId, 'results'), (snapshot) => {
        const scores = snapshot.docs.map(doc => doc.data() as StudentResult);
        setScoreSheet(scores.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }, (error) => console.error("Exam Results Sync Error:", error));
    }

    return () => {
      unsubScores();
    };
  }, [user, adminMode, hostExamId]);

  // User-specific Data Sync
  useEffect(() => {
    if (!user) {
      setChatSessions([]);
      setChatHistory([]);
      setSessions([]);
      return;
    }

    const unsubChats = onSnapshot(collection(db, 'users', user.uid, 'chatSessions'), (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ChatSession);
      setChatSessions(sessions);
    });

    // For simplicity, we'll keep lecture sessions local or add them to Firestore too
    // Let's add them to Firestore for full persistence
    const unsubLectures = onSnapshot(collection(db, 'users', user.uid, 'lectureSessions'), (snapshot) => {
      const lectureData = snapshot.docs.map(doc => doc.data() as LectureSession);
      setSessions(lectureData.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)));
    });

    return () => {
      unsubChats();
      unsubLectures();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      // NOTE: For Google Sign-in to work on your custom domain (nuellstudyguide.name.ng),
      // you MUST add it to the "Authorized domains" list in your Firebase Console:
      // Authentication -> Settings -> Authorized domains
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || '',
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.email === 'nuellkelechi@gmail.com' ? 'admin' : 'student',
          createdAt: new Date().toISOString(),
          status: 'active',
          matric: '',
          dob: '',
          bypassHostingPayment: false,
          bypassTakingPayment: false,
          bypassAllPayments: false
        });
      } else {
        // Update existing user with Google data if missing
        const existingData = userDoc.data();
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: existingData.photoURL || user.photoURL,
          displayName: existingData.displayName || user.displayName,
          fullName: existingData.fullName || user.displayName
        });
      }
      setShowAuthModal(false);
      setUserNotification("Logged in with Google!");
    } catch (error: any) {
      console.error("Login Error:", error);
      const errorMessage = error.message || String(error);
      const errorCode = error.code || "unknown";
      
      if (errorCode === 'auth/unauthorized-domain') {
        setUserNotification(`Login failed: This domain is not authorized in Firebase Console. Please add "${window.location.hostname}" to Authorized Domains.`);
      } else if (errorCode === 'auth/popup-blocked') {
        setUserNotification("Login failed: Popup was blocked by your browser. Please allow popups for this site.");
      } else if (errorCode === 'auth/cancelled-popup-request') {
        // Ignore user cancellation
      } else {
        setUserNotification(`Failed to login with Google: ${errorMessage} (${errorCode})`);
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === 'signup') {
        if (!authEmail || !authPassword || !authFullName || !authDOB) {
          setUserNotification("All fields are required for sign up.");
          setIsAuthLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        const newUser = userCredential.user;
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          fullName: authFullName,
          dob: authDOB,
          matric: authMatric || '',
          role: newUser.email === 'nuellkelechi@gmail.com' ? 'admin' : 'student',
          createdAt: new Date().toISOString(),
          status: 'active',
          bypassHostingPayment: false,
          bypassTakingPayment: false,
          bypassAllPayments: false
        });
        
        const { sendEmailVerification } = await import('firebase/auth');
        await sendEmailVerification(newUser);
        
        setUserNotification("Account created! Verification link sent to your email.");
      } else {
        let loginEmail = authEmail;
        
        // If they provided a matric number but no email, try to find the email
        if (authMatric && !authEmail) {
          const q = query(collection(db, 'users'), where('matric', '==', authMatric));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            loginEmail = snapshot.docs[0].data().email;
          } else {
            setUserNotification("Account not registered. Please sign up.");
            setIsAuthLoading(false);
            return;
          }
        }

        if (!loginEmail || !authPassword) {
          setUserNotification("Email/Matric and Password are required.");
          setIsAuthLoading(false);
          return;
        }

        try {
          await signInWithEmailAndPassword(auth, loginEmail, authPassword);
          setUserNotification("Logged in successfully!");
        } catch (err: any) {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            setUserNotification("Account not registered or incorrect credentials.");
          } else if (err.code === 'auth/wrong-password') {
            setUserNotification("Incorrect password. Please try again.");
          } else {
            setUserNotification("Authentication failed. Please check your details.");
          }
          setIsAuthLoading(false);
          return;
        }
      }
      setShowAuthModal(false);
    } catch (error: any) {
      console.error("Auth Error:", error);
      setUserNotification(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setAdminMode(false);
      setIsHostPaid(false);
      setIsTakingPaid(false);
      setUserNotification("Logged out successfully.");
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleProfileUpdate = async (updates: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      setUserNotification("Profile updated!");
    } catch (error) {
      console.error("Profile Update Error:", error);
      setUserNotification("Failed to update profile.");
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Check file size (max 2MB raw limit before compression)
    if (file.size > 2 * 1024 * 1024) {
      setUserNotification("Image too large. Please use an image under 2MB.");
      return;
    }

    try {
      setUserNotification("Compressing image...");
      const compressedBlob = await compressImage(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await updateDoc(doc(db, 'users', user.uid), { photoURL: base64String });
          setUserNotification("Profile image updated!");
        } catch (error) {
          console.error("Image Upload Error:", error);
          setUserNotification("Failed to upload image. It might be too large for the database.");
        }
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      console.error("Compression Error:", err);
      setUserNotification("Failed to process image.");
    }
  };

  useEffect(() => {
    const quizData = {
      questions: quizQuestions,
      index: currentQuestionIndex,
      score: quizScore,
      state: quizState,
      selectedOption: selectedOption,
      isAnswered: isAnswered,
      topic: quizTopic
    };
    localStorage.setItem('nsg_quiz_data', JSON.stringify(quizData));
  }, [quizQuestions, currentQuestionIndex, quizScore, quizState, selectedOption, isAnswered, quizTopic]);

  useEffect(() => {
    if (chatContainerRef.current && !showScrollButton) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('nsg_theme', newTheme);
  };

  const handleChatScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setUserNotification("Copied to clipboard!");
  };

  // --- \u{1F393} CBT & ADMIN LOGIC ---
  const shuffleArray = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const generateAdminQuestions = async () => {
    console.log("Starting Admin Question Generation...");
    if (!adminQuestionsRaw.trim()) return;
    
    if (!getApiKey()) {
      setUserNotification("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
      return;
    }

    setIsGeneratingAdminQuestions(true);
    try {
      const prompt = `
        Convert the following raw text into a professional Multiple Choice Question (MCQ) pool.
        Generate exactly ${examConfig.poolCount || 50} questions.
        Each question must have 4 options (A-D) and one correct answer index (0-3).
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number,
              "explanation": "string"
            }
          ]
        }
        Raw Text: ${adminQuestionsRaw}
      `;
      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      if (data.questions) {
        const formatted = data.questions.map((q: any) => ({ ...q, id: Math.random().toString(36).substr(2, 9) }));
        
        // Update local state instead of global collection
        setExamQuestions(formatted);
        
        setAdminNotification(`Successfully generated ${formatted.length} questions.`);
      }
    } catch (e) {
      console.error(e);
      setAdminNotification("Failed to generate questions.");
    } finally {
      setIsGeneratingAdminQuestions(false);
    }
  };

  useEffect(() => {
    if (userNotification) {
      const timer = setTimeout(() => setUserNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [userNotification]);

  const handleMatricLogin = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!activeExamId) {
      setUserNotification("No active exam selected. Please use an exam link.");
      return;
    }
    if (!matricNumber.trim()) {
      setUserNotification("Please enter your matric number.");
      return;
    }

    let student = registeredStudents.find(s => s.matric.toLowerCase() === matricNumber.toLowerCase());
    
    if (student) {
      setStudentName(student.name);
      const session = localStorage.getItem(`nsg_exam_session_${activeExamId}_${student.matric}`);
      if (session) {
        const data = JSON.parse(session);
        if (data.status === 'completed') {
          setUserNotification("You have already completed this exam.");
          return;
        }
      }

      // If already paid or no payment required
      if (isTakingPaid || currentUserData?.bypassTakingPayment || currentUserData?.bypassAllPayments) {
        setIsTakingPaid(true);
        setExamLobbyState('briefing');
      } else {
        // Stay in login state to show payment button
      }
    } else {
      setUserNotification("You are not ready (Matric not registered for this exam)");
    }
  };

  const startExam = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (examQuestions.length < examConfig.questionCount) {
      setUserNotification(`Admin has not uploaded enough questions (Minimum ${examConfig.questionCount} required).`);
      return;
    }
    const shuffled = shuffleArray(examQuestions).slice(0, examConfig.questionCount);
    setExamQuestions(shuffled);
    setExamTimer(examConfig.duration);
    setExamLobbyState('exam');
    setExamAnswers({});
    setCurrentExamIndex(0);
    setExamFinished(false);
    
    // Mark as active
    setRegisteredStudents(prev => prev.map(s => 
      s.matric.toLowerCase() === matricNumber.toLowerCase() ? { ...s, isActive: true, lastActive: Date.now() } : s
    ));
    
    // Broadcast status
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.postMessage({ type: 'STATUS_UPDATE', matric: matricNumber, isActive: true });
    channel.close();

    localStorage.setItem(`nsg_exam_session_${activeExamId}_${matricNumber}`, JSON.stringify({ status: 'in-progress', startTime: Date.now() }));

    examTimerRef.current = setInterval(() => {
      setExamTimer(prev => {
        if (prev <= 1) {
          submitExam();
          return 0;
        }
        // Refresh active status every 30 seconds
        if (prev % 30 === 0) {
          setRegisteredStudents(curr => curr.map(s => 
            s.matric.toLowerCase() === matricNumber.toLowerCase() ? { ...s, lastActive: Date.now(), isActive: true } : s
          ));
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitExam = async () => {
    if (examTimerRef.current) clearInterval(examTimerRef.current);
    
    let score = 0;
    examQuestions.forEach((q, idx) => {
      if (examAnswers[idx] === q.correctAnswer) score++;
    });

    setExamScore(score);
    setExamFinished(true);
    setExamLobbyState('result');

    if (user && activeExamId) {
      const result: StudentResult = {
        matric: matricNumber,
        name: studentName,
        score: score,
        total: examQuestions.length,
        timestamp: new Date().toLocaleString(),
        hostUid: activeExamHostUid || undefined
      };
      
      // Save result to the specific exam's results subcollection
      await addDoc(collection(db, 'exams', activeExamId, 'results'), result);
      
      localStorage.setItem(`nsg_exam_session_${activeExamId}_${matricNumber}`, JSON.stringify({ status: 'completed', score }));
    }
  };

  const loadSharedExam = async (id: string) => {
    try {
      const examDoc = await getDoc(doc(db, 'exams', id));
      if (examDoc.exists()) {
        const data = examDoc.data();
        setExamConfig(data.config);
        setExamQuestions(data.questions);
        setRegisteredStudents(data.registeredStudents || []);
        setActiveExamId(id);
        setActiveExamHostUid(data.hostUid || null);
      } else {
        setUserNotification("Exam not found or expired.");
      }
    } catch (error) {
      console.error("Error loading exam:", error);
    }
  };

  const handleHostPaymentSuccess = async (reference: any) => {
    setIsHostPaid(true);
    const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
    setHostExamId(newId);
    localStorage.setItem('nsg_host_exam_id', newId);
    setUserNotification("Payment successful! You can now configure your exam.");
  };

  const endHostedExam = () => {
    if (window.confirm("Are you sure you want to end this exam session? All unsaved local data will be cleared.")) {
      setIsHostPaid(false);
      setHostExamId(null);
      setRegisteredStudents([]);
      setExamQuestions([]);
      setAdminQuestionsRaw('');
      localStorage.removeItem('nsg_host_exam_id');
      localStorage.removeItem('nsg_host_config');
      localStorage.removeItem('nsg_host_students');
      localStorage.removeItem('nsg_host_questions');
      setUserNotification("Exam session ended.");
    }
  };

  useEffect(() => {
    if (isHostPaid && hostExamId) {
      localStorage.setItem('nsg_host_config', JSON.stringify(examConfig));
      localStorage.setItem('nsg_host_students', JSON.stringify(registeredStudents));
      localStorage.setItem('nsg_host_questions', JSON.stringify(examQuestions));
    }
  }, [examConfig, registeredStudents, examQuestions, isHostPaid, hostExamId]);

  const handleTakingPaymentSuccess = async (reference: any) => {
    setPaymentVerified(true);
    setIsTakingPaid(true);
    setExamLobbyState('briefing');
    setUserNotification("Payment verified! Good luck.");
  };

  const saveHostedExam = async () => {
    if (!user || !hostExamId) return;
    try {
      const examData = {
        id: hostExamId,
        hostUid: user.uid,
        hostEmail: user.email,
        config: examConfig,
        questions: examQuestions,
        registeredStudents: registeredStudents,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'exams', hostExamId), examData);
      setUserNotification("Exam hosted successfully! Copy the link to share.");
    } catch (error) {
      console.error("Error saving exam:", error);
      setUserNotification("Failed to save exam.");
    }
  };

  const restartStudentTimer = (matric: string) => {
    localStorage.removeItem(`nsg_exam_session_${matric}`);
    setRegisteredStudents(prev => prev.map(s => 
      s.matric === matric ? { ...s, isActive: false } : s
    ));
    setAdminNotification(`Session for ${matric} has been reset.`);

    // Broadcast reset
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.postMessage({ type: 'RESET_EXAM', matric });
    channel.close();
  };

  const addStudent = () => {
    if (!newStudentMatric.trim() || !newStudentName.trim()) return;
    if (registeredStudents.some(s => s.matric === newStudentMatric)) {
      setAdminNotification("Matric number already exists.");
      return;
    }
    const studentData = { matric: newStudentMatric, name: newStudentName, paymentEnabled: true };
    setRegisteredStudents(prev => [...prev, studentData]);
    setNewStudentMatric('');
    setNewStudentName('');
    setAdminNotification("Student added successfully.");
  };

  const togglePayment = (matric: string) => {
    setRegisteredStudents(prev => prev.map(s => 
      s.matric === matric ? { ...s, paymentEnabled: !s.paymentEnabled } : s
    ));
  };

  const deleteStudent = (matric: string) => {
    setRegisteredStudents(prev => prev.filter(s => s.matric !== matric));
  };

  const downloadResults = () => {
    const content = scoreSheet.map(r => `${r.timestamp} | ${r.matric} | ${r.name} | Score: ${r.score}/${r.total}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NSG_Exam_Results_${Date.now()}.txt`;
    a.click();
  };

  // --- \u{1F4B3} PAYSTACK INTEGRATION ---
  const handleExamPaymentSuccess = (reference: any) => {
    setPaymentVerified(true);
    setExamLobbyState('briefing');
  };

  const handlePaystackClose = () => {
    setUserNotification("Payment cancelled. Please complete payment to proceed.");
  };

  const paystackConfig = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || (matricNumber ? `${matricNumber}@nsg.com` : "nuellkelechi@gmail.com"),
    amount: (adminMode ? 200 : 100) * 100, // 200 for hosting, 100 for taking
    publicKey: PAYSTACK_PUBLIC_KEY,
    onSuccess: handleExamPaymentSuccess,
    onClose: handlePaystackClose
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const togglePinLectureSession = async (id: string) => {
    if (!user) return;
    const session = sessions.find(s => s.id === id);
    if (session) {
      await updateDoc(doc(db, 'users', user.uid, 'lectureSessions', id), { isPinned: !session.isPinned });
    }
  };

  const deleteLectureSession = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'lectureSessions', id));
    if (selectedSession?.id === id) {
      setSelectedSession(null);
      setShowAnalysisInRecord(false);
    }
  };

  const uploadHistoryToOmni = async (session: LectureSession) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const report = `
      # Lecture Analysis: ${session.title}
      **Date:** ${session.date}
      **Duration:** ${session.duration}
      **Images Analyzed:** ${session.imageCount}

      ${session.fullAnalysis}
    `;

    // Create a new chat session with this analysis
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: `Analysis: ${session.title}`,
      history: [
        {
          role: 'model',
          text: "I've received your lecture analysis. How can I help you study this content further?",
          timestamp: new Date().toLocaleTimeString()
        },
        {
          role: 'user',
          text: report,
          timestamp: new Date().toLocaleTimeString()
        }
      ],
      timestamp: new Date().toLocaleString(),
      isPinned: false,
      uid: user.uid
    };

    await setDoc(doc(db, 'users', user.uid, 'chatSessions', newSession.id), newSession);
    setActiveChatSessionId(newSession.id);
    setChatHistory(newSession.history);
    setActiveTab('ai');
    setUserNotification("Analysis forwarded to Omni Ai!");
  };

  const shareAnalysis = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NSG Lecture Analysis',
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      copyToClipboard(text);
    }
  };

  // --- \u{1F3A4} RECORDING LOGIC ---
  const [isStopping, setIsStopping] = useState(false);
  const handleToggleRecording = async () => {
    if (isStopping) return;
    if (isRecording) {
      setIsStopping(true);
      try {
        console.log("\u{1F6D1} Stopping recording...");
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          // Stop all tracks to release the microphone
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Error stopping recording:", err);
      } finally {
        setIsRecording(false);
        setIsStopping(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } else {
      audioChunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      } catch (err) {
        setUserNotification("Microphone access denied. Please check permissions.");
      }
    }
  };

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- \u{1F6E0}\u{FE0F} HELPERS ---
  const uploadToCloudinary = async (file: File | Blob): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.warn("Cloudinary credentials missing. Falling back to local preview URL.");
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      throw error;
    }
  };

  const AdUnit = ({ slot }: { slot: string }) => {
    const adRef = useRef<any>(null);

    useEffect(() => {
      const timer = setTimeout(() => {
        try {
          if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
            const adsbygoogle = (window as any).adsbygoogle || [];
            adsbygoogle.push({});
          }
        } catch (e) {
          console.error("AdSense error:", e);
        }
      }, 500);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div className="my-6 overflow-hidden flex flex-col items-center w-full">
        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">Advertisement</span>
        <ins className="adsbygoogle"
             ref={adRef}
             style={{ display: 'block', minWidth: '250px', minHeight: '90px' }}
             data-ad-client="ca-pub-3216169026195971"
             data-ad-slot={slot}
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
    );
  };

  // --- \u{1F5BC}\u{FE0F} IMAGE HANDLER ---
  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 50) {
      setUserNotification("Limit Reached: 50 images max.");
      return;
    }
    const mapped = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      preview: URL.createObjectURL(f),
      type: 'image' as const
    }));
    setUploadedImages([...uploadedImages, ...mapped]);
  };

  // --- \u{1F9E0} GEMINI ANALYSIS ---
  const triggerFullAnalysis = async () => {
    if (uploadedImages.length === 0 && !recordedBlob) {
      setUserNotification("No data provided for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setShowAnalysisInRecord(false);

    try {
      const parts: any[] = [];

      // 1. Add Audio if exists
      if (recordedBlob) {
        const audioPart = await fileToGenerativePart(recordedBlob);
        parts.push(audioPart);
      }

      // 2. Add Images if exist
      if (uploadedImages.length > 0) {
        const imageParts = await Promise.all(
          uploadedImages.map(img => fileToGenerativePart(img.file))
        );
        imageParts.forEach(p => parts.push(p));
      }

      // 3. Add the Analysis Prompt
      parts.push({ text: `
        Act as the Omni Ai. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts with clear explanations.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic. Use markdown for better formatting. 
        IMPORTANT: For any mathematical formulas, use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$E=mc^2$$) or single dollar signs for inline (e.g. $x^2$).
      ` });

      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts }]
      });

      const text = response.text || "Analysis failed to generate text.";
      
      const base64Images = await Promise.all(uploadedImages.map(async (img) => {
        const part = await fileToGenerativePart(img.file);
        return `data:${img.file.type};base64,${part.inlineData.data}`;
      }));

      const newSession: LectureSession = { 
        id: Date.now().toString(), 
        title: `Lecture ${new Date().toLocaleTimeString()}`, 
        date: new Date().toLocaleDateString(), 
        duration: formatTime(recordingTime), 
        imageCount: uploadedImages.length, 
        summary: text.substring(0, 100) + "...",
        fullAnalysis: text,
        images: base64Images,
        audioUrl: audioUrl || undefined
      };

      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'lectureSessions', newSession.id), newSession);
      }
      
      setAnalysisResult(text);
      setSelectedSession(newSession);
      setShowAnalysisInRecord(true);
      setIsAnalyzing(false);
      setUserNotification("Analysis complete! View it below.");
    } catch (error: any) {
      console.error('\u{1F6A8} Gemini Analysis Error:', error);
      setUserNotification(`Analysis failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateChatTitle = async (history: ChatMessage[]) => {
    if (history.length < 2) return "New Chat Session";
    try {
      const prompt = `Based on this chat history, generate a very short (max 5 words) title for this conversation. Return ONLY the title text. Do not include quotes or any other text.\n\nHistory:\n${history.map(m => `${m.role}: ${m.text}`).join('\n')}`;
      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }]
      });
      return response.text?.trim() || "New Chat Session";
    } catch (e) {
      return "New Chat Session";
    }
  };

  const resetChat = async () => {
    if (!user) return;

    // Auto-name current session if it's default and has content
    if (activeChatSessionId) {
      const currentSession = chatSessions.find(s => s.id === activeChatSessionId);
      if (currentSession && (currentSession.title === "New Chat Session" || currentSession.title === "Lecture Analysis") && currentSession.history.length > 1) {
        const newTitle = await generateChatTitle(currentSession.history);
        await updateDoc(doc(db, 'users', user.uid, 'chatSessions', activeChatSessionId), { title: newTitle });
      }
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat Session",
      history: [{
        role: 'model',
        text: "System Online. How can I assist your studies today?",
        timestamp: new Date().toLocaleTimeString()
      }],
      timestamp: new Date().toLocaleString(),
      isPinned: false,
      uid: user.uid
    };
    await setDoc(doc(db, 'users', user.uid, 'chatSessions', newSession.id), newSession);
    setActiveChatSessionId(newSession.id);
    setChatHistory(newSession.history);
    chatInstanceRef.current = null;
    setShowChatSidebar(false);
  };

  const renameChatSession = async (id: string, newTitle: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'chatSessions', id), { title: newTitle });
  };

  const togglePinChatSession = async (id: string) => {
    if (!user) return;
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      await updateDoc(doc(db, 'users', user.uid, 'chatSessions', id), { isPinned: !session.isPinned });
    }
  };

  const handleShareResult = () => {
    setShowShareModal(true);
  };

  const generateShareImage = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `NSG_Score_${shareName || 'Student'}.png`;
      link.href = dataUrl;
      link.click();
      setShowShareModal(false);
      setUserNotification("Score card generated successfully!");
    } catch (err) {
      console.error('oops, something went wrong!', err);
      setUserNotification("Failed to generate image.");
    }
  };

  const loadChatSession = (id: string) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setActiveChatSessionId(id);
      setChatHistory(session.history);
      chatInstanceRef.current = null;
      setShowChatSidebar(false);
    }
  };

  const deleteChatSession = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'chatSessions', id));
    if (activeChatSessionId === id) {
      const remaining = chatSessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        loadChatSession(remaining[0].id);
      } else {
        resetChat();
      }
    }
  };

  // --- \u{1F4AC} CHAT ROUTING ENGINE ---
  const [isRecordingChat, setIsRecordingChat] = useState(false);
  const chatMediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startChatRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chatMediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setIsTyping(true);
        try {
          const part = await fileToGenerativePart(blob);
          const aiInstance = getAiInstance();
          const response = await aiInstance.models.generateContent({
            model: MODEL_NAME,
            contents: [{ parts: [part, { text: "Transcribe this audio exactly. If it's a question, just transcribe it." }] }]
          });
          if (response.text) {
            handleSendMessage(response.text);
          }
        } catch (err) {
          console.error("Voice Chat Error:", err);
          setUserNotification("Failed to process voice input.");
        } finally {
          setIsTyping(false);
        }
      };

      recorder.start();
      setIsRecordingChat(true);
    } catch (err) {
      console.error("Mic access error:", err);
      setUserNotification("Microphone access denied.");
    }
  };

  const stopChatRecording = () => {
    if (chatMediaRecorderRef.current && isRecordingChat) {
      chatMediaRecorderRef.current.stop();
      setIsRecordingChat(false);
    }
  };

  const handleSendMessage = async (msgOverride?: string) => {
    console.log("Handling Send Message...");
    const textToSend = msgOverride || chatInput;
    if (!textToSend.trim() && uploadedImages.length === 0) return;
    
    if (!getApiKey()) {
      setUserNotification("API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Check for image generation request
    const isImageRequest = chatMode === 'Creative' || textToSend.toLowerCase().includes("generate image") || textToSend.toLowerCase().includes("create image") || textToSend.toLowerCase().includes("draw");
    
    if (isImageRequest && !isPremium) {
      setShowPremiumModal(true);
      setUserNotification("Image generation is a premium feature.");
      return;
    }

    if (isImageRequest && !getHfKey()) {
      setUserNotification("HuggingFace API Key is missing. Please set VITE_HUGGINGFACE_API_KEY in your environment.");
      return;
    }

    const newHistory: ChatMessage[] = [...chatHistory, { 
      role: 'user', 
      text: textToSend || "Analyze this image", 
      timestamp: new Date().toLocaleTimeString() 
    }];
    
    setChatHistory(newHistory);
    setChatInput('');
    setIsTyping(true);

    try {
      let responseText = "";
      let generatedImage = "";

      if (isImageRequest) {
        try {
          const hfInstance = getHfInstance();
          const imageBlob = await hfInstance.textToImage({
            model: HF_MODELS.IMAGE,
            inputs: textToSend,
          });
          
          // Upload generated image to Cloudinary
          generatedImage = await uploadToCloudinary(imageBlob as any);
          responseText = "Here is your generated image:";
        } catch (hfError) {
          console.error("HF Image Gen Error:", hfError);
          responseText = "Failed to generate image. Please try again.";
        }
      } else {
        const parts: any[] = [{ text: textToSend || "Analyze this content." }];
        
        if (uploadedImages.length > 0) {
          // Upload all images to Cloudinary and get URLs for history persistence
          const cloudinaryUrls = await Promise.all(
            uploadedImages.map(img => uploadToCloudinary(img.file))
          );
          
          // For Gemini API, we still need the parts
          const imageParts = await Promise.all(
            uploadedImages.map(img => fileToGenerativePart(img.file))
          );
          imageParts.forEach(p => parts.push(p));

          // Store the first image URL in the message for history (simplified)
          if (cloudinaryUrls.length > 0) {
            newHistory[newHistory.length - 1].image = cloudinaryUrls[0];
          }
        }

        const aiInstance = getAiInstance();
        const response = await aiInstance.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: "You are Omni AI, a professional academic assistant. Provide clear, concise, and accurate information. Use LaTeX for math."
          }
        });
        responseText = response.text || "I'm sorry, I couldn't generate a response.";
      }

      const updatedHistory: ChatMessage[] = [...newHistory, { 
        role: 'model', 
        text: responseText, 
        timestamp: new Date().toLocaleTimeString(),
        ...(generatedImage ? { image: generatedImage } : {})
      }];
      
      setChatHistory(updatedHistory);

      if (user) {
        const sessionId = activeChatSessionId || Date.now().toString();
        if (!activeChatSessionId) setActiveChatSessionId(sessionId);

        const sessionRef = doc(db, 'users', user.uid, 'chatSessions', sessionId);
        
        await setDoc(sessionRef, {
          id: sessionId,
          title: updatedHistory.length > 2 ? "Conversation" : "New Conversation",
          history: updatedHistory,
          timestamp: new Date().toLocaleString(),
          uid: user.uid
        }, { merge: true });
      }
      
      if (uploadedImages.length > 0) setUploadedImages([]);
      
    } catch (error: any) {
      console.error("Chat Error:", error);
      // Only add error message if it's not already handled
      setChatHistory(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role === 'model' && (lastMsg.text.includes("Failed") || lastMsg.text.includes("I'm sorry"))) {
          return prev;
        }
        return [...prev, { 
          role: 'model', 
          text: formatAiError(error), 
          timestamp: new Date().toLocaleTimeString() 
        }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  // --- \u{1F4DD} QUIZ LOGIC ---
  const loadSharedQuiz = async (quizId: string) => {
    try {
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (quizDoc.exists()) {
        const data = quizDoc.data();
        setQuizQuestions(data.questions);
        setQuizTopic(data.topic);
        setQuizState('active');
        setActiveTab('quiz');
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setIsAnswered(false);
        setSelectedOption(null);
      }
    } catch (error) {
      console.error("Error loading shared quiz:", error);
    }
  };

  const shareQuiz = async () => {
    if (!quizQuestions.length) return;
    if (!user) {
      setShowAuthModal(true);
      setUserNotification("Please login to share your quiz.");
      return;
    }
    try {
      const quizId = Date.now().toString();
      await setDoc(doc(db, 'quizzes', quizId), {
        questions: quizQuestions,
        topic: quizTopic,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });
      const link = `${window.location.origin}${window.location.pathname}?quizId=${quizId}`;
      setShareQuizLink(link);
      navigator.clipboard.writeText(link);
      setUserNotification("Quiz link copied to clipboard!");
      setShowShareModal(true); // Show the modal so user can see the link
    } catch (error) {
      console.error("Error sharing quiz:", error);
      setUserNotification("Failed to generate share link.");
    }
  };
  const generateQuiz = async () => {
    console.log("Starting Quiz Generation...");
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!quizTopic.trim()) {
      setUserNotification("Please enter a topic first.");
      return;
    }

    if (!getApiKey()) {
      setUserNotification("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizState('idle');

    try {
      const prompt = `
        Generate a ${quizQuestionCount}-question multiple choice quiz about "${quizTopic}".
        Difficulty Level: ${quizDifficulty}.
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number (0-3),
              "explanation": "Detailed explanation of why the correct answer is right and others are wrong."
            }
          ]
        }
      `;

      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctAnswer", "explanation"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.questions) {
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setQuizState('active');
        setSelectedOption(null);
        setIsAnswered(false);
      }
    } catch (error) {
      console.error("Quiz Generation Error:", error);
      setUserNotification(formatAiError(error));
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const sendQuizReportToAI = () => {
    const report = `
      I just completed a quiz on ${quizTopic}.
      Score: ${quizScore}/${quizQuestions.length}.
      Difficulty: ${quizDifficulty}.
      Please analyze my performance and provide a study plan based on these results.
    `;
    setChatHistory(prev => [...prev, { role: 'user', text: report, timestamp: new Date().toLocaleTimeString() }]);
    setActiveTab('ai');
    handleSendMessage();
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === quizQuestions[currentQuestionIndex].correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizState('finished');
    }
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('nsg_welcome_seen', 'true');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-[#DC2626] pb-24 ${theme === 'dark' ? 'bg-[#0A0F1C] text-white dark' : 'bg-white text-slate-900'}`}>
      
      {/* AUTH LOADING OVERLAY */}
      <AnimatePresence>
        {isAuthLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className={`fixed inset-0 z-[300] ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} flex flex-col items-center justify-center space-y-4`}
          >
            <BlinkingBrain size={64} className="text-red-500" />
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} animate-pulse`}>Processing Authentication...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTH MODAL */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#DC2626] to-transparent" />
              <button onClick={() => setShowAuthModal(false)} className={`absolute top-4 right-4 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} hover:text-[#DC2626] transition-colors`}><XCircle size={24} /></button>
              
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={24} className="text-[#DC2626]" />
                </div>
                <h2 className={`text-2xl font-black tracking-tighter uppercase italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} mt-1`}>
                  {authMode === 'login' ? 'Login to access Quizzes and Exams' : 'Join NSG to start your academic journey'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' ? (
                  <>
                    <input type="text" value={authFullName} onChange={(e) => setAuthFullName(e.target.value)} placeholder="Full Name" required className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                    <input type="date" value={authDOB} onChange={(e) => setAuthDOB(e.target.value)} placeholder="Date of Birth" required className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                    <input type="text" value={authMatric} onChange={(e) => setAuthMatric(e.target.value)} placeholder="Matric Number (Optional)" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email Address" required className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className={`text-[10px] uppercase font-black tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} ml-1`}>Login with Email or Matric</p>
                      <input type="text" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email Address" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                      <div className="flex items-center gap-2 px-2">
                        <div className={`h-[1px] flex-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`} />
                        <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>OR</span>
                        <div className={`h-[1px] flex-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`} />
                      </div>
                      <input type="text" value={authMatric} onChange={(e) => setAuthMatric(e.target.value)} placeholder="Matric Number" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                    </div>
                  </>
                )}
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" required className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                
                <button type="submit" className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-[#DC2626]/20 uppercase tracking-widest">
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-xs font-bold text-[#DC2626] hover:underline uppercase tracking-tighter">
                  {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                </button>
              </div>

              <div className={`mt-8 pt-6 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                <button 
                  onClick={handleGoogleLogin} 
                  className={`w-full flex items-center justify-center gap-3 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10' : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'} border py-4 rounded-2xl text-sm font-bold transition-all`}
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Continue with Google
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#DC2626]" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-[#DC2626]" />
                </div>
                <h2 className={`text-2xl font-black tracking-tighter uppercase italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Welcome to <span className="text-[#DC2626]">NSG</span></h2>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'} leading-relaxed`}>
                  Welcome to NSG (Nuell Study Guide), powered by Nuell Graphics. Transform your learning experience by recording classes, generating AI transcriptions, chatting with our intelligent assistant, and creating custom quizzes. We are constantly improving NSG to better serve your academic journey. Thank you for choosing us as your study partner!
                </p>
                <button onClick={closeWelcome} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-[#DC2626]/20">GET STARTED</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEGAL MODAL */}
      <PremiumModal />
      <AnimatePresence>
        {legalPage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className={`${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
                  {legalPage === 'privacy' && "Privacy Policy"}
                  {legalPage === 'contact' && "Contact Us"}
                </h2>
                <button onClick={() => setLegalPage(null)} className="text-white/40 hover:text-[#DC2626] transition-colors"><XCircle size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm text-white/70 leading-relaxed">
                {legalPage === 'about' && (
                  <>
                    <p>NSG (Nuell Study Guide) is a cutting-edge educational tool designed to empower students and lifelong learners. Powered by Nuell Graphics, we leverage advanced AI to simplify complex learning processes.</p>
                    <p>Our mission is to provide a seamless interface for capturing lecture content, analyzing it with state-of-the-art language models, and providing interactive tools like AI chat and custom quizzes to reinforce knowledge.</p>
                  </>
                )}
                {legalPage === 'terms' && (
                  <>
                    <p>By using NSG, you agree to the following terms:</p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>NSG is provided "as is" for educational purposes.</li>
                      <li>Users are responsible for the content they upload and record.</li>
                      <li>We do not guarantee 100% accuracy of AI-generated content.</li>
                      <li>Your data is stored locally on your device for privacy.</li>
                    </ul>
                  </>
                )}
                {legalPage === 'privacy' && (
                  <div className="space-y-4">
                    <p className="font-bold text-[#DC2626]">Last Updated: April 9, 2026</p>
                    <p>At NSG Omni AI, we take your privacy seriously. This policy explains how we collect, use, and protect your data.</p>
                    
                    <h3 className="font-bold text-white">1. Information Collection</h3>
                    <p>We collect information you provide directly to us, such as your name, email address, and educational details when you create an account. We also collect audio recordings and text data you process through our AI tools.</p>
                    
                    <h3 className="font-bold text-white">2. Use of Data</h3>
                    <p>Your data is used to provide and improve our educational services, personalize your experience, and communicate with you about your account. We use advanced AI models to process your study materials.</p>
                    
                    <h3 className="font-bold text-white">3. Cookies & Google AdSense</h3>
                    <p>We use cookies to enhance your experience and analyze site traffic. We also use Google AdSense to serve advertisements. Google, as a third-party vendor, uses cookies to serve ads based on your visit to this and other sites on the Internet.</p>
                    <p>Users may opt out of personalized advertising by visiting Google's <a href="https://www.google.com/settings/ads" target="_blank" className="text-[#DC2626] underline">Ads Settings</a>.</p>
                    
                    <h3 className="font-bold text-white">4. Data Security</h3>
                    <p>We implement industry-standard security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
                  </div>
                )}
                {legalPage === 'contact' && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto"><Settings size={32} className="text-[#DC2626]" /></div>
                    <p className="text-lg font-bold text-white">Need Assistance?</p>
                    <p>If you have any issues, pls contact us at:</p>
                    <div className="space-y-1 font-mono text-[#DC2626] font-bold">
                      <p>nuellkelechi@gmail.com</p>
                      <p>07046732569</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className={`px-5 py-4 flex justify-between items-center border-b ${theme === 'dark' ? 'border-white/10 bg-[#0A0F1C]/95' : 'border-slate-200 bg-white/95'} backdrop-blur-xl sticky top-0 z-40`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${theme === 'dark' ? 'bg-[#0A0F1C] border-[#DC2626]/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-slate-100 border-slate-200'} border rounded-2xl flex items-center justify-center`}>
            <Brain size={22} className="text-[#DC2626] drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-xl font-black tracking-tighter italic leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>NSG <span className="text-[#DC2626]">(NUELL STUDY GUIDE)</span></h1>
            <span className={`text-[8px] sm:text-[9px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} uppercase tracking-widest`}>Lecture OS 4.0</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isStandalone && showInstallTimer && (
            <button 
              onClick={handleInstallClick}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg transition-all"
            >
              <Download size={14} /> {showInstallBtn ? "INSTALL APP" : "USE IN APP"}
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className={`text-[10px] font-black uppercase leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.displayName}</p>
                <p className={`text-[8px] uppercase font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{isAdminUser ? 'Admin' : 'Student'}</p>
              </div>
              <button onClick={handleLogout} className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/70' : 'bg-slate-100 border-slate-200 text-slate-600'} hover:text-[#DC2626] transition-all`}>
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-[#DC2626]/20">
              <User size={16} /> LOGIN
            </button>
          )}
          <button onClick={toggleTheme} className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/70' : 'bg-slate-100 border-slate-200 text-slate-600'} hover:text-[#DC2626] transition-all`}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-full border`}>
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'} uppercase`}>SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-2 sm:px-4 pt-4 sm:pt-6">
        {/* Global Notification System */}
        <AnimatePresence>
          {userNotification && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -50 }} 
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md"
            >
              <div className="bg-[#DC2626] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} />
                  <p className="text-xs font-black uppercase tracking-tight">{userNotification}</p>
                </div>
                <button onClick={() => setUserNotification(null)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                  <XCircle size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          
          {/* RECORD TAB */}
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity: 0}} className="space-y-6 relative">
              
              {/* Sliding Record Sidebar */}
              <AnimatePresence>
                {showRecordSidebar && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      onClick={() => setShowRecordSidebar(false)}
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />
                    <motion.div 
                      initial={{ x: '-100%' }} 
                      animate={{ x: 0 }} 
                      exit={{ x: '-100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className={`fixed left-0 top-0 bottom-0 w-1/2 min-w-[280px] z-[70] border-r ${theme === 'dark' ? 'border-white/10 bg-[#0A0F1C]' : 'border-slate-200 bg-white'} flex flex-col shadow-2xl`}
                    >
                      <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} flex items-center justify-between`}>
                        <button 
                          onClick={() => {
                            setShowAnalysisInRecord(false);
                            setSelectedSession(null);
                            setShowRecordSidebar(false);
                            setAudioUrl(null);
                            setRecordedBlob(null);
                            setUploadedImages([]);
                          }} 
                          className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626] text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[#DC2626]/20 hover:bg-[#DC2626]/90 transition-all"
                        >
                          <PlusCircle size={16} /> New Recording
                        </button>
                        <button onClick={() => setShowRecordSidebar(false)} className={`p-2 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} ml-2 hover:text-[#DC2626] transition-colors`}><XCircle size={20} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'} uppercase tracking-widest px-3 py-2`}>Analysis History</p>
                        {sessions.map(session => (
                          <div key={session.id} className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${selectedSession?.id === session.id ? 'bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626]' : `hover:bg-white/5 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}`}>
                            <div 
                              onClick={() => {
                                setSelectedSession(session);
                                setAnalysisResult(session.fullAnalysis);
                                setShowAnalysisInRecord(true);
                                setShowRecordSidebar(false);
                              }} 
                              className="flex items-center gap-2 overflow-hidden flex-1"
                            >
                              {session.isPinned ? <Pin size={12} className="text-red-500" /> : <FileAudio size={14} className="flex-shrink-0" />}
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-bold truncate">{session.title}</span>
                                <span className="text-[8px] opacity-60">{session.date} \u{2022} {session.duration}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); togglePinLectureSession(session.id); }} className="p-1.5 hover:text-red-500 bg-slate-100 dark:bg-white/5 rounded-lg transition-all" title="Pin Lecture">
                                <Pin size={12} className={session.isPinned ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteLectureSession(session.id); }} className="p-1.5 hover:text-red-500 bg-slate-100 dark:bg-white/5 rounded-lg transition-all" title="Delete Lecture">
                                <Trash2 size={12} className="text-slate-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <AdUnit slot="7536999840" />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setShowRecordSidebar(true)} className={`p-2 ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-xl ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'} hover:text-[#DC2626] transition-all flex items-center gap-2`}>
                  <History size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!showAnalysisInRecord ? (
                  <motion.div key="recorder" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} rounded-3xl p-8 border relative overflow-hidden shadow-sm`}>
                      <div className="flex flex-col items-center text-center relative z-10">
                        <div className="relative mb-6">
                          {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-[#DC2626] rounded-full blur-2xl pointer-events-none" />}
                          <button 
                            onClick={handleToggleRecording} 
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? (theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white') : 'bg-[#DC2626] text-white'} hover:scale-105 active:scale-95`}
                          >
                            {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                          </button>
                        </div>

                        <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-white">{isRecording ? "Capture Active" : "Engine Idle"}</h2>
                        <p className="font-mono text-4xl text-[#DC2626] font-bold mb-6 tracking-tight">{formatTime(recordingTime)}</p>

                        {audioUrl && (
                          <div className="w-full max-w-sm bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
                            <p className="text-[10px] font-black text-white/30 uppercase mb-2">Recording Preview</p>
                            <audio src={audioUrl} controls className="w-full h-8" />
                          </div>
                        )}

                        <div className="flex gap-2 w-full max-w-xs">
                          {audioUrl && (
                            <a 
                              href={audioUrl} 
                              download="NSG_Lecture.mp3" 
                              className={`flex-1 flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-white/10 text-white border-white/10' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} px-4 py-3 rounded-2xl text-xs font-bold transition-all border`}
                            >
                              <Download size={16} /> Download
                            </a>
                          )}
                          <button onClick={triggerFullAnalysis} disabled={isAnalyzing || !recordedBlob} className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626]/10 hover:bg-[#DC2626] text-[#DC2626] hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-[#DC2626]/30 transition-all disabled:opacity-50">
                            <Sparkles size={16} /> Analyze
                          </button>
                        </div>
                      </div>
                    </div>
                    <AdUnit slot="7536999840" />
                  </motion.div>
                ) : (
                  <motion.div key="analysis" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border shadow-sm space-y-6`}>
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
                            <Sparkles size={20} className="text-[#DC2626]" />
                          </div>
                          <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tighter">Omni Ai Analysis</h2>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                              {selectedSession ? selectedSession.title : 'Deep Learning Insights'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => selectedSession && uploadHistoryToOmni(selectedSession)} 
                            className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-white/5 text-white/70 border-white/10' : 'bg-zinc-100 text-zinc-600 border-zinc-200'} px-3 py-2 rounded-xl text-[10px] font-black hover:text-[#DC2626] transition-all border`}
                          >
                            <UserPlus size={14} /> UPLOAD TO OMNI
                          </button>
                          <button 
                            onClick={() => setShowAnalysisInRecord(false)} 
                            className={`p-2 ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-zinc-100 text-zinc-500'} rounded-xl hover:text-[#DC2626] transition-all`}
                          >
                            <ArrowLeft size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-6 overflow-y-auto max-h-[60vh] shadow-inner">
                        <div className="markdown-body text-sm text-white leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {analysisResult}
                          </ReactMarkdown>
                        </div>
                      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => copyToClipboard(analysisResult)} className={`flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-white/5 text-white/70' : 'bg-zinc-100 text-zinc-600'} py-4 rounded-2xl text-[10px] font-black hover:bg-zinc-200 transition-all`}>
          <Copy size={16} /> COPY
        </button>
        <button onClick={() => shareAnalysis(analysisResult || '')} className={`flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-white/5 text-white/70' : 'bg-zinc-100 text-zinc-600'} py-4 rounded-2xl text-[10px] font-black hover:bg-zinc-200 transition-all`}>
          <Share2 size={16} /> SHARE
        </button>
        <button 
          onClick={() => {
            const newHistory: ChatMessage[] = [...chatHistory, { role: 'model', text: analysisResult, timestamp: new Date().toLocaleTimeString() }];
            setChatHistory(newHistory);
            setActiveTab('ai');
          }} 
          className="flex items-center justify-center gap-2 bg-[#DC2626] text-white py-4 rounded-2xl text-[10px] font-black hover:bg-[#DC2626]/90 transition-all shadow-lg shadow-[#DC2626]/20"
        >
          <Brain size={16} /> CHAT
        </button>
      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className={`flex h-[calc(100vh-140px)] sm:h-[calc(100vh-220px)] ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/5' : 'bg-white border-slate-200'} rounded-2xl sm:rounded-3xl border overflow-hidden relative shadow-2xl mx-[-8px] sm:mx-0`}>
              
              {/* Sidebar Drawer */}
              <AnimatePresence>
                {showChatSidebar && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setShowChatSidebar(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-md z-[60]"
                    />
                    <motion.div 
                      initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[320px] z-[70] border-r ${theme === 'dark' ? 'border-white/10 bg-[#0A0F1C]' : 'border-slate-200 bg-white'} flex flex-col shadow-2xl`}
                    >
                      <div className="p-6 border-b border-white/10">
                        <button onClick={resetChat} className="w-full flex items-center justify-center gap-2 bg-[#DC2626] text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-[#DC2626]/20 mb-6">
                          <Plus size={18} /> NEW CHAT
                        </button>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Premium Status</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isPremium ? 'text-yellow-500' : 'text-white/20'}`}>{isPremium ? 'Active' : 'Free'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: isPremium ? '100%' : '10%' }} className={`h-full ${isPremium ? 'bg-yellow-500' : 'bg-[#DC2626]'}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest px-2 mb-2">Recent Conversations</p>
                        {chatSessions.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)).map(session => (
                          <div key={session.id} onClick={() => loadChatSession(session.id)} className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${activeChatSessionId === session.id ? 'bg-white/5 border border-white/10 text-white' : 'text-white/40 hover:bg-white/5'}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                              <MessageSquare size={14} className={`flex-shrink-0 ${session.isPinned ? 'text-yellow-500' : ''}`} />
                              <span className="text-xs font-bold truncate">{session.title}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-all flex-shrink-0">
                              <button 
                                onClick={(e) => { e.stopPropagation(); togglePinChatSession(session.id); }} 
                                className={`p-1.5 hover:text-yellow-500 transition-all ${session.isPinned ? 'text-yellow-500' : 'text-white/40'}`}
                              >
                                <Pin size={14} />
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const newTitle = prompt("Rename chat:", session.title);
                                  if (newTitle) renameChatSession(session.id, newTitle);
                                }} 
                                className="p-1.5 hover:text-blue-500 transition-all text-white/40"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteChatSession(session.id); }} 
                                className="p-1.5 hover:text-[#DC2626] transition-all text-white/40"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col relative">
                <AnimatePresence>
                  {isLiveActive && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`absolute inset-0 z-[100] ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'}`}
                    >
                      <GeminiLive onClose={() => setIsLiveActive(false)} setUserNotification={setUserNotification} theme={theme} />
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Chat Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowChatSidebar(true)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><Menu size={20} className="text-white/60" /></button>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Omni AI</h3>
                      <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Neural Engine V4.0</p>
                    </div>
                  </div>
                <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsLiveActive(true)}
                      className="flex items-center gap-2 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border border-[#DC2626]/20"
                    >
                      <Activity size={14} className="animate-pulse" /> LIVE TUTOR
                    </button>
                    {isPremium && <div className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[8px] font-black uppercase border border-yellow-500/20">Premium</div>}
                  </div>
                </div>

                {/* Messages Area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-2 sm:p-6 space-y-3 sm:space-y-8 scroll-smooth">
                  <AdUnit slot="7536999840" />
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center px-4">
                      <div className="max-w-2xl w-full text-left space-y-8">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                            Hi {currentUserData?.displayName?.split(' ')[0] || 'there'},
                          </h2>
                          <h3 className="text-3xl sm:text-4xl font-black text-white/40 tracking-tighter">
                            Where should we start?
                          </h3>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { icon: ImageIcon, label: 'Create image', color: 'text-blue-400', prompt: 'Generate a creative image of...' },
                            { icon: Mic, label: 'Create music', color: 'text-red-400', prompt: 'Compose a short melody about...' },
                            { icon: FileText, label: 'Write anything', color: 'text-green-400', prompt: 'Write a professional article about...' },
                            { icon: BookOpen, label: 'Help me learn', color: 'text-yellow-400', prompt: 'Explain the concept of...' }
                          ].map((btn, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              onClick={() => setChatInput(btn.prompt)}
                              className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group text-left"
                            >
                              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <btn.icon size={20} className={btn.color} />
                              </div>
                              <span className="text-sm font-bold text-white/80">{btn.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] sm:max-w-[85%] flex gap-2 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-[#DC2626]' : 'bg-white/10'}`}>
                            {msg.role === 'user' ? <User size={12} className="sm:size-[16px]" /> : <Brain size={12} className="sm:size-[16px] text-[#DC2626]" />}
                          </div>
                          <div className={`space-y-1 sm:space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#DC2626] text-white rounded-tr-none' : `${theme === 'dark' ? 'bg-white/5 text-white/90 border-white/10' : 'bg-slate-50 text-slate-700 border-slate-200'} border rounded-tl-none`}`}>
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                              
                              {msg.role === 'model' && (
                                <div className="mt-2 flex justify-end">
                                  <button 
                                    onClick={() => copyToClipboard(msg.text)}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-[#DC2626] transition-all border border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                    title="Copy Response"
                                  >
                                    <Copy size={12} /> Copy
                                  </button>
                                </div>
                              )}

                              {msg.image && (
                                <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                                  <img src={msg.image} alt="Generated" className="rounded-xl border border-white/10 max-w-full h-auto shadow-2xl" />
                                  <a href={msg.image} download="NSG_Generated_Image.png" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all border border-white/10">
                                    <Download size={12} className="sm:size-[14px]" /> Download Image
                                  </a>
                                </div>
                              )}
                            </div>
                            <span className="text-[7px] sm:text-[8px] font-bold text-white/20 uppercase tracking-widest">{msg.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Brain size={16} className="text-[#DC2626] animate-pulse" /></div>
                        <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/10">
                          <div className="flex gap-1">
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-2 sm:p-6 bg-gradient-to-t from-[#0A0F1C] via-[#0A0F1C] to-transparent">
                  <div className="max-w-3xl mx-auto space-y-4">
                    
                    {/* File Preview Area - Moved above input */}
                    <AnimatePresence>
                      {uploadedImages.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="flex gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl overflow-x-auto no-scrollbar"
                        >
                          {uploadedImages.map(img => (
                            <div key={img.id} className="relative group flex-shrink-0">
                              <img src={img.preview} className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                              <button 
                                onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                                className="absolute -top-2 -right-2 bg-[#DC2626] text-white p-1 rounded-full shadow-lg hover:scale-110 transition-all"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Module Info - Disappears when typing or after upload */}
                    {!chatInput && uploadedImages.length === 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="px-4 py-2 bg-[#DC2626]/5 border border-[#DC2626]/10 rounded-xl"
                      >
                        <p className="text-[9px] font-bold text-[#DC2626] uppercase tracking-widest text-center">
                          Tip: Use <span className="font-black">Vision</span> for images & <span className="font-black">Creative</span> for generation
                        </p>
                      </motion.div>
                    )}

                    {/* Mode Selector */}
                    <div className="flex items-center gap-1.5 sm:gap-2 px-1 overflow-x-auto no-scrollbar">
                      {[
                        { id: 'General', icon: Brain, label: 'General' },
                        { id: 'Vision', icon: Camera, label: 'Vision' },
                        { id: 'Creative', icon: Sparkles, label: 'Creative' }
                      ].map(mode => (
                        <button 
                          key={mode.id}
                          onClick={() => setChatMode(mode.id as any)}
                          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[8px] sm:text-[10px] font-black uppercase transition-all whitespace-nowrap border ${chatMode === mode.id ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                        >
                          <mode.icon size={12} className="sm:size-[14px]" /> {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-[#DC2626]/20 to-blue-500/20 rounded-2xl sm:rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                      <div className="relative flex items-end bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 backdrop-blur-xl focus-within:border-[#DC2626]/50 transition-all">
                        <div className="flex items-center">
                          <button onClick={() => isRecordingChat ? stopChatRecording() : startChatRecording()} className={`p-2 sm:p-3 rounded-xl transition-all ${isRecordingChat ? 'bg-[#DC2626] text-white animate-pulse' : 'text-white/40 hover:text-white'}`}>
                            {isRecordingChat ? <StopCircle size={18} className="sm:size-[22px]" /> : <Mic size={18} className="sm:size-[22px]" />}
                          </button>
                          <label className="p-2 sm:p-3 rounded-xl text-white/40 hover:text-white cursor-pointer transition-all">
                            <Upload size={18} className="sm:size-[22px]" />
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              onChange={(e) => {
                                if (e.target.files) {
                                  const files = Array.from(e.target.files).map(f => ({
                                    id: Math.random().toString(36).substr(2, 9),
                                    file: f,
                                    preview: URL.createObjectURL(f),
                                    type: f.type.startsWith('image/') ? 'image' : 'audio'
                                  }));
                                  setUploadedImages(prev => [...prev, ...files as any]);
                                  if (files.some(f => f.type === 'image')) setChatMode('Vision');
                                }
                              }} 
                            />
                          </label>
                        </div>
                        <textarea 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                          placeholder={chatMode === 'Vision' ? "Ask about these images..." : chatMode === 'Creative' ? "Describe the image you want to generate..." : "Message Omni AI..."} 
                          className="flex-1 bg-transparent border-none outline-none px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white placeholder:text-white/20 resize-none min-h-[40px] max-h-32" 
                        />
                        <button 
                          onClick={() => handleSendMessage()} 
                          disabled={isTyping}
                          className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all shadow-xl shadow-[#DC2626]/20 mb-0.5 sm:mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isTyping ? <RefreshCcw size={18} className="sm:size-[22px] animate-spin" /> : <Zap size={18} className="sm:size-[22px]" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[8px] text-center mt-3 text-white/20 font-bold uppercase tracking-widest">Omni AI can make mistakes. Verify important info.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tools & History</h2>
                {selectedSession && <button onClick={() => setSelectedSession(null)} className="text-[#DC2626] text-xs font-bold flex items-center gap-1"><ArrowLeft size={14} /> Back</button>}
              </div>

              {/* Premium Status Widget */}
              <div className="bg-gradient-to-br from-yellow-500/20 to-transparent p-6 rounded-3xl border border-yellow-500/20 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                    <Sparkles size={24} className="text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight text-white">Premium Membership</h3>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {isPremium ? `Active \u{2022} ${premiumTimeLeft} Remaining` : "Inactive \u{2022} Upgrade for full access"}
                    </p>
                  </div>
                </div>
                {!isPremium ? (
                  <button onClick={() => setShowPremiumModal(true)} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-yellow-500/20">Upgrade</button>
                ) : (
                  <div className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">Active</div>
                )}
              </div>

              {!selectedSession ? (
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className={`text-center py-20 ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} rounded-3xl border border-dashed`}>
                      <History size={40} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-white/10' : 'text-slate-200'}`} />
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>No saved lectures found</p>
                    </div>
                  ) : (
                    sessions.map(session => (
                      <div key={session.id} className="w-full bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/10 hover:border-[#DC2626]/30 transition-all group shadow-sm">
                        <div onClick={() => setSelectedSession(session)} className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-[#DC2626]/10 transition-all">
                            {session.isPinned ? <Pin size={20} className="text-[#DC2626]" /> : <FileAudio size={20} className="text-white/20 group-hover:text-[#DC2626]" />}
                          </div>
                          <div><p className="font-bold text-sm text-white">{session.title}</p><p className="text-[10px] text-white/40 font-mono uppercase">{session.date} \u{2022} {session.duration}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => togglePinLectureSession(session.id)} className="p-2.5 bg-white/5 rounded-xl text-white/20 hover:text-[#DC2626] transition-all" title="Pin Lecture">
                            <Pin size={16} className={session.isPinned ? 'fill-[#DC2626] text-[#DC2626]' : ''} />
                          </button>
                          <button onClick={() => deleteLectureSession(session.id)} className="p-2.5 bg-white/5 rounded-xl text-white/20 hover:text-[#DC2626] transition-all" title="Delete Lecture">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-6 rounded-3xl border space-y-6 shadow-sm`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">{selectedSession.title}</h3>
                    <button onClick={() => {
                      setChatHistory([{ role: 'model', text: selectedSession.fullAnalysis, timestamp: new Date().toLocaleTimeString() }]);
                      setActiveTab('ai');
                      setSelectedSession(null);
                    }} className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#DC2626]/20"><Brain size={14} /> Continue in Chat</button>
                  </div>
                  <div className="markdown-body text-sm leading-relaxed text-white/70">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedSession.fullAnalysis}</ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* QUIZ TAB */}
          {activeTab === 'quiz' && (
            <motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <AdUnit slot="7536999840" />
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Quiz Engine</h2>
                <Zap size={20} className="text-[#DC2626]" />
              </div>

              {quizState === 'idle' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border space-y-6 shadow-sm`}>
                  <div className="text-center space-y-2 mb-4">
                    <div className="w-12 h-12 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><Sparkles size={24} className="text-[#DC2626]" /></div>
                    <h3 className="font-bold text-lg text-white">Generate Interactive Quiz</h3>
                    <p className="text-xs text-white/40">Test your knowledge with AI-generated questions.</p>
                  </div>
                  
                  <div className="space-y-4">
                    {!user ? (
                      <div className="text-center space-y-4 py-6">
                        <p className="text-sm text-white/60">You must be logged in to generate quizzes.</p>
                        <button onClick={() => setShowAuthModal(true)} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">
                          LOGIN TO PROCEED
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] font-black text-white/30 uppercase mb-2 ml-1">Topic</p>
                          <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. Quantum Physics, EEE 101..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all text-white" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-white/30 uppercase mb-2 ml-1">Questions</p>
                            <div className="flex flex-wrap gap-2">
                              {[15, 25, 50, 100].map(count => (
                                <button key={count} onClick={() => setQuizQuestionCount(count)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${quizQuestionCount === count ? 'bg-[#DC2626] border-[#DC2626] text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                  {count}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white/30 uppercase mb-2 ml-1">Difficulty</p>
                            <div className="flex flex-wrap gap-2">
                              {['Easy', 'Medium', 'Hard', 'Professional'].map(level => (
                                <button key={level} onClick={() => setQuizDifficulty(level as any)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${quizDifficulty === level ? 'bg-[#DC2626] border-[#DC2626] text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                  {level}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button onClick={generateQuiz} disabled={isGeneratingQuiz} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isGeneratingQuiz ? <><RefreshCcw size={18} className="animate-spin" /> GENERATING...</> : <><Zap size={18} /> START ASSESSMENT</>}
                  </button>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-4 rounded-2xl border shadow-sm`}>
                    <button onClick={() => setQuizState('idle')} className="text-white/40 hover:text-[#DC2626] flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back</button>
                    <div className="text-center"><p className="text-[10px] font-black text-white/30 uppercase">Progress</p><p className="text-sm font-black text-[#DC2626]">{currentQuestionIndex + 1} / {quizQuestions.length}</p></div>
                    <div className="text-right"><p className="text-[10px] font-black text-white/30 uppercase">Score</p><p className="text-sm font-black text-green-500">{quizScore}</p></div>
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border space-y-8 shadow-sm`}>
                    <h3 className="text-lg font-bold leading-tight text-white">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border transition-all ${isAnswered ? (idx === quizQuestions[currentQuestionIndex].correctAnswer ? 'bg-green-500/10 border-green-500 text-green-500' : (selectedOption === idx ? 'bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]' : 'bg-white/5 opacity-40')) : (selectedOption === idx ? 'border-[#DC2626]' : 'bg-white/5 border-white/10 text-white/80')}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    {isAnswered && (
                      <button 
                        onClick={nextQuestion} 
                        className={`w-full ${theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white'} font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all`}
                      >
                        {currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"} <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quizState === 'finished' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-3xl border border-slate-200 dark:border-white/10 text-center space-y-8 shadow-sm">
                  <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto relative">
                    <Trophy size={48} className="text-red-500" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-500/5 rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Assessment Complete</h3>
                    <p className="text-slate-500 dark:text-white/40 text-sm mt-1">You've successfully finished the quiz.</p>
                  </div>
                  <div className="py-8 border-y border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1">Your Score</p>
                    <p className="text-6xl font-black text-red-500">{quizScore} / {quizQuestions.length || 1}</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-white/30 mt-2 uppercase tracking-widest">{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}% Proficiency</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={shareQuiz} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                      <Share2 size={18} /> SHARE QUIZ LINK
                    </button>
                    <button onClick={handleShareResult} className="w-full bg-red-500 hover:bg-red-500/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-2">
                      <Share2 size={18} /> SHARE SCORE CARD
                    </button>
                    <button onClick={() => setQuizState('idle')} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">TRY ANOTHER TOPIC</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}


          {/* EXAM TAB */}
          {activeTab === 'exam' && (
            <motion.div key="exam" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">CBT Examination</h2>
                <ShieldCheck size={20} className="text-[#DC2626]" />
              </div>

              {examLobbyState === 'login' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-5 sm:p-8 rounded-3xl border space-y-6 shadow-sm`}>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><User size={24} className="text-[#DC2626]" /></div>
                    <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Student Verification</h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Enter your credentials to access the examination hall.</p>
                  </div>
                  {!showAdminLogin ? (
                    <div className="space-y-4">
                      {!user ? (
                        <div className="text-center space-y-4 py-6">
                          <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>You must be logged in to access examinations.</p>
                          <button onClick={() => setShowAuthModal(true)} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">
                            LOGIN TO PROCEED
                          </button>
                        </div>
                      ) : studentName ? (
                        <div className={`p-6 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} rounded-3xl border space-y-4 text-center`}>
                          <div className="w-16 h-16 bg-[#DC2626] rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-[#DC2626]/20">{studentName.charAt(0)}</div>
                          <div>
                            <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase tracking-widest`}>Authenticated Student</p>
                            <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{studentName}</p>
                            <p className="text-xs font-mono text-[#DC2626] font-bold">{matricNumber}</p>
                          </div>
                          
                          {isTakingPaid ? (
                            <div className={`pt-4 space-y-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                              <button onClick={handleMatricLogin} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">PROCEED TO HALL</button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className={`w-full text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase hover:text-[#DC2626] transition-all`}>Not you? Switch Account</button>
                            </div>
                          ) : (
                            <div className={`pt-4 space-y-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                              <p className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} leading-relaxed italic`}>This examination requires a one-time access fee of <span className={`font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{"\u{20A6}100"}</span>. Please complete payment to proceed.</p>
                              <button 
                                onClick={() => {
                                  if (currentUserData?.bypassTakingPayment || currentUserData?.bypassAllPayments) {
                                    handleTakingPaymentSuccess({ reference: 'GOD_MODE_BYPASS' });
                                  } else {
                                    initializePayment({ onSuccess: handleTakingPaymentSuccess, onClose: handlePaystackClose });
                                  }
                                }} 
                                className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2"
                              >
                                <CreditCard size={18} /> {"PAY \u{20A6}100 & PROCEED"}
                              </button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className={`w-full text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase hover:text-[#DC2626] transition-all`}>Not you? Switch Account</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter Matric Number" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                          <button onClick={handleMatricLogin} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">VERIFY MATRIC</button>
                      <button 
                        onClick={() => setAdminMode(true)} 
                        className={`w-full ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-zinc-100 text-zinc-500'} font-bold py-3 rounded-2xl text-xs hover:bg-[#DC2626]/10 transition-all`}
                      >
                        {"HOST AN EXAM (\u{20A6}200)"}
                      </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="Admin PIN" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowAdminLogin(false)} 
                          className={`flex-1 ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-zinc-100 text-zinc-500'} font-bold py-4 rounded-2xl text-sm`}
                        >
                          BACK
                        </button>
                        <button onClick={handleAdminLogin} className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">LOGIN AS ADMIN</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {examLobbyState === 'briefing' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-5 sm:p-8 rounded-3xl border space-y-6 shadow-sm`}>
                  <div className={`flex items-center gap-4 p-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} rounded-2xl border`}>
                    <div className="w-12 h-12 bg-[#DC2626] rounded-full flex items-center justify-center text-white font-black text-xl">{studentName.charAt(0)}</div>
                    <div><p className={`font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase tracking-tighter`}>{studentName}</p><p className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} font-mono`}>{matricNumber}</p></div>
                  </div>
                  <div className="space-y-4">
                    <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Examination Briefing</h3>
                    <div className={`${theme === 'dark' ? 'bg-[#DC2626]/5 border-[#DC2626]/20' : 'bg-red-50 border-red-100'} p-4 rounded-2xl border space-y-3`}>
                      <p className="text-xs text-[#DC2626] font-bold flex items-center gap-2"><XCircle size={14} /> WARNING: {studentName}, if you leave this app, you automatically forfeit the exam.</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'} leading-relaxed`}>This is a professional CBT Mock Exam. You have {Math.floor(examConfig.duration / 60)} minutes to answer {examConfig.questionCount} randomized questions. Use only your brain. Good luck.</p>
                    </div>
                  </div>
                  <button onClick={startExam} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    <Zap size={18} /> START EXAMINATION NOW
                  </button>
                </div>
              )}

              {examLobbyState === 'exam' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-3 sm:p-4 rounded-2xl border shadow-sm sticky top-16 sm:top-20 z-30`}>
                    <div className="flex items-center gap-2 text-[#DC2626] font-black">
                      <Clock size={16} className="sm:size-[18px]" />
                      <span className="font-mono text-base sm:text-lg">{Math.floor(examTimer / 60)}:{(examTimer % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="text-center"><p className={`text-[8px] sm:text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase`}>Question</p><p className={`text-xs sm:text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentExamIndex + 1} / {examQuestions.length}</p></div>
                    <button onClick={submitExam} disabled={Object.keys(examAnswers).length < (examQuestions.length * 0.5)} className="bg-[#DC2626] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest disabled:opacity-30">Submit</button>
                  </div>

                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-5 sm:p-8 rounded-3xl border space-y-6 sm:space-y-8 shadow-sm`}>
                    <h3 className={`text-base sm:text-lg font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{examQuestions[currentExamIndex].question}</h3>
                    <div className="space-y-3">
                      {examQuestions[currentExamIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => setExamAnswers({ ...examAnswers, [currentExamIndex]: idx })} className={`w-full text-left p-4 rounded-2xl border transition-all ${examAnswers[currentExamIndex] === idx ? 'border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]' : `${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-slate-50 border-slate-200 text-slate-700'}`}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between pt-4">
                      <button onClick={() => setCurrentExamIndex(prev => Math.max(0, prev - 1))} disabled={currentExamIndex === 0} className={`p-3 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} hover:text-[#DC2626] disabled:opacity-20`}><ArrowLeft size={24} /></button>
                      <button onClick={() => setCurrentExamIndex(prev => Math.min(examQuestions.length - 1, prev + 1))} disabled={currentExamIndex === examQuestions.length - 1} className={`p-3 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} hover:text-[#DC2626] disabled:opacity-20`}><ChevronRight size={24} /></button>
                    </div>
                  </div>
                </div>
              )}

              {examLobbyState === 'result' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-10 rounded-3xl border text-center space-y-6 shadow-sm`}>
                  <div className="w-20 h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} className="text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Exam Submitted</h3>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Your results have been recorded in the system.</p>
                  </div>
                  <div className={`py-6 border-y ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                    <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase tracking-widest mb-1`}>Final Score</p>
                    <p className="text-5xl font-black text-[#DC2626]">{examScore} / {examQuestions.length}</p>
                    <p className={`text-sm font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>{Math.round((examScore / (examQuestions.length || 1)) * 100)}% Proficiency</p>
                  </div>
                  <button 
                    onClick={() => setExamLobbyState('login')} 
                    className={`w-full ${theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white'} font-black py-4 rounded-2xl text-sm transition-all`}
                  >
                    LOGOUT
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* BLOG TAB */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-8 pb-20">
              <AdUnit slot="7536999840" />
              {blogPosts.length === 0 ? (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-12 rounded-3xl border shadow-sm text-center space-y-4`}>
                  <div className="w-16 h-16 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                    <BookOpen size={32} className="text-[#DC2626]" />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">No Articles Yet</h2>
                  <p className="text-sm text-white/40">Check back later for updates from the NSG team.</p>
                </div>
              ) : (
                blogPosts.map((post) => (
                  <div key={post.id} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border shadow-sm space-y-6`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-[#DC2626] uppercase tracking-widest">
                        <Calendar size={12} />
                        {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Just now'}
                      </div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">{post.title}</h2>
                    </div>
                    <div className={`markdown-body text-sm leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content}
                      </ReactMarkdown>
                    </div>

                    {/* Reactions Section */}
                    <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-2">
                      {['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F44F}', '\u{1F64C}', '\u{1F4A1}'].map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => handleReaction(post.id, emoji)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-bold opacity-60">{post.reactions?.[emoji] || 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-32 px-2 sm:px-0">
              <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-6 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#DC2626]/20 to-transparent opacity-50" />
                
                <div className="relative flex flex-col items-center text-center space-y-6 sm:space-y-8">
                  <div className="relative group">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-[#DC2626] overflow-hidden bg-white/5 shadow-2xl shadow-[#DC2626]/20">
                      {currentUserData?.photoURL ? (
                        <img src={currentUserData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20"><User size={48} className="sm:size-[64px]" /></div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 p-2 sm:p-3 bg-[#DC2626] text-white rounded-full cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all border-2 border-[#0A0F1C]">
                      <Camera size={16} className="sm:size-[20px]" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter italic">{currentUserData?.displayName || 'Student Name'}</h2>
                    <p className="text-[10px] sm:text-xs font-bold text-[#DC2626] uppercase tracking-[0.3em]">{currentUserData?.email || 'email@example.com'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Status</p>
                      <p className={`text-xs font-black uppercase ${isPremium ? 'text-yellow-500' : 'text-white/60'}`}>{isPremium ? 'Premium' : 'Free User'}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Joined</p>
                      <p className="text-xs font-black text-white/60 uppercase">2026</p>
                    </div>
                  </div>

                  <div className="w-full space-y-4 sm:space-y-6 pt-4 sm:pt-6 border-t border-white/10">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Display Name</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          defaultValue={currentUserData?.displayName || ''} 
                          onBlur={(e) => handleProfileUpdate({ displayName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" 
                          placeholder="Enter your name"
                        />
                        <Edit3 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                      </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Matric Number (Optional)</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          defaultValue={currentUserData?.matricNumber || ''} 
                          onBlur={(e) => handleProfileUpdate({ matricNumber: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" 
                          placeholder="e.g. DEL/2024/001"
                        />
                        <ShieldCheck size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                      </div>
                    </div>

                    <button 
                      onClick={() => signOut(auth)}
                      className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-[#DC2626]/10 text-white/40 hover:text-[#DC2626] py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border border-white/10 hover:border-[#DC2626]/20"
                    >
                      <LogOut size={16} className="sm:size-[18px]" /> LOGOUT FROM ACCOUNT
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* HOST EXAM PANEL (FORMERLY ADMIN) */}
          {adminMode && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`fixed inset-0 z-[110] p-2 sm:p-6 overflow-y-auto ${theme === 'dark' ? 'bg-[#0A0F1C]/95' : 'bg-white/95'} backdrop-blur-xl`}>
              <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8 pb-32">
                <div className="flex items-center justify-between border-b border-[#DC2626]/20 pb-4 sm:pb-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#DC2626] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
                      <LayoutDashboard size={20} className="text-white sm:hidden" />
                      <LayoutDashboard size={24} className="text-white hidden sm:block" />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-3xl font-black text-[#DC2626] uppercase tracking-tighter italic">Host Exam</h1>
                      <p className="text-[7px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Professional Infrastructure</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <AnimatePresence>
                      {adminNotification && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-[#DC2626] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#DC2626]/20">
                          {adminNotification}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button 
                      onClick={() => setAdminMode(false)} 
                      className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-zinc-100 text-zinc-500'} hover:bg-[#DC2626]/10`}
                    >
                      <XCircle size={20} className="sm:size-[24px]" />
                    </button>
                  </div>
                </div>

                {!isHostPaid ? (
                  <div className="max-w-md mx-auto py-10 sm:py-20 text-center space-y-6 px-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                      <ShieldCheck size={32} className="text-[#DC2626] sm:size-[40px]" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">Host Your Own Exam</h2>
                      <p className="text-xs sm:text-sm text-white/40 leading-relaxed">Create a professional CBT environment for your students. Hosting fee is <span className="font-black text-white">{"\u{20A6}200"}</span> per session.</p>
                    </div>
                    <button 
                      onClick={() => {
                        if (currentUserData?.bypassHostingPayment || currentUserData?.bypassAllPayments) {
                          handleHostPaymentSuccess({ reference: 'GOD_MODE_BYPASS' });
                        } else {
                          initializePayment({ 
                            onSuccess: handleHostPaymentSuccess, 
                            onClose: handlePaystackClose 
                          });
                        }
                      }} 
                      className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 sm:py-5 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard size={18} className="sm:size-[20px]" /> {"PAY \u{20A6}200 TO START"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Student Management */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                      {hostExamId ? (
                        <div className="bg-green-500/10 border border-green-500/20 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex-shrink-0 flex items-center justify-center text-white"><Share2 size={16} /></div>
                            <div className="overflow-hidden">
                              <p className="text-[8px] sm:text-[10px] font-black text-green-500 uppercase tracking-widest">Exam Share Link</p>
                              <p className="text-[10px] sm:text-xs font-mono text-white/60 truncate">{window.location.origin}?examId={hostExamId}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => copyToClipboard(`${window.location.origin}?examId=${hostExamId}`)} className="flex-1 sm:flex-none p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2 text-[10px] font-bold"><Copy size={14} /> COPY LINK</button>
                            <button onClick={endHostedExam} className="flex-1 sm:flex-none p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 text-[10px] font-bold" title="End Exam Session"><XCircle size={14} /> END EXAM</button>
                          </div>
                        </div>
                      ) : (
                        <div className={`bg-[#DC2626]/10 border border-[#DC2626]/20 p-4 rounded-2xl text-center space-y-3 ${theme === 'dark' ? '' : 'bg-red-50 border-red-100'}`}>
                          <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>No active exam link found. Click below to generate one.</p>
                          <button 
                            onClick={() => {
                              const newId = Math.random().toString(36).substr(2, 9).toUpperCase();
                              setHostExamId(newId);
                              localStorage.setItem('nsg_host_exam_id', newId);
                            }}
                            className="bg-[#DC2626] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                          >
                            Generate Exam Link
                          </button>
                        </div>
                      )}

                      <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-3xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold flex items-center gap-2 text-white"><UserPlus size={18} className="text-[#DC2626]" /> Register Students</h3>
                          <button onClick={saveHostedExam} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">Save Exam Changes</button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="text" value={newStudentMatric} onChange={(e) => setNewStudentMatric(e.target.value)} placeholder="Matric Number" className="flex-1 border rounded-xl px-4 py-3 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                          <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Full Name" className="flex-1 border rounded-xl px-4 py-3 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                          <button onClick={addStudent} className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white px-6 py-3 sm:py-0 rounded-xl text-xs font-black transition-all shadow-lg shadow-[#DC2626]/20 uppercase tracking-widest">ADD</button>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[300px]">
                          <table className="w-full text-left text-[10px]">
                            <thead>
                              <tr className="uppercase tracking-widest border-b text-white/30 border-white/5">
                                <th className="py-3 px-2">Matric</th>
                                <th className="py-3 px-2">Name</th>
                                <th className="py-3 px-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="text-white/70">
                              {registeredStudents.map(student => (
                                <tr key={student.matric} className="border-b transition-colors border-white/5 hover:bg-white/5">
                                  <td className="py-3 px-2 font-mono">{student.matric}</td>
                                  <td className="py-3 px-2 font-bold">{student.name}</td>
                                  <td className="py-3 px-2 text-right space-x-2">
                                    <button onClick={() => deleteStudent(student.matric)} className="p-2 transition-all text-white/30 hover:text-[#DC2626]" title="Delete Student"><Trash2 size={12} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Exam Config */}
                        <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-3xl space-y-4 shadow-sm">
                          <h3 className="font-bold flex items-center gap-2 text-white"><Settings size={18} className="text-[#DC2626]" /> Exam Configuration</h3>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[8px] font-black uppercase mb-1 text-white/30">Question Count</p>
                              <input type="number" value={examConfig.questionCount} onChange={(e) => setExamConfig({...examConfig, questionCount: parseInt(e.target.value)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase mb-1 text-white/30">Duration (Seconds)</p>
                              <input type="number" value={examConfig.duration} onChange={(e) => setExamConfig({...examConfig, duration: parseInt(e.target.value)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase mb-1 text-white/30">Pool Count (AI Generation)</p>
                              <input type="number" value={examConfig.poolCount} onChange={(e) => setExamConfig({...examConfig, poolCount: parseInt(e.target.value)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                            </div>
                          </div>
                        </div>

                        {/* Question Generation */}
                        <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-3xl space-y-4 shadow-sm">
                          <h3 className="font-bold flex items-center gap-2 text-white"><PlusCircle size={18} className="text-[#DC2626]" /> Question Pool</h3>
                          <textarea value={adminQuestionsRaw} onChange={(e) => setAdminQuestionsRaw(e.target.value)} placeholder="Paste raw text here to generate MCQs..." className="w-full h-32 border rounded-2xl p-4 text-[10px] outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                          <button onClick={generateAdminQuestions} disabled={isGeneratingAdminQuestions} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#DC2626]/20 uppercase tracking-widest">
                            {isGeneratingAdminQuestions ? <RefreshCcw size={16} className="animate-spin" /> : <Cpu size={16} />} GENERATE QUESTIONS
                          </button>
                          <p className="text-[10px] text-center text-white/30">Current Pool: {examQuestions.length} Questions</p>
                        </div>
                      </div>
                    </div>

                    {/* Results & Question Log */}
                    <div className="grid grid-rows-2 gap-4 h-full">
                      <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold flex items-center gap-2 text-white"><ListChecks size={18} className="text-[#DC2626]" /> Exam Results</h3>
                          <button onClick={downloadResults} className="text-[#DC2626] hover:text-[#DC2626]/80 transition-all"><FileDown size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 max-h-[250px] sm:max-h-none">
                          {scoreSheet.length === 0 ? (
                            <p className="text-[10px] text-center py-10 text-white/20">No results recorded yet</p>
                          ) : (
                            scoreSheet.map((res, i) => (
                              <div key={i} className="p-3 rounded-xl border flex items-center justify-between group bg-white/5 border-white/5">
                                <div>
                                  <p className="text-[10px] font-bold text-white">{res.name}</p>
                                  <p className="text-[8px] font-mono text-white/40">{res.matric} \u{2022} {res.score}/{res.total}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-[#DC2626]">{Math.round((res.score/res.total)*100)}%</p>
                                  <p className="text-[6px] uppercase text-white/20">{res.timestamp}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 shadow-sm">
                        <h3 className="font-bold flex items-center gap-2 text-white"><FileText size={18} className="text-[#DC2626]" /> Question Log</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[250px] sm:max-h-none">
                          {examQuestions.length === 0 ? (
                            <p className="text-[10px] text-center py-10 text-white/20">No questions in pool</p>
                          ) : (
                            examQuestions.map((q, i) => (
                              <div key={i} className="p-3 rounded-xl border space-y-2 bg-white/5 border-white/5">
                                <p className="text-[10px] font-bold leading-tight text-white">{i + 1}. {q.question}</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {q.options.map((opt, idx) => (
                                    <p key={idx} className={`text-[8px] px-2 py-1 rounded ${idx === q.correctAnswer ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}>{opt}</p>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* NAVIGATION */}
      <nav className={`fixed bottom-0 left-0 right-0 ${theme === 'dark' ? 'bg-[#0A0F1C]/95 border-white/10' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-t z-50 shadow-2xl`}>
        <div className="flex items-center justify-around py-1 sm:py-2 max-w-2xl mx-auto px-2">
          {[
            { id: 'record', icon: Mic, label: 'Capture' },
            { id: 'ai', icon: Brain, label: 'Omni AI' },
            { id: 'history', icon: Database, label: 'Tools' },
            { id: 'quiz', icon: Zap, label: 'Quiz' },
            { id: 'exam', icon: ShieldCheck, label: 'Exam' },
            { id: 'blog', icon: FileText, label: 'Blog' },
            { id: 'profile', icon: User, label: 'Profile' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-2 sm:px-4 transition-all relative ${activeTab === tab.id ? 'text-[#DC2626]' : 'text-white/30 hover:text-[#DC2626]'}`}>
              {activeTab === tab.id && <motion.div layoutId="nav-active" className="absolute inset-0 bg-[#DC2626]/5 rounded-2xl -z-10" />}
              <tab.icon size={18} className="sm:size-[22px]" strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[7px] sm:text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* GOD MODE PANEL */}
      <AnimatePresence>
        {showGodMode && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`fixed inset-0 z-[200] p-6 overflow-y-auto ${theme === 'dark' ? 'bg-[#0A0F1C]/95' : 'bg-white/95'} backdrop-blur-xl`}>
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
              <div className="flex items-center justify-between border-b border-[#DC2626]/20 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#DC2626] rounded-2xl flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
                    <ShieldCheck size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-[#DC2626] uppercase tracking-tighter italic">God Mode</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Omnipotent User Control</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <AnimatePresence>
                    {godModeNotification && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#DC2626]/20">
                        {godModeNotification}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button 
                    onClick={() => setShowGodMode(false)} 
                    className={`p-3 rounded-2xl transition-all ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-zinc-100 text-zinc-500'} hover:bg-[#DC2626]/10`}
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-white"><BookOpen size={18} className="text-[#DC2626]" /> Blog Management ({blogPosts.length})</h3>
                  <button 
                    onClick={() => setIsAddingPost(true)}
                    className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DC2626]/80 transition-all flex items-center gap-2"
                  >
                    <Plus size={14} /> New Article
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blogPosts.map(post => (
                    <div key={post.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group">
                      <div className="truncate pr-4 flex-1">
                        <p className="font-bold text-white text-xs truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[8px] text-white/30 uppercase tracking-widest">{post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Draft'}</p>
                          <div className="flex gap-1">
                            {Object.entries(post.reactions || {}).map(([emoji, count]) => (
                              <span key={emoji} className="text-[8px] bg-white/5 px-1 rounded">{emoji} {count as any}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingPost(post); setIsEditingPost(true); }} className="p-2 text-white/20 hover:text-blue-400 transition-colors">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => deletePost(post.id)} className="p-2 text-white/20 hover:text-[#DC2626] transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-white"><Database size={18} className="text-[#DC2626]" /> User Directory ({allUsers.length})</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="uppercase tracking-widest border-b text-white/30 border-white/5">
                        <th className="py-3 px-2">User Info</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2">Hosting Payment</th>
                        <th className="py-3 px-2">Taking Payment</th>
                        <th className="py-3 px-2">Global Bypass</th>
                        <th className="py-3 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/70">
                      {allUsers.map(u => (
                        <tr key={u.id} className={`border-b transition-colors border-white/5 hover:bg-white/5 ${u.status === 'deleted' ? 'opacity-50 grayscale' : ''}`}>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-xs">
                                {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-bold text-white">{u.fullName || u.displayName || 'Anonymous'}</p>
                                <p className="text-[8px] font-mono opacity-50">{u.email}</p>
                                <p className="text-[8px] font-mono text-[#DC2626]">{u.matric || 'No Matric'} \u{2022} {u.dob || 'No DOB'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <button onClick={() => toggleUserStatus(u.id, u.status)} className={`px-2 py-1 rounded-md font-black uppercase tracking-tighter ${u.status === 'deleted' ? 'bg-[#DC2626]/20 text-[#DC2626]' : 'bg-green-600/20 text-green-500'}`}>
                              {u.status === 'deleted' ? 'Deleted' : 'Active'}
                            </button>
                          </td>
                          <td className="py-4 px-2">
                            <button onClick={() => updateUserPermissions(u.id, 'bypassHostingPayment', !u.bypassHostingPayment)} className={`px-2 py-1 rounded-md font-black uppercase tracking-tighter ${u.bypassHostingPayment ? 'bg-green-600/20 text-green-500' : 'bg-white/10 text-white/40'}`}>
                              {u.bypassHostingPayment ? 'Bypassed' : 'Required'}
                            </button>
                          </td>
                          <td className="py-4 px-2">
                            <button onClick={() => updateUserPermissions(u.id, 'bypassTakingPayment', !u.bypassTakingPayment)} className={`px-2 py-1 rounded-md font-black uppercase tracking-tighter ${u.bypassTakingPayment ? 'bg-green-600/20 text-green-500' : 'bg-white/10 text-white/40'}`}>
                              {u.bypassTakingPayment ? 'Bypassed' : 'Required'}
                            </button>
                          </td>
                          <td className="py-4 px-2">
                            <button onClick={() => updateUserPermissions(u.id, 'bypassAllPayments', !u.bypassAllPayments)} className={`px-2 py-1 rounded-md font-black uppercase tracking-tighter ${u.bypassAllPayments ? 'bg-[#DC2626] text-white' : 'bg-white/10 text-white/40'}`}>
                              {u.bypassAllPayments ? 'GOD BYPASS' : 'Normal'}
                            </button>
                          </td>
                          <td className="py-4 px-2 text-right space-x-2">
                            <button onClick={() => setEditingUser(u)} className="p-2 transition-all text-white/30 hover:text-[#DC2626]" title="Edit User"><Edit3 size={14} /></button>
                            <button onClick={() => toggleUserStatus(u.id, u.status)} className="p-2 transition-all text-white/30 hover:text-[#DC2626]" title={u.status === 'deleted' ? 'Revive' : 'Delete'}>
                              {u.status === 'deleted' ? <RefreshCcw size={14} /> : <Trash2 size={14} />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isAddingPost && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Publish New Article</h3>
                <button onClick={() => setIsAddingPost(false)} className="text-white/40 hover:text-[#DC2626] transition-colors"><XCircle size={24} /></button>
              </div>
              
              <form onSubmit={handleAddPost} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Article Title</p>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter a bold, catchy title..."
                    value={newPost.title} 
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Article Content (Markdown Supported)</p>
                  <textarea 
                    required
                    placeholder="Write your article here. Use markdown for bold text, lists, etc."
                    value={newPost.content} 
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all h-64 resize-none" 
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setIsAddingPost(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-4 rounded-2xl text-sm">CANCEL</button>
                  <button type="submit" className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    <Send size={16} /> PUBLISH ARTICLE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditingPost && editingPost && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Edit Article</h3>
                <button onClick={() => setIsEditingPost(false)} className="text-white/40 hover:text-[#DC2626] transition-colors"><XCircle size={24} /></button>
              </div>
              
              <form onSubmit={handleUpdatePost} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Article Title</p>
                  <input 
                    type="text" 
                    required
                    value={editingPost.title} 
                    onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Article Content (Markdown Supported)</p>
                  <textarea 
                    required
                    value={editingPost.content} 
                    onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all h-64 resize-none" 
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setIsEditingPost(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-4 rounded-2xl text-sm">CANCEL</button>
                  <button type="submit" className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    <Save size={16} /> SAVE CHANGES
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl p-8 max-w-md w-full space-y-6`}>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Edit User Information</h3>
                <p className="text-xs text-white/40">Modify user details directly in the database.</p>
              </div>
              
              <form onSubmit={handleEditUser} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Full Name</p>
                  <input type="text" value={editingUser.fullName || editingUser.displayName || ''} onChange={(e) => setEditingUser({...editingUser, fullName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Email Address</p>
                  <input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Matric Number</p>
                  <input type="text" value={editingUser.matric || ''} onChange={(e) => setEditingUser({...editingUser, matric: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Date of Birth</p>
                  <input type="text" value={editingUser.dob || ''} onChange={(e) => setEditingUser({...editingUser, dob: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-white/5 text-white/60 font-bold py-4 rounded-2xl text-sm">CANCEL</button>
                  <button type="submit" className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">SAVE CHANGES</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHARE MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl p-8 max-w-sm w-full space-y-6`}>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Share Your Result</h3>
                <p className="text-xs text-white/40">Enter your name to generate your score card.</p>
              </div>

              {shareQuizLink && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Shareable Quiz Link</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={shareQuizLink} className="flex-1 bg-transparent border-none outline-none text-[10px] text-[#DC2626] font-mono truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(shareQuizLink); setUserNotification("Link copied!"); }} className="p-2 text-white/40 hover:text-[#DC2626] transition-colors"><Copy size={14} /></button>
                  </div>
                </div>
              )}
              
              <input type="text" value={shareName} onChange={(e) => setShareName(e.target.value)} placeholder="Your Full Name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />

              <div className="flex gap-2">
                <button onClick={() => setShowShareModal(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-4 rounded-2xl text-sm">CANCEL</button>
                <button onClick={generateShareImage} disabled={!shareName.trim()} className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all disabled:opacity-50">GENERATE IMAGE</button>
              </div>

              {/* HIDDEN SHARE CARD FOR GENERATION */}
              <div className="fixed -left-[9999px] top-0">
                <div ref={shareCardRef} className={`w-[600px] h-[400px] ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} p-10 flex flex-col items-center justify-center text-center relative overflow-hidden border-[10px] border-[#DC2626]`}>
                  <div className="absolute top-0 left-0 w-32 h-32 bg-[#DC2626]/5 rounded-full -translate-x-16 -translate-y-16" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#DC2626]/5 rounded-full translate-x-24 translate-y-24" />
                  
                  <div className="mb-6">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-1">NSG STUDY GUIDE</h1>
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-[0.3em]">Official Assessment Certificate</p>
                  </div>

                  <div className="space-y-2 mb-8">
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest">This certifies that</p>
                    <p className="text-3xl font-black text-white uppercase">{shareName || 'Student'}</p>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest">has achieved a score of</p>
                  </div>

                  <div className="bg-[#DC2626] text-white px-10 py-4 rounded-2xl">
                    <p className="text-5xl font-black">{quizScore} / {quizQuestions.length || 1}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}% Proficiency</p>
                  </div>

                  <div className="mt-10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Generated by Omni Ai \u{2022} {new Date().toLocaleDateString()}</p>
                    <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t border-white/10 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/20">
        {user?.email === "nuellkelechi@gmail.com" && (
          <button onClick={() => setShowGodMode(true)} className="text-[#DC2626] hover:text-[#DC2626]/80 transition-colors flex items-center gap-1">
            <ShieldCheck size={12} /> GOD MODE
          </button>
        )}
        <button onClick={() => setLegalPage('about')} className="hover:text-[#DC2626] transition-colors">About Us</button>
        <button onClick={() => setLegalPage('terms')} className="hover:text-[#DC2626] transition-colors">Terms & Conditions</button>
        <button onClick={() => setLegalPage('privacy')} className="hover:text-[#DC2626] transition-colors">Privacy Policy</button>
        <button onClick={() => setLegalPage('contact')} className="hover:text-[#DC2626] transition-colors">Contact Us</button>
        <span>{"\u{00A9} 2026 Nuell Graphics"}</span>
      </footer>
    </div>
  );
}
