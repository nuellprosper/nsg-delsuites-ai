import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * NSG DE-SUITES V2.5 - RE-ENGINEERED
 * ✅ Fixed formatTime bug
 * ✅ Fixed chat error & improved readability
 * ✅ WhatsApp-style fixed bottom navigation
 * ✅ Mobile-first UX with compact buttons
 * ✅ Interactive Quiz Module (Gemini Powered)
 * ✅ Black + Red theme preserved
 * ✅ LocalStorage Persistence (Chat, Quiz, History)
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  transcript?: string;
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
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz'>('record');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // --- 📝 QUIZ STATE ---
  const [quizTopic, setQuizTopic] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'finished'>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // --- 📱 INITIALIZATION & PERSISTENCE ---
  useEffect(() => {
    // Load Sessions
    const savedSessions = localStorage.getItem('nsg_sessions');
    if (savedSessions) setSessions(JSON.parse(savedSessions));

    // Load Chat History
    const savedChat = localStorage.getItem('nsg_chat_history');
    if (savedChat) {
      setChatHistory(JSON.parse(savedChat));
    } else {
      setChatHistory([{
        role: 'model',
        text: "System Online. Gemini 3 Flash ready. Upload images or start recording to begin.",
        timestamp: new Date().toLocaleTimeString()
      }]);
    }

    // Load Quiz State
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
  }, []);

  // Save Sessions
  useEffect(() => {
    localStorage.setItem('nsg_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Save Chat History
  useEffect(() => {
    localStorage.setItem('nsg_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Save Quiz State
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
        Act as the NSG De-Suites AI Executive. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts with clear explanations.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic. Use markdown for better formatting. 
        IMPORTANT: For any mathematical formulas, use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$E=mc^2$$) or single dollar signs for inline (e.g. $x^2$).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }, ...imageParts] }]
      });

      const text = response.text || "Analysis failed to generate text.";

      setChatHistory(prev => [...prev, {
        role: 'model',
        text,
        timestamp: new Date().toLocaleTimeString()
      }]);
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
        // Resume from saved history
        const history = chatHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

        chatInstanceRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          history: history,
          config: { systemInstruction: "You are the NSG De-Suites AI Executive. Provide sharp, technical, and academic assistance. Use markdown for all responses. For any mathematical formulas, ALWAYS use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$\\int x dx$$) or single dollar signs for inline (e.g. $x^2$). Make your responses interesting, engaging, and highly structured like a premium AI assistant." }
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
        model: "gemini-3-flash-preview",
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
      summary: "Lecture recorded and ready for analysis."
    };
    setSessions([newSession, ...sessions]);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-600 pb-24">
      
      {/* 💰 TOP AD SLOT */}
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
            <h1 className="text-xl font-black tracking-tighter italic leading-none">NSG <span className="text-red-600">(Nuell Study Guide)</span></h1>
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Lecture OS 3.0</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
              <div className="bg-[#0a0a0a] rounded-3xl p-6 border border-white/10 relative overflow-hidden">
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
                <label className="bg-[#0a0a0a] p-5 rounded-3xl border border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <ImageIcon size={20} className="text-red-500 group-hover:text-white" />
                  </div>
                  <span className="font-bold text-xs">Upload Slides</span>
                  <span className="text-[9px] text-white/40 mt-1 uppercase tracking-widest">({uploadedImages.length}/50)</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>

                <label className="bg-[#0a0a0a] p-5 rounded-3xl border border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <FileAudio size={20} className="text-red-500 group-hover:text-white" />
                  </div>
                  <span className="font-bold text-xs">Import Audio</span>
                  <span className="text-[9px] text-white/40 mt-1 uppercase tracking-widest">MP3 / WAV</span>
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
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex flex-col h-[calc(100vh-220px)] bg-[#0a0a0a] rounded-3xl border border-white/10 overflow-hidden relative">
              {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm">
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
                    <p className="font-bold text-xs">Gemini 3 Flash</p>
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
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[92%] sm:max-w-[85%] group relative ${msg.role === 'user' ? 'bg-red-600 text-white rounded-2xl rounded-tr-none shadow-lg shadow-red-600/10' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-none shadow-sm'} px-4 py-3.5 transition-all`}>
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

              {/* Input bar */}
              <div className="p-3 border-t border-white/10 bg-[#0a0a0a]">
                <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about the lecture..."
                    className="flex-1 bg-transparent px-4 py-2 text-xs outline-none placeholder:text-white/20"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-red-600 w-9 h-9 rounded-xl flex items-center justify-center hover:scale-95 active:scale-90 transition-all shadow-lg shadow-red-600/20"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Library</h2>
                <span className="text-[10px] font-bold text-white/30">{sessions.length} SESSIONS</span>
              </div>
              {sessions.length === 0 ? (
                <div className="text-center py-20 bg-[#0a0a0a] rounded-3xl border border-white/10 border-dashed">
                  <History size={40} className="mx-auto mb-4 text-white/10" />
                  <p className="text-sm font-bold text-white/30">No saved lectures found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="bg-[#0a0a0a] p-4 rounded-2xl flex items-center justify-between border border-white/10 hover:border-red-600/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-all">
                          <FileAudio size={20} className="text-white/20 group-hover:text-red-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{session.title}</p>
                          <p className="text-[10px] text-white/40 font-mono uppercase">{session.date} • {session.duration} • {session.imageCount} SLIDES</p>
                        </div>
                      </div>
                      <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:bg-red-600 hover:text-white transition-all">
                        <Play size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* QUIZ TAB */}
          {activeTab === 'quiz' && (
            <motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Quiz Engine</h2>
                <Zap size={20} className="text-red-600" />
              </div>

              {quizState === 'idle' && (
                <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="text-center space-y-2 mb-4">
                    <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <Sparkles size={24} className="text-red-600" />
                    </div>
                    <h3 className="font-bold text-lg">Generate Interactive Quiz</h3>
                    <p className="text-xs text-white/40">Test your knowledge with AI-generated questions based on your lecture or a specific topic.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Topic / Subject</label>
                    <input 
                      type="text" 
                      value={quizTopic}
                      onChange={(e) => setQuizTopic(e.target.value)}
                      placeholder="e.g. Quantum Physics, EEE 101..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none focus:border-red-600/50 transition-all"
                    />
                  </div>

                  <button 
                    onClick={generateQuiz}
                    disabled={isGeneratingQuiz}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <RefreshCcw size={18} className="animate-spin" />
                        GENERATING...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        START ASSESSMENT
                      </>
                    )}
                  </button>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  {/* Quiz Header with Back Button and Score */}
                  <div className="flex items-center justify-between bg-[#0a0a0a] p-4 rounded-3xl border border-white/10 shadow-sm">
                    <button 
                      onClick={() => setQuizState('idle')}
                      className="flex items-center gap-2 text-xs font-black text-white/40 hover:text-red-600 transition-colors uppercase tracking-widest"
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5">Assessment Progress</p>
                      <p className="text-sm font-black text-red-600">{currentQuestionIndex + 1} <span className="text-white/20">/</span> {quizQuestions.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5">Current Score</p>
                      <p className="text-sm font-black text-green-500">{quizScore}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                      className="bg-red-600 h-full"
                    />
                  </div>

                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Score: {quizScore}</span>
                  </div>

                  <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/10 space-y-6">
                    <h3 className="text-lg font-bold leading-tight">{quizQuestions[currentQuestionIndex].question}</h3>
                    
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
                        const isCorrect = idx === quizQuestions[currentQuestionIndex].correctAnswer;
                        const isSelected = selectedOption === idx;
                        
                        let bgColor = "bg-white/5";
                        let borderColor = "border-white/10";
                        let textColor = "text-white/80";

                        if (isAnswered) {
                          if (isCorrect) {
                            bgColor = "bg-green-500/10";
                            borderColor = "border-green-500/50";
                            textColor = "text-green-500";
                          } else if (isSelected) {
                            bgColor = "bg-red-500/10";
                            borderColor = "border-red-500/50";
                            textColor = "text-red-500";
                          } else {
                            bgColor = "bg-white/5 opacity-40";
                          }
                        } else if (isSelected) {
                          borderColor = "border-red-600";
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleOptionSelect(idx)}
                            disabled={isAnswered}
                            className={`w-full text-left p-4 rounded-2xl border ${bgColor} ${borderColor} ${textColor} transition-all flex items-center justify-between group`}
                          >
                            <span className="text-sm font-medium">{option}</span>
                            {isAnswered && isCorrect && <CheckCircle2 size={18} />}
                            {isAnswered && isSelected && !isCorrect && <XCircle size={18} />}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <button 
                        onClick={nextQuestion}
                        className="w-full bg-white text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all"
                      >
                        {currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"}
                        <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quizState === 'finished' && (
                <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/10 text-center space-y-6">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center mx-auto">
                      <Sparkles size={40} className="text-red-600" />
                    </div>
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 bg-white text-black text-[10px] font-black px-2 py-1 rounded-full border border-black"
                    >
                      COMPLETED
                    </motion.div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Assessment Result</h3>
                    <p className="text-white/40 text-xs font-medium">You've successfully completed the AI evaluation.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-1">Final Score</p>
                      <p className="text-3xl font-black text-red-600">{quizScore}/{quizQuestions.length}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-1">Accuracy</p>
                      <p className="text-3xl font-black text-white">{Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setQuizState('idle')}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all"
                  >
                    RETAKE ASSESSMENT
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 💰 BOTTOM AD SLOT */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-[728px] mx-auto h-10 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-[10px] font-black tracking-widest text-white/30 backdrop-blur-sm">
          MOBILE AD • 320×50
        </div>
      </div>

      {/* WHATSAPP-STYLE FIXED BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { id: 'record', icon: Mic, icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center py-2 px-4 transition-all relative ${activeTab === tab.id ? 'text-red-600' : 'text-white/30 hover:text-white/60'}`}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="nav-active" className="absolute inset-0 bg-red-600/5 rounded-2xl -z-10" />
              )}
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* BACKGROUND FX */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 rounded-full blur-[150px]" />
      </div>
    </div>
  );
}
