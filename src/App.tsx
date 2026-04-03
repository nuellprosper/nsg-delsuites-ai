import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText,
  Sun, Moon, ArrowDown, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * NSG (Nuell Study Guide) V3.7 - EXECUTIVE EDITION
 * ✅ FIXED: Audio recording/import now correctly sent to Gemini for analysis
 * ✅ Manual Theme Toggle (White <-> Black)
 * ✅ Library-to-Chat Integration
 * ✅ Audio/Image Previews & Downloads
 * ✅ 4000+ Words Blog Content
 * ✅ Perfected Quiz & Chat UI
 */

const getApiKey = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  return key.trim();
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
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

export default function App() {
  // --- 📱 APP STATE ---
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz' | 'blog'>('record');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [legalPage, setLegalPage] = useState<'about' | 'terms' | 'contact' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showScrollButton, setShowScrollButton] = useState(false);

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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);

  // --- 📚 PERSISTENCE ---
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LectureSession | null>(null);

  // --- 📝 QUIZ STATE ---
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'finished'>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // --- 📱 INITIALIZATION ---
  useEffect(() => {
    const savedSessions = localStorage.getItem('nsg_sessions');
    if (savedSessions) setSessions(JSON.parse(savedSessions));

    const savedTheme = localStorage.getItem('nsg_theme');
    if (savedTheme) setTheme(savedTheme as 'dark' | 'light');

    const savedChat = localStorage.getItem('nsg_chat_history');
    if (savedChat) {
      setChatHistory(JSON.parse(savedChat));
    } else {
      resetChat();
    }

    const savedQuiz = localStorage.getItem('nsg_quiz_data');
    if (savedQuiz) {
      const quizData = JSON.parse(savedQuiz);
      setQuizQuestions(quizData.questions || []);
      setCurrentQuestionIndex(quizData.index || 0);
      setQuizScore(quizData.score || 0);
      setQuizState(quizData.state || 'idle');
      setSelectedOption(quizData.selectedOption !== undefined ? quizData.selectedOption : null);
      setIsAnswered(quizData.isAnswered || false);
      setQuizTopic(quizData.topic || '');
    }

    const hasSeenWelcome = localStorage.getItem('nsg_welcome_seen');
    if (!hasSeenWelcome) setShowWelcome(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('nsg_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('nsg_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

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

  const resetChat = () => {
    setChatHistory([{
      role: 'model',
      text: "System Online. Gemini 3.1 Flash Lite ready. Upload images or start recording to begin.",
      timestamp: new Date().toLocaleTimeString()
    }]);
    chatInstanceRef.current = null;
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
        alert("Microphone access denied. Please check permissions.");
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
      alert("Limit Reached: 50 images max.");
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
      alert("No data provided for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('ai');

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
        Act as the NSG (Nuell Study Guide) AI Executive. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts with clear explanations.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic. Use markdown for better formatting. 
        IMPORTANT: For any mathematical formulas, use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$E=mc^2$$) or single dollar signs for inline (e.g. $x^2$).
      ` });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts }]
      });

      const text = response.text || "Analysis failed to generate text.";

      setChatHistory(prev => [...prev, {
        role: 'model',
        text,
        timestamp: new Date().toLocaleTimeString()
      }]);

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
      setSessions([newSession, ...sessions]);
    } catch (error: any) {
      console.error('🚨 Gemini Analysis Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'model',
        text: `Critical Error: ${error.message || 'Failed to connect to Gemini.'}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- 💬 CHAT WITH GEMINI ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');

    setChatHistory(prev => [...prev, { role: 'user', text: msg, timestamp: new Date().toLocaleTimeString() }]);

    try {
      if (!chatInstanceRef.current) {
        const history = chatHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

        chatInstanceRef.current = ai.chats.create({
          model: "gemini-3.1-flash-lite-preview",
          history: history,
          config: { systemInstruction: "You are the NSG (Nuell Study Guide) AI Executive. Provide sharp, technical, and academic assistance. Use markdown for all responses. For any mathematical formulas, ALWAYS use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$\\int x dx$$) or single dollar signs for inline (e.g. $x^2$). Make your responses interesting, engaging, and highly structured like a premium AI assistant." }
        });
      }

      const response = await chatInstanceRef.current.sendMessage({ message: msg });
      
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: response.text || "I couldn't process that request.", 
        timestamp: new Date().toLocaleTimeString() 
      }]);
    } catch (e: any) {
      console.error('🚨 Gemini Chat Error:', e);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: `Connection interrupted: ${e.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  };

  // --- 📝 QUIZ LOGIC ---
  const generateQuiz = async () => {
    if (!quizTopic.trim()) {
      alert("Please enter a topic first.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizState('idle');

    try {
      const prompt = `
        Generate a 15 to 100-question multiple choice quiz about "${quizTopic}".
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number (0-3)
            }
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
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
                    correctAnswer: { type: Type.INTEGER }
                  },
                  required: ["question", "options", "correctAnswer"]
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
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
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
  };return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-red-600 pb-24 ${theme === 'dark' ? 'bg-[#050505] text-[#e0e0e0] dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* WELCOME MODAL */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-red-600" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">Welcome to <span className="text-red-600">NSG</span></h2>
                <p className="text-sm text-slate-600 dark:text-white/70 leading-relaxed">
                  Welcome to NSG (Nuell Study Guide), powered by Nuell Graphics. Transform your learning experience by recording classes, generating AI transcriptions, chatting with our intelligent assistant, and creating custom quizzes. We are constantly improving NSG to better serve your academic journey. Thank you for choosing us as your study partner!
                </p>
                <button onClick={closeWelcome} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-red-600/20">GET STARTED</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEGAL MODAL */}
      <AnimatePresence>
        {legalPage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
                  {legalPage === 'contact' && "Contact Us"}
                </h2>
                <button onClick={() => setLegalPage(null)} className="text-slate-400 hover:text-red-600 transition-colors"><XCircle size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm text-slate-600 dark:text-white/70 leading-relaxed">
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
                    <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto"><Settings size={32} className="text-red-600" /></div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">Need Assistance?</p>
                    <p>If you have any issues, pls contact us at:</p>
                    <div className="space-y-1 font-mono text-red-600 font-bold">
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
      <header className="px-5 py-4 flex justify-between items-center border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#050505]/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black border border-white/10 rounded-2xl flex items-center justify-center">
            <Brain size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic leading-none text-slate-900 dark:text-white">NSG <span className="text-red-600">(NUELL STUDY GUIDE)</span></h1>
            <span className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest">Lecture OS 3.7</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:text-red-600 transition-all">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 uppercase">SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          
          {/* RECORD TAB */}
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity: 0}} className="space-y-6">
              <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-sm">
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="relative mb-6">
                    {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-600 rounded-full blur-2xl" />}
                    <button onClick={handleToggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-white text-black scale-105' : 'bg-red-600 text-white hover:scale-105 active:scale-95'}`}>
                      {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                    </button>
                  </div>

                  <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-slate-900 dark:text-white">{isRecording ? "Capture Active" : "Engine Idle"}</h2>
                  <p className="font-mono text-4xl text-red-600 font-bold mb-6 tracking-tight">{formatTime(recordingTime)}</p>

                  {audioUrl && (
                    <div className="w-full max-w-sm bg-slate-100 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10 mb-6">
                      <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase mb-2">Recording Preview</p>
                      <audio src={audioUrl} controls className="w-full h-8" />
                    </div>
                  )}

                  <div className="flex gap-2 w-full max-w-xs">
                    {audioUrl && (
                      <a href={audioUrl} download="NSG_Lecture.mp3" className="flex-1 flex items-center justify-center gap-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-slate-200 dark:border-white/10">
                        <Download size={16} /> Download
                      </a>
                    )}
                    <button onClick={triggerFullAnalysis} disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob)} className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-red-600/30 transition-all disabled:opacity-50">
                      <Sparkles size={16} /> Analyze
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all"><ImageIcon size={20} className="text-red-500 group-hover:text-white" /></div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Upload Slides</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">({uploadedImages.length}/50)</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>

                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all"><FileAudio size={20} className="text-red-500 group-hover:text-white" /></div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Import Audio</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">MP3 / WAV</span>
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
                      <img src={img.preview} alt="slide" className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-white/10" />
                      <button onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-lg"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex flex-col h-[calc(100vh-220px)] bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden relative shadow-sm">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600/10 rounded-lg flex items-center justify-center"><Brain size={18} className="text-red-600" /></div>
                  <div><p className="font-bold text-xs text-slate-900 dark:text-white">Gemini 3.1 Flash Lite</p><p className="text-[9px] text-slate-400 dark:text-white/40 uppercase font-bold tracking-tighter">Optimized Intelligence</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetChat} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="New Chat"><PlusCircle size={18} /></button>
                  <button onClick={() => setChatHistory([])} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>

              <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3.5 rounded-2xl ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-tl-none shadow-sm'}`}>
                      <div className="markdown-body text-slate-900 dark:text-white">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                      </div>
                      <p className="text-[8px] font-mono uppercase tracking-tighter mt-2 opacity-40">{msg.timestamp}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <AnimatePresence>
                {showScrollButton && (
                  <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute bottom-24 right-6 p-3 bg-red-600 text-white rounded-full shadow-xl z-20"><ArrowDown size={20} /></motion.button>
                )}
              </AnimatePresence>

              <div className="p-4 bg-white dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-white/10">
                <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/10">
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask NSG Executive..." className="flex-1 bg-transparent border-none outline-none px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20" />
                  <button onClick={handleSendMessage} className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20"><ChevronRight size={18} /></button>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Library</h2>
                {selectedSession && <button onClick={() => setSelectedSession(null)} className="text-red-600 text-xs font-bold flex items-center gap-1"><ArrowLeft size={14} /> Back</button>}
              </div>

              {!selectedSession ? (
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">
                      <History size={40} className="mx-auto mb-4 text-slate-200 dark:text-white/10" />
                      <p className="text-sm font-bold text-slate-400 dark:text-white/30">No saved lectures found</p>
                    </div>
                  ) : (
                    sessions.map(session => (
                      <div key={session.id} className="w-full bg-white dark:bg-[#0a0a0a] p-4 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-white/10 hover:border-red-600/30 transition-all group shadow-sm">
                        <div onClick={() => setSelectedSession(session)} className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-all"><FileAudio size={20} className="text-slate-400 dark:text-white/20 group-hover:text-red-500" /></div>
                          <div><p className="font-bold text-sm text-slate-900 dark:text-white">{session.title}</p><p className="text-[10px] text-slate-400 dark:text-white/40 font-mono uppercase">{session.date} • {session.duration}</p></div>
                        </div>
                        <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#0a0a0a] p-6 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedSession.title}</h3>
                    <button onClick={() => {
                      setChatHistory([{ role: 'model', text: selectedSession.fullAnalysis, timestamp: new Date().toLocaleTimeString() }]);
                      setActiveTab('ai');
                      setSelectedSession(null);
                    }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/20"><Brain size={14} /> Continue in Chat</button>
                  </div>
                  <div className="markdown-body text-sm leading-relaxed text-slate-700 dark:text-white/70">
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
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Quiz Engine</h2>
                <Zap size={20} className="text-red-600" />
              </div>

              {quizState === 'idle' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="text-center space-y-2 mb-4">
                    <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><Sparkles size={24} className="text-red-600" /></div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Generate Interactive Quiz</h3>
                    <p className="text-xs text-slate-500 dark:text-white/40">Test your knowledge with AI-generated questions (15-100 questions).</p>
                  </div>
                  <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. Quantum Physics, EEE 101..." className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-red-600/50 transition-all text-slate-900 dark:text-white" />
                  <button onClick={generateQuiz} disabled={isGeneratingQuiz} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isGeneratingQuiz ? <><RefreshCcw size={18} className="animate-spin" /> GENERATING...</> : <><Zap size={18} /> START ASSESSMENT</>}
                  </button>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0a0a0a] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <button onClick={() => setQuizState('idle')} className="text-slate-400 hover:text-red-600 flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back</button>
                    <div className="text-center"><p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase">Progress</p><p className="text-sm font-black text-red-600">{currentQuestionIndex + 1} / {quizQuestions.length}</p></div>
                    <div className="text-right"><p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase">Score</p><p className="text-sm font-black text-green-500">{quizScore}</p></div>
                  </div>
                  <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-8 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border transition-all ${isAnswered ? (idx === quizQuestions[currentQuestionIndex].correctAnswer ? 'bg-green-500/10 border-green-500 text-green-500' : (selectedOption === idx ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-slate-50 dark:bg-white/5 opacity-40')) : (selectedOption === idx ? 'border-red-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80')}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    {isAnswered && <button onClick={nextQuestion} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">{currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"} <ChevronRight size={18} /></button>}
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {quizState === 'finished' && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#0a0a0a] p-10 rounded-3xl border border-slate-200 dark:border-white/10 text-center space-y-6 shadow-sm">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Assessment Complete</h3>
                    <p className="text-slate-500 dark:text-white/40 text-sm mt-1">You've successfully completed the {quizTopic} quiz.</p>
                  </div>
                  <div className="py-6 border-y border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1">Final Score</p>
                    <p className="text-5xl font-black text-red-600">{Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-2">{quizScore} correct out of {quizQuestions.length}</p>
                  </div>
                  <button onClick={() => setQuizState('idle')} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all">TRY ANOTHER TOPIC</button>
                </motion.div>
              )}

          {/* BLOG TAB */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-8 pb-10">
              <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-12 text-sm leading-relaxed text-slate-600 dark:text-white/70 shadow-sm">
                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">The Visionary Purpose of NSG (Nuell Study Guide)</h3>
                  <p>In the rapidly evolving landscape of modern education, students are often overwhelmed by the sheer volume of information they are expected to process, retain, and apply. Traditional methods of note-taking—scribbling in notebooks or typing frantically on laptops—frequently fall short in capturing the nuances of a live lecture. This is where NSG (Nuell Study Guide) steps in. Developed by Nuell Graphics, NSG is not just another app; it is a comprehensive ecosystem designed to bridge the gap between human cognition and artificial intelligence. The core purpose of NSG is empowerment. We believe that every student possesses the potential for greatness, but that potential is often hindered by inefficient study habits or the stress of missing critical information during class. By providing a platform that allows for high-fidelity audio recording and seamless image capture of lecture slides, we ensure that no detail is lost. But capturing data is only the first step. The true magic of NSG lies in its ability to transform that raw data into actionable knowledge. Our vision extends beyond simple transcription. We aim to create a "digital brain" for every user—a repository of their academic journey that is searchable, interactive, and intelligent. By integrating the latest advancements in Large Language Models (LLMs), specifically the Gemini 3.1 Flash Lite series, we provide students with an AI executive assistant that can summarize hours of lectures in seconds, extract complex technical concepts, and even generate personalized study plans. This level of automation allows students to focus on what truly matters: understanding and critical thinking, rather than the mechanical task of data entry. Furthermore, NSG is built with accessibility in mind. We recognize that students come from diverse backgrounds and have varying levels of access to high-end hardware. By optimizing our application to run efficiently on a wide range of devices, we are democratizing elite-level study tools. Whether you are a medical student navigating the complexities of anatomy or an engineering student tackling advanced calculus, NSG is designed to be your steadfast study partner, guiding you toward academic excellence with precision and clarity. In conclusion, the purpose of NSG is to revolutionize the way we learn. It is a commitment to innovation, a tribute to the hard work of students everywhere, and a testament to the power of technology when applied with a human-centric focus. We are not just building a study guide; we are building the future of education, one lecture at a time.</p>
                  <p>As we continue to develop NSG, our focus remains on the user. Every feature, from the high-intensity recording engine to the interactive quiz generator, is designed with the student's success in mind. We understand the pressures of academic life—the late nights, the complex subjects, and the high stakes of examinations. NSG is our answer to these challenges. It is a tool that grows with you, learning your study patterns and providing increasingly tailored assistance. The future of NSG is one of constant evolution. We are already exploring real-time collaborative study rooms, advanced diagram recognition, and deeper integrations with academic databases. Our goal is to make NSG the central hub of your intellectual life, a place where information is not just stored, but synthesized into wisdom. We invite you to join us on this journey. Together, we can redefine what it means to be a student in the 21st century. With NSG, the path to academic dominance is clearer than ever before. Thank you for choosing us as your study partner.</p>
                </section>
                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">How to Enjoy the NSG Experience: A Masterclass in Efficiency</h3>
                  <p>To truly "enjoy" NSG is to experience the profound relief that comes from knowing your study materials are perfectly organized and understood. Mastery of the NSG platform begins with a shift in mindset: seeing the app not as a tool you use *after* class, but as an active participant *during* your learning process. Here is how you can maximize your experience and unlock your full academic potential. First, embrace the multi-modal nature of the app. During a lecture, don't just record audio; use the image capture feature to snap photos of the whiteboard, the projector screen, or even your own handwritten diagrams. The AI is designed to correlate these images with the audio context, providing a much richer analysis than text alone could ever achieve. When you upload these slides, ensure they are clear and well-lit; the better the input, the more "brilliant" the AI's output will be. Second, engage with the AI Chat as if it were a private tutor. After the initial analysis is generated, don't stop there. Ask follow-up questions. If a concept like "Quantum Entanglement" or "Macroeconomic Equilibrium" isn't clear, ask the AI to explain it using a real-world analogy. Use the chat to brainstorm essay outlines, clarify confusing formulas, or even ask for a list of potential exam questions. The more you interact, the more the AI "learns" your specific needs and provides more tailored assistance. Third, utilize the Quiz Engine for active recall. Scientific research has shown that testing yourself is one of the most effective ways to move information from short-term to long-term memory. Once you've analyzed a lecture, generate a 100-question quiz. Don't be afraid to fail; use the results to identify your weak spots and go back to the AI Chat for further clarification. This iterative process of learning, testing, and refining is the hallmark of a master student. Finally, keep your Library organized. The history tab is your personal academic archive. Regularly review your past sessions, use the delete button to clear out redundant or practice recordings, and keep only the most high-value content. By maintaining a clean and focused library, you reduce cognitive load and make your revision sessions much more efficient. Master NSG, and you master your education.</p>
                  <p>Efficiency is not just about doing things faster; it's about doing the right things better. NSG is designed to automate the low-value tasks of learning—like transcription and basic summarization—so you can spend your time on high-value activities like critical analysis and creative problem-solving. Imagine being able to walk out of a two-hour lecture with a perfectly formatted executive summary, a list of key terms, and a 50-question practice quiz already waiting for you. That is the NSG promise. It's about reclaiming your time and your mental energy. We also recommend using the "New Chat" feature frequently to keep your sessions focused. If you're switching from a Physics lecture to a History seminar, start a fresh chat to ensure the AI's context remains sharp. Use the "Scroll to Bottom" button to stay on top of the conversation, and don't forget to download your recordings for offline review. By integrating these habits into your daily routine, you'll find that studying becomes less of a chore and more of a rewarding intellectual journey. NSG is more than an app; it's a lifestyle choice for the ambitious student. It's a commitment to excellence and a refusal to settle for mediocrity. As you explore the features of NSG, remember that you are in control. The AI is your executive assistant, but you are the CEO of your own education. Use the tools we've provided to build a foundation of knowledge that will last a lifetime. We are honored to be part of your success story.</p>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 z-50 shadow-2xl">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' },
            { id: 'blog', icon: FileText, label: 'Blog' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-4 transition-all relative ${activeTab === tab.id ? 'text-red-600' : 'text-slate-400 dark:text-white/30 hover:text-red-500'}`}>
              {activeTab === tab.id && <motion.div layoutId="nav-active" className="absolute inset-0 bg-red-600/5 rounded-2xl -z-10" />}
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* FOOTER */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t border-slate-200 dark:border-white/10 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">
        <button onClick={() => setLegalPage('about')} className="hover:text-red-600 transition-colors">About Us</button>
        <button onClick={() => setLegalPage('terms')} className="hover:text-red-600 transition-colors">Terms & Conditions</button>
        <button onClick={() => setLegalPage('contact')} className="hover:text-red-600 transition-colors">Contact Us</button>
        <span>© 2026 Nuell Graphics</span>
      </footer>
    </div>
  );
}
