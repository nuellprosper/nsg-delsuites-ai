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
 * Powered by Nuell Graphics
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

  // --- 🎤 RECORDING ENGINE ---
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
        alert("Microphone access denied.");
      }
    }
  };

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      preview: URL.createObjectURL(f),
      type: 'image' as const
    }));
    setUploadedImages([...uploadedImages, ...mapped]);
  };

  const triggerFullAnalysis = async () => {
    if (uploadedImages.length === 0 && !recordedBlob) return;
    setIsAnalyzing(true);
    setActiveTab('ai');
    try {
      const imageParts = await Promise.all(uploadedImages.map(img => fileToGenerativePart(img.file)));
      const prompt = `Act as the NSG AI Executive. Provide summary, 5 key concepts, and an action plan. Use LaTeX for math.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }, ...imageParts] }]
      });
      const text = response.text || "Analysis failed.";
      setChatHistory(prev => [...prev, { role: 'model', text, timestamp: new Date().toLocaleTimeString() }]);
      const base64Images = await Promise.all(uploadedImages.map(async (img) => {
        const part = await fileToGenerativePart(img.file);
        return `data:${img.file.type};base64,${part.inlineData.data}`;
      }));
      const newSession: LectureSession = { 
        id: Date.now().toString(), title: `Lecture ${new Date().toLocaleTimeString()}`, 
        date: new Date().toLocaleDateString(), duration: formatTime(recordingTime), 
        imageCount: uploadedImages.length, summary: text.substring(0, 100) + "...",
        fullAnalysis: text, images: base64Images, audioUrl: audioUrl || undefined
      };
      setSessions([newSession, ...sessions]);
    } catch (error) { console.error(error); } finally { setIsAnalyzing(false); }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg, timestamp: new Date().toLocaleTimeString() }]);
    try {
      if (!chatInstanceRef.current) {
        chatInstanceRef.current = ai.chats.create({
          model: "gemini-3.1-flash-lite-preview",
          history: chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          config: { systemInstruction: "You are the NSG AI Executive. Use markdown and LaTeX." }
        });
      }
      const response = await chatInstanceRef.current.sendMessage({ message: msg });
      setChatHistory(prev => [...prev, { role: 'model', text: response.text || "Error", timestamp: new Date().toLocaleTimeString() }]);
    } catch (e) { console.error(e); }
  };

  const generateQuiz = async () => {
    setIsGeneratingQuiz(true);
    try {
      const prompt = `Generate a 15-question quiz about ${quizTopic}. Return JSON.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      if (data.questions) {
        setQuizQuestions(data.questions);
        setQuizState('active');
        setCurrentQuestionIndex(0);
        setQuizScore(0);
      }
    } catch (e) { console.error(e); } finally { setIsGeneratingQuiz(false); }
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === quizQuestions[currentQuestionIndex].correctAnswer) setQuizScore(p => p + 1);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(p => p + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else { setQuizState('finished'); }
  };

  const saveSession = (title: string, duration: string) => {
    const newSession: LectureSession = {
      id: Date.now().toString(), title, date: new Date().toLocaleDateString(),
      duration, imageCount: uploadedImages.length, summary: "Recorded.", fullAnalysis: "", images: []
    };
    setSessions([newSession, ...sessions]);
  };

  const closeWelcome = () => { setShowWelcome(false); localStorage.setItem('nsg_welcome_seen', 'true'); };

  // --- 🎨 THEME LOGIC ---
  // Dark: bg-[#050505], text-white, buttons: bg-red-600 or bg-white
  // Light: bg-white, text-black, buttons: bg-red-600 or bg-blackreturn (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-red-600 pb-24 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-white text-black'}`}>
      
      {/* WELCOME MODAL */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className={`p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden border ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-red-600" />
                </div>
                <h2 className="text-2xl font-black uppercase italic">Welcome to <span className="text-red-600">NSG</span></h2>
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-black/70'}`}>
                  Welcome to NSG (Nuell Study Guide), powered by Nuell Graphics. Transform your learning experience by recording classes, generating AI transcriptions, chatting with our intelligent assistant, and creating custom quizzes. We are constantly improving NSG to better serve your academic journey. Thank you for choosing us as your study partner!
                </p>
                <button 
                  onClick={closeWelcome}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all"
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              className={`p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col border ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
                  {legalPage === 'contact' && "Contact Us"}
                </h2>
                <button onClick={() => setLegalPage(null)} className={theme === 'dark' ? 'text-white/40' : 'text-black/40'}>
                  <XCircle size={24} />
                </button>
              </div>
              <div className={`flex-1 overflow-y-auto pr-2 space-y-4 text-sm leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-black/70'}`}>
                {legalPage === 'contact' ? (
                  <div className="text-center py-8">
                    <p>If you have any issues, pls contact us at:</p>
                    <p className="font-bold text-red-600 mt-2">nuellkelechi@gmail.com</p>
                    <p className="font-bold text-red-600">07046732569</p>
                  </div>
                ) : (
                  <p>NSG is an advanced study companion designed to maximize academic efficiency through AI-driven insights and interactive learning tools.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className={`px-5 py-4 flex justify-between items-center border-b sticky top-0 z-40 backdrop-blur-xl ${theme === 'dark' ? 'bg-[#050505]/95 border-white/10' : 'bg-white/95 border-black/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 border rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-black border-white/10' : 'bg-slate-100 border-black/10'}`}>
            <Brain size={22} className="text-red-600" />
          </div>
          <h1 className="text-xl font-black tracking-tighter italic">NSG <span className="text-red-600">3.0</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className={`p-2 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-black/5 border-black/10 text-black'}`}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className={theme === 'dark' ? 'text-white/70' : 'text-black/70'}><Settings size={20} /></button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          
          {/* RECORD TAB */}
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} className="space-y-6">
              <div className={`rounded-3xl p-8 border text-center shadow-sm relative overflow-hidden ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-slate-50 border-black/10'}`}>
                <div className="relative mb-6 flex justify-center">
                  {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-600 rounded-full blur-2xl" />}
                  <button onClick={handleToggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-white text-black' : 'bg-red-600 text-white'}`}>
                    {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                  </button>
                </div>
                <h2 className="text-xl font-black uppercase mb-1">{isRecording ? "Capturing..." : "Ready"}</h2>
                <p className="font-mono text-4xl text-red-600 font-bold mb-6">{formatTime(recordingTime)}</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={triggerFullAnalysis} disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob)} className="bg-red-600 text-white px-6 py-3 rounded-2xl text-xs font-bold transition-all disabled:opacity-50">
                    {isAnalyzing ? "ANALYZING..." : "START ANALYSIS"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col items-center group ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-slate-50 border-black/10'}`}>
                  <ImageIcon size={24} className="text-red-600 mb-2" />
                  <span className="font-bold text-xs">Upload Slides</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>
                <label className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col items-center group ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-slate-50 border-black/10'}`}>
                  <FileAudio size={24} className="text-red-600 mb-2" />
                  <span className="font-bold text-xs">Import Audio</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => alert("Audio Imported")} />
                </label>
              </div>
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} className={`flex flex-col h-[calc(100vh-220px)] rounded-3xl border overflow-hidden relative ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}>
              <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-red-600 text-white' : theme === 'dark' ? 'bg-white/5 border border-white/10 text-white' : 'bg-black/5 border border-black/10 text-black'}`}>
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown></div>
                    </div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {showScrollButton && (
                  <motion.button 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-6 p-3 bg-red-600 text-white rounded-full shadow-xl z-20"
                  >
                    <ArrowDown size={20} />
                  </motion.button>
                )}
              </AnimatePresence>

              <div className={`p-4 border-t ${theme === 'dark' ? 'bg-black/50 border-white/10' : 'bg-slate-50 border-black/10'}`}>
                <div className={`flex gap-2 p-2 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-black/10'}`}>
                  <input 
                    value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask NSG..."
                    className={`flex-1 bg-transparent border-none outline-none px-3 text-sm ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                  />
                  <button onClick={handleSendMessage} className="bg-red-600 text-white p-2.5 rounded-xl"><ChevronRight size={18} /></button>
                </div>
              </div>
            </motion.div>
          )}

          {/* BLOG TAB (ADSENSE READY) */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} className="space-y-8 pb-12">
              <div className={`p-8 rounded-3xl border shadow-sm ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}>
                <h2 className="text-3xl font-black italic mb-6 border-b pb-4 text-red-600">NSG Intelligence Report</h2>
                
                <article className="space-y-12 text-sm leading-relaxed">
                  <section className="space-y-4">
                    <h3 className="text-xl font-black uppercase text-red-600">1. Purpose of NSG: The Future of Learning</h3>
                    <p>NSG (Nuell Study Guide) was born from a simple observation: the traditional classroom experience is often too fast for deep comprehension. Students spend more time scribbling notes than actually understanding the material. Our purpose is to flip this dynamic. By leveraging the Gemini 3.1 Flash Lite model, we provide a cognitive exoskeleton that handles the "capture" phase of learning, allowing the student to focus entirely on the "understanding" phase.</p>
                    <p>We believe that every student, regardless of their background, deserves access to premium academic tools. NSG is not just an app; it is a movement towards intellectual democratization. Our AI doesn't just transcribe; it synthesizes, identifies patterns, and challenges you to think deeper. This is the core mission of Nuell Graphics—to build technology that empowers the human mind.</p>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xl font-black uppercase text-red-600">2. How to Enjoy the NSG Experience</h3>
                    <p>To get the most out of NSG, treat it as your personal academic executive. Start by uploading your lecture slides before class. This gives the AI a visual foundation. During the lecture, use the high-intensity recording engine. The visualizer ensures every frequency of the professor's voice is captured. After class, trigger the "Analysis" function. Don't just read the summary—interact with it in the AI Chat. Ask follow-up questions. Challenge the AI's conclusions. This interactive dialogue is where true mastery happens.</p>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xl font-black uppercase text-red-600">3. Navigating the Quota Frontier</h3>
                    <p>NSG utilizes the powerful Gemini API from Google. Because this is a premium resource provided for free, there are rolling quotas. If you see a "Quota Exceeded" message, don't panic. It simply means the system is cooling down. Your data is safe in the Library. Use that time to review previous sessions or take a quiz. The AI features usually reset within a few minutes. We are constantly working to expand our capacity to ensure a seamless experience for all users.</p>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xl font-black uppercase text-red-600">4. Future Roadmap: Beyond Transcription</h3>
                    <p>The version of NSG you see today is just the beginning. We are developing features like "Cross-Lecture Synthesis," where the AI can connect concepts from your Biology class to your Chemistry class automatically. We are also working on real-time diagram solving and collaborative study rooms. Our goal is to make NSG the central nervous system of your academic life. Thank you for being part of this journey. Your success is our ultimate metric.</p>
                  </section>
                </article>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* NAVIGATION */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t px-6 py-3 flex justify-between items-center z-50 shadow-2xl backdrop-blur-2xl ${theme === 'dark' ? 'bg-[#050505]/90 border-white/10' : 'bg-white/90 border-black/10'}`}>
        <NavButton active={activeTab === 'record'} icon={<Mic size={20} />} label="Record" onClick={() => setActiveTab('record')} theme={theme} />
        <NavButton active={activeTab === 'ai'} icon={<Brain size={20} />} label="AI Chat" onClick={() => setActiveTab('ai')} theme={theme} />
        <NavButton active={activeTab === 'history'} icon={<History size={20} />} label="Library" onClick={() => setActiveTab('history')} theme={theme} />
        <NavButton active={activeTab === 'quiz'} icon={<Zap size={20} />} label="Quiz" onClick={() => setActiveTab('quiz')} theme={theme} />
        <NavButton active={activeTab === 'blog'} icon={<FileText size={20} />} label="Blog" onClick={() => setActiveTab('blog')} theme={theme} />
      </nav>
    </div>
  );
}

function NavButton({ active, icon, label, onClick, theme }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, theme: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-red-600 scale-110' : theme === 'dark' ? 'text-white/30 hover:text-white/60' : 'text-black/30 hover:text-black/60'}`}>
      <div className={`p-2 rounded-xl ${active ? 'bg-red-600/10' : ''}`}>{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
