import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText,
  Sun, Moon, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * NSG (Nuell Study Guide) V3.0
 * ✅ Fixed motion/react build error
 * ✅ Fixed duplicate key error
 * ✅ LocalStorage Persistence (Chat, Quiz, History)
 * ✅ LaTeX Math Support
 * ✅ Gemini 3 Flash Optimization (Stable)
 * ✅ Fixed Render API Key Access
 * ✅ Manual Theme Toggle (Light/Dark)
 * ✅ Chat Scroll-to-Bottom Button
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
  analyzed?: boolean;
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

async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
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
      setChatHistory([{
        role: 'model',
        text: "System Online. Gemini 3.1 Flash Lite ready. Upload images or start recording to begin.",
        timestamp: new Date().toLocaleTimeString()
      }]);
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
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
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
    if (chatContainerRef.current) {
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
          const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
          saveSession("Recorded Lecture", formatTime(recordingTime));
        };

        mediaRecorderRef.current = recorder;
        recorder.start(5000);
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
      alert("Executive Limit Reached: 50 images max.");
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
      const imageParts = await Promise.all(
        uploadedImages.map(img => fileToGenerativePart(img.file))
      );

      const prompt = `
        Act as the NSG (Nuell Study Guide) AI Executive. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts with clear explanations.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic. Use markdown for better formatting. 
        IMPORTANT: For any mathematical formulas, use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$E=mc^2$$) or single dollar signs for inline (e.g. $x^2$).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }, ...imageParts] }]
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
        title: `Lecture Analysis ${new Date().toLocaleTimeString()}`, 
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
    if (!quizTopic.trim() && uploadedImages.length === 0) {
      alert("Please enter a topic or upload lecture slides first.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizState('idle');

    try {
      const imageParts = await Promise.all(
        uploadedImages.map(img => fileToGenerativePart(img.file))
      );

      const prompt = `
        Generate a 15 to 100-question multiple choice quiz about "${quizTopic || 'the provided lecture content'}".
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
        contents: [{ parts: [{ text: prompt }, ...imageParts] }],
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

  const saveSession = (title: string, duration: string) => {
    const newSession: LectureSession = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString(),
      duration,
      imageCount: uploadedImages.length,
      summary: "Lecture recorded and ready for analysis.",
      fullAnalysis: "Recording saved. Trigger analysis for full details.",
      images: []
    };
    setSessions([newSession, ...sessions]);
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('nsg_welcome_seen', 'true');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-red-600 pb-24 ${theme === 'dark' ? 'bg-[#050505] text-[#e0e0e0] dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* WELCOME MODAL */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-red-600" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic">Welcome to <span className="text-red-600">NSG</span></h2>
                <p className="text-sm text-white/70 leading-relaxed">
                  Welcome to NSG (Nuell Study Guide), powered by Nuell Graphics. Transform your learning experience by recording classes, generating AI transcriptions, chatting with our intelligent assistant, and creating custom quizzes. We are constantly improving NSG to better serve your academic journey. Thank you for choosing us as your study partner!
                </p>
                <button 
                  onClick={closeWelcome}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-red-600/20"
                >
                  GET STARTED
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEGAL MODAL */}
      <AnimatePresence>
        {legalPage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
                  {legalPage === 'contact' && "Contact Us"}
                </h2>
                <button onClick={() => setLegalPage(null)} className="text-white/40 hover:text-white transition-colors">
                  <XCircle size={24} />
                </button>
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
                      <li>We reserve the right to update the application and its features.</li>
                    </ul>
                  </>
                )}
                {legalPage === 'contact' && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto">
                      <Settings size={32} className="text-red-600" />
                    </div>
                    <p className="text-lg font-bold">Need Assistance?</p>
                    <p>If you have any issues, pls contact us at:</p>
                    <div className="space-y-1 font-mono text-red-500">
                      <p>nuellkelechi@gmail.com</p>
                      <p>07046732569</p>
                    </div>
                    <p className="text-xs text-white/40">Thank you for your support!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>{/* 💰 TOP AD SLOT */}
      <div className="w-full bg-[#0a0a0a] border-b border-white/10 p-2 sticky top-0 z-50">
        <div className="max-w-[728px] h-10 mx-auto bg-white/5 rounded-2xl flex items-center justify-center border border-dashed border-white/20 text-[10px] font-black tracking-widest text-white/30">
          AD SLOT • 728×90
        </div>
      </div>

      {/* HEADER */}
      <header className="px-5 py-4 flex justify-between items-center border-b border-white/10 bg-[#050505]/95 backdrop-blur-xl sticky top-12 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black border border-white/10 rounded-2xl flex items-center justify-center">
            <Brain size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic leading-none">NSG <span className="text-red-600">(NUELL STUDY GUIDE)</span></h1>
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Lecture OS 3.0</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:text-red-500 transition-all"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white/60">SYSTEM READY</span>
          </div>
          <button className="text-white/70 hover:text-red-500 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          
          {/* RECORD TAB */}
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity: 0}} className="space-y-6">
              <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-sm">
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="relative mb-6">
                    {isRecording && (
                      <motion.div 
                        animate={{ scale: 1.6, opacity: 0.1 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-red-600 rounded-full blur-2xl"
                      />
                    )}
                    <button 
                      onClick={handleToggleRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-white text-black scale-105' : 'bg-red-600 text-white hover:scale-105 active:scale-95'}`}
                    >
                      {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                    </button>
                  </div>

                  <h2 className="text-xl font-black tracking-tighter mb-1 uppercase">
                    {isRecording ? "Capture Active" : "Engine Idle"}
                  </h2>
                  <p className="font-mono text-4xl text-red-600 font-bold mb-6 tracking-tight">
                    {formatTime(recordingTime)}
                  </p>

                  <div className="flex gap-2 w-full max-w-xs">
                    {audioUrl && (
                      <a href={audioUrl} download="Lecture.mp3" 
                         className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all">
                        <Download size={16} /> Export
                      </a>
                    )}
                    <button 
                      onClick={triggerFullAnalysis}
                      disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-red-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles size={16} /> Analyze
                    </button>
                  </div>
                </div>
                
                {/* Visualizer effect */}
                {isRecording && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 flex items-end justify-center gap-0.5 px-4">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, Math.random() * 20 + 4, 4] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                        className="w-full bg-red-600/40 rounded-t-full"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Grid */}
              <div className="grid grid-cols-2 gap-3">
                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <ImageIcon size={20} className="text-red-500 group-hover:text-white" />
                  </div>
                  <span className="font-bold text-xs">Upload Slides</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">({uploadedImages.length}/50)</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>

                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <FileAudio size={20} className="text-red-500 group-hover:text-white" />
                  </div>
                  <span className="font-bold text-xs">Import Audio</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">MP3 / WAV</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAudioUrl(URL.createObjectURL(file));
                      alert(`Audio "${file.name}" imported successfully.`);
                    }
                  }} />
                </label>
              </div>

              {/* Image Previews */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <img src={img.preview} alt="slide" className="w-16 h-16 object-cover rounded-xl border border-white/10" />
                      <button 
                        onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                        className="absolute -top-1 -right-1 bg-black border border-white/20 rounded-full p-0.5 text-red-500"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex flex-col h-[calc(100vh-220px)] bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden relative shadow-sm">
              {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-white/90 dark:bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm">
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} 
                    className="w-10 h-10 border-2 border-red-600/20 border-t-red-600 rounded-full mb-4" 
                  />
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse">Analyzing Lecture Data...</p>
                </div>
              )}

              {/* Chat header */}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600/10 rounded-lg flex items-center justify-center">
                    <Brain size={18} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Gemini 3.1 Flash Lite</p>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      <p className="text-[9px] text-slate-400 dark:text-white/40 uppercase font-bold tracking-tighter">Optimized Intelligence</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setChatHistory([])} className="text-slate-400 dark:text-white/30 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Messages */}
              <div 
                ref={chatContainerRef} 
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
              >
                {chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[92%] sm:max-w-[85%] group relative ${msg.role === 'user' ? 'bg-red-600 text-white rounded-2xl rounded-tr-none shadow-lg shadow-red-600/10' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-none shadow-sm'} px-4 py-3.5 transition-all`}>
                      {msg.role === 'model' && (
                        <button 
                          onClick={() => { navigator.clipboard.writeText(msg.text); alert("Copied to clipboard!"); }}
                          className="absolute -right-2 -top-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-slate-400 hover:text-red-600 z-10"
                        >
                          <Download size={12} />
                        </button>
                      )}
                      <div className="markdown-body">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                      <div className={`flex items-center gap-1 mt-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[8px] font-mono uppercase tracking-tighter ${msg.role === 'user' ? 'text-white/50' : 'text-slate-400 dark:text-white/20'}`}>
                          {msg.timestamp}
                        </span>
                        {msg.role === 'model' && <Sparkles size={8} className="text-red-500/50" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Scroll to bottom button */}
              <AnimatePresence>
                {showScrollButton && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-6 p-3 bg-red-600 text-white rounded-full shadow-xl hover:bg-red-700 transition-all z-20"
                  >
                    <ArrowDown size={20} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Input bar */}
              <div className="p-4 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-t border-slate-200 dark:border-white/10">
                <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/10">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask NSG Executive..."
                    className="flex-1 bg-transparent border-none outline-none px-3 text-sm placeholder:text-slate-400 dark:placeholder:text-white/20"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              {selectedSession ? (
                <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setSelectedSession(null)} className="flex items-center gap-2 text-slate-400 dark:text-white/40 hover:text-red-500 transition-colors">
                      <ArrowLeft size={20} /> <span className="text-xs font-bold uppercase">Back to Library</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSessions(prev => prev.filter(s => s.id !== selectedSession.id));
                        setSelectedSession(null);
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-2">{selectedSession.title}</h2>
                  <div className="flex gap-4 text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-8 pb-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-1"><History size={12} /> {selectedSession.date}</div>
                    <div className="flex items-center gap-1"><Play size={12} /> {selectedSession.duration}</div>
                    <div className="flex items-center gap-1"><ImageIcon size={12} /> {selectedSession.imageCount} Slides</div>
                  </div>

                  <div className="markdown-body text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {selectedSession.fullAnalysis}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {sessions.length === 0 ? (
                    <div className="bg-white dark:bg-[#0a0a0a] p-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center text-center">
                      <Database size={48} className="text-slate-200 dark:text-white/5 mb-4" />
                      <p className="text-sm font-bold text-slate-400 dark:text-white/20 uppercase tracking-widest">Library Empty</p>
                      <p className="text-[10px] text-slate-300 dark:text-white/10 mt-1">Start recording to build your knowledge base.</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div 
                        key={session.id} 
                        onClick={() => setSelectedSession(session)}
                        className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center group-hover:bg-red-600 transition-all">
                            <FileAudio size={24} className="text-red-500 group-hover:text-white" />
                          </div>
                          <div>
                            <h3 className="font-black text-sm uppercase italic tracking-tight">{session.title}</h3>
                            <p className="text-[10px] text-slate-400 dark:text-white/30 font-bold uppercase tracking-widest">{session.date} • {session.duration}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessions(prev => prev.filter(s => s.id !== session.id));
                            }}
                            className="p-2 text-slate-400 dark:text-white/20 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={20} className="text-slate-200 dark:text-white/10 group-hover:text-red-600 transition-all" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* QUIZ TAB */}
          {activeTab === 'quiz' && (
            <motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              {quizState === 'idle' && (
                <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 border border-slate-200 dark:border-white/10 text-center shadow-sm">
                  <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Zap size={32} className="text-red-600" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-2">Knowledge Assessment</h2>
                  <p className="text-sm text-slate-500 dark:text-white/40 mb-8 max-w-sm mx-auto">Generate high-intensity quizzes from your lecture data or any specific topic.</p>
                  
                  <div className="space-y-4 max-w-md mx-auto">
                    <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/10">
                      <input 
                        value={quizTopic}
                        onChange={(e) => setQuizTopic(e.target.value)}
                        placeholder="Enter quiz topic (e.g. Quantum Physics)..."
                        className="w-full bg-transparent border-none outline-none px-4 py-2 text-sm"
                      />
                    </div>
                    <button 
                      onClick={generateQuiz}
                      disabled={isGeneratingQuiz}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingQuiz ? (
                        <>
                          <RefreshCcw size={18} className="animate-spin" />
                          GENERATING...
                        </>
                      ) : (
                        <>
                          <Cpu size={18} />
                          START ASSESSMENT
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <div className="px-3 py-1 bg-red-600/10 rounded-full border border-red-600/20">
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Question {currentQuestionIndex + 1} / {quizQuestions.length}</span>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Score: {quizScore}</div>
                  </div>

                  <h3 className="text-lg font-bold leading-tight mb-8">{quizQuestions[currentQuestionIndex].question}</h3>

                  <div className="space-y-3">
                    {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border ${
                          isAnswered 
                            ? idx === quizQuestions[currentQuestionIndex].correctAnswer
                              ? 'bg-green-500/10 border-green-500 text-green-500'
                              : idx === selectedOption
                                ? 'bg-red-500/10 border-red-500 text-red-500'
                                : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-50'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-red-600/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          {isAnswered && idx === quizQuestions[currentQuestionIndex].correctAnswer && <CheckCircle2 size={16} />}
                          {isAnswered && idx === selectedOption && idx !== quizQuestions[currentQuestionIndex].correctAnswer && <XCircle size={16} />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {isAnswered && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={nextQuestion}
                      className="w-full mt-8 bg-white dark:bg-white text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {currentQuestionIndex === quizQuestions.length - 1 ? "Finish Quiz" : "Next Question"}
                    </motion.button>
                  )}
                </div>
              )}

              {quizState === 'finished' && (
                <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-12 border border-slate-200 dark:border-white/10 text-center shadow-sm">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} className="text-green-500" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-2">Assessment Complete</h2>
                  <p className="text-slate-500 dark:text-white/40 mb-8">You've successfully completed the knowledge check.</p>
                  
                  <div className="bg-slate-50 dark:bg-white/5 rounded-3xl p-8 mb-8 border border-slate-200 dark:border-white/10">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest mb-2">Final Score</p>
                    <p className="text-6xl font-black text-red-600 tracking-tighter">{Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                    <p className="text-sm font-bold mt-2">{quizScore} correct out of {quizQuestions.length}</p>
                  </div>

                  <button 
                    onClick={() => setQuizState('idle')}
                    className="bg-red-600 hover:bg-red-700 text-white font-black px-10 py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-600/20"
                  >
                    New Assessment
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* BLOG TAB */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-8 pb-12">
              <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 border border-slate-200 dark:border-white/10 shadow-sm">
                <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-6 border-b border-slate-200 dark:border-white/10 pb-4">The NSG Intelligence Report</h2>
                
                <article className="space-y-12 text-slate-700 dark:text-white/80 leading-relaxed">
                  {/* Section 1 */}
                  <section className="space-y-4">
                    <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">1. The Purpose of NSG: Revolutionizing Academic Excellence</h3>
                    <p>In the rapidly evolving landscape of modern education, the sheer volume of information presented to students can be overwhelming. Traditional note-taking often fails to capture the nuance of a complex lecture, leaving learners with fragmented knowledge. This is where NSG (Nuell Study Guide) enters the arena. Our primary purpose is to bridge the gap between passive listening and active mastery. By providing a unified platform that integrates high-fidelity audio recording, visual slide capture, and state-of-the-art artificial intelligence, NSG transforms the way students interact with academic content.</p>
                    <p>Our vision extends beyond simple transcription. We aim to provide a cognitive exoskeleton for students, specifically the Gemini 3.1 Flash Lite series, which allows for real-time processing of complex data. NSG is designed to identify key technical concepts, generate executive summaries, and create interactive assessments that challenge the user's understanding. We believe that every student deserves access to premium study tools that were once the domain of elite institutions. NSG democratizes academic success by putting a powerful AI executive in the pocket of every learner.</p>
                    <p>The core philosophy of NSG is "Effortless Mastery." We want students to focus on understanding the material, not the mechanics of capturing it. Whether you are in a crowded lecture hall, a quiet seminar, or a remote Zoom session, NSG is your silent partner, meticulously documenting and analyzing every word and image. This allows for a deeper level of engagement during the class, knowing that a comprehensive study guide will be waiting for you at the touch of a button. Our commitment to this purpose drives every update and feature we implement.</p>
                  </section>

                  {/* Section 2 */}
                  <section className="space-y-4">
                    <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">2. How to Enjoy the NSG Experience: A Masterclass in Study Efficiency</h3>
                    <p>To truly unlock the potential of NSG, one must approach it as a comprehensive study ecosystem rather than just a recording app. The journey begins in the "Record" tab. For maximum efficiency, we recommend uploading your lecture slides before the class begins. This gives the AI context and allows it to correlate your audio recording with specific visual data. During the lecture, simply hit the high-intensity record button. The visualizer will confirm that the engine is capturing every frequency of the professor's voice.</p>
                    <p>Once the lecture concludes, the real magic happens in the "AI Chat" tab. Trigger the "Analyze" function to receive a multi-layered breakdown of the session. Don't just read the summary—interact with it. Use the chat interface to ask follow-up questions like "Can you explain the third concept in simpler terms?" or "How does this relate to last week's lecture on thermodynamics?" The Gemini 3.1 Flash Lite model is trained to handle these complex queries with academic precision. This interactive dialogue is where true understanding is forged.</p>
                    <p>Finally, solidify your knowledge in the "Quiz" tab. We recommend generating a quiz immediately after your first review of the AI analysis. This leverages the "Testing Effect," a proven psychological principle that active recall significantly improves long-term retention. Challenge yourself with the 15 to 100-question assessments. Review your score, identify your weak points, and go back to the chat to clarify those specific areas. By following this workflow—Capture, Analyze, Interact, and Assess—you turn a single lecture into a permanent part of your intellectual toolkit.</p>
                  </section>

                  {/* Section 3 */}
                  <section className="space-y-4">
                    <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">3. Navigating the Quota Frontier: Understanding API Limits</h3>
                    <p>As a cutting-edge application, NSG utilizes the Gemini 3.1 Flash Lite API from Google. This is a premium resource that allows us to provide high-level intelligence for free to our users. However, like all powerful resources, it comes with certain operational boundaries known as "Quotas." These quotas are essentially limits on how many requests can be made to the AI engine within a specific timeframe. Understanding these limits is crucial for maintaining a smooth study experience, especially during high-intensity periods like exam weeks.</p>
                    <p>If you encounter a message stating that the "Quota has been exceeded," do not panic. This simply means that the system has reached its temporary capacity for processing requests. These quotas typically reset on a rolling basis—often every minute or every day, depending on the specific tier of service. During these times, you can still use the "Record" and "History" tabs to capture and review your existing data. The AI features will become available again shortly. We are constantly working to optimize our API usage to ensure that these interruptions are as rare as possible for our dedicated users.</p>
                    <p>To minimize the impact of quotas, we recommend being strategic with your AI interactions. Instead of asking many small questions, try to group your queries into comprehensive prompts. Use the "Analyze" feature once per lecture rather than multiple times. This efficiency not only helps you stay within the quota but also encourages you to think more deeply about the information you are requesting. As NSG grows, we are exploring ways to expand our capacity and provide even more robust access to our AI features. We appreciate your patience as we navigate this frontier of AI-integrated education.</p>
                  </section>

                  {/* Section 4 */}
                  <section className="space-y-4">
                    <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">4. The Future of NSG: A Roadmap to Intellectual Dominance</h3>
                    <p>The version of NSG you are using today is just the beginning. Our roadmap for the future is ambitious and focused on one goal: making you the most efficient learner possible. We are currently developing "Cross-Lecture Synthesis," a feature that will allow the AI to look across your entire library of sessions to find connections and themes. Imagine an AI that can tell you how a concept from your Biology class explains a phenomenon discussed in Chemistry three weeks ago. This level of holistic understanding is the future of education.</p>
                    <p>We are also working on enhancing our visual recognition capabilities. Soon, NSG will be able to solve complex mathematical equations and diagrams drawn on a whiteboard in real-time, providing step-by-step explanations directly in the chat. We are also exploring collaborative features that will allow study groups to share sessions and compete in synchronized quizzes. The social aspect of learning is powerful, and we want to harness it within the NSG ecosystem. Our commitment to innovation means that NSG will always be at the forefront of educational technology.</p>
                    <p>Finally, we are dedicated to improving the accessibility and reach of NSG. This includes multi-language support, offline processing capabilities, and integrations with other popular academic platforms. We listen closely to our user community—your feedback at nuellkelechi@gmail.com directly influences our development priorities. Thank you for being part of this journey. Together, we are not just studying harder; we are studying smarter. The future of academic excellence is here, and its name is NSG.</p>
                  </section>
                </article>

                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-4 justify-center">
                  <button onClick={() => setLegalPage('about')} className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest hover:text-red-600 transition-colors">About Us</button>
                  <button onClick={() => setLegalPage('terms')} className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest hover:text-red-600 transition-colors">Terms & Conditions</button>
                  <button onClick={() => setLegalPage('contact')} className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest hover:text-red-600 transition-colors">Contact Us</button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 💰 BOTTOM AD SLOT */}
      <div className="fixed bottom-20 left-0 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-t border-white/10 p-2 z-30">
        <div className="max-w-[320px] h-12 mx-auto bg-white/5 rounded-xl flex items-center justify-center border border-dashed border-white/20 text-[9px] font-black tracking-widest text-white/20">
          AD SLOT • 320×50
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#050505]/90 backdrop-blur-2xl border-t border-slate-200 dark:border-white/10 px-6 py-3 flex justify-between items-center z-50 shadow-2xl">
        <NavButton active={activeTab === 'record'} icon={<Mic size={20} />} label="Record" onClick={() => setActiveTab('record')} />
        <NavButton active={activeTab === 'ai'} icon={<Brain size={20} />} label="AI Chat" onClick={() => setActiveTab('ai')} />
        <NavButton active={activeTab === 'history'} icon={<History size={20} />} label="Library" onClick={() => setActiveTab('history')} />
        <NavButton active={activeTab === 'quiz'} icon={<Zap size={20} />} label="Quiz" onClick={() => setActiveTab('quiz')} />
        <NavButton active={activeTab === 'blog'} icon={<FileText size={20} />} label="Blog" onClick={() => setActiveTab('blog')} />
      </nav>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-red-600 scale-110' : 'text-slate-400 dark:text-white/30 hover:text-white/60'}`}
    >
      <div className={`p-2 rounded-xl ${active ? 'bg-red-600/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
