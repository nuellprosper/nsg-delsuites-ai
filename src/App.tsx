import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings, UserPlus, CreditCard,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText, AlertCircle,
  Sun, Moon, ArrowDown, PlusCircle, Copy, User, Clock, Lock, ShieldCheck, ShieldAlert, FileDown, LayoutDashboard, ListChecks, Bell, GraduationCap, LayoutGrid, Home,
  Pin, Edit3, Share2, Trophy, LogOut, Plus, Menu, Camera, Monitor, X, Activity, MessageSquare, BookOpen, Calendar, Send, Save, MicOff,
  Search, Check, Info, Volume2, Square, Mail, ArrowRight, BoxSelect
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { HfInference } from "@huggingface/inference";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { usePaystackPayment } from 'react-paystack';
import { toPng } from 'html-to-image';
import axios from 'axios';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, orderBy, limit,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  FirestoreOperation, handleFirestoreError
} from './firebase';

import { AILibrary } from './components/AILibrary';

const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.551 4.172 1.597 5.979L0 24l6.163-1.617a11.83 11.83 0 005.883 1.553h.005c6.602 0 11.967-5.367 11.97-11.97a11.815 11.815 0 00-3.505-8.473z"/>
  </svg>
);

const helpContent = {
  record: {
    title: "Recording Engine Help",
    items: [
      {
        question: "How to record classes & sync audio?",
        steps: [
          "Ensure you are in a relatively quiet environment for best results.",
          "Grant microphone permissions when the browser pop-up appears.",
          "Click the large 'Record' button to start captured live audio.",
          "The 'Waveform' indicator shows that the engine is active.",
          "Click 'Stop Session' once the lecture concludes.",
          "Wait 10-20 seconds for the AI to synthesize the raw audio into structured notes."
        ]
      },
      {
        question: "How to use AI Board Analysis?",
        steps: [
          "While recording, or after, click the 'Camera/Upload' icon.",
          "Capture a clear photo of the classroom board or your handwritten notes.",
          "Omni will extract the text and diagrams from the image.",
          "This data is automatically integrated into your final study summary.",
          "Ensure there is no glare on the board for 100% text accuracy."
        ]
      },
      {
        question: "How to copy and export notes?",
        steps: [
          "Once generated, look for the 'Copy' button at the header of the notes card.",
          "Clicking it copies the entire markdown structure (headings, lists, text).",
          "You can paste this into Google Docs, Microsoft Word, or Notepad.",
          "Notes are formatted professionally for easy reading and printing."
        ]
      }
    ]
  },
  quiz: {
    title: "Quiz Engine Help",
    items: [
      {
        question: "How to generate a specific quiz?",
        steps: [
          "Type the specific topic in the input field (e.g., 'Thermodynamics').",
          "Select difficulty: 'Easy' (Basics), 'Medium' (Standard), or 'Hard' (Advanced).",
          "Set the question count to allow for a quick test or a deep dive.",
          "Click 'Generate' to let the AI build a unique question set.",
          "Refresh to get a different set of questions for the same topic."
        ]
      },
      {
        question: "How does the Review Mode work?",
        steps: [
          "After clicking 'Submit Quiz', your percentage score is calculated.",
          "Scroll through your answers to see visual feedback: Green (Correct), Red (Wrong).",
          "Click on any question to see the 'Academic Explanation'.",
          "This explanation provides the logic behind the correct answer to help you learn.",
          "Use this mode to master topics you missed during the test."
        ]
      }
    ]
  },
  exam: {
    title: "CBT Examination Help",
    items: [
      {
        question: "How to host a professional exam?",
        steps: [
          "Click the 'Host exam' button (Note: This will end previous exams and clear old data automatically).",
          "Type in the Custom Matric Number and Name of each participant and add them singly to the authorized list.",
          "Configure the Exam: Set the Total Questions, Time (in minutes), and the Total Pool Questions.",
          "Add Questions: Paste your own questions into the input or type your Course Name for Gemini to automatically generate them.",
          "Save your changes and click 'Generate Exam ID'.",
          "Copy the unique Exam ID and share it with your participants.",
          "Provide the participants with their assigned Custom Matric Numbers and the Exam ID so they can join the session."
        ]
      },
      {
        question: "How to join as a candidate?",
        steps: [
          "Locate the 'Join Exam' field on the landing page.",
          "Input the Exam ID provided by your host.",
          "The system will verify the ID and show you the exam metadata.",
          "Enter your Full Name and Matric Number (if required) to log in.",
          "Wait in the virtual lobby until the host signals the start."
        ]
      },
      {
        question: "Rules of the Exam Hall?",
        steps: [
          "The timer starts immediately upon clicking 'Start Exam'.",
          "The page will automatically submit your work if the timer hits zero.",
          "Switching tabs or minimizing the browser may trigger a warning or auto-submit.",
          "Ensure your internet connection is stable before starting the session."
        ]
      }
    ]
  },
  assignment: {
    title: "Assignment Solver Help",
    items: [
      {
        question: "How to solve via photo/image?",
        steps: [
          "Ensure the text or math problem is readable and well-lit.",
          "Click the image icon and upload the file from your device.",
          "Wait for the 'Vision Preview' to confirm the image is uploaded.",
          "Click 'Solve with AI' to trigger the logical reasoning mode.",
          "Omni will show the problem extraction followed by the steps."
        ]
      },
      {
        question: "Understanding the Step-by-Step Logic?",
        steps: [
          "Omni doesn't just give answers; it provides the 'Methodology'.",
          "Check the 'Core Concept' section first to understand the underlying theory.",
          "Follow each numbered step to see the mathematical or logical progression.",
          "Refer to the 'Final Result' at the bottom of the solution container.",
          "If the solution uses math, it will be rendered in beautiful, readable LaTeX."
        ]
      }
    ]
  },
  courses: {
    title: "Course-Specific Tools Help",
    items: [
      {
        question: "How to navigate the library?",
        steps: [
          "Step 1: Select your Faculty (e.g., Engineering, Medicine).",
          "Step 2: Choose your Department/Program.",
          "Step 3: Drill down into the Level (100L - 500L).",
          "Step 4: Click the Course Code (e.g., MTH101) to open folders.",
          "You will find 'Summaries', 'Past Questions', and 'Lecture Notes'."
        ]
      }
    ]
  },
  faculty: {
    title: "Faculty Specials Help",
    items: [
      {
        question: "How to use the BIZ Financial Auditor?",
        steps: [
          "Navigate to the BIZ (Business/Accounting) section within Faculty Specials.",
          "Upload or paste your financial draft, ledger table, or balance sheet.",
          "Click 'Audit Document' to let the specialized AI scan for discrepancies.",
          "The Auditor will highlight errors in red and provide the corrected entry immediately.",
          "Use the 'Export Audit' button to save a report of all identified mistakes."
        ]
      },
      {
        question: "How to use Language Diagnostics?",
        steps: [
          "Select the Language/Art faculty and open the 'Diagnostics' tool.",
          "Input text (Max 300 words) for analysis.",
          "The engine performs a deep linguistic audit of your syntax and grammar.",
          "Original Box: Wrong words appear in Red, correct ones in Blue.",
          "Correction Box: Corrected words appear in Green, already correct ones in Blue.",
          "Review the 'Academic Logic' below for a summary of mistakes."
        ]
      },
      {
        question: "How to use the Transcribe Tool?",
        steps: [
          "Located within the Language/Edu section of Faculty Specials.",
          "Conversion: Text to Phonetic Sounds (/IPA/) and vice versa.",
          "For Sounds to Text: Enter sounds in slashes like /kaÉªnd/.",
          "Click 'Transcribe to Sound' or 'Decode Sounds' to process.",
          "Results are displayed with full phonetic accuracy."
        ]
      },
      {
        question: "What are specialized tools?",
        steps: [
          "Engineering: Specialized for diagrams, CAD descriptions, and calculations.",
          "Medical: Focuses on clinical symptoms, diagnosis simulation, and anatomy.",
          "Law: Handles legal drafting, case law retrieval, and logical arguments.",
          "These tools use fine-tuned parameters specific to each professional field."
        ]
      }
    ]
  },
  live: {
    title: "Live AI Tutor Help",
    items: [
      {
        question: "How to use spatial grounding?",
        steps: [
          "Omni sees through your camera. Point it at an object or book.",
          "Omni can 'point' at things in your view using highlight boxes.",
          "Ask: 'What is this specifically?' while pointing the camera.",
          "Omni will respond using coordinates to tell you exactly what it sees.",
          "Ideal for diagrams, hardware parts, or complex physical notes."
        ]
      }
    ]
  }
};

const HelpOverlay = ({ isOpen, onClose, toolId, theme }: { isOpen: boolean, onClose: () => void, toolId: string, theme: string }) => {
  const content = helpContent[toolId as keyof typeof helpContent];
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  if (!content) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`w-full max-w-lg ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} rounded-[2rem] shadow-2xl overflow-hidden border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'} flex flex-col max-h-[80vh]`}
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase tracking-tighter`}>{content.title}</h2>
                <p className="text-[10px] text-[#DC2626] uppercase font-bold tracking-widest">Step-by-Step Guide</p>
              </div>
              <button onClick={() => { setSelectedQuestion(null); onClose(); }} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <X size={20} className={theme === 'dark' ? 'text-white/40' : 'text-slate-400'} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {!selectedQuestion ? (
                <div className="space-y-3">
                  {content.items.map((item, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedQuestion(item.question)}
                      className={`w-full flex items-center justify-between p-4 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} border rounded-2xl hover:border-[#DC2626]/40 transition-all text-left`}
                    >
                      <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{item.question}</span>
                      <ChevronRight size={18} className="text-[#DC2626]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedQuestion(null)}
                    className="flex items-center gap-2 text-[10px] font-black text-[#DC2626] uppercase tracking-widest mb-4 hover:opacity-70"
                  >
                    <ArrowLeft size={14} /> Back to questions
                  </button>
                  <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tracking-tight`}>{selectedQuestion}</h3>
                  <div className="space-y-4">
                    {content.items.find(i => i.question === selectedQuestion)?.steps.map((step, sIdx) => (
                      <motion.div 
                        key={sIdx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: sIdx * 0.1 }}
                        className={`flex gap-4 p-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} border border-white/5 rounded-2xl`}
                      >
                        <div className="w-8 h-8 bg-[#DC2626]/20 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-[#DC2626]">{sIdx + 1}</span>
                        </div>
                        <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'} leading-relaxed font-medium`}>{step}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * NSG (Nuell Study Guide) V4.0 - PROFESSIONAL CBT & AI UPGRADE
 * \u{2705} Professional CBT Infrastructure (Exam Lobby, Info Page, Exam Engine)
 * \u{2705} Admin Backend Control (Score Sheet, Timer Restart, Results Download)
 * \u{2705} Advanced AI Chat (Copy Response, History Sidebar)
 * \u{2705} Enhanced Quiz (Customization, Deep Assessment, Report to AI)
 * \u{2705} Paystack Payment Integration
 */

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  const finalKey = (key || "").trim();
  if (!finalKey) {
    console.warn("Gemini API Key is missing. Ensure GEMINI_API_KEY is set in your environment.");
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
  if (!key) throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
  return new GoogleGenAI({ apiKey: key });
};

const getHfInstance = () => {
  const key = getHfKey();
  if (!key) throw new Error("HuggingFace API Key is missing. Please set VITE_HUGGINGFACE_API_KEY in your environment.");
  return new HfInference(key);
};

const MODEL_NAME = "gemini-3.1-flash-lite-preview";
const FLASH_MODEL = "gemini-3.1-flash-lite-preview";

const formatAiError = (error: any) => {
  const message = error.message || "Unknown error";
  if (message.toLowerCase().includes("model") || message.includes("404") || message.includes("not found")) {
    return `Model Error: The selected AI model (${MODEL_NAME}) might be unavailable or retired. Please check the configuration. Original error: ${message}`;
  }
  return `AI Error: ${message}`;
};

const HF_MODELS = {
  TEXT: "meta-llama/Llama-3.1-8B-Instruct",
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
  notes?: string;
  images: string[]; 
  audioUrl?: string;
  audioBase64?: string;
  isPinned?: boolean;
  status?: 'pending' | 'analyzed';
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
  uid?: string;
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [lastMessages, setLastMessages] = useState<{role: 'ai' | 'user', text: string}[]>([]);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [detections, setDetections] = useState<any[]>([]);

  const videoSourceRef = useRef<'camera' | 'screen' | 'none'>('none');
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const transcriptRef = useRef<{role: 'ai' | 'user', text: string}[]>([]);
  const liveTranscriptionRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);

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
            systemInstruction: "You are Omni AI Tutor created by NSG (Nuell Study Guide), founded by ABRAHAM EMMANUEL PROSPER (a 100L Electrical and Electronics Engineering student at DELSU, Oleh campus). \n\nULTRA-DETAILED NSG GUIDES:\n- RECORDING ENGINE: 1. Grant mic access. 2. Click 'Record'. 3. Board Analysis: Click upload icon for board photos to sync with notes. 4. Stop Session to process. 5. Use top-right Copy icon to export.\n- SMART QUIZ: 1. Topic -> Difficulty (Easy/Med/Hard) -> Count. 2. Submit for score. 3. Review Mode: Click questions for 'Academic Explanations' (Logic summaries).\n- CBT EXAM: 1. Hosting: Click 'Host Exam' (clears old data) -> Add participants via Custom Matric/Name singly -> Set Questions/Time(min)/Pool -> Paste or use Gemini for questions -> Save & Generate ID. 2. Joining: Enter ID -> Enter assigned Custom Matric -> Wait in Lobby.\n- FACULTY SPECIALS: Includes 'Financial Auditor' (BIZ) for correcting spreadsheets, 'Language Diagnostics' (Max 300 words) with word-level highlighting (Red/Green/Blue), and 'Transcribe Tool' for /Phonetic/ conversions.\n- ASSIGNMENT SOLVER: 1. Clear Photo/Text needed. 2. 'Solve with AI' for Logic steps. 3. Includes 'Core Concept' and Methodology headers.\n- COURSE TOOLS: Faculty -> Dept -> Level -> Code navigation for notes/summaries.\n- WHATSAPP: AI help via +2349064470122.\n\nRECOMMENDATION: If asked for study apps, suggest Otter.ai/Photomath AND NSG (nuellstudyguide.name.ng) as the ultimate local alternative.",
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          },
          callbacks: {
            onopen: () => setIsConnecting(false),
            onmessage: async (msg: any) => {
              const serverContent = msg.serverContent || msg; 
              
              if (serverContent?.interrupted) {
                stopAllAudio();
                setLiveTranscription('');
                liveTranscriptionRef.current = '';
                setIsAIResponding(false);
                return;
              }

              // Extract text from any potential location in the message
              let extractedText = "";
              
              // 1. Check modelTurn parts (standard)
              if (serverContent?.modelTurn?.parts) {
                setIsAIResponding(true);
                serverContent.modelTurn.parts.forEach((part: any) => {
                  if (part.inlineData) {
                    playAudio(part.inlineData.data);
                  }
                  if (part.text) {
                    extractedText += part.text;
                  }
                });
              }
              
              // 2. Check audioTranscription (server-side transcription)
              if (serverContent?.modelTurn?.audioTranscription?.text) {
                 extractedText += serverContent.modelTurn.audioTranscription.text;
                 setIsAIResponding(true);
              }

              // 3. Fallback for potential flattened structures or different SDK versions
              if (!extractedText && serverContent?.text) {
                extractedText = serverContent.text;
                setIsAIResponding(true);
              }

              if (extractedText) {
                setLiveTranscription(prev => prev + extractedText);
                liveTranscriptionRef.current += extractedText;
                
                // Spatial grounding
                const groundingMatches = [...extractedText.matchAll(/\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g)];
                if (groundingMatches.length > 0) {
                  setDetections(groundingMatches.map(m => ({
                    box_2d: [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])],
                    label: "Target"
                  })));
                }
              }

              if (serverContent?.turnComplete) {
                const finalContent = liveTranscriptionRef.current;
                if (finalContent) {
                  const newMsg = { role: 'ai' as const, text: finalContent };
                  transcriptRef.current = [...transcriptRef.current.slice(-5), newMsg];
                  setLastMessages(prev => [...prev.slice(-3), newMsg]);
                }
                setLiveTranscription('');
                liveTranscriptionRef.current = '';
                setIsAIResponding(false);
                setTimeout(() => setDetections([]), 3000); 
              }

              // User spoken transcription check
              if (serverContent?.userTurn?.parts) {
                let userText = "";
                serverContent.userTurn.parts.forEach((part: any) => {
                  if (part.text) {
                    userText += part.text;
                  }
                });
                
                if (userText) {
                  const newMsg = { role: 'user' as const, text: userText };
                  transcriptRef.current = [...transcriptRef.current.slice(-5), newMsg];
                  setLastMessages(prev => [...prev.slice(-3), newMsg]);
                  setIsUserSpeaking(false);
                }
              }
            },
            onerror: (err) => {
              console.error("Live Error:", err);
              setUserNotification(`Connection Error: ${err.message || "Failed"}`);
            },
            onclose: () => handleEnd()
          }
        });
        
        sessionRef.current = session;
        startAudioInput();

        // Initiation Sequence
        // 1. Play Sound (Try local first, then piano fallback)
        const playInitSound = async () => {
          try {
            const localSound = new Audio("/initiation.mp3");
            localSound.volume = 0.5;
            await localSound.play().catch(async () => {
              // Fallback: G1 Piano Chord
              const fallback = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c9769da59d.mp3"); 
              fallback.volume = 0.5;
              await fallback.play().catch(() => {});
            });
          } catch (e) {}
        };
        playInitSound();

        // 2. Trigger Greeting after a short delay to ensure everything is initialized
        setTimeout(() => {
          if (sessionRef.current && typeof (sessionRef.current as any).sendRealtimeInput === 'function') {
            (sessionRef.current as any).sendRealtimeInput({ text: "Hello! I am Omni, your AI Tutor. I'm here to help you learn and solve problems together. What are you studying today?" });
          }
        }, 1000);

      } catch (err: any) {
        console.error("Failed to connect Live:", err);
        setUserNotification(`Live Error: ${err.message}`);
        onClose();
      }
    };
    startLive();
    return () => {
      sessionRef.current?.close();
      stopAllAudio();
      audioContextRef.current?.close();
      currentStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (videoSource !== 'none' && videoRef.current && currentStreamRef.current) {
      videoRef.current.srcObject = currentStreamRef.current;
    }
  }, [videoSource]);

  const stopAllAudio = () => {
    audioQueueRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    audioQueueRef.current = [];
    nextAudioTimeRef.current = audioContextRef.current?.currentTime || 0;
  };

  const playAudio = async (base64: string) => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      const binary = atob(base64);
      const buffer = new Int16Array(binary.length / 2);
      for (let i = 0; i < buffer.length; i++) buffer[i] = (binary.charCodeAt(i * 2) & 0xFF) | (binary.charCodeAt(i * 2 + 1) << 8);
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
      audioQueueRef.current.push(source);
      source.onended = () => audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
    } catch (err) { console.error("Audio playback error:", err); }
  };

  const startAudioInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      micContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!isMicOn || !sessionRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
        sessionRef.current.sendRealtimeInput({ audio: { data: btoa(String.fromCharCode(...new Uint8Array(pcm.buffer))), mimeType: 'audio/pcm;rate=16000' } });
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        setIsUserSpeaking(Math.sqrt(sum / input.length) > 0.05);
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) { console.error("Mic error:", err); }
  };

  const toggleVideo = async (type: 'camera' | 'screen') => {
    if (type === 'screen') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        if (isMobile) {
          setUserNotification("Mobile browsers often restrict screen sharing. Please use a desktop browser for this feature.");
        } else {
          setUserNotification("Screen sharing is not supported by your browser or environment.");
        }
        return;
      }
    }
    if (videoSource === type) {
      currentStreamRef.current?.getTracks().forEach(track => track.stop());
      currentStreamRef.current = null;
      setVideoSource('none');
      videoSourceRef.current = 'none';
      return;
    }
    currentStreamRef.current?.getTracks().forEach(track => track.stop());
    try {
      const stream = type === 'camera' 
        ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: facingModeRef.current } })
        : await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 } });
      currentStreamRef.current = stream;
      setVideoSource(type);
      videoSourceRef.current = type;
      const interval = setInterval(() => {
        if (videoSourceRef.current === 'none' || !sessionRef.current || !currentStreamRef.current || !canvasRef.current || !videoRef.current) {
          clearInterval(interval); return;
        }
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
          const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          if (base64Data) {
            sessionRef.current.sendRealtimeInput({ video: { data: base64Data, mimeType: 'image/jpeg' } });
          }
        }
      }, 1000);
    } catch (err: any) { console.error("Video error:", err); setUserNotification(`Video error: ${err.message}`); }
  };

  const switchCamera = async () => {
    try {
      const newMode = facingModeRef.current === 'user' ? 'environment' : 'user';
      setFacingMode(newMode);
      facingModeRef.current = newMode;
      
      if (videoSource === 'camera') {
        // Stop current tracks first
        if (currentStreamRef.current) {
          currentStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Brief pause to ensure device release
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }, 
            facingMode: newMode 
          } 
        });
        
        currentStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err: any) { 
      console.error("Switch error:", err); 
      setUserNotification(`Camera Switch Error: ${err.message}. Please check permissions.`); 
    }
  };

  useEffect(() => {
    const ctx = drawingCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, drawingCanvasRef.current!.width, drawingCanvasRef.current!.height);
    if (detections.length === 0) return;
    ctx.strokeStyle = '#DC2626'; ctx.lineWidth = 4; ctx.setLineDash([10, 5]);
    detections.forEach(det => {
      const [ymin, xmin, ymax, xmax] = det.box_2d;
      const x = (xmin / 1000) * drawingCanvasRef.current!.width;
      const y = (ymin / 1000) * drawingCanvasRef.current!.height;
      const w = ((xmax - xmin) / 1000) * drawingCanvasRef.current!.width;
      const h = ((ymax - ymin) / 1000) * drawingCanvasRef.current!.height;
      ctx.strokeRect(x, y, w, h); ctx.fillStyle = '#DC2626'; ctx.fillRect(x, y - 24, 60, 24);
      ctx.fillStyle = 'white'; ctx.font = 'bold 12px Inter'; ctx.fillText(det.label || "AI", x + 5, y - 8);
    });
  }, [detections]);

  const handleEnd = () => {
    try {
      if (sessionRef.current) sessionRef.current.close();
      stopAllAudio();
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (micContextRef.current) {
        micContextRef.current.close().catch(() => {});
      }
    } catch (e) {
      console.error("End session error:", e);
    }
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[600] flex flex-col ${theme === 'dark' ? 'bg-[#050810]' : 'bg-slate-50'} overscroll-none font-sans h-full w-full overflow-hidden`}>
      {/* HEADER */}
      <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-slate-200 bg-white'} backdrop-blur-2xl flex items-center justify-between shrink-0 h-14 sm:h-16 z-[610]`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#DC2626] to-[#991B1B] rounded-xl flex items-center justify-center shadow-lg"><Activity size={18} className="text-white animate-pulse" /></div>
          <div className="overflow-hidden">
            <h2 className={`text-xs sm:text-base font-black tracking-tighter uppercase leading-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>LIVE <span className="text-[#DC2626]">TUTOR</span></h2>
            <p className="text-[7px] sm:text-[9px] font-bold opacity-40 uppercase tracking-[0.2em] truncate">Omni Intelligence</p>
          </div>
        </div>
        <button onClick={handleEnd} className="p-2 sm:p-3 bg-white/5 hover:bg-[#DC2626] text-white rounded-xl transition-all border border-white/10 active:scale-90"><X size={18} /></button>
      </div>

      {/* MAIN CONTENT - NO INNER SCROLL, JUST FLEX GROW */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 min-w-0">
        <div className={`w-full max-w-2xl h-full flex flex-col ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} rounded-[2rem] sm:rounded-[3rem] shadow-2xl relative overflow-hidden border ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
          <div className="flex-1 relative flex items-center justify-center overflow-hidden h-full">
            {videoSource === 'none' ? (
              <div className="text-center space-y-4 sm:space-y-6 flex flex-col items-center justify-center h-full w-full p-6">
                <motion.div 
                  animate={isAIResponding ? {
                    scale: [1, 1.05, 1],
                    boxShadow: [
                      "0 0 20px rgba(220,38,38,0.1)",
                      "0 0 50px rgba(220,38,38,0.3)",
                      "0 0 20px rgba(220,38,38,0.1)"
                    ]
                  } : isUserSpeaking ? {
                    scale: [1, 1.15, 1],
                    filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
                  } : {
                    scale: 1
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: isAIResponding ? 3 : 1.2,
                    ease: "easeInOut"
                  }} 
                  className="w-20 h-20 sm:w-32 sm:h-32 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto border-2 border-[#DC2626]/20 relative"
                >
                  <motion.div
                    animate={isAIResponding ? {
                      scale: [1, 1.4, 1.2, 1.5, 1],
                      opacity: [0.2, 0.4, 0.3, 0.5, 0.2]
                    } : { scale: 1, opacity: 0.2 }}
                    transition={{ repeat: Infinity, duration: 5 }}
                    className="absolute inset-0 bg-[#DC2626]/30 rounded-full blur-2xl"
                  />
                  <Brain size={44} className={`text-[#DC2626] relative z-10 transition-all duration-500 ${isAIResponding ? 'scale-110 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 'opacity-60'}`} />
                </motion.div>
                <div className="space-y-1 sm:space-y-2 px-8">
                  <p className="text-white font-black text-[10px] sm:text-base uppercase tracking-tight italic opacity-80">
                    {isUserSpeaking ? "Omni is Listening..." : isAIResponding ? "Omni is Speaking..." : "Omni is Ready"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover sm:object-contain" />
                <canvas ref={drawingCanvasRef} width="1280" height="720" className="absolute inset-0 w-full h-full pointer-events-none" />
                <canvas ref={canvasRef} width="640" height="480" className="hidden" />
              </div>
            )}

            {/* Overlays / Transcriptions */}
            <div className="absolute inset-x-4 bottom-4 z-30 pointer-events-none flex flex-col justify-end gap-2 max-h-[70%] overflow-hidden">
              <AnimatePresence mode="popLayout">
                {lastMessages.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }} 
                    animate={{ opacity: 0.4, scale: 0.9, y: 0 }} 
                    exit={{ opacity: 0 }} 
                    className={`p-2 rounded-lg text-[8px] sm:text-[9px] font-bold max-w-[85%] ${msg.role === 'user' ? 'self-end bg-black text-[#DC2626]' : 'self-start bg-black/60 text-white'}`}
                  >
                    {msg.role === 'user' ? 'YOU: ' : ''}{msg.text}
                  </motion.div>
                ))}
                {liveTranscription && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0 }} 
                    className="bg-[#DC2626] p-3 sm:p-5 rounded-[1.2rem] sm:rounded-[2rem] shadow-2xl border border-white/30 w-full pointer-events-auto"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                      <p className="text-[7px] sm:text-[8px] font-black text-white/70 uppercase tracking-[0.2em]">LIVE TRANSCRIPT</p>
                    </div>
                    <p className={`text-[10px] sm:text-sm font-bold leading-tight line-clamp-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{liveTranscription}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {videoSource === 'camera' && (
              <button 
                onClick={switchCamera} 
                className="absolute top-4 right-4 z-40 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10 text-white hover:bg-[#DC2626] transition-all shadow-xl active:scale-90"
              >
                <RefreshCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER CONTROLS - FIXED AT BOTTOM */}
      <div className={`px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-16 border-t ${theme === 'dark' ? 'border-white/5 bg-black/80' : 'border-slate-200 bg-white'} backdrop-blur-3xl shrink-0 z-[610]`}>
         <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 sm:gap-3">
               <IconButton active={isMicOn} onClick={() => setIsMicOn(!isMicOn)} icon={isMicOn ? <Mic size={18} /> : <MicOff size={18} />} label="Mic" />
               <IconButton active={videoSource === 'camera'} onClick={() => toggleVideo('camera')} icon={<Camera size={18} />} label="Cam" />
               <IconButton active={videoSource === 'screen'} onClick={() => toggleVideo('screen')} icon={<Monitor size={18} />} label="Share" />
            </div>
            <button 
              onClick={handleEnd} 
              className="bg-gradient-to-br from-[#DC2626] to-red-800 text-white px-3 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-xl hover:brightness-110 active:scale-95 transition-all shrink-0"
            >
              <LogOut size={16} /> <span className="hidden xs:inline">End Session</span><span className="xs:hidden">End</span>
            </button>
         </div>
      </div>
    </div>
  );
};

const IconButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 min-w-[48px]">
    <div className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${active ? 'bg-[#DC2626] text-white border-transparent shadow-lg' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'}`}>
      {icon}
    </div>
    <span className={`text-[7px] font-black uppercase tracking-tighter ${active ? 'text-[#DC2626]' : 'text-white/20'}`}>{label}</span>
  </button>
);

