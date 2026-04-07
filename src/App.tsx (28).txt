import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings, UserPlus, CreditCard,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText,
  Sun, Moon, ArrowDown, PlusCircle, Copy, User, Clock, Lock, ShieldCheck, FileDown, LayoutDashboard, ListChecks,
  Pin, Edit3, Share2, Trophy, LogOut, Plus, Menu, Camera, Monitor, X, Activity, MessageSquare
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
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  FirestoreOperation, handleFirestoreError
} from './firebase';

/**
 * NSG (Nuell Study Guide) V4.0 - PROFESSIONAL CBT & AI UPGRADE
 * ✅ Professional CBT Infrastructure (Exam Lobby, Info Page, Exam Engine)
 * ✅ Admin Backend Control (Score Sheet, Timer Restart, Results Download)
 * ✅ Advanced AI Chat (Copy Response, History Sidebar)
 * ✅ Enhanced Quiz (Customization, Deep Assessment, Report to AI)
 * ✅ Paystack Payment Integration
 */

const getApiKey = () => {
  // Check for Vite environment variables first, then process.env (for Node/Render), then fallback
  const key = (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : "") || "";
  return key.trim();
};

const getHfKey = () => {
  const key = (import.meta.env?.VITE_HUGGINGFACE_API_KEY) || (typeof process !== 'undefined' ? process.env.HUGGINGFACE_API_KEY : "") || "";
  return key.trim();
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });
const hf = new HfInference(getHfKey());

const MODEL_NAME = "gemini-3-flash-preview";

const HF_MODELS = {
  TEXT: "Qwen/Qwen2.5-72B-Instruct",
  VISION: "meta-llama/Llama-3.2-11B-Vision-Instruct",
  IMAGE: "black-forest-labs/FLUX.1-schnell"
};

const PAYSTACK_PUBLIC_KEY = "pk_test_14a5b8ee0a06e063a8b0e46fc7e0e76ed66f2746";

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
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
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

