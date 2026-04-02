import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings,
  Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, FileCheck, ArrowLeft, Clock, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * NSG DE-SUITES V2.7 - THE "PERFECTION" UPDATE
 * ✅ Fixed Library Detail View (No more plain pages)
 * ✅ Manual + Auto Theme Toggle (Sun/Moon Button)
 * ✅ Stabilized Gemini 2.5 Flash Engine
 * ✅ Enhanced Audio/Image Sync
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz'>('record');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [uploadedImages, setUploadedImages] = useState<MediaFile[]>([]);
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LectureSession | null>(null);
  
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'finished'>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // --- 🌓 THEME LOGIC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('nsg_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(systemDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', systemDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('nsg_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  useEffect(() => {
    const saved = localStorage.getItem('nsg_sessions');
    if (saved) setSessions(JSON.parse(saved));
    setChatHistory([{
      role: 'model',
      text: "System Online. Gemini 2.5 Flash ready. Upload images or start recording to begin.",
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, []);

  useEffect(() => {
    localStorage.setItem('nsg_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

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
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };
        mediaRecorderRef.current = recorder;
        recorder.start(5000);
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      } catch (err) { alert("Microphone access denied."); }
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

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedAudio(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const triggerFullAnalysis = async () => {
    if (uploadedImages.length === 0 && !recordedBlob && !uploadedAudio) {
      alert("No data to analyze.");
      return;
    }
    setIsAnalyzing(true);
    setActiveTab('ai');
    try {
      const imageParts = await Promise.all(uploadedImages.map(img => fileToGenerativePart(img.file)));
      
      const prompt = `Act as the NSG De-Suites AI Executive. Provide a sharp, comprehensive summary of these lecture materials and an action plan. Use markdown.`;
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ parts: [{ text: prompt }, ...imageParts] }]
      });
      const responseText = result.text || "Analysis failed.";
      
      setChatHistory(prev => [...prev, { role: 'model', text: responseText, timestamp: new Date().toLocaleTimeString() }]);
      
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
        summary: responseText.substring(0, 100) + "...",
        fullAnalysis: responseText,
        images: base64Images,
        audioUrl: audioUrl || undefined
      };
      setSessions(prev => [newSession, ...prev]);
      
    } catch (error: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${error.message}`, timestamp: new Date().toLocaleTimeString() }]);
    } finally { setIsAnalyzing(false); }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg, timestamp: new Date().toLocaleTimeString() }]);
    try {
      if (!chatInstanceRef.current) {
        chatInstanceRef.current = ai.chats.create({ model: "gemini-2.5-flash-image" });
      }
      const result = await chatInstanceRef.current.sendMessage({ message: msg });
      setChatHistory(prev => [...prev, { role: 'model', text: result.text || "No response.", timestamp: new Date().toLocaleTimeString() }]);
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${e.message}`, timestamp: new Date().toLocaleTimeString() }]);
    }
  };

  const generateQuiz = async (fromLecture = false, sessionData?: LectureSession) => {
    setIsGeneratingQuiz(true);
    setActiveTab('quiz');
    try {
      let prompt = `Generate a 15 to 20-question multiple choice quiz about "${quizTopic || 'the lecture'}". Return ONLY a JSON object: {"questions": [{"question": "string", "options": ["string"], "correctAnswer": number}]}`;
      
      let contents: any[] = [{ parts: [{ text: prompt }] }];
      if (sessionData) {
        contents = [{ parts: [{ text: prompt }, { text: sessionData.fullAnalysis }] }];
      } else if (fromLecture) {
        const imageParts = await Promise.all(uploadedImages.map(img => fileToGenerativePart(img.file)));
        contents = [{ parts: [{ text: prompt }, ...imageParts] }];
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(result.text || "{}");
      if (data.questions) {
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setQuizState('active');
        setSelectedOption(null);
        setIsAnswered(false);
      }
    } catch (error) { alert("Failed to generate quiz."); } finally { setIsGeneratingQuiz(false); }
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === quizQuestions[currentQuestionIndex].correctAnswer) setQuizScore(prev => prev + 1);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else { setQuizState('finished'); }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-slate-900 dark:text-[#e0e0e0] font-sans selection:bg-red-600 pb-24 transition-colors duration-300">
      
      <div className="w-full bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-white/10 p-2 sticky top-0 z-50">
        <div className="max-w-[728px] h-10 mx-auto bg-slate-200/50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-dashed border-slate-300 dark:border-white/20 text-[10px] font-black tracking-widest text-slate-400 dark:text-white/30">AD SLOT</div>
      </div>

      <header className="px-5 py-4 flex justify-between items-center border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#050505]/95 backdrop-blur-xl sticky top-12 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center shadow-sm">
            <Brain size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic leading-none">NSG <span className="text-red-600">(Nuell Study Guide)</span></h1>
            <span className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest">Lecture OS 2.5</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/70 hover:text-red-500 transition-all">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="text-slate-500 dark:text-white/70 hover:text-red-500 transition-colors"><Settings size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity: 0}} className="space-y-6">
              <div className="bg-slate-50 dark:bg-[#0a0a0a] rounded-3xl p-6 border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-sm">
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="relative mb-6">
                    {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-600 rounded-full blur-2xl" />}
                    <button onClick={handleToggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${isRecording ? 'bg-slate-900 text-white dark:bg-white dark:text-black scale-105' : 'bg-red-600 text-white hover:scale-105 active:scale-95'}`}>
                      {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                    </button>
                  </div>
                  <h2 className="text-xl font-black tracking-tighter mb-1 uppercase">{isRecording ? "Capture Active" : "Engine Idle"}</h2>
                  <p className="font-mono text-4xl text-red-600 font-bold mb-6 tracking-tight">{formatTime(recordingTime)}</p>
                  <div className="flex gap-2 w-full max-w-xs">
                    {audioUrl && <a href={audioUrl} download="Lecture.mp3" className="flex-1 flex items-center justify-center gap-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all"><Download size={16} /> Export</a>}
                    <button onClick={triggerFullAnalysis} disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob && !uploadedAudio)} className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-red-600/30 transition-all disabled:opacity-50"><Sparkles size={16} /> Analyze</button>
                  </div>
                </div>
              </div>

              {uploadedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
                  {uploadedImages.map(img => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <img src={img.preview} className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-white/10" />
                      <button onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 text-white shadow-md"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="bg-slate-50 dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all"><ImageIcon size={20} className="text-red-500 group-hover:text-white" /></div>
                  <span className="font-bold text-xs">Upload Slides</span>
                  <span className="text-[10px] text-slate-400 dark:text-white/40 mt-1">{uploadedImages.length}/50</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>
                <label className="bg-slate-50 dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all">
                    {uploadedAudio ? <FileCheck size={20} className="text-green-500" /> : <FileAudio size={20} className="text-red-500 group-hover:text-white" />}
                  </div>
                  <span className="font-bold text-xs">{uploadedAudio ? "Audio Ready" : "Import Audio"}</span>
                  <span className="text-[10px] text-slate-400 dark:text-white/40 mt-1">{uploadedAudio ? uploadedAudio.name.substring(0, 10) + "..." : "MP3 / WAV"}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </label>
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex flex-col h-[calc(100vh-220px)] bg-slate-50 dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden relative shadow-sm">
              {isAnalyzing && <div className="absolute inset-0 z-50 bg-white/90 dark:bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm"><p className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse">Analyzing with Gemini 2.5...</p></div>}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Brain size={18} className="text-red-600" />
                  <div><p className="font-bold text-xs">Gemini 2.5 Flash</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => generateQuiz(true)} className="bg-red-600/10 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold border border-red-600/30 flex items-center gap-1"><Zap size={10}/> Turn to Quiz</button>
                  <button onClick={() => setChatHistory([])} className="text-slate-400 dark:text-white/30 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              </div>
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-red-600 text-white rounded-2xl rounded-tr-none shadow-md' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-none shadow-sm'} px-4 py-3`}>
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a]">
                <div className="flex gap-2 bg-slate-100 dark:bg-white/5 rounded-2xl p-1.5 border border-slate-200 dark:border-white/10">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about the lecture..." className="flex-1 bg-transparent px-4 py-2 text-xs outline-none text-slate-800 dark:text-white" />
                  <button onClick={handleSendMessage} className="bg-red-600 w-9 h-9 rounded-xl flex items-center justify-center hover:scale-95 transition-all shadow-lg shadow-red-600/20"><ChevronRight size={20} className="text-white" /></button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tighter">Library</h2>
                {selectedSession && (
                  <button onClick={() => setSelectedSession(null)} className="text-red-600 text-xs font-bold flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </button>
                )}
              </div>

              {!selectedSession ? (
                sessions.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">
                    <p className="text-sm font-bold text-slate-400 dark:text-white/30">No saved lectures</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map(session => (
                      <button 
                        key={session.id} 
                        onClick={() => setSelectedSession(session)}
                        className="w-full text-left bg-slate-50 dark:bg-[#0a0a0a] p-4 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-white/10 hover:border-red-600/30 transition-all group shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-all shadow-sm">
                            <FileAudio size={20} className="text-slate-400 dark:text-white/20 group-hover:text-red-500" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{session.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-white/40 font-mono uppercase">{session.date} • {session.duration}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 dark:text-white/20 group-hover:text-red-500" />
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-10">
                  <div className="bg-slate-50 dark:bg-[#0a0a0a] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock size={16} className="text-red-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40">{selectedSession.date} • {selectedSession.duration}</span>
                    </div>
                    <h3 className="text-2xl font-black mb-4 leading-tight">{selectedSession.title}</h3>
                    
                    <div className="flex gap-2 mb-6">
                      <button onClick={() => generateQuiz(false, selectedSession)} className="flex-1 bg-red-600 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20">
                        <Zap size={14} /> Start Quiz
                      </button>
                    </div>

                    <div className="markdown-body mb-8">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedSession.fullAnalysis}</ReactMarkdown>
                    </div>

                    {selectedSession.images && selectedSession.images.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40">Lecture Slides</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedSession.images.map((img, idx) => (
                            <img key={idx} src={img} className="w-full aspect-square object-cover rounded-xl border border-slate-200 dark:border-white/10" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'quiz' && (
            <motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tighter">Quiz Engine</h2>
              {quizState === 'idle' && (
                <div className="bg-slate-50 dark:bg-[#0a0a0a] p-6 rounded-3xl border border-slate-200 dark:border-white/10 space-y-4 shadow-sm">
                  <h3 className="font-bold text-lg">Generate Interactive Quiz</h3>
                  <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="Topic..." className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3 text-sm outline-none text-slate-800 dark:text-white" />
                  <button onClick={() => generateQuiz(false)} disabled={isGeneratingQuiz} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-600/20">
                    {isGeneratingQuiz ? <RefreshCcw size={18} className="animate-spin" /> : <Zap size={18} />} START ASSESSMENT
                  </button>
                </div>
              )}
              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#0a0a0a] p-6 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
                        const isCorrect = idx === quizQuestions[currentQuestionIndex].correctAnswer;
                        const isSelected = selectedOption === idx;
                        let borderColor = isAnswered ? (isCorrect ? "border-green-500" : (isSelected ? "border-red-500" : "border-slate-200 dark:border-white/10")) : (isSelected ? "border-red-600" : "border-slate-200 dark:border-white/10");
                        let bgColor = isAnswered ? (isCorrect ? "bg-green-500/5" : (isSelected ? "bg-red-500/5" : "bg-white dark:bg-white/5")) : "bg-white dark:bg-white/5";
                        return (
                          <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border ${bgColor} ${borderColor} transition-all flex items-center justify-between shadow-sm`}>
                            <span className="text-sm font-medium">{option}</span>
                            {isAnswered && isCorrect && <CheckCircle2 size={18} className="text-green-500" />}
                            {isAnswered && isSelected && !isCorrect && <XCircle size={18} className="text-red-500" />}
                          </button>
                        );
                      })}
                    </div>
                    {isAnswered && <button onClick={nextQuestion} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg">{currentQuestionIndex === quizQuestions.length - 1 ? "FINISH" : "NEXT"}</button>}
                  </div>
                </div>
              )}
              {quizState === 'finished' && (
                <div className="bg-slate-50 dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 text-center space-y-6 shadow-sm">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Result: {quizScore}/{quizQuestions.length}</h3>
                  <button onClick={() => setQuizState('idle')} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20">RETAKE</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 z-50">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-4 transition-all ${activeTab === tab.id ? 'text-red-600' : 'text-slate-400 dark:text-white/30'}`}>
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