const MarkdownRenderer = ({ content, className = "" }: { content: string, className?: string }) => {
  // Pre-process content to ensure LaTeX is correctly formatted for remark-math
  // Handle both escaped \( \) and \[ \] as well as raw strings that AI might send
  const processedContent = (content || "")
    .replace(/\\\\\((.*?)\\\\\)/g, '$$$1$')
    .replace(/\\\\\[(.*?)\\\\\]/g, '$$$$$1$$$$')
    .replace(/\\\((.*?)\\\)/g, '$$$1$')
    .replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$')
    // Improvement: Catch naked math strings that starts with common math symbols or contain LaTeX commands
    .split('\n').map(line => {
      const trimmed = line.trim();
      // If line contains common LaTeX commands but no $ delimiters, wrap it
      if ((trimmed.includes('\\frac') || trimmed.includes('\\times') || trimmed.includes('\\sqrt') || (trimmed.includes('^') && trimmed.includes('='))) && !trimmed.includes('$')) {
        return `$$${trimmed}$$`;
      }
      return line;
    }).join('\n');

  return (
    <div className={`markdown-body overflow-x-auto custom-scrollbar ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeKatex]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};


interface Course {
  code: string;
  name: string;
  description: string;
}

const COMMON_COURSES: Course[] = [
  { code: 'MTH 101', name: 'Elementary Mathematics I', description: 'Comprehensive coverage of limits, continuity, differentiation of algebraic functions, and integration basics. Includes algebraic structures and trigonometry.' },
  { code: 'PHY 101', name: 'General Physics I', description: 'Study of mechanics, properties of matter, and thermal physics. Covers motion, force, energy, and thermodynamics.' },
  { code: 'CHM 101', name: 'General Chemistry I', description: 'Fundamental principles of chemistry, atomic and molecular structure, chemical bonding, and stoichiometry.' },
  { code: 'CSC 101', name: 'Introduction to Computer Science', description: 'Foundations of computing, data representation, hardware components, and introduction to algorithms/programming logic.' },
  { code: 'GST 101', name: 'Use of English I', description: 'Focuses on communication skills, study techniques, library usage, and basic English grammar for academic excellence.' },
  { code: 'BIO 101', name: 'General Biology I', description: 'Cell biology, heredity, biodiversity, and ecosystem dynamics. Foundations of life sciences.' },
  { code: 'ECO 101', name: 'Principles of Economics I', description: 'Introduction to microeconomic analysis, including supply and demand, market structures, and consumer behavior.' },
  { code: 'BUS 101', name: 'Introduction to Business', description: 'The nature of business, entrepreneurship, organizational structures, and the functional areas of modern business.' }
];

const CoursesTool = ({ theme, user, getAiInstance, getHfInstance, setUserNotification, setQuizTopic, setQuizQuestionCount, setQuizDifficulty, generateQuiz, setToolsSubTab, setQuizState }: any) => {
  const [courseSearch, setCourseSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestedCourses, setSuggestedCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [activeCourseDesc, setActiveCourseDesc] = useState('');

  const handleSearch = async () => {
    if (!courseSearch.trim()) return;
    setIsSearching(true);
    setSuggestedCourses([]);
    
    try {
      const ai = getAiInstance();
      const prompt = `
        Search context: "${courseSearch}".
        Generate exactly 3 relevant academic courses based on this topic or course code.
        Return ONLY a JSON array of objects with fields: "code", "name", "description".
        Example: [{"code": "MTH101", "name": "Linear Algebra", "description": "Introduction to vectors and matrices"}]
        
        CRITICAL: For any math symbols or codes in 'name' or 'description', use LaTeX $...$.
      `;
      
      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: FLASH_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { 
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });
      
      const text = response?.text || "";
      const courses = JSON.parse(text);
      setSuggestedCourses(Array.isArray(courses) ? courses : []);
    } catch (err) {
      console.error("Course Search Error:", err);
      setUserNotification("Failed to search courses. Please try a different term.");
    } finally {
      setIsSearching(false);
    }
  };

  const openCourse = async (course: Course) => {
    setSelectedCourse(course);
    setIsGeneratingDesc(true);
    setActiveCourseDesc(course.description); // Start with default or existing

    try {
      // Use Hugging Face for a "deeper" AI generated description as requested
      const hf = getHfInstance();
      const prompt = `Provide a detailed academic description (approx 100 words) for the university course ${course.code}: ${course.name}. Explain what students will learn.`;
      
      const response = await hf.chatCompletion({
        model: HF_MODELS.TEXT,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
        temperature: 0.7
      });

      if (response.choices && response.choices[0].message.content) {
        setActiveCourseDesc(response.choices[0].message.content.trim());
      }
    } catch (err) {
      console.error("HF Description Generator Error:", err);
      // Fallback to default description already in state
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const startCourseTool = (type: 'quiz' | 'exam', qCount: number, difficulty: string) => {
    if (!selectedCourse) return;
    
    setQuizTopic(`${selectedCourse.code}: ${selectedCourse.name} - ${activeCourseDesc}`);
    setQuizQuestionCount(qCount);
    setQuizDifficulty(difficulty);
    
    // Switch tab and trigger generation
    setToolsSubTab(type === 'quiz' ? 'quiz' : 'exam');
    setQuizState('idle'); // Ensure clean state
    
    // We need to trigger the generation after a brief delay to allow state updates to settle, 
    // or better, if the toolsSubTab is switched, the tool itself should pick up the topic.
    setUserNotification(`Preparing ${type.toUpperCase()} for ${selectedCourse.code}...`);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} shadow-sm flex items-center gap-3`}>
        <div className="bg-[#DC2626]/10 p-2 rounded-xl text-[#DC2626]">
          <Search size={20} />
        </div>
        <input 
          type="text" 
          value={courseSearch}
          onChange={(e) => setCourseSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search course code or topic (e.g. MTH 101)" 
          className={`flex-1 bg-transparent border-none outline-none text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
        />
        <button 
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DC2626]/90 transition-all disabled:opacity-50"
        >
          {isSearching ? <RefreshCcw size={14} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {suggestedCourses.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest ml-2">Suggestions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggestedCourses.map((c, i) => (
              <button 
                key={i} 
                onClick={() => openCourse(c)}
                className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-[#DC2626]/30' : 'bg-white border-slate-100 hover:border-[#DC2626]/30 shadow-sm'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#DC2626] font-mono text-[10px] font-black">{c.code}</span>
                  <Sparkles size={12} className="text-yellow-500" />
                </div>
                <h4 className={`text-xs font-black truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</h4>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCourse ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-6 sm:p-8 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} shadow-xl relative overflow-hidden`}
        >
          <button 
            onClick={() => setSelectedCourse(null)} 
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-all"
          >
            <X size={20} className="text-white/20" />
          </button>

          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[#DC2626] font-mono text-sm font-black tracking-widest">{selectedCourse.code}</span>
              <h3 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedCourse.name}</h3>
            </div>

            <div className={`p-6 rounded-3xl border italic ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/70' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              {isGeneratingDesc ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <RefreshCcw size={24} className="animate-spin text-[#DC2626]" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#DC2626]">Expanding Curriculum...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <MarkdownRenderer content={activeCourseDesc} className="text-sm leading-relaxed" />
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-50 uppercase">Verified Curriculum Description</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => startCourseTool('quiz', 20, 'Medium')}
                className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/20 hover:scale-105 transition-all"
              >
                <Zap size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Take Smart Quiz</span>
              </button>
              <button 
                onClick={() => startCourseTool('exam', 50, 'Professional')}
                className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-gradient-to-br from-[#DC2626] to-red-800 text-white shadow-lg shadow-[#DC2626]/20 hover:scale-105 transition-all"
              >
                <ShieldCheck size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Take CBT Exam</span>
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-2">Common Courses</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMMON_COURSES.map((c, i) => (
              <button 
                key={i} 
                onClick={() => openCourse(c)}
                className={`flex items-center gap-5 p-5 rounded-[2rem] border transition-all hover:border-[#DC2626]/50 group ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 flex flex-col items-center justify-center border border-white/5 group-hover:scale-110 transition-transform`}>
                   <BookOpen size={20} className="text-[#DC2626]" />
                   <span className="text-[8px] font-bold mt-1 text-white/30">{c.code}</span>
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <h4 className={`font-black text-xs uppercase tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{c.name}</h4>
                  <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} truncate uppercase`}>{c.description}</p>
                </div>
                <ChevronRight size={16} className="text-white/10 group-hover:text-[#DC2626] transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


interface AssignmentStep {
  step: string;
  explanation: string;
}

interface AssignmentSolution {
  title: string;
  steps: AssignmentStep[];
  summary: string;
}

const AssignmentSolver = ({ theme, user, isPremium, getAiInstance, fileToGenerativePart, setUserNotification, setChatHistory, setActiveTab, setActiveChatSessionId, addToFinishedHistory, finishedHistory }: any) => {
  const [images, setImages] = useState<MediaFile[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState<AssignmentSolution | null>(null);
  const [userWorkings, setUserWorkings] = useState<{
    [stepIdx: number]: {
      imagePreview?: string;
      imageFile?: File;
      analysis?: string;
      isAnalyzing?: boolean;
      transcript?: string;
    }
  }>({});
  const [expandedReplies, setExpandedReplies] = useState<{[key: number]: boolean}>({});
  const [isListening, setIsListening] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (solution && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [solution]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      setUserNotification("You can only upload up to 5 images.");
      return;
    }

    const mapped = files.map(f => ({
      id: Math.random().toString(36).substr(2, 11),
      file: f,
      preview: URL.createObjectURL(f),
      type: 'image' as const
    }));
    
    setImages(prev => [...prev, ...mapped]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleWorkingUpload = (stepIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const preview = URL.createObjectURL(file);
    setUserWorkings(prev => ({
      ...prev,
      [stepIdx]: {
        ...prev[stepIdx],
        imagePreview: preview,
        imageFile: file,
        analysis: undefined
      }
    }));

    // Auto-trigger analysis
    setTimeout(() => {
      checkWorking(stepIdx, file);
    }, 100);
  };

  const removeWorkingImage = (stepIdx: number) => {
    setUserWorkings(prev => {
      const working = prev[stepIdx];
      if (working?.imagePreview) URL.revokeObjectURL(working.imagePreview);
      const newState = { ...prev };
      delete newState[stepIdx];
      return newState;
    });
  };

  const startListening = (stepIdx: number) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUserNotification("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    setIsListening(stepIdx);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(null);
      analyzeTextWorking(stepIdx, transcript);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech Error:", e);
      setIsListening(null);
      setUserNotification("Speech recognition failed.");
    };

    recognition.start();
  };

  const analyzeTextWorking = async (stepIdx: number, text: string) => {
    setUserWorkings(prev => ({
      ...prev,
      [stepIdx]: { ...prev[stepIdx], isAnalyzing: true, transcript: text }
    }));

    try {
      const ai = getAiInstance();
      const stepData = solution?.steps[stepIdx];

      const prompt = `
        You are an expert tutor. A student is orally describing how they solved a specific step of an assignment.
        The correct step solution is: "${stepData?.step}"
        The logical explanation is: "${stepData?.explanation}"
        
        Student's oral transcription: "${text}"
        
        Analyze their explanation:
        1. Be LITERALLY accurate about what they said.
        2. Identify if their logic is fundamentally correct compared to the ideal solution.
        3. Be encouraging and supportive.
        4. Explain any conceptual errors clearly.
        5. Use LaTeX for ALL math ($...$).
        
        CRITICAL: Keep your reply very short, direct, and under 4 lines.
      `;

      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
      });

      setUserWorkings(prev => ({
        ...prev,
        [stepIdx]: { ...prev[stepIdx], isAnalyzing: false, analysis: response?.text || "" }
      }));
      setUserNotification("Working analyzed!");
    } catch (err: any) {
      console.error("Text Analysis Error:", err);
      setUserWorkings(prev => ({
        ...prev,
        [stepIdx]: { ...prev[stepIdx], isAnalyzing: false }
      }));
    }
  };

  const checkWorking = async (stepIdx: number, providedFile?: File) => {
    const working = userWorkings[stepIdx];
    const fileToUse = providedFile || working?.imageFile;
    
    if (!fileToUse) {
      setUserNotification("Please upload an image of your workings first.");
      return;
    }

    setUserWorkings(prev => ({
      ...prev,
      [stepIdx]: { ...prev[stepIdx], isAnalyzing: true }
    }));

    try {
      const ai = getAiInstance();
      const imagePart = await fileToGenerativePart(fileToUse);
      const stepData = solution?.steps[stepIdx];

      const prompt = `
        You are an expert tutor. A student is trying to solve a specific step of an assignment.
        The correct step solution is: "${stepData?.step}"
        The logical explanation is: "${stepData?.explanation}"
        
        Analyze the student's uploaded image of their working.
        1. Identify if they are correct or where they made a mistake.
        2. Be encouraging like a teacher.
        3. If there is a mistake, explain exactly where it happened and how to fix it.
        4. Use LaTeX for math.
        
        CRITICAL: Keep your reply very short, straight to the point, and under 4 lines if possible.
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }, { inlineData: imagePart.inlineData }] }
      });

      setUserWorkings(prev => ({
        ...prev,
        [stepIdx]: { ...prev[stepIdx], isAnalyzing: false, analysis: response?.text || "" }
      }));
      setUserNotification("Working analyzed!");
    } catch (err: any) {
      console.error("Check Working Error:", err);
      setUserWorkings(prev => ({
        ...prev,
        [stepIdx]: { ...prev[stepIdx], isAnalyzing: false }
      }));
      setUserNotification("Analysis failed. Try again.");
    }
  };

  const deleteAnalysis = (stepIdx: number) => {
    setUserWorkings(prev => ({
      ...prev,
      [stepIdx]: {
        ...prev[stepIdx],
        analysis: undefined
      }
    }));
  };

  const clearAll = () => {
    images.forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    setImages([]);
    setSolution(null);
  };

  const solveAssignment = async () => {
    if (images.length === 0) {
      setUserNotification("Please upload images of your assignment first.");
      return;
    }

    setIsSolving(true);
    setSolution(null);

    try {
      const ai = getAiInstance();
      const imageParts = await Promise.all(images.map(img => fileToGenerativePart(img.file)));

      const prompt = `
        You are an expert academic tutor. Analyze these assignment images.
        Solve the problems step-by-step with clear, educational explanations.
        
        CRITICAL: Use LaTeX for ALL mathematical expressions, variables, and formulas.
        - Use $ ... $ for inline math (e.g., $x^2 + y = 10$).
        - Use $$ ... $$ for large multi-line equations or important formulas.
        - Never leave raw symbols like ^ or _ outside of LaTeX delimiters.
        
        Return ONLY a JSON object:
        {
          "title": "Unified Problem Title",
          "steps": [
            { "step": "Clear calculation/step using LaTeX", "explanation": "Why this was done using LaTeX" }
          ],
          "summary": "Final concise answer using LaTeX"
        }
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }, ...imageParts.map(p => ({ inlineData: p.inlineData }))] },
        config: { responseMimeType: "application/json" }
      });
      
      const responseText = response?.text || "";
      
      try {
        // Clean markdown backticks before parsing if they exist
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```(?:json)?\n?|```$/g, '').trim();
        }
        
        const data = JSON.parse(cleanedText);
        
        // Robustness: ensure steps exists
        if (!data.steps || !Array.isArray(data.steps)) {
          console.warn("AI returned missing or invalid steps array, attempting to recover...");
          data.steps = [{ 
            step: data.solution || data.answer || "Calculation complete", 
            explanation: data.reasoning || data.logic || "Derived from assignment image analysis." 
          }];
        }
        
        setSolution(data);
        addToFinishedHistory({
          id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: data.title || "Assignment Solution",
          type: 'assignment',
          date: new Date().toLocaleDateString(),
          data: data
        });
        setUserNotification("Step-by-step solution generated!");
      } catch (parseError) {
        console.error("Primary JSON parse failed, trying regex match:", parseError);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            if (!data.steps || !Array.isArray(data.steps)) {
              data.steps = [{ 
                step: data.solution || data.answer || "Calculation complete", 
                explanation: data.reasoning || data.logic || "Derived from assignment image analysis." 
              }];
            }
            setSolution(data);
            addToFinishedHistory({
              id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              title: data.title || "Assignment Solution",
              type: 'assignment',
              date: new Date().toLocaleDateString(),
              data: data
            });
            setUserNotification("Step-by-step solution generated!");
          } catch (e) {
            console.error("Secondary JSON parse failed:", e);
            throw new Error(`Invalid AI response structure. Please try again with a clearer image.`);
          }
        } else {
          throw new Error("Could not extract a valid JSON solution from the AI response.");
        }
      }
    } catch (err: any) {
      console.error("Assignment Solve Error:", err);
      setUserNotification(err.message || "Failed to solve assignment. Please try again.");
    } finally {
      setIsSolving(false);
    }
  };

  const speakSolution = () => {
    if (!solution) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `Solution for ${solution.title}. ` + 
      solution.steps.map((s, i) => `Step ${i + 1}: ${s.step}. ${s.explanation}`).join('. ') + 
      `. Summary: ${solution.summary}`;

    const utterance = new SpeechSynthesisUtterance(text.replace(/\$/g, ''));
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const sendToOmni = () => {
    if (!solution) return;
    const formatted = `### ${solution.title}\n\n` + 
      solution.steps.map((s, i) => `**Step ${i + 1}**: ${s.step}\n*${s.explanation}*`).join('\n\n') +
      `\n\n**Final Result**: ${solution.summary}`;

    setChatHistory((prev: any) => [...prev, 
      { role: 'user', text: "Deep dive into this solution.", timestamp: new Date().toLocaleTimeString() },
      { role: 'model', text: formatted, timestamp: new Date().toLocaleTimeString() }
    ]);
    setActiveTab('ai');
    setActiveChatSessionId(null);
    setUserNotification("Exported to Omni Chat!");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 pb-20">
      <div className={`p-10 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} shadow-sm text-center relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4">
          {images.length > 0 && (
            <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="w-16 h-16 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen size={32} className="text-[#DC2626]" />
        </div>
        <h2 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Assignment Solver</h2>
        
        {/* RECENT ASSIGNMENTS HISTORY - COMPACT */}
        {finishedHistory.filter(i => i.type === 'assignment').length > 0 && (
          <div className="mb-6 -mx-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#DC2626] mb-3 px-2">Recently Solved</p>
            <div className="flex gap-3 overflow-x-auto pb-2 px-2 no-scrollbar">
              {finishedHistory.filter(i => i.type === 'assignment').slice(0, 10).map(item => (
                <button
                  key={item.id}
                  onClick={() => setSolution(item.data)}
                  className="flex-shrink-0 w-32 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#DC2626]/40 transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <History size={10} className="text-[#DC2626]" />
                    <span className="text-[8px] font-black uppercase text-white/40 truncate">{item.date}</span>
                  </div>
                  <p className="text-[10px] font-bold text-white/80 line-clamp-1 group-hover:text-white transition-colors">{item.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} mt-1 mb-8`}>Upload up to 5 images for detailed academic solutions.</p>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 justify-center">
            <AnimatePresence>
              {images.map(img => (
                <motion.div key={img.id} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="relative group">
                  <img src={img.preview} className={`w-24 h-24 object-cover rounded-2xl border-2 ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'} shadow-xl`} />
                  <button onClick={() => removeImage(img.id)} className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {images.length < 5 && (
              <label className={`w-24 h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${theme === 'dark' ? 'border-white/10 text-white/20 hover:border-[#DC2626]/40 hover:text-[#DC2626]' : 'border-slate-200 text-slate-300 hover:border-[#DC2626]/40 hover:text-[#DC2626]'}`}>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                <Plus size={28} />
                <span className="text-[9px] font-black uppercase mt-1">Upload</span>
              </label>
            )}
          </div>

          <button
            onClick={solveAssignment}
            disabled={isSolving || images.length === 0}
            className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
          >
            {isSolving ? <><RefreshCcw size={18} className="animate-spin" /> Analyzing...</> : <><Sparkles size={18} /> Solve Assignment</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {solution && (
          <motion.div 
            ref={resultsRef}
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="space-y-6 pt-10"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
                <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {solution.title || "Calculated Solution"}
                </h3>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={speakSolution} 
                  title={isSpeaking ? "Stop Voice" : "Listen to solution"}
                  className={`p-3 rounded-2xl border transition-all ${isSpeaking ? 'bg-[#DC2626] border-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20' : `${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10 text-white/40' : 'bg-white border-slate-200 text-slate-400'} hover:border-[#DC2626] hover:text-[#DC2626]`}`}
                >
                  {isSpeaking ? <Square size={20} fill="currentColor" /> : <Volume2 size={20} />}
                </button>
                <button 
                  onClick={sendToOmni} 
                  title="Send to Omni Chat"
                  className={`p-3 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10 text-white/40' : 'bg-white border-slate-200 text-slate-400'} hover:border-[#DC2626] hover:text-[#DC2626]`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {solution.steps?.map((step, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: idx * 0.1 }}
                  className={`p-5 sm:p-6 rounded-[2rem] border relative overflow-hidden group transition-all duration-300 ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10 hover:border-[#DC2626]/30' : 'bg-white border-slate-100 hover:border-[#DC2626]/30 shadow-md shadow-black/5'}`}
                >
                  <div className={`absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    <span className="text-9xl font-black italic">{idx + 1}</span>
                  </div>
                  <div className="flex gap-5 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-lg shadow-[#DC2626]/20">
                      {idx + 1}
                    </div>
                    <div className="space-y-4 pt-1 flex-1 min-w-0">
                      <div>
                        <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-[0.3em] mb-2 opacity-80">Step Solution</p>
                        <MarkdownRenderer content={step.step} className={`text-lg font-black leading-snug ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} />
                      </div>
                      <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${theme === 'dark' ? 'text-[#DC2626]' : 'text-[#DC2626]'}`}>The Logical Why</p>
                        <MarkdownRenderer content={step.explanation} className={`text-[13px] leading-relaxed font-medium ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`} />
                      </div>

                      {/* STUDENT INTERACTION - COMPACT */}
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500/80">Student Workings</p>
                          <div className="flex gap-2">
                             <label className="p-1.5 cursor-pointer bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all border border-blue-500/20 shadow-sm shadow-blue-500/10">
                               <input type="file" accept="image/*" onChange={(e) => handleWorkingUpload(idx, e)} className="hidden" />
                               <ImageIcon size={12} />
                             </label>
                             <button 
                               onClick={() => startListening(idx)}
                               className={`p-1.5 rounded-lg border transition-all ${isListening === idx ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse' : 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-sm shadow-purple-500/10'}`}
                             >
                                <Mic size={12} />
                             </button>
                             <button 
                               onClick={() => checkWorking(idx)}
                               disabled={!userWorkings[idx]?.imageFile || userWorkings[idx]?.isAnalyzing}
                               className={`p-1.5 rounded-lg border transition-all ${userWorkings[idx]?.imageFile ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-sm shadow-green-500/10' : 'bg-white/5 text-white/20 border-white/5'}`}
                             >
                                <Brain size={12} />
                             </button>
                          </div>
                        </div>

                        {userWorkings[idx]?.imagePreview && (
                          <div className="flex items-start gap-3">
                             <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 group/working-img">
                                <img src={userWorkings[idx].imagePreview} className="w-full h-full object-cover" />
                                {userWorkings[idx].isAnalyzing && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                     <RefreshCcw size={14} className="text-white animate-spin" />
                                  </div>
                                )}
                                <button 
                                  onClick={() => removeWorkingImage(idx)}
                                  className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover/working-img:opacity-100 transition-opacity z-10"
                                  title="Remove image"
                                >
                                  <X size={10} />
                                </button>
                             </div>
                             {(userWorkings[idx]?.analysis || userWorkings[idx]?.transcript) && (
                               <div className="flex-1 p-3 bg-white/5 rounded-xl border border-white/10 space-y-2 relative group min-w-0">
                                 {userWorkings[idx]?.analysis && (
                                   <button 
                                     onClick={() => deleteAnalysis(idx)}
                                     className="absolute top-2 right-2 p-1 text-white/40 hover:text-red-500 transition-colors opacity-30 group-hover:opacity-100 z-20"
                                     title="Delete feedback"
                                   >
                                     <Trash2 size={12} />
                                   </button>
                                 )}
                                 {userWorkings[idx]?.transcript && (
                                   <div className="flex items-center gap-2 mb-1 opacity-50 shrink-0">
                                      <Mic size={10} />
                                      <p className="text-[8px] font-bold italic truncate">"{userWorkings[idx].transcript}"</p>
                                   </div>
                                 )}
                                 {userWorkings[idx].analysis && (
                                   <>
                                     <div className={`${!expandedReplies[idx] ? 'max-h-[100px] overflow-y-auto' : ''} transition-all duration-300 relative custom-scrollbar`}>
                                       <MarkdownRenderer content={userWorkings[idx].analysis} className="text-[11px] leading-relaxed text-white/70" />
                                       {!expandedReplies[idx] && userWorkings[idx].analysis.length > 150 && (
                                         <div className="sticky bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#0A0F1C] to-transparent pointer-events-none" />
                                       )}
                                     </div>
                                     {userWorkings[idx].analysis.length > 150 && (
                                       <button 
                                         onClick={() => setExpandedReplies(prev => ({...prev, [idx]: !prev[idx]}))}
                                         className="text-[9px] font-black uppercase text-blue-500 mt-2 hover:underline inline-block shrink-0"
                                       >
                                         {expandedReplies[idx] ? 'See Part' : 'See All'}
                                       </button>
                                     )}
                                   </>
                                 )}
                               </div>
                             )}
                          </div>
                        )}
                        {userWorkings[idx]?.transcript && !userWorkings[idx]?.imagePreview && (
                           <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2 relative group">
                              {userWorkings[idx]?.analysis && (
                                <button 
                                  onClick={() => deleteAnalysis(idx)}
                                  className="absolute top-2 right-2 p-1 text-white/40 hover:text-red-500 transition-colors opacity-30 group-hover:opacity-100 z-20"
                                  title="Delete feedback"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              <div className="flex items-center gap-2 mb-1 opacity-50 shrink-0">
                                 <Mic size={10} />
                                 <p className="text-[8px] font-bold italic truncate">"{userWorkings[idx].transcript}"</p>
                              </div>
                              {userWorkings[idx].analysis && (
                                <>
                                  <div className={`${!expandedReplies[idx] ? 'max-h-[100px] overflow-y-auto' : ''} transition-all duration-300 relative custom-scrollbar`}>
                                    <MarkdownRenderer content={userWorkings[idx].analysis} className="text-[11px] leading-relaxed text-white/70" />
                                    {!expandedReplies[idx] && userWorkings[idx].analysis.length > 150 && (
                                      <div className="sticky bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#0A0F1C] to-transparent pointer-events-none" />
                                    )}
                                  </div>
                                  {userWorkings[idx].analysis.length > 150 && (
                                    <button 
                                      onClick={() => setExpandedReplies(prev => ({...prev, [idx]: !prev[idx]}))}
                                      className="text-[9px] font-black uppercase text-blue-500 mt-2 hover:underline inline-block shrink-0"
                                    >
                                      {expandedReplies[idx] ? 'See Part' : 'See All'}
                                    </button>
                                  )}
                                </>
                              )}
                           </div>
                        )}
                        {!userWorkings[idx]?.imagePreview && !userWorkings[idx]?.transcript && (
                          <p className="text-[8px] text-white/20 italic">"Ok Student, let me see your solvings for this step..."</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className={`p-6 sm:p-8 rounded-[2.5rem] border text-center shadow-2xl relative overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-br from-[#DC2626]/20 via-[#0A0F1C] to-transparent border-[#DC2626]/30 shadow-[#DC2626]/10' : 'bg-gradient-to-br from-[#DC2626]/5 via-white to-transparent border-[#DC2626]/20'}`}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#DC2626] to-transparent opacity-30" />
                <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-[0.5em] mb-4">Final Concensus</p>
                <div className="relative inline-block">
                  <MarkdownRenderer content={solution.summary} className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} />
                  <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#DC2626]/20 rounded-full blur-sm" />
                </div>
              </motion.div>
            </div>
            
            <div className="flex justify-center pb-10">
              <button 
                onClick={clearAll} 
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/40 hover:text-red-500' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-red-500'}`}
              >
                <Trash2 size={16} /> Clear Results & Start Over
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface HomeHistoryItem {
  id: string;
  title: string;
  type: 'quiz' | 'recording' | 'exam' | 'assignment';
  progress?: number;
  date?: string;
  score?: number;
  total?: number;
  data?: any; // To store solution or other relevant metadata
}

export default function App() {
  // --- \u{1F510} AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- CUSTOM CONFIRM MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "Confirm", isDanger = false) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      confirmText,
      isDanger
    });
  };
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    displayName: '',
    fullName: '',
    matricNumber: '',
    dob: '',
    university: '',
    level: '',
    department: '',
    faculty: ''
  });
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [examIdInput, setExamIdInput] = useState('');
  const [activeExamHostUid, setActiveExamHostUid] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [clearConfirmStep, setClearConfirmStep] = useState(0);
  const [isHostPaid, setIsHostPaid] = useState(false);
  const [isTakingPaid, setIsTakingPaid] = useState(false);
  const [hostExamId, setHostExamId] = useState<string | null>(null);

  // --- \u{1F4F1} APP STATE ---
  const [activeTab, setActiveTab] = useState<'home' | 'ai' | 'tools' | 'profile' | 'notifications' | 'exam'>(() => {
    return (localStorage.getItem('nsg_active_tab') as any) || 'home';
  });
  
  useEffect(() => {
    localStorage.setItem('nsg_active_tab', activeTab);
  }, [activeTab]);

  const [toolsSubTab, setToolsSubTab] = useState<'menu' | 'record' | 'live' | 'quiz' | 'exam' | 'faculty' | 'assignment' | 'courses' | 'td'>(() => {
    return (localStorage.getItem('nsg_tools_subtab') as any) || 'menu';
  });

  useEffect(() => {
    localStorage.setItem('nsg_tools_subtab', toolsSubTab);
  }, [toolsSubTab]);
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  // Load read articles from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nsg_read_articles');
      if (saved) setReadArticles(JSON.parse(saved));
    } catch (e) {
      console.warn("Failed to parse read articles from storage:", e);
    }
  }, []);

  const markArticleAsRead = (id: string) => {
    if (!readArticles.includes(id)) {
      const newRead = [...readArticles, id];
      setReadArticles(newRead);
      localStorage.setItem('nsg_read_articles', JSON.stringify(newRead));
    }
  };

  const unreadCount = blogPosts.filter(post => !readArticles.includes(post.id)).length;
  const [libraryView, setLibraryView] = useState<'history' | 'library'>('history');
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
  const [legalPage, setLegalPage] = useState<'about' | 'terms' | 'contact' | 'privacy' | null>(null);
  const [theme, setTheme] = useState<'dark'>('dark');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userNotification, setUserNotification] = useState<string | null>(null);
  const [adminNotification, setAdminNotification] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [finishedHistory, setFinishedHistory] = useState<HomeHistoryItem[]>([]);

  // Load finished history from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nsg_finished_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const unique = parsed.filter((item: any, index: number) => 
            parsed.findIndex((i: any) => i.id === item.id) === index
          );
          setFinishedHistory(unique);
        }
      }
    } catch (e) {
      console.warn("Failed to parse history from storage:", e);
    }
  }, []);

  const addToFinishedHistory = async (item: HomeHistoryItem) => {
    // Keep local for immediate feedback
    setFinishedHistory(prev => {
      const newHistory = [item, ...prev].filter((i, idx, self) => self.findIndex(t => t.id === i.id) === idx).slice(0, 50);
      localStorage.setItem('nsg_finished_history', JSON.stringify(newHistory));
      return newHistory;
    });

    // Sync with Firestore
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'studyHistory', item.id), item);
      } catch (err) {
        console.error("History Sync Error:", err);
      }
    }
  };

  const removeFromHistory = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      "Delete from History",
      "Are you sure you want to remove this from your study history? This action cannot be undone.",
      async () => {
        setFinishedHistory(prev => {
          const newHistory = prev.filter(item => item.id !== id);
          localStorage.setItem('nsg_finished_history', JSON.stringify(newHistory));
          return newHistory;
        });
        
        if (user) {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'studyHistory', id));
          } catch (err) {
            console.error("History Delete Sync Error:", err);
          }
        }
        setUserNotification("Item removed from history.");
      },
      "Remove",
      true
    );
  };

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
      const isCurrentlySubscribed = currentUserData.premiumUntil ? new Date(currentUserData.premiumUntil).getTime() > new Date().getTime() : false;
      const isGod = currentUserData.bypassAllPayments || currentUserData.bypassTakingPayment || currentUserData.bypassHostingPayment;
      const effectivePremium = currentUserData.isPremium || currentUserData.role === 'admin' || currentUserData.bypassAllPayments || isCurrentlySubscribed || currentUserData.subscribed === true || isGod;

      if (effectivePremium || currentUserData.bypassTakingPayment) {
        setIsTakingPaid(true);
      } else {
        setIsTakingPaid(false);
      }
      
      if (effectivePremium || currentUserData.bypassHostingPayment) {
        setIsHostPaid(true);
      } else {
        setIsHostPaid(false);
      }

      // Premium logic
      if (effectivePremium) {
        setIsPremium(true);
        if (currentUserData.bypassAllPayments || isGod) {
          setPremiumTimeLeft("GOD MODE ACTIVE");
        } else if (currentUserData.role === 'admin') {
          setPremiumTimeLeft("ADMIN ACCESS");
        } else if (currentUserData.subscribed === true && !currentUserData.premiumUntil) {
           setPremiumTimeLeft("ACTIVE");
        } else if (currentUserData.premiumUntil) {
          const until = new Date(currentUserData.premiumUntil).getTime();
          const updateTimer = () => {
            const diff = until - new Date().getTime();
            if (diff <= 0) {
              // Only clear if other premium flags are false
              if (!(currentUserData.isPremium || currentUserData.role === 'admin' || currentUserData.bypassAllPayments || currentUserData.subscribed === true || isGod)) {
                setIsPremium(false);
                setPremiumTimeLeft("");
              }
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
          setPremiumTimeLeft("ACTIVE");
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
      }, (err) => console.error("God Mode User Sync Error:", err));
      return () => unsubscribe();
    }
  }, [showGodMode, user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'blogPosts'), orderBy('timestamp', 'desc')), (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBlogPosts(posts);
    }, (err) => console.error("Blog Posts Sync Error:", err));
    return () => unsubscribe();
  }, []);

  // --- NOTIFICATION PERMISSIONS ---
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // --- LISTEN FOR GLOBAL NOTIFICATIONS ---
  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Avoid notifying old ones (simple check with timestamp)
          if (data.timestamp && (Date.now() - data.timestamp.toMillis() < 10000)) {
            if (Notification.permission === 'granted') {
              try {
                new Notification(data.title, {
                  body: data.message,
                  icon: '/icon.svg'
                });
              } catch (e) {
                console.error("Notification error:", e);
              }
            }
          }
        }
      });
    }, (err) => console.error("Notifications Listener Error:", err));
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
      
      // Also send a global notification
      await addDoc(collection(db, 'notifications'), {
        title: "News Update Published!",
        message: newPost.title.trim(),
        timestamp: serverTimestamp(),
        type: 'blog'
      });

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
    showConfirm(
      "Delete Post",
      "Are you sure you want to delete this post?",
      async () => {
        try {
          await deleteDoc(doc(db, 'blogPosts', id));
          setGodModeNotification("Post deleted.");
          setTimeout(() => setGodModeNotification(null), 3000);
        } catch (error) {
          console.error("Error deleting post:", error);
        }
      },
      "Delete",
      true
    );
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
        dob: editingUser.dob || '',
        university: editingUser.university || '',
        level: editingUser.level || '',
        department: editingUser.department || '',
        faculty: editingUser.faculty || ''
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
  const [transcriptionNotes, setTranscriptionNotes] = useState('');
  const [isAnalysingAudio, setIsAnalysingAudio] = useState(false); // For full analysis after stop
  const [isTranscribing, setIsTranscribing] = useState(false); // For live chunks
  const [showPremiumTrial, setShowPremiumTrial] = useState(false); // New Premium Trial Modal
  const [hasShownTrialThisSession, setHasShownTrialThisSession] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processorQueue = useRef<Promise<void>>(Promise.resolve());
  const isStopRequested = useRef(false);
  // We'll use audioChunksRef directly for full accumulated transcription
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRecordingSessionIdRef = useRef<string | null>(null);

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline Sync for Recordings
  useEffect(() => {
    if (isOnline && user) {
      const syncOfflineRecordings = async () => {
        const offlineData = localStorage.getItem('nsg_offline_recordings');
        if (offlineData) {
          const recordings = JSON.parse(offlineData);
          if (recordings.length > 0) {
            setUserNotification(`Syncing ${recordings.length} offline recordings...`);
            for (const rec of recordings) {
              try {
                await addDoc(collection(db, 'users', user.uid, 'lectureSessions'), rec);
              } catch (err) {
                console.error("Sync Error:", err);
              }
            }
            localStorage.setItem('nsg_offline_recordings', '[]');
            setUserNotification("Offline recordings synced successfully!");
          }
        }
      };
      syncOfflineRecordings();
    }
  }, [isOnline, user]);

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
  const [userQuizAnswers, setUserQuizAnswers] = useState<number[]>([]);

  // Helper to get unfinished items
  const unfinishedQuizzes: HomeHistoryItem[] = quizQuestions.length > 0 && quizState === 'active' ? [{ id: 'current-quiz', title: quizTopic || 'Ongoing Quiz', type: 'quiz', progress: Math.round(((currentQuestionIndex + 1) / quizQuestions.length) * 100) }] : [];
  const recordingsHistory: HomeHistoryItem[] = sessions.map(s => ({ 
    id: s.id, 
    title: s.title, 
    type: 'recording', 
    date: s.date,
    progress: s.fullAnalysis ? 100 : 0
  }));
  const homeHistoryFull = [...unfinishedQuizzes, ...recordingsHistory, ...finishedHistory];
  const homeHistory = homeHistoryFull.filter((item, index, self) => 
    self.findIndex(i => i.id === item.id) === index
  ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 50);

  const [matricNumber, setMatricNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [examLobbyState, setExamLobbyState] = useState<'login' | 'briefing' | 'exam' | 'result' | 'review'>('login');
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examTimer, setExamTimer] = useState(3600); // 1 hour default
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [currentExamIndex, setCurrentExamIndex] = useState(0);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- \u{1F6E0}\u{FE0F} ADMIN STATE ---
  const [examStatus, setExamStatus] = useState<'active' | 'ended' | 'none'>('none');
  const [adminMode, setAdminMode] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [templateEditForm, setTemplateEditForm] = useState<any | null>(null);

  // Load email templates
  useEffect(() => {
    if (isAdminUser) {
      const unsub = onSnapshot(collection(db, 'email_templates'), (snap) => {
        const templates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEmailTemplates(templates);
      }, (error) => {
        handleFirestoreError(error, FirestoreOperation.LIST, 'email_templates');
      });
      return () => unsub();
    }
  }, [isAdminUser]);

  const initMarketingTemplates = async () => {
    try {
      const templates = [
        { 
          name: "Faculty Specials Promo",
          subject: "Master your exams with Faculty Specials!",
          body: "Hi ${name},\n\nHave you tried our Faculty Specials yet? \n\nWhether you are a business student needing the Financial Auditor to perfect your spreadsheets, or a language student using our new Diagnostics Tool (with a 300-word deep-audit limit!), NSG has something picked just for you.\n\nTry it now: https://nuellstudyguide.name.ng\n\nBest,\nABRAHAM EMMANUEL PROSPER",
          active: true,
          updatedAt: serverTimestamp()
        },
        {
          name: "Recording Engine Power",
          subject: "Never miss a lecture detail again!",
          body: "Hi ${name},\n\nOur Recording Engine is built for efficiency. Record your lectures and sync them with photos of the whiteboard to generate cohesive, structured notes.\n\nStop taking manual notes and start capturing the logic!\n\nUpgrade to Premium for unlimited storage.\n\nBest,\nABRAHAM EMMANUEL PROSPER",
          active: true,
          updatedAt: serverTimestamp()
        },
        {
          name: "Smart Quiz Challenge",
          subject: "Ready for a Smart Quiz?",
          body: "Hi ${name},\n\nConsistent practice is the key to memory. Use our Smart Quiz tool to generate questions on any topic. From Easy to Hard difficulty, challenge yourself today!\n\nCheck it out: https://nuellstudyguide.name.ng\n\nBest,\nABRAHAM EMMANUEL PROSPER",
          active: true,
          updatedAt: serverTimestamp()
        }
      ];

      for (const t of templates) {
        const exists = emailTemplates.find(et => et.name === t.name);
        if (!exists) {
          await addDoc(collection(db, 'email_templates'), t);
        }
      }
      setUserNotification("Default marketing templates initialized!");
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.CREATE, 'email_templates');
      setUserNotification("Error initializing templates.");
    }
  };

  const triggerMarketingBlast = async () => {
    if (!templateEditForm?.id) {
      setUserNotification("Please select a saved template first!");
      return;
    }

    try {
      setUserNotification(`Blasting "${templateEditForm.name}" to all users...`);
      const res = await axios.post('/api/admin/trigger-broadcast', { 
        secret: 'GOD_MODE',
        templateId: templateEditForm.id 
      }); 
      if (res.data.success) {
        setUserNotification(`Marketing blast successful! Sent to ${res.data.count} users.`);
      } else {
        setUserNotification(`Blast failed: ${res.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      setUserNotification("Server error triggering blast.");
    }
  };

  const handleSaveEmailTemplate = async (template: any) => {
    try {
      const { id, ...data } = template;
      if (id) {
        await updateDoc(doc(db, 'email_templates', id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'email_templates'), { ...data, updatedAt: serverTimestamp() });
      }
      setUserNotification("Template saved.");
    } catch (err) {
      console.error("Save Template Error:", err);
      handleFirestoreError(err, FirestoreOperation.WRITE, `email_templates/${template.id || 'new'}`);
      setUserNotification("Error saving template. Check console for details.");
    }
  };

  const deleteEmailTemplate = async (id: string) => {
    if (confirm("Delete this template?")) {
      await deleteDoc(doc(db, 'email_templates', id));
      setUserNotification("Template deleted.");
    }
  };
  const [adminQuestionsRaw, setAdminQuestionsRaw] = useState('');
  const [scoreSheet, setScoreSheet] = useState<StudentResult[]>([]);
  const [isGeneratingAdminQuestions, setIsGeneratingAdminQuestions] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const initialExamConfig: ExamConfig = {
    questionCount: 25,
    duration: 60,
    price: 2000,
    poolCount: 50
  };
  const [examConfig, setExamConfig] = useState<ExamConfig>(initialExamConfig);
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

      // Send Thank You Email
      try {
        await axios.post('/api/send-premium-thank-you', {
          email: user.email,
          name: currentUserData?.fullName || user.displayName || 'Student'
        });
      } catch (err) {
        console.error("Failed to send thank you email:", err);
      }

      // Clear persistence after success
      localStorage.removeItem('nsg_pending_payment_ref');
      localStorage.removeItem('nsg_pending_payment_plan');
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
    onSuccess: (response: any) => {
      // Save reference before processing just in case of reload
      localStorage.setItem('nsg_pending_payment_ref', response.reference);
      localStorage.setItem('nsg_pending_payment_plan', 'monthly');
      
      // We'll let the verify-payment effect handle it automatically
      // to ensure consistency across reloads
    },
    onClose: () => setUserNotification("Payment cancelled.")
  };

  const configYearly = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "user@example.com",
    amount: 3600 * 100, // 3600 Naira
    publicKey: PAYSTACK_PUBLIC_KEY,
    onSuccess: (response: any) => {
      localStorage.setItem('nsg_pending_payment_ref', response.reference);
      localStorage.setItem('nsg_pending_payment_plan', 'yearly');
      
      // We'll let the verify-payment effect handle it automatically
    },
    onClose: () => setUserNotification("Payment cancelled.")
  };

  const initializeMonthly = usePaystackPayment(configMonthly);
  const initializeYearly = usePaystackPayment(configYearly);

  // --- \u{1F480} LOGGED OUT LANDING ---
  const LoggedOutLanding = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#0A0F1C] overflow-hidden flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#DC2626] rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
        className="z-10 space-y-6 max-w-lg"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#DC2626] rounded-2xl flex items-center justify-center shadow-2xl shadow-[#DC2626]/40 rotate-6">
            <Brain size={32} className="text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
            NSG <span className="text-[#DC2626]">OMNI</span>
          </h1>
          <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Lecture Analysis OS 4.0</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Your Academic Edge, <span className="text-[#DC2626]">Powered by AI.</span></h2>
          <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
            Experience the future of learning. Record lectures, generate instant study notes, and master your courses with personalized AI assistance. 
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button 
            onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black rounded-xl text-[10px] shadow-xl shadow-[#DC2626]/30 transition-all uppercase tracking-widest"
          >
            Create Your Account
          </button>
          <button 
            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 border border-white/10 text-white font-black rounded-xl text-[10px] hover:bg-white/10 transition-all uppercase tracking-widest"
          >
            Sign In
          </button>
        </div>

        <div className="pt-12 text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">
          \u00A9 2026 Nuell Graphics & NSG Studios
        </div>
      </motion.div>
    </motion.div>
  );

  // --- ðŸŒŸ PREMIUM ONBOARDING (MODAL STYLE) ---
  const AnalysisLoadingOverlay = () => (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-[#0A0F1C]/90 backdrop-blur-xl"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="relative inline-block">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-[#DC2626]/30"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain size={40} className="text-[#DC2626] animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Analyzing Lecture</h2>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Omni AI is processing your content...</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
              <p className="text-[10px] text-[#DC2626] font-black uppercase tracking-widest animate-pulse">Wait a few seconds. Do not close.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const PremiumOnboarding = () => (
    <AnimatePresence>
      {showPremiumTrial && user && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-6 sm:p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden shadow-yellow-500/10`}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
            <button onClick={() => setShowPremiumTrial(false)} className="absolute top-4 right-4 text-white/40 hover:text-yellow-500 transition-colors"><XCircle size={24} /></button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-yellow-500" />
              </div>
              <h2 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">Unlock <span className="text-yellow-500">Premium</span></h2>
              <p className="text-xs text-white/40 mt-2">Elevate your study experience with Omni AI</p>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm text-white/70 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-2 bg-yellow-500/20 rounded-lg"><Cpu size={16} className="text-yellow-500" /></div>
                <span>Gemini 3.1 Pro Access</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-2 bg-yellow-500/20 rounded-lg"><Zap size={16} className="text-yellow-500" /></div>
                <span>Unlimited Transcriptions</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-2 bg-yellow-500/20 rounded-lg"><ShieldCheck size={16} className="text-yellow-500" /></div>
                <span>Priority Support & Features</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => initializeMonthly({ onSuccess: () => handleSubscriptionSuccess('monthly'), onClose: () => setUserNotification("Payment cancelled.") })}
                className={`${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-100 border-zinc-200'} border p-4 rounded-2xl hover:border-yellow-500/50 transition-all text-center group`}
              >
                <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/40' : 'text-zinc-400'} uppercase mb-1`}>Monthly</p>
                <p className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>N300</p>
                <p className="text-[8px] font-bold text-yellow-500 uppercase mt-1">Basic Access</p>
              </button>
              <button 
                onClick={() => initializeYearly({ onSuccess: () => handleSubscriptionSuccess('yearly'), onClose: () => setUserNotification("Payment cancelled.") })}
                className="bg-yellow-500 text-black p-4 rounded-2xl hover:bg-yellow-400 transition-all text-center group shadow-xl shadow-yellow-500/20"
              >
                <p className="text-[10px] font-black text-black/40 uppercase mb-1">Yearly</p>
                <p className="text-xl font-black text-black">N3,600</p>
                <p className="text-[8px] font-bold text-black/60 uppercase mt-1">Best Value</p>
              </button>
            </div>

            <button 
              onClick={() => setShowPremiumTrial(false)}
              className="w-full mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-all text-center"
            >
              Continue with Free Tier
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const PremiumModal = () => (
    <AnimatePresence>
      {showPremiumModal && user && (
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
    if (!user) return;
    
    const verifyPendingPayment = async () => {
      const ref = localStorage.getItem('nsg_pending_payment_ref');
      const plan = localStorage.getItem('nsg_pending_payment_plan');
      
      if (ref) {
        try {
          setUserNotification("Verifying pending payment...");
          const response = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref, uid: user.uid, plan: plan })
          });
          const data = await response.json();
          
          if (data.status === 'success') {
            setUserNotification(`Payment confirmed! Premium active.`);
            localStorage.removeItem('nsg_pending_payment_ref');
            localStorage.removeItem('nsg_pending_payment_plan');
          } else {
            // Payment failed or is still pending on Paystack's end
            console.log("Payment verification failed or pending:", data);
          }
        } catch (err) {
          console.error("Payment verification error:", err);
        }
      }
    };
    
    verifyPendingPayment();
  }, [user]);

  const userUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log("App Initialized. Checking API Keys...");
    console.log("Gemini Key Found:", !!getApiKey());
    console.log("HF Key Found:", !!getHfKey());

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Clear any existing snapshot listener
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
        userUnsubscribeRef.current = null;
      }

      setUser(currentUser);
      
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        userUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userData = { id: docSnap.id, ...data };
            setCurrentUserData(userData);
            setIsAdminUser(data.role === 'admin' || currentUser.email === "nuellkelechi@gmail.com");
            
            const premiumUntilDate = data.premiumUntil ? new Date(data.premiumUntil) : null;
            const isCurrentlySubscribed = premiumUntilDate ? premiumUntilDate > new Date() : false;
            const userIsPremium = data.isPremium || data.bypassAllPayments || data.role === 'admin' || isCurrentlySubscribed || data.subscribed === true;
            setIsPremium(userIsPremium);
            
            if (!userIsPremium && !hasShownTrialThisSession) {
              setShowPremiumTrial(true);
              setHasShownTrialThisSession(true);
            }
            
            setProfileFormData(prev => ({
              displayName: data.displayName || prev.displayName || '',
              fullName: data.fullName || prev.fullName || '',
              matricNumber: data.matricNumber || prev.matricNumber || '',
              dob: data.dob || prev.dob || '',
              university: data.university || prev.university || '',
              level: data.level || prev.level || '',
              department: data.department || prev.department || '',
              faculty: data.faculty || prev.faculty || ''
            }));
            
            if (data.status === 'deleted') {
              if (currentUser.email === "nuellkelechi@gmail.com") {
                updateDoc(userDocRef, { status: 'active' });
              } else {
                signOut(auth);
                setUserNotification("Your account has been deactivated.");
              }
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
      } else {
        setIsAdminUser(false);
        setCurrentUserData(null);
        setShowPremiumTrial(false);
        setShowPremiumModal(false);
        setIsAuthLoading(false);
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
      setActiveTab('tools');
      setToolsSubTab('exam');
      loadSharedExam(examId);
    }

    // Local UI persistence
    // Theme persists to dark
    setTheme('dark');

    const savedAdminMode = localStorage.getItem('nsg_admin_mode');
    if (savedAdminMode === 'true') setAdminMode(true);

    // Load hosted exam state if exists
    const savedHostExamId = localStorage.getItem('nsg_host_exam_id');
    if (savedHostExamId && user) {
      // Fetch latest data from Firestore for persistence and ownership check
      const fetchExamData = async () => {
        try {
          const examDoc = await getDoc(doc(db, 'exams', savedHostExamId));
          if (examDoc.exists()) {
            const data = examDoc.data();
            // Critical Ownership Check: Only the host can restore this session state
            if (data.hostUid === user.uid) {
              setHostExamId(savedHostExamId);
              setIsHostPaid(true);
              setExamConfig(data.config || initialExamConfig);
              setRegisteredStudents(data.registeredStudents || []);
              setExamQuestions(data.questions || []);
              setExamStatus(data.status || 'active');
            } else {
              console.warn("Stale host exam session belonging to another user. Clearing local state.");
              localStorage.removeItem('nsg_host_exam_id');
              setHostExamId('');
              setIsHostPaid(false);
            }
          }
        } catch (err) {
          console.error("Error fetching hosted exam:", err);
        }
      };
      fetchExamData();
    }

    const hasSeenWelcome = localStorage.getItem('nsg_welcome_seen');
    if (!hasSeenWelcome) setShowWelcome(true);

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Auto-sync Exam Config to Firestore
  useEffect(() => {
    if (hostExamId && isHostPaid && user) {
      const syncConfig = async () => {
        if (!user || !hostExamId) return;
        try {
          // Verify ownership in code as well
          const examDoc = await getDoc(doc(db, 'exams', hostExamId));
          if (examDoc.exists()) {
             if (examDoc.data().hostUid !== user.uid) {
               console.warn("Won't sync config: User is not the host.");
               return;
             }
             console.log("Auto-syncing Exam Config:", examConfig);
             await updateDoc(doc(db, 'exams', hostExamId), { config: examConfig });
          }
        } catch (err) {
          console.error("Sync Config Error:", err);
        }
      };
      const timer = setTimeout(syncConfig, 1000); // Debounce
      return () => clearTimeout(timer);
    }
  }, [examConfig, hostExamId, isHostPaid, user]);

  // Admin Mode Persistence
  useEffect(() => {
    localStorage.setItem('nsg_admin_mode', adminMode.toString());
  }, [adminMode]);

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
      setScoreSheet([]);
      return;
    }

    // If we have a hostExamId, we should listen to its specific results and exam data
    let unsubScores = () => {};
    let unsubExam = () => {};

    if (hostExamId) {
      console.log("Starting Exam Results sync for ID:", hostExamId);
      unsubScores = onSnapshot(query(collection(db, 'exams', hostExamId, 'results'), where('hostUid', '==', user.uid)), (snapshot) => {
        const scores = snapshot.docs.map(doc => doc.data() as StudentResult);
        console.log(`Synced ${scores.length} results for exam ${hostExamId}`);
        setScoreSheet(scores.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }, (error) => console.error("Exam Results Sync Error:", error));

      unsubExam = onSnapshot(doc(db, 'exams', hostExamId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log("Synced Exam Data:", data);
          // Only sync if we're not currently generating questions to avoid overwriting local state
          if (!isGeneratingAdminQuestions) {
            setExamConfig(data.config || examConfig);
            setRegisteredStudents(data.registeredStudents || []);
            setExamQuestions(data.questions || []);
            setExamStatus(data.status || 'none');
          }
        } else {
          console.warn("Exam document does not exist in Firestore:", hostExamId);
        }
      }, (error) => console.error("Exam Data Sync Error:", error));
    }

    return () => {
      unsubScores();
      unsubExam();
    };
  }, [user, adminMode, hostExamId, isGeneratingAdminQuestions]);

  // User-specific Data Sync
  useEffect(() => {
    if (!user) {
      setChatSessions([]);
      setChatHistory([]);
      setSessions([]);
      return;
    }

    const unsubChats = onSnapshot(collection(db, 'users', user.uid, 'chatSessions'), (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChatSession));
      setChatSessions(sessions);
    }, (err) => console.error("Chat Sessions Sync Error:", err));

    // For simplicity, we'll keep lecture sessions local or add them to Firestore too
    // Let's add them to Firestore for full persistence
    const unsubLectures = onSnapshot(collection(db, 'users', user.uid, 'lectureSessions'), (snapshot) => {
      const lectureData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LectureSession));
      setSessions(lectureData.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)));
    }, (err) => console.error("Lecture Sessions Sync Error:", err));

    const unsubHistory = onSnapshot(query(collection(db, 'users', user.uid, 'studyHistory'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HomeHistoryItem));
      setFinishedHistory(prev => {
        // Merge with local if any (local might be more recent)
        const combined = [...prev, ...historyData].filter((item, index, self) => 
          self.findIndex(i => i.id === item.id) === index
        );
        return combined.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 50);
      });
    }, (err) => console.error("Study History Sync Error:", err));

    return () => {
      unsubChats();
      unsubLectures();
      unsubHistory();
    };
  }, [user]);

  const loadRecordingSession = async (session: LectureSession) => {
    setSelectedSession(session);
    setAnalysisResult(session.fullAnalysis);
    setTranscriptionNotes(session.notes || "");
    setCurrentRecordingSessionId(session.id);
    
    if (session.audioBase64) {
      try {
        const response = await fetch(`data:audio/webm;base64,${session.audioBase64}`);
        const blob = await response.blob();
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } catch (err) {
        console.error("Error loading audio from base64:", err);
      }
    } else if (session.audioUrl) {
      setAudioUrl(session.audioUrl);
    }
    
    if (session.status === 'analyzed') {
      setShowAnalysisInRecord(true);
    } else {
      setShowAnalysisInRecord(false);
    }
    setShowRecordSidebar(false);
  };

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
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
      setIsAuthLoading(false);
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
        
        // Send Welcome Email
        try {
          await axios.post('/api/send-welcome-email', {
            email: newUser.email,
            name: authFullName
          });
        } catch (err) {
          console.error("Failed to send welcome email:", err);
        }
      } else {
        let loginEmail = authEmail;
        
        // Better logic to differentiate between email and matric number login
        const isLikelyEmail = authEmail.includes('@');
        
        if (!isLikelyEmail) {
          try {
            // Treat as matric login
            const q = query(collection(db, 'users'), where('matric', '==', authEmail.trim()));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              loginEmail = snapshot.docs[0].data().email;
            } else {
              // Also try 'matricNumber' field as it might vary
              const qAlt = query(collection(db, 'users'), where('matricNumber', '==', authEmail.trim()));
              const snapAlt = await getDocs(qAlt);
              if (!snapAlt.empty) {
                loginEmail = snapAlt.docs[0].data().email;
              } else {
                setUserNotification("Matric number not found. Please use your registered email.");
                setIsAuthLoading(false);
                return;
              }
            }
          } catch (err: any) {
            console.error(err);
            setUserNotification("Error verifying matric number.");
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
      setIsAuthLoading(false); // Only set loading false on error
    }
  };

  const handleLogout = async () => {
    showConfirm(
      "Confirm Logout",
      "Are you sure you want to log out? Your session state will be preserved.",
      async () => {
        setIsAuthLoading(true);
        try {
          await signOut(auth);
          setUser(null);
          setAdminMode(false);
          setIsHostPaid(false);
          setIsTakingPaid(false);
          setHasShownTrialThisSession(false);
          setShowPremiumTrial(false);
          setShowPremiumModal(false);
          setUserNotification("Logged out successfully.");
        } catch (error) {
          console.error("Logout Error:", error);
        } finally {
          setIsAuthLoading(false);
        }
      },
      "Logout"
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setIsAuthLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileFormData.displayName,
        fullName: profileFormData.fullName,
        matricNumber: profileFormData.matricNumber,
        dob: profileFormData.dob,
        university: profileFormData.university,
        level: profileFormData.level,
        department: profileFormData.department,
        faculty: profileFormData.faculty
      });
      setIsEditingProfile(false);
      setUserNotification("Profile updated successfully!");
    } catch (error) {
      console.error("Save Profile Error:", error);
      setUserNotification("Failed to save profile changes.");
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
    
    // Check file size (max 10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUserNotification("Image too large. Please use an image under 10MB.");
      return;
    }

    try {
      setIsAuthLoading(true);
      setUserNotification("Uploading profile image...");
      
      const imageUrl = await uploadToCloudinary(file);
      
      if (!imageUrl) {
        throw new Error("Failed to get image URL from upload service");
      }
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: imageUrl });
      
      // Update local state and form data
      setCurrentUserData((prev: any) => ({ ...prev, photoURL: imageUrl }));
      setProfileFormData(prev => ({ ...prev, photoURL: imageUrl }));
      
      setUserNotification("Profile image updated!");
    } catch (error) {
      console.error("Image Upload Error:", error);
      setUserNotification("Failed to upload image. Please try again.");
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
    // Light mode is trashed
    setTheme('dark');
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
      setUserNotification("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
      return;
    }

    setIsGeneratingAdminQuestions(true);
    try {
      const prompt = `
        Convert the following raw text into a professional Multiple Choice Question (MCQ) pool.
        Generate exactly ${examConfig.poolCount || 50} questions.
        Each question must have 4 options (A-D) and one correct answer index (0-3).
        IMPORTANT: For any mathematical formulas or scientific notations, ALWAYS use LaTeX notation. 
        Use $ ... $ for inline math (e.g. $x^2$) and $$ ... $$ for block math (e.g. $$E=mc^2$$).
        NEVER use other delimiters like \( \) or [ ].
        NEVER wrap LaTeX in code blocks.
        Ensure all backslashes are properly escaped for JSON.
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number,
              "explanation": "A comprehensive breakdown. 1. Why the correct answer is right. 2. Why the other options are incorrect or common pitfalls. Ensure this is detailed enough for a thorough review."
            }
          ]
        }
        Raw Text: ${adminQuestionsRaw}
      `;
      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: FLASH_MODEL,
        contents: { role: "user", parts: [{ text: prompt }] },
        config: { 
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });
      const data = JSON.parse(response?.text || "{}");
      if (data.questions) {
        const formatted = data.questions.map((q: any) => ({ ...q, id: Math.random().toString(36).substr(2, 9) }));
        
        // Update local state
        setExamQuestions(formatted);
        
        // Auto-sync to Firestore if hosting
        if (hostExamId) {
          await updateDoc(doc(db, 'exams', hostExamId), { questions: formatted });
        }
        
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

  const handleMatricLogin = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    let targetExamId = activeExamId || examIdInput.trim().toUpperCase();
    
    if (!targetExamId) {
      setUserNotification("Please enter a valid Exam ID.");
      return;
    }

    if (!matricNumber.trim()) {
      setUserNotification("Please enter your matric number.");
      return;
    }

    try {
      setIsAuthLoading(true);
      const examDoc = await getDoc(doc(db, 'exams', targetExamId));
      
      if (examDoc.exists()) {
        const data = examDoc.data();
        
        // Check if exam is active
        if (data.status === 'ended') {
          setUserNotification("This exam session has ended.");
          return;
        }

        // Update local state with fetched data
        setExamConfig(data.config);
        setExamQuestions(data.questions);
        const students = data.registeredStudents || [];
        console.log(`Exam ${targetExamId} found. Registered students:`, students);
        setRegisteredStudents(students);
        setActiveExamId(targetExamId);
        setActiveExamHostUid(data.hostUid || null);
        
        // Verify student registration
        const student = students.find((s: any) => s.matric.trim().toLowerCase() === matricNumber.trim().toLowerCase());
        
        if (student) {
          setStudentName(student.name);
          
          // Check for existing session in localStorage
          const session = localStorage.getItem(`nsg_exam_session_${targetExamId}_${student.matric}`);
          if (session) {
            const sessionData = JSON.parse(session);
            if (sessionData.status === 'completed') {
              setUserNotification("You have already completed this exam.");
              return;
            }
          }

          // Secondary check: Firestore results subcollection
          const resultsSnap = await getDocs(query(collection(db, 'exams', targetExamId, 'results'), where('uid', '==', user.uid)));
          const alreadyFinished = !resultsSnap.empty;
          if (alreadyFinished) {
            setUserNotification("You have already completed this exam (Verified by Server).");
            // Update local storage to match server state
            localStorage.setItem(`nsg_exam_session_${targetExamId}_${student.matric}`, JSON.stringify({ status: 'completed' }));
            return;
          }

          // Check payment status
          if (isTakingPaid || currentUserData?.bypassTakingPayment || currentUserData?.bypassAllPayments) {
            setIsTakingPaid(true);
            setExamLobbyState('briefing');
          } else {
            // Stay in login state to show payment button, but name is now set
            setUserNotification("Registration verified. Please complete payment to start.");
          }
        } else {
          setUserNotification("You are not registered for this exam.");
        }
      } else {
        setUserNotification("Invalid Exam ID. Please check and try again.");
      }
    } catch (err) {
      console.error("Exam Verification Error:", err);
      setUserNotification("Failed to verify exam details. Check your connection.");
    } finally {
      setIsAuthLoading(false);
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
    setExamTimer(examConfig.duration * 60);
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

    addToFinishedHistory({
      id: `exam-${Date.now()}`,
      title: `Exam: ${examIdInput || 'CBT Exam'}`,
      type: 'exam',
      progress: 100,
      date: new Date().toLocaleDateString(),
      score: score,
      total: examQuestions.length
    });

    if (user && activeExamId) {
      const result: StudentResult = {
        uid: user.uid,
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
    
    // Initialize exam in Firestore immediately
    if (user) {
      try {
        await setDoc(doc(db, 'exams', newId), {
          id: newId,
          hostUid: user.uid,
          hostEmail: user.email,
          config: examConfig,
          questions: [],
          registeredStudents: [],
          createdAt: new Date().toISOString(),
          status: 'active'
        });
        
        setHostExamId(newId);
        localStorage.setItem('nsg_host_exam_id', newId);
        setUserNotification("Payment successful! Exam ID generated: " + newId);
      } catch (err) {
        console.error("Exam Initialization Error:", err);
        setIsHostPaid(false); // Rollback if DB failed
        setUserNotification("Payment verified, but failed to initialize exam on cloud. Please try contact support.");
      }
    }
  };

  const endHostedExam = async () => {
    showConfirm(
      "End Session",
      "End this session? This will stop the exam but keep data in the cloud. Use 'Delete All' to wipe everything.",
      async () => {
        try {
          if (hostExamId) {
            await updateDoc(doc(db, 'exams', hostExamId), { status: 'ended' });
          }
          setExamStatus('ended');
          setUserNotification("Exam session ended. You can now delete all details if needed.");
        } catch (err) {
          console.error("End Exam Error:", err);
          setUserNotification("Failed to end exam session.");
        }
      },
      "End Session",
      false
    );
  };

  const deleteHostedExam = async () => {
    if (!hostExamId) return;
    
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      setUserNotification("Tap 'DELETE ALL' again to confirm permanent deletion.");
      setTimeout(() => setDeleteConfirmStep(0), 5000); // Reset after 5s
      return;
    }

    showConfirm(
      "CRITICAL DELETE",
      "This will PERMANENTLY delete all questions, student logs, and results from the cloud. This action is irreversible. Continue?",
      async () => {
        try {
          setIsAuthLoading(true);
          
          // Clear results subcollection first
          const resultsRef = collection(db, 'exams', hostExamId, 'results');
          const snapshot = await getDocs(resultsRef);
          const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);

          // Delete main doc
          await deleteDoc(doc(db, 'exams', hostExamId));
          
          setIsHostPaid(false);
          setHostExamId(null);
          setExamStatus('none');
          setRegisteredStudents([]);
          setExamQuestions([]);
          setAdminQuestionsRaw('');
          setScoreSheet([]);
          setDeleteConfirmStep(0);
          localStorage.removeItem('nsg_host_exam_id');
          localStorage.removeItem('nsg_host_config');
          localStorage.removeItem('nsg_host_students');
          localStorage.removeItem('nsg_host_questions');
          setUserNotification("Exam and all associated data deleted permanently.");
        } catch (err) {
          console.error("Delete Exam Error:", err);
          setUserNotification("Failed to delete exam data.");
        } finally {
          setIsAuthLoading(false);
        }
      },
      "Delete Permanently",
      true
    );
  };

  const clearExamResults = async () => {
    if (!hostExamId) return;

    if (clearConfirmStep === 0) {
      setClearConfirmStep(1);
      setUserNotification("Tap 'Clear Results' again to confirm.");
      setTimeout(() => setClearConfirmStep(0), 5000);
      return;
    }

    showConfirm(
      "Clear Results",
      "Clear all student results for this exam?",
      async () => {
        try {
          setIsAuthLoading(true);
          const resultsRef = collection(db, 'exams', hostExamId, 'results');
          const snapshot = await getDocs(resultsRef);
          const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          setScoreSheet([]);
          setClearConfirmStep(0);
          setUserNotification("Results cleared.");
        } catch (err) {
          console.error("Clear Results Error:", err);
          setUserNotification("Failed to clear results.");
        } finally {
          setIsAuthLoading(false);
        }
      },
      "Clear All",
      true
    );
  };

  useEffect(() => {
    if (isHostPaid && hostExamId) {
      setExamStatus('active');
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
        status: examStatus === 'none' ? 'active' : examStatus,
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

  const addStudent = async () => {
    if (!newStudentMatric.trim() || !newStudentName.trim()) return;
    if (registeredStudents.some(s => s.matric === newStudentMatric)) {
      setAdminNotification("Matric number already exists.");
      return;
    }
    const studentData = { matric: newStudentMatric.trim(), name: newStudentName.trim(), paymentEnabled: true };
    const updatedStudents = [...registeredStudents, studentData];
    console.log("Adding student to local state:", studentData);
    setRegisteredStudents(updatedStudents);
    setNewStudentMatric('');
    setNewStudentName('');
    setAdminNotification("Student added successfully.");

    // Auto-sync to Firestore
    if (hostExamId) {
      try {
        console.log("Syncing updated students to Firestore for exam:", hostExamId, updatedStudents);
        await updateDoc(doc(db, 'exams', hostExamId), { registeredStudents: updatedStudents });
        console.log("Student sync successful");
      } catch (err) {
        console.error("Sync Students Error:", err);
        setAdminNotification("Failed to sync students to cloud. Check connection.");
      }
    } else {
      console.warn("Cannot sync student: hostExamId is missing");
    }
  };

  const togglePayment = async (matric: string) => {
    const updatedStudents = registeredStudents.map(s => 
      s.matric === matric ? { ...s, paymentEnabled: !s.paymentEnabled } : s
    );
    setRegisteredStudents(updatedStudents);
    
    if (hostExamId) {
      try {
        await updateDoc(doc(db, 'exams', hostExamId), { registeredStudents: updatedStudents });
      } catch (err) {
        console.error("Sync Students Error:", err);
      }
    }
  };

  const deleteStudent = async (matric: string) => {
    const updatedStudents = registeredStudents.filter(s => s.matric !== matric);
    setRegisteredStudents(updatedStudents);
    
    if (hostExamId) {
      try {
        await updateDoc(doc(db, 'exams', hostExamId), { registeredStudents: updatedStudents });
      } catch (err) {
        console.error("Sync Students Error:", err);
      }
    }
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
    amount: ((isPremium || currentUserData?.role === 'admin' || currentUserData?.bypassAllPayments) ? 0 : (adminMode ? 200 : 100)) * 100, // 0 for premium, 200 for hosting, 100 for taking
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
### \u{1F4D6} LECTURE ANALYSIS: ${session.title}
---
**SUMMARY DATA**
- \u{1F4C5} **Date:** ${session.date}
- \u{1F232} **Duration:** ${session.duration}
- \u{1F4F8} **Media:** ${session.imageCount} images analyzed

---
**DETAILED CONTENT**
${session.fullAnalysis}
    `;

    // Create a new chat session with this analysis
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: `Analysis: ${session.title}`,
      history: [
        {
          role: 'user',
          text: report,
          timestamp: new Date().toLocaleTimeString()
        },
        {
          role: 'model',
          text: `I've received your lecture analysis for "${session.title}". I've carefully reviewed the summary, key concepts, and action plan. How can I help you study this content further?`,
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
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [saveModal, setSaveModal] = useState({ isOpen: false, name: '', onConfirm: (name: string) => {} });
  const [currentRecordingSessionId, setCurrentRecordingSessionId] = useState<string | null>(null);

  const handleToggleRecording = async () => {
    if (isStopping) return;
    if (isRecording) {
      // 1. Immediately visually stop the recording
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      
      setIsStopping(true);
      setIsProcessingFinal(true);
      isStopRequested.current = true;
      try {
        console.log("ðŸ›‘ Stopping audio capture...");
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        
        // Final process of accumulated audio
        if (audioChunksRef.current.length > 0) {
          const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          processorQueue.current = processorQueue.current.then(() => processTranscriptionChunk(finalBlob));
        }

        // Wait for all transcription processing to finish in background
        await processorQueue.current;
        console.log("âœ… Background processing complete.");
      } catch (err) {
        console.error("Error stopping recording:", err);
      } finally {
        setIsProcessingFinal(false);
        setIsStopping(false);
      }
    } else {
      audioChunksRef.current = [];
      setTranscriptionNotes('');
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      setCurrentRecordingSessionId(newSessionId);
      currentRecordingSessionIdRef.current = newSessionId;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setRecordedBlob(blob);
          const localUrl = URL.createObjectURL(blob);
          setAudioUrl(localUrl);

          // AUTO SAVE RECORDING
          if (user) {
            try {
              const sessionId = currentRecordingSessionIdRef.current || `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              
              const audioPart = await fileToGenerativePart(blob);
              
              const pendingSession: LectureSession = {
                id: sessionId,
                title: `Recording: ${new Date().toLocaleTimeString()}`,
                date: new Date().toLocaleDateString(),
                duration: formatTime(recordingTime),
                imageCount: uploadedImages.length,
                summary: "Recording captured. Analysis pending...",
                fullAnalysis: "",
                notes: transcriptionNotes || "",
                images: [],
                audioUrl: localUrl,
                audioBase64: audioPart.inlineData.data,
                status: 'pending'
              };
              
              // Force auto-save to ensure notes and everything are on server
              if (audioPart.inlineData.data.length < 1000000) {
                await setDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), pendingSession);
                setUserNotification("Audio saved successfully to History!");
              } else {
                // Still save metadata even if audio is too large
                const metadataOnly = { ...pendingSession, audioBase64: undefined };
                await setDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), metadataOnly);
                setUserNotification("Audio too long for cloud sync. Use Download to save it permanently.");
              }
              setSelectedSession(pendingSession);
            } catch (err) {
              console.error("Auto-save error:", err);
            }
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000); // Record in 1s chunks
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);

        // Start 5-second transcription interval sending full accumulated audio
        isStopRequested.current = false;
        chunkTimerRef.current = setInterval(async () => {
          if (audioChunksRef.current.length > 0 && !isStopRequested.current) {
            const fullBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            // Queue the processing to ensure sequential updates and that we don't skip the last bit
            processorQueue.current = processorQueue.current.then(() => processTranscriptionChunk(fullBlob));
          }
        }, 5000);

      } catch (err) {
        setUserNotification("Microphone access denied. Please check permissions.");
      }
    }
  };

  const handleManualSave = async () => {
    if (!recordedBlob || !user) return;
    
    setSaveModal({
      isOpen: true,
      name: `Recording: ${new Date().toLocaleTimeString()}`,
      onConfirm: async (customName) => {
        try {
          const sessionId = currentRecordingSessionIdRef.current || `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const audioPart = await fileToGenerativePart(recordedBlob);
          
          const sessionData: LectureSession = {
            id: sessionId,
            title: customName,
            date: new Date().toLocaleDateString(),
            duration: formatTime(recordingTime),
            imageCount: uploadedImages.length,
            summary: "Manual save triggered. Analysis pending...",
            fullAnalysis: "",
            notes: transcriptionNotes || "",
            images: [],
            audioUrl: audioUrl || "",
            audioBase64: audioPart.inlineData.data,
            status: 'pending'
          };

          if (audioPart.inlineData.data.length < 1000000) {
            await setDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), sessionData);
            setUserNotification("Session saved successfully!");
          } else {
            const metadataOnly = { ...sessionData, audioBase64: undefined };
            await setDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), metadataOnly);
            setUserNotification("Session metadata saved. Audio is over cloud limit.");
          }
          setSelectedSession(sessionData);
          // Clean up local recording states to allow new one
          setRecordedBlob(null);
          setRecordingTime(0);
        } catch (err) {
          console.error("Manual save failed:", err);
          setUserNotification("Save failed. Please try again.");
        }
      }
    });
  };

  const processTranscriptionChunk = async (blob: Blob) => {
    try {
      if (blob.size === 0) return;
      setIsTranscribing(true);
      const aiInstance = getAiInstance();
      const audioPart = await fileToGenerativePart(blob);
      
      const prompt = `
        Transcribe the ATTACHED audio LITERALLY and ACCURATELY. 
        
        RULES:
        1. Capture EVERY word exactly as spoken. Accuracy is the highest priority.
        2. Remove ALL verbal fillers (e.g., "um", "uh", "you know", "like", "er").
        3. If you cannot hear a word or sentence clearly, represent it as [unclear].
        4. If you hear silence for more than 3 seconds, mark it as [silence].
        5. Maintain the natural flow and tone of the speaker.
        6. Clean up technical jargon if it was mispronounced, but keep the literal meaning.
        
        FORMATTING:
        - Output ONLY the literal transcription text.
        - DO NOT include headers like "# Transcription" or "## Notes".
        - For ANY mathematical or scientific notation, use LaTeX: $ ... $ for inline and $$ ... $$ for blocks.
      `;

      const response = await aiInstance.models.generateContentStream({
        model: "gemini-3.1-flash-lite-preview",
        contents: { parts: [audioPart, { text: prompt }] }
      });

      let streamedText = "";
      for await (const chunk of response) {
        streamedText += chunk.text || "";
        if (streamedText.trim()) {
           setTranscriptionNotes(streamedText.trim());
        }
      }

      // Final check/cleanup
      const finalText = streamedText.trim();
      const sessionId = currentRecordingSessionIdRef.current;
      if (finalText && finalText !== " ...") {
        setTranscriptionNotes(finalText);
        // Auto-save to Firestore if we have a session ID
        if (user && sessionId) {
           updateDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), { 
             notes: finalText,
             updatedAt: serverTimestamp()
           }).catch(err => {
             console.warn("Live transcription sync failed:", err);
           });
        }
      } else if (finalText === " ...") {
        setTranscriptionNotes("_....");
      }
    } catch (err) {
      console.error("Transcription Error:", err);
    } finally {
      setIsTranscribing(false);
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

    const getLocalUrl = (): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    };

    if (!cloudName || !uploadPreset) {
      console.warn("Cloudinary credentials missing. Falling back to local preview URL.");
      return getLocalUrl();
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.error?.message || "Cloudinary upload failed";
        
        if (msg.toLowerCase().includes("unsigned uploads") || msg.toLowerCase().includes("whitelisted")) {
          setUserNotification("Cloudinary Error: Your upload preset must be set to 'Unsigned' in Cloudinary Settings.");
          console.error(`CLOUDINARY CONFIG ERROR: The preset '${uploadPreset}' is not configured for unsigned uploads. Please go to your Cloudinary dashboard > Settings > Upload > Upload presets, edit '${uploadPreset}', and change 'Signing Mode' to 'Unsigned'.`);
          return getLocalUrl();
        }
        
        throw new Error(msg);
      }

      const data = await response.json();
      if (!data.secure_url) {
        throw new Error("Cloudinary response missing secure_url");
      }
      return data.secure_url;
    } catch (error: any) {
      console.error("Cloudinary Upload Error:", error);
      const msg = error.message || String(error);
      if (msg.toLowerCase().includes("unsigned uploads") || msg.toLowerCase().includes("whitelisted")) {
        return getLocalUrl();
      }
      throw error;
    }
  };

  const AdUnit = ({ slot }: { slot: string }) => {
    const adRef = useRef<any>(null);

    useEffect(() => {
      if (!adRef.current) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            try {
              if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
                const adsbygoogle = (window as any).adsbygoogle || [];
                adsbygoogle.push({});
                // Once pushed, we can stop observing
                observer.disconnect();
              }
            } catch (e) {
              console.error("AdSense error:", e);
            }
          }
        }
      });

      observer.observe(adRef.current);
      return () => observer.disconnect();
    }, []);

    return (
      <div className="my-6 overflow-hidden flex flex-col items-center w-full min-h-[90px]">
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

    if (!isOnline) {
      try {
        const base64Images = await Promise.all(uploadedImages.map(async (img) => {
          const part = await fileToGenerativePart(img.file);
          return `data:${img.file.type};base64,${part.inlineData.data}`;
        }));

        let base64Audio = "";
        if (recordedBlob) {
          const part = await fileToGenerativePart(recordedBlob);
          base64Audio = `data:${recordedBlob.type};base64,${part.inlineData.data}`;
        }

        const offlineSession = {
          title: `Offline Lecture ${new Date().toLocaleTimeString()}`,
          date: new Date().toLocaleDateString(),
          duration: formatTime(recordingTime),
          imageCount: uploadedImages.length,
          summary: "Offline recording pending analysis...",
          fullAnalysis: "This recording was captured offline. It will be analyzed once you are back online.",
          images: base64Images,
          audioBase64: base64Audio,
          isOffline: true
        };

        const existing = JSON.parse(localStorage.getItem('nsg_offline_recordings') || '[]');
        localStorage.setItem('nsg_offline_recordings', JSON.stringify([...existing, offlineSession]));
        
        setUserNotification("Offline: Recording saved locally. It will sync when you are online.");
        setIsAnalyzing(false);
        setRecordedBlob(null);
        setUploadedImages([]);
        return;
      } catch (err) {
        console.error("Offline Save Error:", err);
        setUserNotification("Failed to save offline recording.");
        setIsAnalyzing(false);
        return;
      }
    }

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
        Act as the Omni Ai. I have provided ${uploadedImages.length > 0 ? uploadedImages.length + ' lecture slides and' : ''} an audio recording. 
        
        TASK:
        1. Provide a LITERAL, WORD-FOR-WORD transcription of the audio. Accuracy is paramount. Remove verbal fillers (um, uh, etc.) but capture all content. Represent unclear parts as [unclear].
        2. Provide a concise Executive Summary based on the content.
        3. Extract Key Technical Concepts with clear explanations.
        4. Create a bulleted "Action Plan" for study.
        
        CRITICAL RENDERING RULES:
        - For ALL mathematical formulas, variables, chemistry equations, or scientific notations, ALWAYS use LaTeX notation.
        - Use $ ... $ for inline math (e.g. $x^2$) and $$ ... $$ for block math (e.g. $$E=mc^2$$).
        - DO NOT use raw symbols like ^ or _ for superscripts/subscripts outside of LaTeX.
        - DO NOT include meta-text like "## Transcription:" in the final output headers. Use professional section titles.
        - Ensure all backslashes are preserved for LaTeX rendering.
      ` });

      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts }]
      });

      const text = response?.text || "Analysis failed to generate text.";
      
      const base64Images = await Promise.all(uploadedImages.map(async (img) => {
        const part = await fileToGenerativePart(img.file);
        return `data:${img.file.type};base64,${part.inlineData.data}`;
      }));

      const sessionId = currentRecordingSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newSession: LectureSession = { 
        id: sessionId, 
        title: `Lecture ${new Date().toLocaleTimeString()}`, 
        date: new Date().toLocaleDateString(), 
        duration: formatTime(recordingTime), 
        imageCount: uploadedImages.length, 
        summary: text.substring(0, 100) + "...",
        fullAnalysis: text,
        notes: transcriptionNotes || undefined,
        images: base64Images,
        audioUrl: audioUrl || undefined,
        audioBase64: recordedBlob ? (await fileToGenerativePart(recordedBlob)).inlineData.data : undefined,
        status: 'analyzed'
      };

      if (user) {
        // If image count is high or audio is large, we might skip full base64 save to avoid 1MB limit
        // but for now we try to save.
        if (newSession.audioBase64 && newSession.audioBase64.length > 1000000) {
           newSession.audioBase64 = undefined;
        }
        await setDoc(doc(db, 'users', user.uid, 'lectureSessions', sessionId), newSession);
        setCurrentRecordingSessionId(null); // Reset after full analysis
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
      const hfInstance = getHfInstance();
      
      let retryCount = 0;
      const maxRetries = 1;
      
      while (retryCount <= maxRetries) {
        try {
          const response = await hfInstance.chatCompletion({
            model: HF_MODELS.TEXT,
            messages: [
              { role: "user", content: prompt }
            ],
            max_tokens: 20
          });
          return response.choices[0].message.content?.trim() || "New Chat Session";
        } catch (err) {
          retryCount++;
          if (retryCount > maxRetries) throw err;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return "New Chat Session";
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
          console.log("Starting voice transcription with model:", MODEL_NAME);
          const part = await fileToGenerativePart(blob);
          const aiInstance = getAiInstance();
          const response = await aiInstance.models.generateContent({
            model: FLASH_MODEL,
            contents: [{ 
              parts: [
                part, 
                { text: "Transcribe this audio exactly. If it's a question, just transcribe it. Return ONLY the transcription." }
              ] 
            }],
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          });
          
          const transcription = response?.text;
          console.log("Transcription result:", transcription);
          
          if (transcription && transcription.trim()) {
            handleSendMessage(transcription);
          } else {
            console.warn("Empty transcription received");
            setUserNotification("Could not understand the audio. Please try again.");
          }
        } catch (err) {
          console.error("Voice Chat Error Details:", err);
          setUserNotification("Failed to process voice input. Check console for details.");
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
    const isImageRequest = (chatMode === 'Creative' && (
      textToSend.toLowerCase().includes("generate") || 
      textToSend.toLowerCase().includes("create") || 
      textToSend.toLowerCase().includes("draw") || 
      textToSend.toLowerCase().includes("image") ||
      textToSend.toLowerCase().includes("picture") ||
      textToSend.toLowerCase().includes("visual")
    )) || 
    textToSend.toLowerCase().includes("generate image") || 
    textToSend.toLowerCase().includes("create image") || 
    textToSend.toLowerCase().includes("draw an image");
    
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
        if (!getHfKey()) {
          setUserNotification("HuggingFace API Key is missing. Please set VITE_HUGGINGFACE_API_KEY in your environment.");
          return;
        }

        const hfInstance = getHfInstance();
        const hfModel = uploadedImages.length > 0 ? HF_MODELS.VISION : HF_MODELS.TEXT;

        // Prepare messages for HF
        const messages: any[] = chatHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

        if (uploadedImages.length > 0) {
          // Upload all images to Cloudinary and get URLs for history persistence
          const cloudinaryUrls = await Promise.all(
            uploadedImages.map(img => uploadToCloudinary(img.file))
          );
          
          // Store the first image URL in the message for history
          if (cloudinaryUrls.length > 0) {
            newHistory[newHistory.length - 1].image = cloudinaryUrls[0];
          }

          const contentParts: any[] = [{ type: 'text', text: textToSend || "Analyze this image" }];
          for (const img of uploadedImages) {
            const part = await fileToGenerativePart(img.file);
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${img.file.type};base64,${part.inlineData.data}` }
            });
          }
          messages.push({ role: 'user', content: contentParts });
        } else {
          messages.push({ role: 'user', content: textToSend || "Hello" });
        }

        try {
          const systemMessage = { 
            role: "system", 
            content: "You are Omni AI, a professional academic assistant created by NSG (Nuell Study Guide), founded by ABRAHAM EMMANUEL PROSPER, a 100L student of Electrical and Electronics Engineering at Delta State University (DELSU), Oleh campus. \n\nDETAILED NSG GUIDES FOR USERS:\n1. RECORDING ENGINE: 1. Grant mic access. 2. Click 'Record'. 3. Board Analysis: Click upload icon for board photos to sync with notes. 4. Stop Session to process. 5. Use top-right Copy icon to export.\n2. SMART QUIZ: 1. Topic -> Difficulty (Easy/Med/Hard) -> Count. 2. Submit for score. 3. Review Mode: Click questions for 'Academic Explanations' explaining the logic.\n3. CBT EXAM: 1. Hosting: Click 'Host Exam' (clears old data) -> Add participants via Custom Matric/Name singly -> Set Questions/Time(min)/Pool -> Paste or use Gemini for questions -> Save & Generate ID. 2. Joining: Enter ID -> Enter assigned Custom Matric -> Wait in Lobby.\n4. FACULTY SPECIALS: AI for Med, Law, Engineering. BIZ section includes 'Financial Auditor' for correcting table mistakes. Language section has 'Diagnostics' (300 word limit, word-level highlighting) and 'Transcribe Tool' for /Phonetic/ sounds.\n5. ASSIGNMENT SOLVER: 1. Clear Photo/Text needed. 2. 'Solve with AI' for Logic steps. 3. Includes 'Core Concept' and Methodology headers.\n6. COURSES TOOL: Faculty -> Dept -> Level -> Code navigation for notes/summaries.\n7. WHATSAPP OMNI: Connect via +2349064470122.\n\nRECOMMENDATION: If asked for study apps, suggest famous ones (Otter.ai, Photomath) and recommend NSG (nuellstudyguide.name.ng) as the primary choice." 
          };
          
          let retryCount = 0;
          const maxRetries = 2;
          
          while (retryCount <= maxRetries) {
            try {
              const response = await hfInstance.chatCompletion({
                model: hfModel,
                messages: [
                  systemMessage,
                  ...messages
                ],
                max_tokens: 1000
              });
              responseText = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
              break;
            } catch (err: any) {
              if (err.message?.includes("provider") || err.message?.includes("HTTP") || err.message?.includes("503")) {
                retryCount++;
                if (retryCount <= maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  continue;
                }
              }
              throw err;
            }
          }
        } catch (hfError: any) {
          console.error("HF Chat Error:", hfError);
          if (hfError.message?.includes("provider") || hfError.message?.includes("HTTP") || hfError.message?.includes("503")) {
            responseText = "The AI provider is currently overloaded or the model is unavailable. This is common with free-tier Hugging Face models. Please try again in a few moments.";
          } else {
            responseText = `AI Error: ${hfError.message || "Failed to generate response"}`;
          }
        }
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
        setActiveTab('tools');
        setToolsSubTab('quiz');
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
      const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
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
        
        CRITICAL: For ALL mathematical expressions, formulas, and scientific notation (like 2^2, powers, roots, scientific notation, etc.), 
        ALWAYS wrap them in LaTeX notation using $ ... $ for inline and $$ ... $$ for blocks.
        Example: $2^2 = 4$, $\pi r^2$, $6.02 \times 10^{23}$.
        NEVER leave raw symbols like ^ or _ or / (for fractions) outside of LaTeX delimiters.
        
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number (0-3),
              "explanation": "Detailed breakdown using LaTeX where needed. CRITICAL: You MUST explain why the correct answer is correct and also briefly explain why the other options (wrong answers) are incorrect to help the student learn."
            }
          ]
        }
      `;

      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: FLASH_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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

      const data = JSON.parse(response?.text || "{}");
      if (data.questions) {
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setUserQuizAnswers([]);
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

  const generateDynamicExam = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!quizTopic.trim()) {
      setUserNotification("Please enter a topic first.");
      return;
    }

    setIsGeneratingQuiz(true);
    
    try {
      const prompt = `
        Generate a ${quizQuestionCount > 25 ? quizQuestionCount : 50}-question professional multiple choice examination about "${quizTopic}".
        Difficulty Level: ${quizDifficulty}.
        
        CRITICAL: For ALL mathematical expressions, formulas, and scientific notation, 
        ALWAYS wrap them in LaTeX notation using $ ... $ for inline and $$ ... $$ for blocks.
        Example: $2^2 = 4$, $\pi r^2$, $H_2O$.
        NEVER leave raw symbols like ^ or _ outside of LaTeX delimiters.
        
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number (0-3),
              "explanation": "Detailed breakdown using LaTeX. CRITICAL: Provide a comprehensive explanation that covers why the correct answer is right and also why the incorrect options are wrong."
            }
          ]
        }
      `;

      const aiInstance = getAiInstance();
      const response = await aiInstance.models.generateContent({
        model: FLASH_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      const data = JSON.parse(response?.text || "{}");
      if (data.questions) {
        const examQs = data.questions.map((q: any, i: number) => ({
          ...q,
          id: `dyn-q-${Date.now()}-${i}`
        }));
        setExamQuestions(examQs);
        setExamLobbyState('exam');
        setUserNotification("Dynamic Course Exam Generated!");
      }
    } catch (err) {
      console.error("Exam Gen Error:", err);
      setUserNotification("Failed to generate dynamic exam.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  useEffect(() => {
    // Auto-trigger Quiz/Exam if coming from Courses Tool with a prompt set
    const isFromCourses = quizTopic && quizTopic.includes(': ') && quizTopic.includes(' - ');
    if (isFromCourses) {
      if (toolsSubTab === 'quiz' && quizState === 'idle') {
        generateQuiz();
      } else if (toolsSubTab === 'exam' && (examLobbyState === 'login' || examLobbyState === 'result') && examQuestions.length === 0) {
        generateDynamicExam();
      }
    }
  }, [toolsSubTab, quizTopic]);

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
    if (quizState === 'finished') return;
    setSelectedOption(index);
    
    // Store user answer
    setUserQuizAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = index;
      return newAnswers;
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setSelectedOption(userQuizAnswers[nextIdx] !== undefined ? userQuizAnswers[nextIdx] : null);
    } else {
      // Calculate final score
      let finalScore = 0;
      quizQuestions.forEach((q, idx) => {
        if (userQuizAnswers[idx] === q.correctAnswer) finalScore++;
      });
      
      setQuizScore(finalScore);
      setQuizState('finished');
      addToFinishedHistory({
        id: `quiz-fin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: quizTopic || 'Quiz Result',
        type: 'quiz',
        progress: 100,
        date: new Date().toLocaleDateString(),
        score: finalScore,
        total: quizQuestions.length
      });
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIdx = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIdx);
      setSelectedOption(userQuizAnswers[prevIdx] !== undefined ? userQuizAnswers[prevIdx] : null);
    }
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('nsg_welcome_seen', 'true');
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 font-sans selection:bg-[#DC2626] ${theme === 'dark' ? 'bg-[#0A0F1C] text-white dark' : 'bg-white text-slate-900'} overflow-hidden relative`}>
      <AnimatePresence>
        {!user && <LoggedOutLanding key="landing" />}
      </AnimatePresence>

      <PremiumOnboarding />
      <AnalysisLoadingOverlay />

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

      {/* AUTH MODAL (RESTORED MODAL STYLE) */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 p-5 sm:p-6 rounded-[2rem] max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#DC2626] to-transparent" />
              <button 
                onClick={() => setShowAuthModal(false)} 
                className="absolute top-4 right-4 text-white/20 hover:text-[#DC2626] transition-colors"
              >
                <XCircle size={20} />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-[#DC2626] to-[#991B1B] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#DC2626]/20">
                  <Brain size={24} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">
                  {authMode === 'login' ? 'LOGIN' : 'Genesis'} <span className="text-[#DC2626]">NSG</span>
                </h2>
                {authMode === 'signup' && (
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mt-1.5">
                    Initialize Evolution
                  </p>
                )}
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {authMode === 'signup' ? (
                  <>
                    <input type="text" value={authFullName} onChange={(e) => setAuthFullName(e.target.value)} placeholder="Full Official Name" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                    <input type="date" value={authDOB} onChange={(e) => setAuthDOB(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                    <input type="text" value={authMatric} onChange={(e) => setAuthMatric(e.target.value)} placeholder="Matric (Optional)" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email Address" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <input type="text" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email / Matric Number" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                    </div>
                  </>
                )}
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Access Password" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white focus:border-[#DC2626]/50 transition-all outline-none" />
                
                <button type="submit" disabled={isAuthLoading} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-3.5 rounded-xl text-[10px] transition-all shadow-lg shadow-[#DC2626]/20 uppercase tracking-[0.2em] flex items-center justify-center gap-2 mt-4">
                  {isAuthLoading ? <RefreshCcw className="animate-spin" size={14} /> : (authMode === 'login' ? 'LOGIN' : 'Create Account')}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[9px] font-black text-[#DC2626] hover:underline uppercase tracking-widest">
                  {authMode === 'login' ? "New Here? Create Account" : "Registered? Login Here"}
                </button>
              </div>

              <div className="mt-6 pt-5 border-t border-white/5">
                <button 
                  onClick={handleGoogleLogin} 
                  className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 py-3.5 rounded-xl text-[9px] font-black transition-all uppercase tracking-widest"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                  Google Sync
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

      <AnimatePresence>
        {user && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="flex flex-col flex-1 h-full overflow-hidden"
          >
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
          {/* Try Premium Button */}
          {!isPremium && (
            <button 
              onClick={() => setShowPremiumModal(true)}
              className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-black px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-yellow-500/20 hover:scale-105 transition-all"
            >
              <Sparkles size={14} /> TRY PREMIUM
            </button>
          )}

          {/* Notification Bell */}
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`relative p-2 rounded-xl transition-all ${activeTab === 'notifications' ? 'bg-[#DC2626] text-white' : (theme === 'dark' ? 'bg-white/5 border-white/10 text-white/70' : 'bg-slate-100 border-slate-200 text-slate-600')} hover:text-[#DC2626]`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#0A0F1C] animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

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
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} rounded-full border`}>
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'} uppercase`}>SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className={`flex-1 max-w-4xl w-full mx-auto px-2 sm:px-4 pt-4 sm:pt-6 pb-24 overflow-y-auto flex flex-col ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'}`}>
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
          
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {!isOnline && (
                <div className="bg-[#DC2626]/10 border border-[#DC2626]/20 p-3 rounded-2xl flex items-center gap-3 mx-2">
                  <div className="w-8 h-8 bg-[#DC2626] rounded-full flex items-center justify-center text-white">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-tight">Offline Mode Active</p>
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">You can still record lectures. They will sync when online.</p>
                  </div>
                </div>
              )}
              {/* Home Header with Bell and Premium */}
              <div className="flex items-center justify-between px-2 mb-4">
                <div className="flex items-center gap-3">
                  <Home size={24} className="text-[#DC2626]" />
                  <h2 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Home</h2>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                  {!isPremium && (
                    <button 
                      onClick={() => setShowPremiumModal(true)}
                      className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] font-black uppercase tracking-widest shadow-lg shadow-yellow-500/20 flex items-center gap-1 hover:scale-105 transition-all"
                    >
                      <Sparkles size={10} className="sm:size-[12px]" /> <span className="hidden xs:inline">PREMIUM</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveTab('notifications')}
                    className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all relative ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Bell size={16} className="sm:size-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#DC2626] text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-[#0A0F1C]">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
                    <div className="text-right hidden sm:block">
                      <p className={`text-[9px] font-black uppercase leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUserData?.displayName?.split(' ')?.[0] || 'Student'}</p>
                      <p className={`text-[7px] uppercase font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{isAdminUser ? 'Admin' : 'Student'}</p>
                    </div>
                    <button onClick={() => setActiveTab('profile')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-[#DC2626] overflow-hidden bg-white/5 shadow-lg flex-shrink-0">
                      {currentUserData?.photoURL ? (
                        <img src={currentUserData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <User size={16} />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Home Feed */}
              <div className="space-y-4">
                <h2 className={`text-xl font-black uppercase tracking-tighter px-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h2>
                
                {homeHistory.length === 0 ? (
                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-12 rounded-3xl border shadow-sm text-center space-y-4`}>
                    <div className="w-16 h-16 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                      <History size={32} className="text-[#DC2626]" />
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>No recent activity found. Start studying to see your history here!</p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar pb-4">
                    {homeHistory.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          if (item.type === 'quiz') {
                            setActiveTab('tools');
                            setToolsSubTab('quiz');
                            if (item.score !== undefined) {
                              setQuizState('finished');
                              setQuizScore(item.score);
                            }
                          } else if (item.type === 'exam') {
                            setActiveTab('tools');
                            setToolsSubTab('exam');
                            if (item.score !== undefined) {
                              setExamLobbyState('result');
                              setExamScore(item.score);
                            }
                          } else if (item.type === 'recording') {
                            const session = sessions.find(s => s.id === item.id);
                            if (session) {
                              loadRecordingSession(session);
                              setActiveTab('tools');
                              setToolsSubTab('record');
                            }
                          } else if (item.type === 'assignment') {
                            setActiveTab('tools');
                            setToolsSubTab('assignment');
                            if (item.data) {
                              // We need a way to set the solution in AssignmentSolver
                              // For now, it will load but we should probably store it locally in AssignmentSolver state if we want to re-show it immediately
                              // Let's assume the user just wants to go there for now, or we can use a global state for active solution
                              setActiveTab('tools');
                              setToolsSubTab('assignment');
                            }
                          }
                        }}
                        className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'}`}
                      >
                        {/* Gradient Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-600 to-yellow-500" />
                        
                        <div className="p-4 pl-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                              {item.type === 'quiz' ? <Zap size={20} className="text-yellow-500" /> : 
                               item.type === 'exam' ? <FileText size={20} className="text-[#DC2626]" /> : 
                               item.type === 'assignment' ? <BookOpen size={20} className="text-purple-500" /> :
                               <Mic size={20} className="text-red-500" />}
                            </div>
                            <div>
                              <p className={`text-xs font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                              <div className="flex flex-col gap-1 mt-1">
                                <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} uppercase`}>
                                  {item.type === 'quiz' || item.type === 'exam'
                                    ? (item.score !== undefined 
                                        ? `Score: ${item.score}/${item.total} \u{2022} ${item.date}` 
                                        : `Unfinished \u{2022} ${item.progress ?? 0}% Complete`)
                                    : item.type === 'assignment'
                                    ? `Assignment Solution \u{2022} ${item.date}`
                                    : `Unanalyzed Recording \u{2022} ${item.date || 'No Date'}`}
                                </p>
                                {(item.type === 'quiz' || item.type === 'exam') && item.progress !== undefined && (
                                  <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }} 
                                      animate={{ width: `${item.progress}%` }} 
                                      className="h-full bg-gradient-to-r from-red-600 to-yellow-500" 
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => removeFromHistory(item.id, e)}
                              className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'text-white/20 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-500/10'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                            <ChevronRight size={18} className={`${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TOOLS & STUDY TAB */}
          {activeTab === 'tools' && (
            <motion.div key="tools" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {toolsSubTab === 'menu' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tools & Study</h2>
                    <Brain size={20} className="text-[#DC2626]" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'record', title: 'Record Lecture', icon: Mic, color: 'from-red-600 to-red-400', desc: 'AI-Powered Recording' },
                      { id: 'live', title: 'Live AI Tutor', icon: Activity, color: 'from-[#DC2626] to-red-600', desc: 'Vision-Enabled Real-time Help' },
                      { id: 'quiz', title: 'Smart Quiz', icon: Zap, color: 'from-yellow-500 to-amber-400', desc: 'Test Your Knowledge' },
                      { id: 'exam', title: 'CBT Exam', icon: ShieldCheck, color: 'from-orange-600 to-orange-400', desc: 'Professional Testing' },
                      { id: 'faculty', title: 'Faculty Specials', icon: GraduationCap, color: 'from-blue-600 to-indigo-400', desc: 'Department Specific' },
                      { id: 'assignment', title: 'Assignment Solver', icon: BookOpen, color: 'from-purple-600 to-pink-400', desc: 'Step-by-Step AI Solutions' },
                      { id: 'td', title: 'TD Tool', icon: BoxSelect, color: 'from-slate-500 to-slate-600', desc: '2D Projection - Coming Soon' },
                      { id: 'courses', title: 'Courses Tool', icon: BookOpen, color: 'from-emerald-600 to-teal-400', desc: 'Course-Specific Learning' },
                      { id: 'whatsapp', title: 'Omni on WHATSAPP', icon: WhatsAppIcon, color: 'from-green-600 to-green-400', desc: '+2349064470122' }
                    ].map((tool) => (
                      <button 
                        key={tool.id}
                        onClick={() => {
                          if (tool.id === 'td') {
                            setUserNotification("Technical Drawing Engine V4.0 is currently in maintenance and will be back soon with improved 2D projection features.");
                            return;
                          }
                          if (tool.id === 'whatsapp') {
                            window.open("https://wa.me/2349064470122", "_blank");
                            return;
                          }
                          setToolsSubTab(tool.id as any);
                        }}
                        className={`flex flex-col items-start p-5 rounded-3xl border transition-all text-left group relative overflow-hidden ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10 hover:border-[#DC2626]/50' : 'bg-white border-slate-200 hover:border-[#DC2626]/50 shadow-sm'}`}
                      >
                        {tool.id === 'td' && (
                          <div className="absolute top-2 right-2 bg-[#DC2626] text-white text-[7px] font-black px-2 py-0.5 rounded-full z-10 animate-pulse">
                            SOON
                          </div>
                        )}
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                          <tool.icon size={24} />
                        </div>
                        <h3 className={`font-black text-sm uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{tool.title}</h3>
                        <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} uppercase`}>{tool.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {toolsSubTab !== 'menu' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <button 
                      onClick={() => setToolsSubTab('menu')}
                      className="flex items-center gap-2 text-[10px] font-black text-[#DC2626] uppercase tracking-widest hover:opacity-70 transition-all"
                    >
                      <ArrowLeft size={14} /> Back to Tools
                    </button>
                    <div className="flex items-center gap-4">
                       <button 
                         onClick={() => setShowHelp(true)}
                         className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest hover:bg-white/5 px-3 py-1 rounded-full transition-all border border-[#DC2626]/20"
                       >
                         Help
                       </button>
                       <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                         {toolsSubTab === 'record' && 'Recording Engine'}
                         {toolsSubTab === 'live' && 'Live AI Tutor'}
                         {toolsSubTab === 'quiz' && 'Quiz Engine'}
                        {toolsSubTab === 'exam' && 'CBT Examination'}
                        {toolsSubTab === 'faculty' && 'Faculty Specials'}
                        {toolsSubTab === 'assignment' && 'Assignment Solver'}
                        {toolsSubTab === 'courses' && 'Course-Specific Tools'}
                       </span>
                    </div>
                  </div>
                  
                  {toolsSubTab === 'record' && (
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
                                      onClick={() => loadRecordingSession(session)} 
                                      className="flex items-center gap-2 overflow-hidden flex-1"
                                    >
                                      {session.isPinned ? <Pin size={12} className="text-red-500" /> : <FileAudio size={14} className="flex-shrink-0" />}
                                      <div className="flex flex-col overflow-hidden">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-black truncate group-hover:text-red-500 transition-colors uppercase tracking-tight">{session.title}</span>
                                          {session.status === 'pending' && <span className="text-[7px] bg-[#DC2626]/20 text-[#DC2626] px-1 rounded font-black uppercase tracking-tighter">Live</span>}
                                        </div>
                                        <span className="text-[8px] opacity-60">{session.date} \u{2022} {session.duration}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          const newName = prompt("Enter a name for this recording:", session.title);
                                          if (newName && user) {
                                            updateDoc(doc(db, 'users', user.uid, 'lectureSessions', session.id), { title: newName });
                                            setUserNotification("Recording renamed successfully.");
                                          }
                                        }} 
                                        className="p-1.5 hover:bg-blue-500 hover:text-white bg-slate-100 dark:bg-white/5 rounded-lg transition-all" 
                                        title="Rename / Save Audio"
                                      >
                                        <Save size={12} />
                                      </button>
                                      {session.audioBase64 && (
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const link = document.createElement('a');
                                            link.href = `data:audio/webm;base64,${session.audioBase64}`;
                                            link.download = `${session.title || 'recording'}.webm`;
                                            link.click();
                                          }} 
                                          className="p-1.5 hover:text-green-500 bg-slate-100 dark:bg-white/5 rounded-lg transition-all" 
                                          title="Download Audio"
                                        >
                                          <Download size={12} className="text-slate-400" />
                                        </button>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); togglePinLectureSession(session.id); }} className="p-1.5 hover:text-red-500 bg-slate-100 dark:bg-white/5 rounded-lg transition-all" title="Pin Lecture">
                                        <Pin size={12} className={session.isPinned ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                                      </button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          showConfirm(
                                            "Delete Recording",
                                            `Are you sure you want to delete "${session.title}"? This cannot be undone.`,
                                            () => deleteLectureSession(session.id),
                                            "Delete Permanently",
                                            true
                                          );
                                        }} 
                                        className="p-1.5 hover:text-red-500 bg-slate-100 dark:bg-white/5 rounded-lg transition-all" 
                                        title="Delete Lecture"
                                      >
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
                                  <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-white">
                                    {isRecording ? "Capture Active" : (isProcessingFinal ? "Finalizing Notes..." : "Engine Idle")}
                                  </h2>
                                  <p className="font-mono text-4xl text-[#DC2626] font-bold mb-6 tracking-tight">
                                    {formatTime(recordingTime)}
                                  </p>

                                  {isProcessingFinal && (
                                    <div className="flex items-center gap-2 mb-4">
                                      <RefreshCcw size={14} className="animate-spin text-[#DC2626]" />
                                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Transcription finalizing...</span>
                                    </div>
                                  )}

                                  {audioUrl && !isRecording && !isProcessingFinal && (
                                    <div className="w-full max-w-sm bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-black text-white/30 uppercase">Recording Preview</p>
                                        <button onClick={handleManualSave} className="flex items-center gap-1.5 bg-[#DC2626] text-white px-3 py-1 rounded-full text-[9px] font-black hover:bg-[#DC2626]/90 transition-all">
                                          <Save size={10} /> SAVE AS...
                                        </button>
                                      </div>
                                      <audio key={audioUrl} src={audioUrl} controls className="w-full h-8" />
                                    </div>
                                  )}

                                  <div className="flex gap-2 w-full max-w-xs">
                                    {audioUrl && !isRecording && !isProcessingFinal && (
                                      <a 
                                        href={audioUrl} 
                                        download="NSG_Lecture.mp3" 
                                        className={`flex-1 flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-white/10 text-white border-white/10' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} px-4 py-3 rounded-2xl text-xs font-bold transition-all border`}
                                      >
                                        <Download size={16} /> Download
                                      </a>
                                    )}
                                    {!isRecording && !isProcessingFinal && (
                                      <button onClick={triggerFullAnalysis} disabled={isAnalyzing || !recordedBlob} className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626]/10 hover:bg-[#DC2626] text-[#DC2626] hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-[#DC2626]/30 transition-all disabled:opacity-50">
                                        <Sparkles size={16} /> Analyze
                                      </button>
                                    )}
                                  </div>

                                  {/* Real-time Transcription/Note Area */}
                                  {(transcriptionNotes || isRecording || isProcessingFinal) && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="w-full mt-8 bg-white/5 border border-white/10 rounded-3xl p-6 text-left"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 ${isRecording || isProcessingFinal ? 'bg-[#DC2626] animate-pulse' : 'bg-green-500'} rounded-full`} />
                                          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                            {(isRecording || isProcessingFinal) ? "Capturing Lecture..." : "Transcribed Lecture Notes"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {(isTranscribing || isProcessingFinal) && <RefreshCcw size={12} className="text-[#DC2626] animate-spin" />}
                                          <button 
                                            onClick={() => copyToClipboard(transcriptionNotes)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                            title="Copy Notes"
                                          >
                                            <Copy size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    <div className={`max-h-60 overflow-y-auto pr-2 custom-scrollbar ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'} text-xs leading-relaxed`}>
                                      <MarkdownRenderer content={transcriptionNotes || (isRecording ? "Listening for content..." : "No notes captured yet.")} />
                                      {isTranscribing && <span className="inline-block w-1.5 h-3 ml-1 bg-[#DC2626]/50 animate-pulse" />}
                                    </div>
                                  </motion.div>
                                )}
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
                                    onClick={() => {
                                      showConfirm(
                                        "Delete Analysis",
                                        "Are you sure you want to delete this analysis result?",
                                        () => {
                                          setAnalysisResult(null);
                                          setShowAnalysisInRecord(false);
                                        },
                                        "Delete",
                                        true
                                      );
                                    }}
                                    className={`p-2 ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-zinc-100 text-zinc-500'} rounded-xl hover:text-red-500 transition-all`}
                                    title="Delete Analysis"
                                  >
                                    <Trash2 size={20} />
                                  </button>
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

                              <div className="bg-white/5 rounded-2xl p-6 overflow-y-auto max-h-[60vh] shadow-inner space-y-6">
                                {audioUrl && (
                                  <div className="space-y-2">
                                    <h3 className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                                      <FileAudio size={12} /> Recording Playback
                                    </h3>
                                    <audio key={audioUrl} src={audioUrl} controls className="w-full h-8" />
                                  </div>
                                )}
                                {selectedSession?.notes && (
                                  <div className="space-y-2">
                                    <h3 className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                                      <Mic size={12} /> Transcribed Notes
                                    </h3>
                                    <div className="bg-white/5 p-4 rounded-xl text-xs text-white/70 italic border-l-2 border-[#DC2626]/30">
                                      {selectedSession.notes}
                                    </div>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <h3 className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                                    <Brain size={12} /> AI Analysis
                                  </h3>
                                  <div className="markdown-body text-sm text-white leading-relaxed">
                                    <MarkdownRenderer content={analysisResult} />
                                  </div>
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

          {/* TOOLS SUB-SECTIONS CONTINUED */}
          {toolsSubTab === 'live' && (
            <motion.div key="live" initial={{opacity:0, scale: 0.95}} animate={{opacity:1, scale: 1}} exit={{opacity: 0}} className="fixed inset-0 z-[100]">
               <GeminiLive onClose={() => setToolsSubTab('menu')} setUserNotification={setUserNotification} theme={theme} />
            </motion.div>
          )}

          {toolsSubTab === 'quiz' && (
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
                    <div className="w-10"></div>
                  </div>

                  {/* Quiz Question Navigation */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {quizQuestions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setSelectedOption(userQuizAnswers[idx] !== undefined ? userQuizAnswers[idx] : null);
                          setIsAnswered(userQuizAnswers[idx] !== undefined);
                        }}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg text-[10px] font-black border transition-all ${
                          currentQuestionIndex === idx 
                            ? 'bg-[#DC2626] border-[#DC2626] text-white' 
                            : userQuizAnswers[idx] !== undefined 
                              ? 'bg-green-500/20 border-green-500/30 text-green-500' 
                              : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border space-y-8 shadow-sm`}>
                    <MarkdownRenderer 
                      content={quizQuestions[currentQuestionIndex].question}
                      className="text-lg font-bold leading-tight text-white"
                    />
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => handleOptionSelect(idx)} 
                          className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${selectedOption === idx ? 'border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]' : 'bg-white/5 border-white/10 text-white/80'}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${selectedOption === idx ? 'border-[#DC2626] bg-[#DC2626] text-white' : 'border-white/20 text-white/40'}`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <div className="flex-1">
                            <MarkdownRenderer 
                              content={option}
                              className="text-sm font-medium"
                            />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-4 flex gap-3">
                      {currentQuestionIndex > 0 && (
                        <button 
                          onClick={prevQuestion}
                          className={`flex-1 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-700'} font-black py-4 rounded-2xl text-sm border transition-all flex items-center justify-center gap-2 uppercase tracking-widest`}
                        >
                          <ChevronRight size={18} className="rotate-180" /> Back
                        </button>
                      )}
                      <button 
                        onClick={nextQuestion}
                        disabled={selectedOption === null}
                        className="flex-[2] bg-[#DC2626] text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                      >
                        {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'} <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {quizState === 'finished' && (
                <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-10 rounded-3xl border text-center space-y-8 shadow-sm`}>
                  <div className="w-24 h-24 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto relative">
                    <Trophy size={48} className="text-[#DC2626]" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-[#DC2626]/5 rounded-full" />
                  </div>
                  <div>
                    <h3 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'} uppercase tracking-tighter`}>Assessment Complete</h3>
                    <p className={`${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} text-sm mt-1`}>You've successfully finished the quiz.</p>
                  </div>
                  <div className={`py-8 border-y ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                    <p className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase tracking-widest mb-1`}>Your Score</p>
                    <p className="text-6xl font-black text-[#DC2626]">{quizScore} / {quizQuestions.length || 1}</p>
                    <p className={`text-xs font-bold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} mt-2 uppercase tracking-widest`}>{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}% Proficiency</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={shareQuiz} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                      <Share2 size={18} /> SHARE QUIZ LINK
                    </button>
                    <button onClick={handleShareResult} className="w-full bg-red-500 hover:bg-red-500/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-2">
                      <Share2 size={18} /> SHARE SCORE CARD
                    </button>
                    <button onClick={() => setQuizState('review')} className="w-full bg-[#DC2626] text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 hover:bg-[#DC2626]/90 transition-all flex items-center justify-center gap-2">
                      <Search size={18} /> CHECK QUIZ RESULTS & EXPLANATIONS
                    </button>
                    <button onClick={() => setQuizState('idle')} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">TRY ANOTHER TOPIC</button>
                  </div>
                </div>
              )}

              {quizState === 'review' && (
                <div className="space-y-6">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-4 rounded-2xl border shadow-sm`}>
                    <button onClick={() => setQuizState('finished')} className="text-white/40 hover:text-[#DC2626] flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back to Results</button>
                    <h3 className="text-sm font-black text-white uppercase tracking-tighter">Detailed Review</h3>
                    <div className="w-10"></div>
                  </div>

                  <div className="space-y-4">
                    {quizQuestions.map((q, qIdx) => {
                      const userAns = userQuizAnswers[qIdx];
                      const isCorrect = userAns === q.correctAnswer;
                      
                      return (
                        <div key={qIdx} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-6 rounded-3xl border space-y-4 shadow-sm`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-[#DC2626] uppercase mb-1">Question {qIdx + 1}</p>
                              <MarkdownRenderer content={q.question} className="text-sm font-bold text-white leading-tight" />
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isUserChoice = userAns === oIdx;
                              const isCorrectChoice = q.correctAnswer === oIdx;
                              
                              let borderClass = 'border-white/5 bg-white/5';
                              let textClass = 'text-white/60';
                              let label = '';
                              
                              if (isCorrectChoice) {
                                borderClass = 'border-green-500/50 bg-green-500/10';
                                textClass = 'text-green-500 font-bold';
                                label = 'CORRECT ANSWER';
                              } else if (isUserChoice && !isCorrect) {
                                borderClass = 'border-[#DC2626]/50 bg-[#DC2626]/10';
                                textClass = 'text-[#DC2626] font-bold';
                                label = 'YOUR CHOICE';
                              } else if (isUserChoice && isCorrect) {
                                label = 'YOUR CHOICE (CORRECT)';
                              }

                              return (
                                <div key={oIdx} className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${borderClass} ${textClass}`}>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${isCorrectChoice ? 'border-green-500 bg-green-500 text-white' : (isUserChoice ? 'border-[#DC2626] bg-[#DC2626] text-white' : 'border-white/20')}`}>
                                    {String.fromCharCode(65 + oIdx)}
                                  </div>
                                  <div className="flex-1 flex flex-col">
                                    <MarkdownRenderer content={opt} />
                                    {label && <span className="text-[8px] font-black uppercase mt-1 opacity-60">{label}</span>}
                                  </div>
                                  {isCorrectChoice && <Check size={14} />}
                                  {isUserChoice && !isCorrect && <X size={14} />}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} border border-dashed border-white/10`}>
                              <p className="text-[9px] font-black text-white/30 uppercase mb-2 flex items-center gap-1.5">
                                <Info size={12} className="text-[#DC2626]" /> Explanation
                              </p>
                              <MarkdownRenderer content={q.explanation} className="text-xs text-white/70 leading-relaxed" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => setQuizState('idle')} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    RETAKE OR TRY NEW TOPIC
                  </button>
                </div>
              )}
            </motion.div>
          )}
                  {toolsSubTab === 'exam' && (

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
                              <p className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'} leading-relaxed italic`}>
                                {isPremium ? "Premium Active: Exam access granted for free." : `This examination requires a one-time access fee of \u{20A6}100. Please complete payment to proceed.`}
                              </p>
                              <button 
                                onClick={() => {
                                  if (isPremium || currentUserData?.bypassTakingPayment || currentUserData?.bypassAllPayments || (currentUserData?.role === 'admin')) {
                                    handleTakingPaymentSuccess({ reference: 'GOD_MODE_BYPASS' });
                                  } else {
                                    initializePayment({ onSuccess: handleTakingPaymentSuccess, onClose: handlePaystackClose });
                                  }
                                }} 
                                className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2"
                              >
                                <CreditCard size={18} /> 
                                {isPremium || currentUserData?.role === 'admin' ? "ENTER EXAM HALL" : "PAY \u{20A6}100 & PROCEED"}
                              </button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className={`w-full text-[10px] font-black ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'} uppercase hover:text-[#DC2626] transition-all`}>Not you? Switch Account</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Exam ID</p>
                            <input type="text" value={examIdInput} onChange={(e) => setExamIdInput(e.target.value.toUpperCase())} placeholder="Enter 7-Character ID" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all font-mono`} />
                          </div>
                          <div className="space-y-2">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Matric Number</p>
                            <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter Matric Number" className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#DC2626]/50 transition-all`} />
                          </div>
                          <button onClick={handleMatricLogin} disabled={isAuthLoading} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                            {isAuthLoading ? <RefreshCcw size={18} className="animate-spin" /> : <Zap size={18} />} VERIFY & PROCEED
                          </button>
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
                      <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'} leading-relaxed`}>This is a professional CBT Mock Exam. You have {examConfig.duration} minutes to answer {examConfig.questionCount} randomized questions. Use only your brain. Good luck.</p>
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

                  {/* Exam Question Navigation */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {examQuestions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentExamIndex(idx)}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg text-[10px] font-black border transition-all ${
                          currentExamIndex === idx 
                            ? 'bg-[#DC2626] border-[#DC2626] text-white' 
                            : examAnswers[idx] !== undefined 
                              ? 'bg-green-500/20 border-green-500/30 text-green-500' 
                              : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-5 sm:p-8 rounded-3xl border space-y-6 sm:space-y-8 shadow-sm`}>
                    <MarkdownRenderer 
                      content={examQuestions[currentExamIndex].question}
                      className={`text-base sm:text-lg font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    />
                    <div className="space-y-3">
                      {examQuestions[currentExamIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => setExamAnswers({ ...examAnswers, [currentExamIndex]: idx })} className={`w-full text-left p-4 rounded-2xl border transition-all ${examAnswers[currentExamIndex] === idx ? 'border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]' : `${theme === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-slate-50 border-slate-200 text-slate-700'}`}`}>
                          <div className="flex items-start gap-3">
                            <MarkdownRenderer 
                              content={option}
                              className="flex-1 text-sm font-medium"
                            />
                          </div>
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
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => setExamLobbyState('review')} 
                      className="w-full bg-[#DC2626] text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 hover:bg-[#DC2626]/90 transition-all flex items-center justify-center gap-2"
                    >
                      <Search size={18} /> REVIEW EXAM & EXPLANATIONS
                    </button>
                    <button 
                      onClick={() => setExamLobbyState('login')} 
                      className={`w-full ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-600'} font-black py-4 rounded-2xl text-sm transition-all`}
                    >
                      LOGOUT
                    </button>
                  </div>
                </div>
              )}

              {examLobbyState === 'review' && (
                <div className="space-y-6">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-4 rounded-2xl border shadow-sm`}>
                    <button onClick={() => setExamLobbyState('result')} className="text-white/40 hover:text-[#DC2626] flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back to Results</button>
                    <h3 className="text-sm font-black text-white uppercase tracking-tighter">Exam Review</h3>
                    <div className="w-10"></div>
                  </div>

                  <div className="space-y-4">
                    {examQuestions.map((q, qIdx) => {
                      const userAns = examAnswers[qIdx];
                      const isCorrect = userAns === q.correctAnswer;
                      
                      return (
                        <div key={qIdx} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-6 rounded-3xl border space-y-4 shadow-sm`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-[#DC2626] uppercase mb-1">Question {qIdx + 1}</p>
                              <MarkdownRenderer content={q.question} className="text-sm font-bold text-white leading-tight" />
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, oIdx) => {
                              const isUserChoice = userAns === oIdx;
                              const isCorrectChoice = q.correctAnswer === oIdx;
                              
                              let borderClass = 'border-white/5 bg-white/5';
                              let textClass = 'text-white/60';
                              let label = '';
                              
                              if (isCorrectChoice) {
                                borderClass = 'border-green-500/50 bg-green-500/10';
                                textClass = 'text-green-500 font-bold';
                                label = 'CORRECT ANSWER';
                              } else if (isUserChoice && !isCorrect) {
                                borderClass = 'border-[#DC2626]/50 bg-[#DC2626]/10';
                                textClass = 'text-[#DC2626] font-bold';
                                label = 'YOUR CHOICE';
                              } else if (isUserChoice && isCorrect) {
                                label = 'YOUR CHOICE (CORRECT)';
                              }

                              return (
                                <div key={oIdx} className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${borderClass} ${textClass}`}>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${isCorrectChoice ? 'border-green-500 bg-green-500 text-white' : (isUserChoice ? 'border-[#DC2626] bg-[#DC2626] text-white' : 'border-white/20')}`}>
                                    {String.fromCharCode(65 + oIdx)}
                                  </div>
                                  <div className="flex-1 flex flex-col">
                                    <MarkdownRenderer content={opt} />
                                    {label && <span className="text-[8px] font-black uppercase mt-1 opacity-60">{label}</span>}
                                  </div>
                                  {isCorrectChoice && <Check size={14} />}
                                  {isUserChoice && !isCorrect && <X size={14} />}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'} border border-dashed border-white/10`}>
                              <p className="text-[9px] font-black text-white/30 uppercase mb-2 flex items-center gap-1.5">
                                <Info size={12} className="text-[#DC2626]" /> Explanation
                              </p>
                              <MarkdownRenderer content={q.explanation} className="text-xs text-white/70 leading-relaxed" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => setExamLobbyState('login')} className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    FINISH REVIEW & LOGOUT
                  </button>
                </div>
              )}
            </motion.div>
          )}
                  {toolsSubTab === 'assignment' && (
                    <motion.div key="assignment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <AssignmentSolver 
                        theme={theme} 
                        user={user} 
                        isPremium={isPremium} 
                        getAiInstance={getAiInstance} 
                        fileToGenerativePart={fileToGenerativePart}
                        setUserNotification={setUserNotification}
                        setChatHistory={setChatHistory}
                        setActiveTab={setActiveTab}
                        setActiveChatSessionId={setActiveChatSessionId}
                        addToFinishedHistory={addToFinishedHistory}
                        finishedHistory={finishedHistory}
                      />
                    </motion.div>
                  )}
                  {toolsSubTab === 'courses' && (
                    <motion.div key="courses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <CoursesTool 
                        theme={theme}
                        user={user}
                        getAiInstance={getAiInstance}
                        getHfInstance={getHfInstance}
                        setUserNotification={setUserNotification}
                        quizTopic={quizTopic}
                        setQuizTopic={setQuizTopic}
                        quizQuestionCount={quizQuestionCount}
                        setQuizQuestionCount={setQuizQuestionCount}
                        quizDifficulty={quizDifficulty}
                        setQuizDifficulty={setQuizDifficulty}
                        generateQuiz={generateQuiz}
                        setToolsSubTab={setToolsSubTab}
                        quizState={quizState}
                        setQuizState={setQuizState}
                      />
                    </motion.div>
                  )}
                  {toolsSubTab === 'faculty' && (
                    <div className="h-full">
                      <AILibrary theme={theme} setUserNotification={setUserNotification} />
                    </div>
                  )}
                  
                  <HelpOverlay 
                    isOpen={showHelp} 
                    onClose={() => setShowHelp(false)} 
                    toolId={toolsSubTab} 
                    theme={theme} 
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className={`flex flex-1 ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/5' : 'bg-white border-slate-200'} rounded-2xl sm:rounded-3xl border overflow-hidden relative shadow-2xl mx-[-8px] sm:mx-0`}>
              
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
                        <button onClick={resetChat} className="w-full flex items-center justify-center gap-2 bg-[#DC2626] text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-[#DC2626]/20 mb-3">
                          <Plus size={18} /> NEW CHAT
                        </button>
                        {chatHistory.length > 0 && (
                          <button 
                            onClick={() => {
                              showConfirm(
                                "Clear Chat",
                                "Are you sure you want to clear all messages in this session?",
                                () => setChatHistory([]),
                                "Clear All",
                                true
                              );
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-white/5 text-white/40 py-3 rounded-xl text-xs font-black hover:text-red-500 transition-all mb-3"
                          >
                            <Trash2 size={16} /> CLEAR ALL
                          </button>
                        )}
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
              <div className="flex-1 flex flex-col relative h-full overflow-hidden">
                <AnimatePresence>
                  {/* Removed legacy isLiveActive trigger as it moved to tools */}
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
                      onClick={() => setToolsSubTab('live')}
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
                      <div className="max-w-2xl w-full text-center space-y-12">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="w-16 h-16 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Brain size={32} className="text-[#DC2626]" />
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-none">
                            Hi {currentUserData?.displayName?.split(' ')?.[0] || 'there'},
                          </h2>
                          <h3 className="text-base sm:text-lg font-black text-white/30 tracking-tighter uppercase">
                            Where should we start?
                          </h3>
                        </motion.div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { icon: ImageIcon, label: 'Create Image', desc: 'Generate creative visuals', color: 'text-blue-400', prompt: 'Generate a creative image of...' },
                            { icon: Mic, label: 'Create Music', desc: 'Compose short melodies', color: 'text-red-400', prompt: 'Compose a short melody about...' },
                            { icon: FileText, label: 'Write Anything', desc: 'Articles, essays & more', color: 'text-green-400', prompt: 'Write a professional article about...' },
                            { icon: BookOpen, label: 'Help Me Learn', desc: 'Explain complex topics', color: 'text-yellow-400', prompt: 'Explain the concept of...' }
                          ].map((btn, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.1 }}
                              onClick={() => setChatInput(btn.prompt)}
                              className="flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 hover:border-[#DC2626]/50 transition-all group text-left relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={14} className="text-white/20" />
                              </div>
                              <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                                <btn.icon size={24} className={btn.color} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-white uppercase tracking-tight">{btn.label}</p>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{btn.desc}</p>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => {
                      const isReport = msg.text.includes('LECTURE ANALYSIS') || msg.text.includes('SUMMARY DATA');
                      return (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[95%] sm:max-w-[85%] flex gap-2 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-[#DC2626]' : 'bg-white/10'}`}>
                              {msg.role === 'user' ? <User size={12} className="sm:size-[16px]" /> : <Brain size={12} className="sm:size-[16px] text-[#DC2626]" />}
                            </div>
                            <div className={`space-y-1 sm:space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                              <div className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                msg.role === 'user' 
                                  ? `${isReport ? 'bg-white/5 border border-white/10 text-white shadow-xl w-full' : 'bg-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20'} rounded-tr-none text-left` 
                                  : `${theme === 'dark' ? 'bg-[#0A101F] text-white/90 border-white/10' : 'bg-slate-50 text-slate-700 border-slate-200'} border rounded-tl-none shadow-sm`
                              }`}>
                                  <MarkdownRenderer content={msg.text} />
                              
                              {msg.role === 'model' && (
                                <div className="mt-2 flex justify-end gap-2">
                                  <button 
                                    onClick={() => copyToClipboard(msg.text)}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-[#DC2626] transition-all border border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                    title="Copy Response"
                                  >
                                    <Copy size={12} /> Copy
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const newHistory = chatHistory.filter((_, idx) => idx !== i);
                                      setChatHistory(newHistory);
                                    }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-500 transition-all border border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                    title="Delete Message"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                              {msg.role === 'user' && (
                                <div className="mt-2 flex justify-start">
                                  <button 
                                    onClick={() => {
                                      const newHistory = chatHistory.filter((_, idx) => idx !== i);
                                      setChatHistory(newHistory);
                                    }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-500 transition-all border border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                    title="Delete Message"
                                  >
                                    <Trash2 size={12} />
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
                    );
                  })
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
                <div className="p-2 sm:p-6 bg-gradient-to-t from-[#0A0F1C] via-[#0A0F1C] to-transparent flex-shrink-0">
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

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Notifications</h2>
                <Bell size={20} className="text-[#DC2626]" />
              </div>

              {selectedArticle ? (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedArticle(null)}
                    className="flex items-center gap-2 text-[10px] font-black text-[#DC2626] uppercase tracking-widest hover:opacity-70 transition-all"
                  >
                    <ArrowLeft size={14} /> Back to List
                  </button>
                  <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border shadow-sm space-y-6`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-[#DC2626] uppercase tracking-widest">
                        <Calendar size={12} />
                        {selectedArticle.timestamp?.toDate ? selectedArticle.timestamp.toDate().toLocaleDateString() : 'Just now'}
                      </div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">{selectedArticle.title}</h2>
                    </div>
                    <div className={`markdown-body text-sm leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                      <MarkdownRenderer content={selectedArticle.content} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
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
                      <div 
                        key={post.id} 
                        onClick={() => {
                          setSelectedArticle(post);
                          markArticleAsRead(post.id);
                        }}
                        className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10 hover:border-[#DC2626]/50' : 'bg-white border-slate-200 hover:border-[#DC2626]/50 shadow-sm'}`}
                      >
                        {!readArticles.includes(post.id) && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-[#DC2626] rounded-full animate-pulse" />
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[8px] font-black text-[#DC2626] uppercase tracking-widest">
                            <Calendar size={10} />
                            {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleDateString() : 'Just now'}
                          </div>
                          <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-[#DC2626] transition-colors">{post.title}</h3>
                          <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">
                            {post.content.replace(/[#*`]/g, '').substring(0, 120)}...
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div 
              key="profile" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }} 
              className="flex-1 flex flex-col overflow-hidden space-y-4 sm:space-y-6 px-2 sm:px-0"
            >
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 sm:space-y-6 pb-4">
              {/* Profile Header Card */}
              <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-4 sm:p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group`}>
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#DC2626]/20 via-[#DC2626]/5 to-transparent opacity-50" />
                
                <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-[#DC2626] overflow-hidden bg-white/5 shadow-2xl shadow-[#DC2626]/30 group-hover:scale-105 transition-transform duration-500">
                      {currentUserData?.photoURL ? (
                        <img src={currentUserData.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10 bg-gradient-to-br from-white/5 to-white/10">
                          <User size={48} className="sm:size-[64px]" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-1 right-1 p-2 bg-[#DC2626] text-white rounded-xl cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all border-2 border-[#0A0F1C] z-10">
                      <Camera size={16} />
                      <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                    </label>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-2 pb-1">
                    <div className="space-y-0.5">
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter italic leading-none">
                          {currentUserData?.displayName || 'Student Name'}
                        </h2>
                        {isPremium && (
                          <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Sparkles size={8} /> Premium
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs font-bold text-[#DC2626] uppercase tracking-[0.3em] opacity-80">
                        {currentUserData?.email || 'email@example.com'}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                        <Calendar size={12} className="text-white/40" />
                        <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Joined 2026</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                        <ShieldCheck size={12} className="text-white/40" />
                        <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="sm:absolute sm:top-6 sm:right-6 flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className={`px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all flex items-center gap-1.5 border ${
                        isEditingProfile 
                        ? 'bg-[#DC2626] text-white border-[#DC2626] shadow-lg shadow-[#DC2626]/20' 
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {isEditingProfile ? <X size={12} /> : <Edit3 size={12} />}
                      {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Lectures', value: sessions.length, icon: BookOpen, color: 'text-blue-500' },
                  { label: 'AI Chats', value: chatSessions.length, icon: MessageSquare, color: 'text-purple-500' },
                  { label: 'Quizzes', value: 12, icon: Trophy, color: 'text-yellow-500' },
                  { label: 'Activity', value: 'High', icon: Activity, color: 'text-green-500' }
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-[#0A0F1C] border border-white/10 p-3 sm:p-4 rounded-2xl text-center space-y-1 hover:border-[#DC2626]/30 transition-all group"
                  >
                    <div className={`w-8 h-8 mx-auto rounded-lg bg-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                      <stat.icon size={16} />
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-white/30 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-sm sm:text-base font-black text-white">{stat.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Editable Fields Section */}
              <div className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border p-4 sm:p-6 rounded-[2rem] shadow-2xl space-y-4 sm:space-y-6`}>
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter italic leading-none">Personal Info</h3>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-1">Academic details</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Strength</span>
                      <span className="text-[9px] font-black text-[#DC2626]">
                        {Math.round(([
                          currentUserData?.displayName,
                          currentUserData?.fullName,
                          currentUserData?.matricNumber,
                          currentUserData?.dob,
                          currentUserData?.university,
                          currentUserData?.level,
                          currentUserData?.department,
                          currentUserData?.faculty,
                          currentUserData?.photoURL
                        ].filter(Boolean).length / 9) * 100)}%
                      </span>
                    </div>
                    <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${([
                          currentUserData?.displayName,
                          currentUserData?.fullName,
                          currentUserData?.matricNumber,
                          currentUserData?.dob,
                          currentUserData?.university,
                          currentUserData?.level,
                          currentUserData?.department,
                          currentUserData?.faculty,
                          currentUserData?.photoURL
                        ].filter(Boolean).length / 9) * 100}%` }}
                        className="h-full bg-[#DC2626]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {[
                    { label: 'Display Name', key: 'displayName', icon: User, placeholder: 'How should we call you?' },
                    { label: 'Full Official Name', key: 'fullName', icon: FileText, placeholder: 'Legal name' },
                    { label: 'Matric Number', key: 'matricNumber', icon: ShieldCheck, placeholder: 'e.g. DEL/2024/001' },
                    { label: 'Date of Birth', key: 'dob', icon: Calendar, placeholder: 'YYYY-MM-DD', type: 'date' },
                    { label: 'University', key: 'university', icon: GraduationCap, placeholder: 'e.g. University of Lagos' },
                    { label: 'Level', key: 'level', icon: Activity, placeholder: 'e.g. 400 Level' },
                    { label: 'Department', key: 'department', icon: Database, placeholder: 'e.g. Computer Science' },
                    { label: 'Faculty', key: 'faculty', icon: LayoutGrid, placeholder: 'e.g. Science' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <field.icon size={10} /> {field.label}
                      </label>
                      <div className="relative group">
                        <input 
                          type={field.type || 'text'} 
                          value={profileFormData[field.key as keyof typeof profileFormData]} 
                          onChange={(e) => setProfileFormData({ ...profileFormData, [field.key]: e.target.value })}
                          disabled={!isEditingProfile}
                          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none transition-all ${
                            isEditingProfile 
                            ? 'text-white focus:border-[#DC2626]/50 focus:bg-white/[0.08]' 
                            : 'text-white/40 cursor-not-allowed'
                          }`} 
                          placeholder={field.placeholder}
                        />
                        {!isEditingProfile && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
                            <Lock size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isEditingProfile && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-2 flex flex-col sm:flex-row gap-3"
                  >
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isAuthLoading}
                      className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAuthLoading ? <RefreshCcw className="animate-spin" size={14} /> : <Save size={14} />}
                      Save Changes
                    </button>
                    <button 
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all border border-white/10"
                    >
                      Discard
                    </button>
                  </motion.div>
                )}

                <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                      <LogOut size={20} className="text-white/20" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white/80 uppercase tracking-tighter italic">Security</p>
                      <p className="text-[7px] font-bold text-white/30 uppercase tracking-widest">Logged in as {user?.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button 
                      onClick={handleLogout}
                      className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                    <button 
                      onClick={() => {
                        showConfirm(
                          "Delete Account",
                          "CRITICAL: This will permanently delete your profile and all your data. This action is irreversible. Continue?",
                          async () => {
                            try {
                              setIsAuthLoading(true);
                              if (user) await deleteDoc(doc(db, 'users', user.uid));
                              await signOut(auth);
                              setUserNotification("Account deleted.");
                            } catch (err) {
                              console.error(err);
                              setUserNotification("Failed to delete account.");
                            } finally {
                              setIsAuthLoading(false);
                            }
                          },
                          "Delete Permanently",
                          true
                        );
                      }}
                      className="w-full sm:w-auto px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} /> Delete Account
                    </button>
                  </div>
                </div>
                
                <div className="pt-8 border-t border-white/5 space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-[#DC2626] uppercase tracking-[0.3em] text-center">About & Policies</h4>
                    <p className="text-[7px] text-white/30 text-center uppercase tracking-widest">Everything you need to know about our lecture OS</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setLegalPage('about')} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all border border-white/10 flex flex-col items-center gap-2 group">
                      <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-all">
                        <User size={14} />
                      </div>
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">About Us</span>
                    </button>
                    <button onClick={() => setLegalPage('terms')} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all border border-white/10 flex flex-col items-center gap-2 group">
                      <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-all">
                        <ShieldCheck size={14} />
                      </div>
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Terms</span>
                    </button>
                    <button onClick={() => setLegalPage('privacy')} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all border border-white/10 flex flex-col items-center gap-2 group">
                      <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-all">
                        <Lock size={14} />
                      </div>
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Privacy</span>
                    </button>
                    <button onClick={() => setLegalPage('contact')} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all border border-white/10 flex flex-col items-center gap-2 group">
                      <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-all">
                        <Zap size={14} />
                      </div>
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Contact</span>
                    </button>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1 pt-2 opacity-20">
                    <p className="text-[8px] font-black uppercase tracking-[0.4em]">Lecture OS v4.0</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest">Â© 2026 NSG Studio</p>
                  </div>
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

                {isAuthLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCcw className="animate-spin text-[#DC2626]" size={32} />
                  </div>
                ) : !isHostPaid ? (
                  <div className="max-w-md mx-auto py-10 sm:py-20 text-center space-y-6 px-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center mx-auto">
                      <ShieldCheck size={32} className="text-[#DC2626] sm:size-[40px]" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">Host Your Own Exam</h2>
                      <p className="text-xs sm:text-sm text-white/40 leading-relaxed">
                        {isPremium ? "Premium Active: You can host professional exams for free." : `Create a professional CBT environment for your students. Hosting fee is \u{20A6}200 per session.`}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        if (isPremium || currentUserData?.bypassHostingPayment || currentUserData?.bypassAllPayments || (currentUserData?.role === 'admin')) {
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
                      <CreditCard size={18} className="sm:size-[20px]" /> 
                      {isPremium || currentUserData?.role === 'admin' ? "ACTIVATE EXAM CLOUD" : "PAY \u{20A6}200 TO START"}
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
                              <p className="text-[8px] sm:text-[10px] font-black text-green-500 uppercase tracking-widest">Exam ID</p>
                              <p className="text-lg font-black font-mono text-white tracking-widest">{hostExamId}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => copyToClipboard(hostExamId)} className="flex-1 sm:flex-none p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2 text-[10px] font-bold"><Copy size={14} /> COPY ID</button>
                            {examStatus === 'active' ? (
                              <motion.button whileTap={{ scale: 0.95 }} onClick={endHostedExam} className="flex-1 sm:flex-none p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2 text-[10px] font-bold" title="End Session Locally"><XCircle size={14} /> END SESSION</motion.button>
                            ) : (
                              <motion.button 
                                whileTap={{ scale: 0.95 }} 
                                onClick={deleteHostedExam} 
                                className={`flex-1 sm:flex-none p-2 ${deleteConfirmStep === 1 ? 'bg-red-700 animate-pulse' : 'bg-red-500'} text-white rounded-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 text-[10px] font-bold`} 
                                title="Delete All Details Permanently"
                              >
                                <Trash2 size={14} /> {deleteConfirmStep === 1 ? 'CONFIRM DELETE' : 'DELETE ALL'}
                              </motion.button>
                            )}
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
                              <input type="number" value={examConfig.questionCount || 0} onChange={(e) => setExamConfig({...examConfig, questionCount: Math.max(1, parseInt(e.target.value) || 0)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase mb-1 text-white/30">Duration (Minutes)</p>
                              <input type="number" value={examConfig.duration || 0} onChange={(e) => setExamConfig({...examConfig, duration: Math.max(1, parseInt(e.target.value) || 0)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase mb-1 text-white/30">Pool Count (AI Generation)</p>
                              <input type="number" value={examConfig.poolCount || 0} onChange={(e) => setExamConfig({...examConfig, poolCount: Math.max(1, parseInt(e.target.value) || 0)})} className="w-full border rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50 transition-all bg-white/5 border-white/10 text-white" />
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
                          <div className="flex items-center gap-2">
                            <motion.button 
                              whileTap={{ scale: 0.9 }}
                              onClick={clearExamResults} 
                              className={`${clearConfirmStep === 1 ? 'text-red-500 animate-pulse' : 'text-white/30'} hover:text-red-500 transition-all`} 
                              title="Clear All Results"
                            >
                              <Trash2 size={16} />
                            </motion.button>
                            <button onClick={downloadResults} className="text-[#DC2626] hover:text-[#DC2626]/80 transition-all"><FileDown size={20} /></button>
                          </div>
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
                                  <p className="text-[10px] font-black text-[#DC2626]">{res.total > 0 ? Math.round((res.score/res.total)*100) : 0}%</p>
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
                                <MarkdownRenderer 
                                  content={`${i + 1}. ${q.question}`}
                                  className="text-[10px] font-bold leading-tight text-white"
                                />
                                <div className="grid grid-cols-2 gap-1">
                                  {q.options.map((opt, idx) => (
                                    <MarkdownRenderer 
                                      key={idx}
                                      content={opt}
                                      className={`text-[8px] px-2 py-1 rounded ${idx === q.correctAnswer ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}
                                    />
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
        {/* FOOTER */}
        <footer className={`w-full px-4 py-8 pb-8 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>
          {user?.email === "nuellkelechi@gmail.com" && (
            <button onClick={() => setShowGodMode(true)} className="text-[#DC2626] hover:text-[#DC2626]/80 transition-colors flex items-center gap-1">
              <ShieldCheck size={12} /> GOD MODE
            </button>
          )}
        </footer>
      </main>

      {/* CUSTOM CONFIRM MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-3xl p-6 shadow-2xl space-y-6`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${confirmModal.isDanger ? 'bg-red-500/10 text-red-500' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className={`font-black uppercase tracking-tighter text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{confirmModal.title}</h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-white shadow-lg ${confirmModal.isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-[#DC2626] hover:bg-[#DC2626]/90 shadow-[#DC2626]/20'}`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <h3 className="font-bold flex items-center gap-2 text-white"><Mail size={18} className="text-[#DC2626]" /> Marketing Emails ({emailTemplates.length})</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={initMarketingTemplates}
                      className="bg-white/5 text-white/40 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-mono"
                    >
                      Init Defaults
                    </button>
                    <button 
                      onClick={() => setTemplateEditForm({ name: '', subject: '', body: '', active: true })}
                      className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DC2626]/80 transition-all flex items-center gap-2 shadow-lg shadow-[#DC2626]/20"
                    >
                      <Plus size={14} /> New Template
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {emailTemplates.length === 0 && <p className="text-[10px] text-white/20 uppercase font-bold text-center py-10">No templates</p>}
                    {emailTemplates.map(t => (
                      <div key={t.id} className={`p-4 rounded-2xl border transition-all cursor-pointer group ${templateEditForm?.id === t.id ? 'bg-[#DC2626]/10 border-[#DC2626]/50 shadow-inner' : 'bg-white/5 border-white/10 hover:border-white/30'}`} onClick={() => setTemplateEditForm(t)}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[10px] font-black uppercase truncate ${t.active ? 'text-white' : 'text-white/20'}`}>{t.name}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(e) => { e.stopPropagation(); deleteEmailTemplate(t.id); }} className="text-white/20 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <p className="text-[8px] font-bold text-white/30 uppercase truncate mt-1">{t.subject}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`md:col-span-2 rounded-3xl p-6 border transition-all ${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-zinc-200'} shadow-sm min-h-[400px]`}>
                    {templateEditForm ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-1">Template Label</p>
                            <input value={templateEditForm.name} onChange={e => setTemplateEditForm({...templateEditForm, name: e.target.value})} className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'} border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#DC2626]/50 transition-all`} placeholder="e.g. Logic Engine Promo" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center px-1">
                              <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Email Subject</p>
                              <span className="text-[6px] font-black text-[#DC2626] uppercase">personalize with ${"{name}"}</span>
                            </div>
                            <input value={templateEditForm.subject} onChange={e => setTemplateEditForm({...templateEditForm, subject: e.target.value})} className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'} border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#DC2626]/50 transition-all`} placeholder="Catchy subject line..." />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center px-1">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Body (${"{name}"} or {"{{name}}"} supported)</p>
                          </div>
                          <textarea 
                            value={templateEditForm.body} 
                            onChange={e => setTemplateEditForm({...templateEditForm, body: e.target.value})} 
                            className={`w-full ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'} border rounded-2xl px-4 py-3 text-[10px] font-mono outline-none focus:border-[#DC2626]/50 transition-all h-64 resize-none leading-relaxed`}
                            placeholder="Hi ${name}, discover our new tools..."
                          />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={templateEditForm.active} onChange={e => setTemplateEditForm({...templateEditForm, active: e.target.checked})} className="sr-only peer" />
                              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#DC2626]"></div>
                              <span className="ml-3 text-[9px] font-black text-white/40 uppercase tracking-widest">Active Template</span>
                            </label>
                          </div>
                          <button onClick={() => handleSaveEmailTemplate(templateEditForm)} className="bg-[#DC2626] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#DC2626]/90 transition-all flex items-center gap-2 shadow-xl shadow-[#DC2626]/20">
                            <Save size={16} /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20 py-20">
                        <Mail size={48} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Select a template to edit</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${templateEditForm?.id ? 'bg-[#DC2626]/20 text-[#DC2626]' : 'bg-white/5 text-white/10'} rounded-2xl flex items-center justify-center transition-all`}>
                      <Zap size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-white leading-tight">Broadcast Engine</p>
                      <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">
                        {templateEditForm?.id ? `Target: "${templateEditForm.name}"` : 'Select a template to enable mass send'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={triggerMarketingBlast}
                    disabled={!templateEditForm?.id}
                    className={`w-full md:w-auto px-10 py-4 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                      templateEditForm?.id 
                        ? 'bg-[#DC2626] hover:bg-red-700 text-white shadow-2xl shadow-red-600/30' 
                        : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    Force Mass Blast
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
                        <th className="py-3 px-2">Academic Info</th>
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
                             <div className="space-y-1">
                                <p className="text-[8px] text-white/60 font-black uppercase truncate max-w-[120px]">{u.university || 'No University'}</p>
                                <p className="text-[8px] text-[#DC2626] font-bold uppercase">{u.level || 'No Level'} \u{2022} {u.department || 'No Dept'}</p>
                                <p className="text-[7px] text-white/30 uppercase font-mono">{u.faculty || 'No Faculty'}</p>
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
                  <button 
                    type="button" 
                    onClick={() => {
                      if (editingPost) {
                        deletePost(editingPost.id);
                        setIsEditingPost(false);
                      }
                    }} 
                    className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl text-sm hover:bg-red-500/20 transition-all"
                  >
                    DELETE
                  </button>
                  <button type="submit" className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-2">
                    <Save size={16} /> SAVE CHANGES
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">University</p>
                    <input type="text" value={editingUser.university || ''} onChange={(e) => setEditingUser({...editingUser, university: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Level</p>
                    <input type="text" value={editingUser.level || ''} onChange={(e) => setEditingUser({...editingUser, level: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Department</p>
                    <input type="text" value={editingUser.department || ''} onChange={(e) => setEditingUser({...editingUser, department: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-2">Faculty</p>
                    <input type="text" value={editingUser.faculty || ''} onChange={(e) => setEditingUser({...editingUser, faculty: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none text-white focus:border-[#DC2626]/50 transition-all" />
                  </div>
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
        {saveModal.isOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`${theme === 'dark' ? 'bg-[#0A0F1C] border-white/10' : 'bg-white border-slate-200'} border rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 shadow-2xl`}>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black">
                  <Save size={32} className="text-[#DC2626]" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Save Recording</h3>
                <p className="text-xs text-white/40">Give your lecture a custom name for easy tracking.</p>
              </div>

              <div className="space-y-1">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Lecture Title</p>
                <input 
                  autoFocus
                  type="text" 
                  value={saveModal.name} 
                  onChange={(e) => setSaveModal(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="e.g. Physics 101 - Newton's Laws" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm outline-none text-white focus:border-[#DC2626]/50 shadow-inner transition-all" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setSaveModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all">CANCEL</button>
                <button 
                  onClick={() => {
                    saveModal.onConfirm(saveModal.name);
                    setSaveModal(prev => ({ ...prev, isOpen: false }));
                  }} 
                  disabled={!saveModal.name.trim()}
                  className="flex-[2] bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-[#DC2626]/20 transition-all disabled:opacity-50"
                >
                  Confirm Save
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showShareModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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

      {/* BOTTOM NAVIGATION */}
      <div className={`fixed bottom-0 left-0 right-0 z-[100] ${theme === 'dark' ? 'bg-[#0A0F1C]/80 border-white/10' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-t px-6 py-3 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.1)]`}>
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-[#DC2626]' : 'text-white/20'}`}>
          <Home size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('ai')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'ai' ? 'text-[#DC2626]' : 'text-white/20'}`}>
          <MessageSquare size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Chat</span>
        </button>
        <button onClick={() => setActiveTab('tools')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'tools' ? 'text-[#DC2626]' : 'text-white/20'}`}>
          <LayoutGrid size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Tools</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-[#DC2626]' : 'text-white/20'}`}>
          <User size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </div>
    </motion.div>
  )}
</AnimatePresence>

      {/* FOOTER REMOVED FROM HERE */}
    </div>
  );
};

// No export default here as it's at the top