const GeminiLive = ({ onClose, setUserNotification }: { onClose: () => void, setUserNotification: (msg: string | null) => void }) => {
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
        const session = await ai.live.connect({
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
    <div className="flex-1 flex flex-col bg-[#0A0F1C] p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex-1 flex gap-6">
        <div className="flex-1 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <div className="bg-[#DC2626] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase animate-pulse">Live</div>
            {videoSource !== 'none' && <div className="bg-white/10 text-white/60 px-3 py-1 rounded-full text-[10px] font-black uppercase">{videoSource} active</div>}
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

          <div className="p-6 bg-black/40 backdrop-blur-xl border-t border-white/10 max-h-40 overflow-y-auto">
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

      <div className="flex items-center justify-center gap-6">
        <button onClick={() => setIsMicOn(!isMicOn)} className={`p-6 rounded-full transition-all shadow-2xl ${isMicOn ? 'bg-[#DC2626] text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}>
          {isMicOn ? <Mic size={28} /> : <Mic size={28} className="opacity-20" />}
        </button>
        <button onClick={() => toggleVideo('camera')} className={`p-6 rounded-full transition-all shadow-2xl ${videoSource === 'camera' ? 'bg-[#DC2626] text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}>
          <Camera size={28} />
        </button>
        <button onClick={() => toggleVideo('screen')} className={`p-6 rounded-full transition-all shadow-2xl ${videoSource === 'screen' ? 'bg-[#DC2626] text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}>
          <Monitor size={28} />
        </button>
        <button onClick={() => window.open(window.location.href, '_blank')} className="p-6 bg-white/5 text-white/40 rounded-full hover:bg-white/10 transition-all border border-white/10" title="Open in new tab for screen sharing">
          <Share2 size={28} />
        </button>
        <button onClick={onClose} className="p-6 bg-white/5 text-white/40 rounded-full hover:bg-[#DC2626] hover:text-white transition-all border border-white/10">
          <X size={28} />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  // --- 🔐 AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeExamHostUid, setActiveExamHostUid] = useState<string | null>(null);
  const [isHostPaid, setIsHostPaid] = useState(false);
  const [isTakingPaid, setIsTakingPaid] = useState(false);
  const [hostExamId, setHostExamId] = useState<string | null>(null);

  // --- 📱 APP STATE ---
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz' | 'blog' | 'exam'>('record');
  const [showRecordSidebar, setShowRecordSidebar] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisInRecord, setShowAnalysisInRecord] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
  const [legalPage, setLegalPage] = useState<'about' | 'terms' | 'contact' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userNotification, setUserNotification] = useState<string | null>(null);
  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  // --- 💎 PREMIUM STATE ---
  const [isPremium, setIsPremium] = useState(false);
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // --- 👑 GOD MODE LOGIC ---
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

  // --- 🎙️ RECORDING ENGINE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 📂 MEDIA & UPLOAD ---
  const [uploadedImages, setUploadedImages] = useState<MediaFile[]>([]);

  // --- 🤖 AI CHAT SYSTEM ---
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

  // --- 📚 PERSISTENCE ---
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LectureSession | null>(null);

  // --- 📝 QUIZ STATE ---
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

  // --- 🎓 CBT EXAM STATE ---
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

  // --- 🛠️ ADMIN STATE ---
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

  // --- 💳 PAYSTACK INTEGRATION ---
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
            className="bg-[#0A0F1C] border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden"
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
                className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:border-yellow-500/50 transition-all text-center group"
              >
                <p className="text-[10px] font-black text-white/40 uppercase mb-1">Monthly</p>
                <p className="text-xl font-black text-white">N300</p>
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
  // --- 📱 INITIALIZATION & FIREBASE SYNC ---
  useEffect(() => {
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
                // Self-repair: Reactivate God Mode account if mistakenly deactivated
                updateDoc(userDocRef, { status: 'active' });
                return;
              }
              signOut(auth);
              setUserNotification("Your account has been deactivated. Contact support.");
            }
          } else {
            // Create user if not exists
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
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.email === 'nuellkelechi@gmail.com' ? 'admin' : 'student',
          createdAt: new Date().toISOString()
        });
      }
      setShowAuthModal(false);
    } catch (error) {
      console.error("Login Error:", error);
      setUserNotification("Failed to login with Google.");
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
        
        setUserNotification("Account created successfully!");
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

  // --- 🎓 CBT & ADMIN LOGIC ---
  const shuffleArray = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const generateAdminQuestions = async () => {
    if (!adminQuestionsRaw.trim()) return;
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
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
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
    setUserNotification("Payment successful! You can now configure your exam.");
  };

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

  // --- 💳 PAYSTACK INTEGRATION ---
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

  // --- 🎤 RECORDING LOGIC ---
  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
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

  // --- 🖼️ IMAGE HANDLER ---
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

  // --- 🧠 GEMINI ANALYSIS ---
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

      const response = await ai.models.generateContent({
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
      console.error('🚨 Gemini Analysis Error:', error);
      setUserNotification(`Analysis failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateChatTitle = async (history: ChatMessage[]) => {
    if (history.length < 2) return "New Chat Session";
    try {
      const prompt = `Based on this chat history, generate a very short (max 5 words) title for this conversation. Return ONLY the title text. Do not include quotes or any other text.\n\nHistory:\n${history.map(m => `${m.role}: ${m.text}`).join('\n')}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
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

  // --- 💬 CHAT ROUTING ENGINE ---
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
          const response = await ai.models.generateContent({
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
          const imageBlob = await hf.textToImage({
            model: HF_MODELS.IMAGE,
            inputs: textToSend,
          });
          const reader = new FileReader();
          reader.readAsDataURL(imageBlob as any);
          await new Promise(resolve => reader.onload = resolve);
          generatedImage = reader.result as string;
          responseText = "Here is your generated image:";
        } catch (hfError) {
          console.error("HF Image Gen Error:", hfError);
          responseText = "Failed to generate image. Please try again.";
        }
      } else {
        const parts: any[] = [{ text: textToSend || "Analyze this content." }];
        
        if (uploadedImages.length > 0) {
          const imageParts = await Promise.all(
            uploadedImages.map(img => fileToGenerativePart(img.file))
          );
          imageParts.forEach(p => parts.push(p));
        }

        const response = await ai.models.generateContent({
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

      if (activeChatSessionId) {
        await updateDoc(doc(db, 'users', user.uid, 'chatSessions', activeChatSessionId), {
          history: updatedHistory,
          timestamp: new Date().toLocaleString()
        });
      }
      
      if (uploadedImages.length > 0) setUploadedImages([]);
      
    } catch (error: any) {
      console.error("Chat Error:", error);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: `Error: ${error.message || "Failed to connect to AI"}`, 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- 📝 QUIZ LOGIC ---
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
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!quizTopic.trim()) {
      setUserNotification("Please enter a topic first.");
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

      const response = await ai.models.generateContent({
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
      setUserNotification("Failed to generate quiz. Please try again.");
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
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-[#DC2626] pb-24 bg-[#0A0F1C] text-white dark`}>
      
      {/* AUTH LOADING OVERLAY */}
      <AnimatePresence>
        {isAuthLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[300] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center space-y-4"
          >
            <BlinkingBrain size={64} className="text-red-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Processing Authentication...</p>
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
              className="bg-[#0A0F1C] border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#DC2626] to-transparent" />
              <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-[#DC2626] transition-colors"><XCircle size={24} /></button>
              
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={24} className="text-[#DC2626]" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white">
                  {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  {authMode === 'login' ? 'Login to access Quizzes and Exams' : 'Join NSG to start your academic journey'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' ? (
                  <>
                    <input type="text" value={authFullName} onChange={(e) => setAuthFullName(e.target.value)} placeholder="Full Name" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                    <input type="date" value={authDOB} onChange={(e) => setAuthDOB(e.target.value)} placeholder="Date of Birth" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                    <input type="text" value={authMatric} onChange={(e) => setAuthMatric(e.target.value)} placeholder="Matric Number (Optional)" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email Address" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Login with Email or Matric</p>
                      <input type="text" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email Address" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                      <div className="flex items-center gap-2 px-2">
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <span className="text-[10px] font-bold text-white/40">OR</span>
                        <div className="h-[1px] flex-1 bg-white/5" />
                      </div>
                      <input type="text" value={authMatric} onChange={(e) => setAuthMatric(e.target.value)} placeholder="Matric Number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                    </div>
                  </>
                )}
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                
                <button type="submit" className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-[#DC2626]/20 uppercase tracking-widest">
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-xs font-bold text-[#DC2626] hover:underline uppercase tracking-tighter">
                  {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 py-4 rounded-2xl text-sm font-bold text-white/70 hover:bg-white/10 transition-all">
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
              className="bg-[#0A0F1C] border border-white/10 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#DC2626]" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-[#DC2626]" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white">Welcome to <span className="text-[#DC2626]">NSG</span></h2>
                <p className="text-sm text-white/70 leading-relaxed">
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
              className="bg-[#0A0F1C] border border-white/10 p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
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
      <header className="px-5 py-4 flex justify-between items-center border-b border-white/10 bg-[#0A0F1C]/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black border border-white/10 rounded-2xl flex items-center justify-center">
            <Brain size={22} className="text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-sm sm:text-xl font-black tracking-tighter italic leading-none text-white">NSG <span className="text-[#DC2626]">(NUELL STUDY GUIDE)</span></h1>
            <span className="text-[8px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest">Lecture OS 4.0</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-white uppercase leading-none">{user.displayName}</p>
                <p className="text-[8px] text-white/40 uppercase font-bold">{isAdminUser ? 'Admin' : 'Student'}</p>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-[#DC2626] transition-all">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-[#DC2626]/20">
              <User size={16} /> LOGIN
            </button>
          )}
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-[#DC2626] transition-all">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white/60 uppercase">SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
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
                      className="fixed left-0 top-0 bottom-0 w-1/2 min-w-[280px] z-[70] border-r border-white/10 flex flex-col bg-[#0A0F1C] shadow-2xl"
                    >
                      <div className="p-4 border-b border-white/10 flex items-center justify-between">
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
                        <button onClick={() => setShowRecordSidebar(false)} className="p-2 text-white/40 ml-2 hover:text-[#DC2626] transition-colors"><XCircle size={20} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest px-3 py-2">Analysis History</p>
                        {sessions.map(session => (
                          <div key={session.id} className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${selectedSession?.id === session.id ? 'bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626]' : 'hover:bg-white/5 text-white/40'}`}>
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
                                <span className="text-[8px] opacity-60">{session.date} • {session.duration}</span>
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
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setShowRecordSidebar(true)} className="p-2 bg-[#0A0F1C] border border-white/10 rounded-xl text-white/60 hover:text-[#DC2626] transition-all flex items-center gap-2">
                  <History size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!showAnalysisInRecord ? (
                  <motion.div key="recorder" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    <div className="bg-[#0A0F1C] rounded-3xl p-8 border border-white/10 relative overflow-hidden shadow-sm">
                      <div className="flex flex-col items-center text-center relative z-10">
                        <div className="relative mb-6">
                          {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-[#DC2626] rounded-full blur-2xl" />}
                          <button onClick={handleToggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-white text-black scale-105' : 'bg-[#DC2626] text-white hover:scale-105 active:scale-95'}`}>
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
                            <a href={audioUrl} download="NSG_Lecture.mp3" className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10">
                              <Download size={16} /> Download
                            </a>
                          )}
                          <button onClick={triggerFullAnalysis} disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob)} className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626]/10 hover:bg-[#DC2626] text-[#DC2626] hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-[#DC2626]/30 transition-all disabled:opacity-50">
                            <Sparkles size={16} /> Analyze
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="bg-[#0A0F1C] p-5 rounded-3xl border border-white/10 hover:border-[#DC2626]/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                        <div className="w-10 h-10 bg-[#DC2626]/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#DC2626] group-hover:text-white transition-all"><ImageIcon size={20} className="text-[#DC2626] group-hover:text-white" /></div>
                        <span className="font-bold text-xs text-white">Upload Slides</span>
                        <span className="text-[9px] text-white/40 mt-1 uppercase tracking-widest">({uploadedImages.length}/50)</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                      </label>

                      <label className="bg-[#0A0F1C] p-5 rounded-3xl border border-white/10 hover:border-[#DC2626]/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                        <div className="w-10 h-10 bg-[#DC2626]/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#DC2626] group-hover:text-white transition-all"><FileAudio size={20} className="text-[#DC2626] group-hover:text-white" /></div>
                        <span className="font-bold text-xs text-white">Import Audio</span>
                        <span className="text-[9px] text-white/40 mt-1 uppercase tracking-widest">MP3 / WAV</span>
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setAudioUrl(URL.createObjectURL(file));
                            setRecordedBlob(file);
                          }
                        }} />
                      </label>
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {uploadedImages.map((img) => (
                          <div key={img.id} className="relative flex-shrink-0">
                            <img src={img.preview} alt="slide" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                            <button onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1 -right-1 bg-[#DC2626] text-white rounded-full p-1 shadow-lg"><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="analysis" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 shadow-sm space-y-6">
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
                            className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl text-[10px] font-black text-white/70 hover:text-[#DC2626] transition-all border border-white/10"
                          >
                            <UserPlus size={14} /> UPLOAD TO OMNI
                          </button>
                          <button onClick={() => setShowAnalysisInRecord(false)} className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-[#DC2626] transition-all"><ArrowLeft size={20} /></button>
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
        <button onClick={() => copyToClipboard(analysisResult)} className="flex items-center justify-center gap-2 bg-white/5 text-white/70 py-4 rounded-2xl text-[10px] font-black hover:bg-white/10 transition-all">
          <Copy size={16} /> COPY
        </button>
        <button onClick={() => shareAnalysis(analysisResult || '')} className="flex items-center justify-center gap-2 bg-white/5 text-white/70 py-4 rounded-2xl text-[10px] font-black hover:bg-white/10 transition-all">
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
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] bg-[#0A0F1C] rounded-3xl border border-white/5 overflow-hidden relative shadow-2xl">
              
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
                      className="absolute left-0 top-0 bottom-0 w-[80%] max-w-[320px] z-[70] border-r border-white/10 flex flex-col bg-[#0A0F1C] shadow-2xl"
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
                      className="absolute inset-0 z-[100] bg-[#0A0F1C]"
                    >
                      <GeminiLive onClose={() => setIsLiveActive(false)} setUserNotification={setUserNotification} />
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
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 scroll-smooth">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                      <Brain size={64} />
                      <div>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter">How can I help you today?</h4>
                        <p className="text-xs font-bold uppercase tracking-widest mt-2">Omni AI is ready to assist</p>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-[#DC2626]' : 'bg-white/10'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Brain size={16} className="text-[#DC2626]" />}
                          </div>
                          <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#DC2626] text-white rounded-tr-none' : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'}`}>
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                              {msg.image && (
                                <div className="mt-4 space-y-3">
                                  <img src={msg.image} alt="Generated" className="rounded-xl border border-white/10 max-w-full h-auto shadow-2xl" />
                                  <a href={msg.image} download="NSG_Generated_Image.png" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border border-white/10">
                                    <Download size={14} /> Download Image
                                  </a>
                                </div>
                              )}
                            </div>
                            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{msg.timestamp}</span>
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
                <div className="p-4 sm:p-6 bg-gradient-to-t from-[#0A0F1C] via-[#0A0F1C] to-transparent">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {/* Mode Selector */}
                    <div className="flex items-center gap-2 px-2 overflow-x-auto no-scrollbar">
                      {[
                        { id: 'General', icon: Brain, label: 'General' },
                        { id: 'Vision', icon: Camera, label: 'Vision' },
                        { id: 'Creative', icon: Sparkles, label: 'Creative' }
                      ].map(mode => (
                        <button 
                          key={mode.id}
                          onClick={() => setChatMode(mode.id as any)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all whitespace-nowrap border ${chatMode === mode.id ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                        >
                          <mode.icon size={14} /> {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-[#DC2626]/20 to-blue-500/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                      <div className="relative flex items-center bg-white/5 border border-white/10 rounded-[2rem] p-2 backdrop-blur-xl focus-within:border-[#DC2626]/50 transition-all">
                        <div className="flex items-center gap-1">
                          <button onClick={() => isRecordingChat ? stopChatRecording() : startChatRecording()} className={`p-4 rounded-2xl transition-all ${isRecordingChat ? 'bg-[#DC2626] text-white animate-pulse' : 'text-white/40 hover:text-white'}`}>
                            {isRecordingChat ? <StopCircle size={22} /> : <Mic size={22} />}
                          </button>
                          <label className="p-4 rounded-2xl text-white/40 hover:text-white cursor-pointer transition-all">
                            <Upload size={22} />
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
                        <input 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
                          placeholder={chatMode === 'Vision' ? "Ask about these images..." : chatMode === 'Creative' ? "Describe the image you want to generate..." : "Message Omni AI..."} 
                          className="flex-1 bg-transparent border-none outline-none px-4 text-sm text-white placeholder:text-white/20" 
                        />
                        <button onClick={() => handleSendMessage()} className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white p-4 rounded-2xl transition-all shadow-xl shadow-[#DC2626]/20">
                          <ChevronRight size={22} />
                        </button>
                      </div>

                      {uploadedImages.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-4 flex gap-2 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-x-auto no-scrollbar">
                          {uploadedImages.map(img => (
                            <div key={img.id} className="relative group flex-shrink-0">
                              <img src={img.preview} className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                              <button 
                                onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                                className="absolute -top-2 -right-2 bg-[#DC2626] text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-[8px] text-center mt-3 text-white/20 font-bold uppercase tracking-widest">Omni AI can make mistakes. Verify important info.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Library</h2>
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
                      {isPremium ? `Active • ${premiumTimeLeft} Remaining` : "Inactive • Upgrade for full access"}
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
                    <div className="text-center py-20 bg-[#0A0F1C] rounded-3xl border border-white/10 border-dashed">
                      <History size={40} className="mx-auto mb-4 text-white/10" />
                      <p className="text-sm font-bold text-white/30">No saved lectures found</p>
                    </div>
                  ) : (
                    sessions.map(session => (
                      <div key={session.id} className="w-full bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/10 hover:border-[#DC2626]/30 transition-all group shadow-sm">
                        <div onClick={() => setSelectedSession(session)} className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-[#DC2626]/10 transition-all">
                            {session.isPinned ? <Pin size={20} className="text-[#DC2626]" /> : <FileAudio size={20} className="text-white/20 group-hover:text-[#DC2626]" />}
                          </div>
                          <div><p className="font-bold text-sm text-white">{session.title}</p><p className="text-[10px] text-white/40 font-mono uppercase">{session.date} • {session.duration}</p></div>
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
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-[#0A0F1C] p-6 rounded-3xl border border-white/10 space-y-6 shadow-sm">
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
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Quiz Engine</h2>
                <Zap size={20} className="text-[#DC2626]" />
              </div>

              {quizState === 'idle' && (
                <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 space-y-6 shadow-sm">
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
                  <div className="flex items-center justify-between bg-[#0A0F1C] p-4 rounded-2xl border border-white/10 shadow-sm">
                    <button onClick={() => setQuizState('idle')} className="text-white/40 hover:text-[#DC2626] flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back</button>
                    <div className="text-center"><p className="text-[10px] font-black text-white/30 uppercase">Progress</p><p className="text-sm font-black text-[#DC2626]">{currentQuestionIndex + 1} / {quizQuestions.length}</p></div>
                    <div className="text-right"><p className="text-[10px] font-black text-white/30 uppercase">Score</p><p className="text-sm font-black text-green-500">{quizScore}</p></div>
                  </div>
                  <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 space-y-8 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight text-white">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border transition-all ${isAnswered ? (idx === quizQuestions[currentQuestionIndex].correctAnswer ? 'bg-green-500/10 border-green-500 text-green-500' : (selectedOption === idx ? 'bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]' : 'bg-white/5 opacity-40')) : (selectedOption === idx ? 'border-[#DC2626]' : 'bg-white/5 border-white/10 text-white/80')}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    {isAnswered && <button onClick={nextQuestion} className="w-full bg-white text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">{currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"} <ChevronRight size={18} /></button>}
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
                <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 space-y-6 shadow-sm">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><User size={24} className="text-[#DC2626]" /></div>
                    <h3 className="font-bold text-lg text-white">Student Verification</h3>
                    <p className="text-xs text-white/40">Enter your credentials to access the examination hall.</p>
                    <AnimatePresence>
                      {userNotification && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-[#DC2626]/10 text-[#DC2626] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#DC2626]/20 mt-2">
                          {userNotification}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {!showAdminLogin ? (
                    <div className="space-y-4">
                      {!user ? (
                        <div className="text-center space-y-4 py-6">
                          <p className="text-sm text-white/60">You must be logged in to access examinations.</p>
                          <button onClick={() => setShowAuthModal(true)} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">
                            LOGIN TO PROCEED
                          </button>
                        </div>
                      ) : studentName ? (
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4 text-center">
                          <div className="w-16 h-16 bg-[#DC2626] rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-[#DC2626]/20">{studentName.charAt(0)}</div>
                          <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Authenticated Student</p>
                            <p className="text-xl font-black text-white">{studentName}</p>
                            <p className="text-xs font-mono text-[#DC2626] font-bold">{matricNumber}</p>
                          </div>
                          
                          {isTakingPaid ? (
                            <div className="pt-4 space-y-3 border-t border-white/10">
                              <button onClick={handleMatricLogin} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">PROCEED TO HALL</button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className="w-full text-[10px] font-black text-white/30 uppercase hover:text-[#DC2626] transition-all">Not you? Switch Account</button>
                            </div>
                          ) : (
                            <div className="pt-4 space-y-3 border-t border-white/10">
                              <p className="text-[10px] text-white/40 leading-relaxed italic">This examination requires a one-time access fee of <span className="font-black text-white">₦100</span>. Please complete payment to proceed.</p>
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
                                <CreditCard size={18} /> PAY ₦100 & PROCEED
                              </button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className="w-full text-[10px] font-black text-white/30 uppercase hover:text-[#DC2626] transition-all">Not you? Switch Account</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter Matric Number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                          <button onClick={handleMatricLogin} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">VERIFY MATRIC</button>
                          <button onClick={() => setAdminMode(true)} className="w-full bg-white/5 text-white/60 font-bold py-3 rounded-2xl text-xs hover:bg-white/10 transition-all">HOST AN EXAM (₦200)</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="Admin PIN" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-white" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-4 rounded-2xl text-sm">BACK</button>
                        <button onClick={handleAdminLogin} className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all">LOGIN AS ADMIN</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {examLobbyState === 'briefing' && (
                <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 space-y-6 shadow-sm">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-12 h-12 bg-[#DC2626] rounded-full flex items-center justify-center text-white font-black text-xl">{studentName.charAt(0)}</div>
                    <div><p className="font-black text-white uppercase tracking-tighter">{studentName}</p><p className="text-[10px] text-white/40 font-mono">{matricNumber}</p></div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-white">Examination Briefing</h3>
                    <div className="p-4 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-2xl space-y-3">
                      <p className="text-xs text-[#DC2626] font-bold flex items-center gap-2"><XCircle size={14} /> WARNING: {studentName}, if you leave this app, you automatically forfeit the exam.</p>
                      <p className="text-xs text-white/60 leading-relaxed">This is a professional CBT Mock Exam. You have {Math.floor(examConfig.duration / 60)} minutes to answer {examConfig.questionCount} randomized questions. Use only your brain. Good luck.</p>
                    </div>
                  </div>
                  <button onClick={startExam} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    <Zap size={18} /> START EXAMINATION NOW
                  </button>
                </div>
              )}

              {examLobbyState === 'exam' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-[#0A0F1C] p-4 rounded-2xl border border-white/10 shadow-sm sticky top-20 z-30">
                    <div className="flex items-center gap-2 text-[#DC2626] font-black">
                      <Clock size={18} />
                      <span className="font-mono text-lg">{Math.floor(examTimer / 60)}:{(examTimer % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="text-center"><p className="text-[10px] font-black text-white/30 uppercase">Question</p><p className="text-sm font-black text-white">{currentExamIndex + 1} / {examQuestions.length}</p></div>
                    <button onClick={submitExam} disabled={Object.keys(examAnswers).length < (examQuestions.length * 0.5)} className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30">Submit</button>
                  </div>

                  <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 space-y-8 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight text-white">{examQuestions[currentExamIndex].question}</h3>
                    <div className="space-y-3">
                      {examQuestions[currentExamIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => setExamAnswers({ ...examAnswers, [currentExamIndex]: idx })} className={`w-full text-left p-4 rounded-2xl border transition-all ${examAnswers[currentExamIndex] === idx ? 'border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]' : 'bg-white/5 border-white/10 text-white/80'}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between pt-4">
                      <button onClick={() => setCurrentExamIndex(prev => Math.max(0, prev - 1))} disabled={currentExamIndex === 0} className="p-3 text-white/40 hover:text-[#DC2626] disabled:opacity-20"><ArrowLeft size={24} /></button>
                      <button onClick={() => setCurrentExamIndex(prev => Math.min(examQuestions.length - 1, prev + 1))} disabled={currentExamIndex === examQuestions.length - 1} className="p-3 text-white/40 hover:text-[#DC2626] disabled:opacity-20"><ChevronRight size={24} /></button>
                    </div>
                  </div>
                </div>
              )}

              {examLobbyState === 'result' && (
                <div className="bg-[#0A0F1C] p-10 rounded-3xl border border-white/10 text-center space-y-6 shadow-sm">
                  <div className="w-20 h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} className="text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Exam Submitted</h3>
                    <p className="text-white/40 text-sm mt-1">Your results have been recorded in the system.</p>
                  </div>
                  <div className="py-6 border-y border-white/5">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Final Score</p>
                    <p className="text-5xl font-black text-[#DC2626]">{examScore} / {examQuestions.length}</p>
                    <p className="text-sm font-bold text-white mt-2">{Math.round((examScore / (examQuestions.length || 1)) * 100)}% Proficiency</p>
                  </div>
                  <button onClick={() => setExamLobbyState('login')} className="w-full bg-white text-black font-black py-4 rounded-2xl text-sm transition-all">LOGOUT</button>
                </div>
              )}
            </motion.div>
          )}

          {/* BLOG TAB */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-8 pb-20">
              <div className="bg-[#0A0F1C] p-8 rounded-3xl border border-white/10 shadow-sm space-y-10">
                <div className="space-y-4">
                  <h2 className="text-2xl font-black text-[#DC2626] uppercase tracking-tighter">SECTION 1: THE MISSION — REDEFINING THE STUDENT EXPERIENCE</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    The current state of education requires more than just reading and memorizing; it requires high-level tools that actually work. The primary goal is to become the number one student study application in the country by offering premium, world-class academic services that bridge the gap between local challenges and global standards. The aim is to provide a seamless, high-tech environment where advanced AI tutors and professional testing infrastructures are available to every student at an almost free cost.
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Beyond digital tools, the vision extends to becoming the leading scholarship provider nationwide. The objective is to build a system where academic excellence is directly rewarded with financial support, creating a cycle where using the platform to study actually leads to having your tuition covered. This is about making success a reality for those who have the brains but lack the funds.
                  </p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-2xl font-black text-[#DC2626] uppercase tracking-tighter">SECTION 2: CURRENT LIMITATIONS & THE ROADMAP TO 2026</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Every innovation starts with a foundation, and there are currently specific boundaries being pushed. Right now, the platform requires an active internet connection for the high-level AI processing to function. There is also a continuous effort to expand the database to cover every single academic department and specialized field. Currently, optimization is highest for mobile and laptop devices, with more universal compatibility being refined daily.
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed font-bold">By late 2026, major upgrades will be live:</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-white/70">
                    <li>Full Offline Capabilities: A "Lite" version is in development to allow access to study guides and quizzes without any data usage.</li>
                    <li>The Scholarship Portal: A fully integrated merit-based system that will automatically identify top performers for tuition coverage.</li>
                    <li>Voice Tutor 2.0: Hands-free learning where you can engage in full academic discussions with the AI through audio alone.</li>
                    <li>Peer-to-Peer Marketplace: A secure environment to exchange verified academic summaries and materials.</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h2 className="text-2xl font-black text-[#DC2626] uppercase tracking-tighter">SECTION 3: WHY THIS WILL BE THE #1 STUDY APP</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    This platform stands alone because of the sheer power of the intelligence behind it. By utilizing advanced AI engines with massive context windows, the app can "read" and "understand" a 100-page textbook in seconds. It doesn’t just give answers; it provides deep, logical explanations that simplify complex topics.
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    The testing engine is built for the real world. With features like the 50% Submission Rule—which prevents accidental submission before a student is ready—and strict session-locking to ensure integrity, it offers a professional environment that mimics actual high-stakes examinations. This is not just a study tool; it is a comprehensive academic ecosystem designed for speed, intelligence, and reliability.
                  </p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-2xl font-black text-[#DC2626] uppercase tracking-tighter">SECTION 4: THE NECESSITY OF SPONSORSHIP</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    To keep these services "almost free" while maintaining world-class quality, a robust support system is essential. The "API Problem" is a constant factor—every time the AI thinks or generates a response, it costs money in global currency. Sponsorship is the bridge that allows these costs to be covered without passing the burden onto the student.
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Support is also needed to fuel the scholarship fund. By partnering with sponsors and stakeholders, the platform can move faster toward the goal of paying tuition for thousands of students. Support isn't just about money; it's about providing the resources and data needed to make the AI smarter for everyone. When a community supports this project, it is investing in a future where financial status no longer limits how far a student can go. This is a collective effort to ensure that the best minds have the best tools to succeed.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* HOST EXAM PANEL (FORMERLY ADMIN) */}
          {adminMode && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[110] p-6 overflow-y-auto bg-[#0A0F1C]/95 backdrop-blur-xl">
              <div className="max-w-6xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between border-b border-[#DC2626]/20 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#DC2626] rounded-2xl flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
                      <LayoutDashboard size={24} className="text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black text-[#DC2626] uppercase tracking-tighter italic">Host Exam</h1>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Professional Examination Infrastructure</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AnimatePresence>
                      {adminNotification && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#DC2626]/20">
                          {adminNotification}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={() => setAdminMode(false)} className="p-3 rounded-2xl transition-all bg-white/5 text-white/40 hover:bg-white/10">
                      <XCircle size={24} />
                    </button>
                  </div>
                </div>

                {!isHostPaid ? (
                  <div className="max-w-md mx-auto py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                      <ShieldCheck size={40} className="text-[#DC2626]" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Host Your Own Exam</h2>
                      <p className="text-sm text-white/40 leading-relaxed">Create a professional CBT environment for your students. Hosting fee is <span className="font-black text-white">₦200</span> per session.</p>
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
                      className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-5 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard size={20} /> PAY ₦200 TO START
                    </button>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Student Management */}
                    <div className="lg:col-span-2 space-y-6">
                      {hostExamId && (
                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white"><Share2 size={16} /></div>
                            <div>
                              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Exam Share Link</p>
                              <p className="text-xs font-mono text-white/60">{window.location.origin}?examId={hostExamId}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => copyToClipboard(`${window.location.origin}?examId=${hostExamId}`)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"><Copy size={16} /></button>
                            <button onClick={() => { setIsHostPaid(false); setHostExamId(''); setRegisteredStudents([]); setExamQuestions([]); }} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all" title="Host Another"><Plus size={16} /></button>
                          </div>
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
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 flex flex-col overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold flex items-center gap-2 text-white"><ListChecks size={18} className="text-[#DC2626]" /> Exam Results</h3>
                          <button onClick={downloadResults} className="text-[#DC2626] hover:text-[#DC2626]/80 transition-all"><FileDown size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                          {scoreSheet.length === 0 ? (
                            <p className="text-[10px] text-center py-10 text-white/20">No results recorded yet</p>
                          ) : (
                            scoreSheet.map((res, i) => (
                              <div key={i} className="p-3 rounded-xl border flex items-center justify-between group bg-white/5 border-white/5">
                                <div>
                                  <p className="text-[10px] font-bold text-white">{res.name}</p>
                                  <p className="text-[8px] font-mono text-white/40">{res.matric} • {res.score}/{res.total}</p>
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

                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 flex flex-col overflow-hidden shadow-sm">
                        <h3 className="font-bold flex items-center gap-2 text-white"><FileText size={18} className="text-[#DC2626]" /> Question Log</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
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
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0F1C]/95 backdrop-blur-xl border-t border-white/10 z-50 shadow-2xl">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' },
            { id: 'exam', icon: ListChecks, label: 'Exam' },
            { id: 'blog', icon: FileText, label: 'Blog' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-4 transition-all relative ${activeTab === tab.id ? 'text-[#DC2626]' : 'text-white/30 hover:text-[#DC2626]'}`}>
              {activeTab === tab.id && <motion.div layoutId="nav-active" className="absolute inset-0 bg-[#DC2626]/5 rounded-2xl -z-10" />}
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* GOD MODE PANEL */}
      <AnimatePresence>
        {showGodMode && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[200] p-6 overflow-y-auto bg-[#0A0F1C]/95 backdrop-blur-xl">
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
                  <button onClick={() => setShowGodMode(false)} className="p-3 rounded-2xl transition-all bg-white/5 text-white/40 hover:bg-white/10">
                    <XCircle size={24} />
                  </button>
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
                                <p className="text-[8px] font-mono text-[#DC2626]">{u.matric || 'No Matric'} • {u.dob || 'No DOB'}</p>
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

        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0A0F1C] rounded-3xl p-8 max-w-md w-full border border-white/10 space-y-6">
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0A0F1C] rounded-3xl p-8 max-w-sm w-full border border-white/10 space-y-6">
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
                <div ref={shareCardRef} className="w-[600px] h-[400px] bg-[#0A0F1C] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden border-[10px] border-[#DC2626]">
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
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Generated by Omni Ai • {new Date().toLocaleDateString()}</p>
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
        <button onClick={() => setLegalPage('contact')} className="hover:text-[#DC2626] transition-colors">Contact Us</button>
        <span>© 2026 Nuell Graphics</span>
      </footer>
    </div>
  );
}
