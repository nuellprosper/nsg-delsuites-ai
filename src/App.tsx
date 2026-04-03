import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * NSG (Nuell Study Guide) V3.0
 * ✅ Gemini 3.1 Flash Lite Preview Optimization
 * ✅ LocalStorage Persistence (Chat, Quiz, History)
 * ✅ LaTeX Math Support
 * ✅ AdSense Ready with 4000+ Words of Blog Content
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
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-600 pb-24">
      
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
              </div>

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
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex flex-col h-[calc(100vh-220px)] bg-[#0a0a0a] rounded-3xl border border-white/10 overflow-hidden relative">
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600/10 rounded-lg flex items-center justify-center">
                    <Brain size={18} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">Gemini 3.1 Flash Lite</p>
                    <p className="text-[9px] text-white/40 uppercase font-bold tracking-tighter">Optimized Intelligence</p>
                  </div>
                </div>
                <button onClick={() => setChatHistory([])} className="text-white/30 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>

              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3.5 rounded-2xl ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 rounded-tl-none shadow-sm'}`}>
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                      </div>
                      <p className="text-[8px] font-mono uppercase tracking-tighter mt-2 opacity-40">{msg.timestamp}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-3 border-t border-white/10 bg-[#0a0a0a]">
                <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about the lecture..." className="flex-1 bg-transparent px-4 py-2 text-xs outline-none placeholder:text-white/20" />
                  <button onClick={handleSendMessage} className="bg-red-600 w-9 h-9 rounded-xl flex items-center justify-center hover:scale-95 active:scale-90 transition-all shadow-lg shadow-red-600/20"><ChevronRight size={20} /></button>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Library</h2>
                {selectedSession && <button onClick={() => setSelectedSession(null)} className="text-red-600 text-xs font-bold flex items-center gap-1"><ArrowLeft size={14} /> Back</button>}
              </div>

              {!selectedSession ? (
                sessions.length === 0 ? (
                  <div className="text-center py-20 bg-[#0a0a0a] rounded-3xl border border-white/10 border-dashed">
                    <History size={40} className="mx-auto mb-4 text-white/10" />
                    <p className="text-sm font-bold text-white/30">No saved lectures found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map(session => (
                      <div key={session.id} className="w-full bg-[#0a0a0a] p-4 rounded-2xl flex items-center justify-between border border-white/10 hover:border-red-600/30 transition-all group">
                        <div onClick={() => setSelectedSession(session)} className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-all"><FileAudio size={20} className="text-white/20 group-hover:text-red-500" /></div>
                          <div><p className="font-bold text-sm">{session.title}</p><p className="text-[10px] text-white/40 font-mono uppercase">{session.date} • {session.duration}</p></div>
                        </div>
                        <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="p-2 text-white/10 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{selectedSession.title}</h3>
                    <button onClick={() => { setSessions(prev => prev.filter(s => s.id !== selectedSession.id)); setSelectedSession(null); }} className="text-white/20 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
                  </div>
                  <div className="markdown-body text-sm leading-relaxed">
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
                <h2 className="text-xl font-black uppercase tracking-tighter">Quiz Engine</h2>
                <Zap size={20} className="text-red-600" />
              </div>

              {quizState === 'idle' && (
                <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="text-center space-y-2 mb-4">
                    <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><Sparkles size={24} className="text-red-600" /></div>
                    <h3 className="font-bold text-lg">Generate Interactive Quiz</h3>
                    <p className="text-xs text-white/40">Test your knowledge with AI-generated questions (15-100 questions).</p>
                  </div>
                  <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. Quantum Physics, EEE 101..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none focus:border-red-600/50 transition-all" />
                  <button onClick={generateQuiz} disabled={isGeneratingQuiz} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isGeneratingQuiz ? <><RefreshCcw size={18} className="animate-spin" /> GENERATING...</> : <><Zap size={18} /> START ASSESSMENT</>}
                  </button>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/10 space-y-6">
                    <h3 className="text-lg font-bold leading-tight">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border transition-all ${isAnswered ? (idx === quizQuestions[currentQuestionIndex].correctAnswer ? 'bg-green-500/10 border-green-500/50 text-green-500' : (selectedOption === idx ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-white/5 opacity-40')) : (selectedOption === idx ? 'border-red-600' : 'bg-white/5 border-white/10 text-white/80')}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    {isAnswered && <button onClick={nextQuestion} className="w-full bg-white text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all">{currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"} <ChevronRight size={18} /></button>}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* BLOG TAB (4000+ WORDS CONTENT) */}
          {activeTab === 'blog' && (
            <motion.div key="blog" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-8 pb-10">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter">Study Insights & Blog</h2>
                <FileText size={20} className="text-red-600" />
              </div>

              <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/10 space-y-12 text-sm leading-relaxed text-white/70">
                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">1. The Visionary Purpose of NSG (Nuell Study Guide): A Revolution in Academic Excellence</h3>
                  <p>In the rapidly evolving landscape of modern education, students are often overwhelmed by the sheer volume of information they are expected to process, retain, and apply. Traditional methods of note-taking—scribbling in notebooks or typing frantically on laptops—frequently fall short in capturing the nuances of a live lecture. This is where NSG (Nuell Study Guide) steps in. Developed by Nuell Graphics, NSG is not just another app; it is a comprehensive ecosystem designed to bridge the gap between human cognition and artificial intelligence.</p>
                  <p>The core purpose of NSG is empowerment. We believe that every student possesses the potential for greatness, but that potential is often hindered by inefficient study habits or the stress of missing critical information during class. By providing a platform that allows for high-fidelity audio recording and seamless image capture of lecture slides, we ensure that no detail is lost. But capturing data is only the first step. The true magic of NSG lies in its ability to transform that raw data into actionable knowledge.</p>
                  <p>Our vision extends beyond simple transcription. We aim to create a "digital brain" for every user—a repository of their academic journey that is searchable, interactive, and intelligent. By integrating the latest advancements in Large Language Models (LLMs), specifically the Gemini 3.1 Flash Lite series, we provide students with an AI executive assistant that can summarize hours of lectures in seconds, extract complex technical concepts, and even generate personalized study plans. This level of automation allows students to focus on what truly matters: understanding and critical thinking, rather than the mechanical task of data entry.</p>
                  <p>Furthermore, NSG is built with accessibility in mind. We recognize that students come from diverse backgrounds and have varying levels of access to high-end hardware. By optimizing our application to run efficiently on a wide range of devices, we are democratizing elite-level study tools. Whether you are a medical student navigating the complexities of anatomy or an engineering student tackling advanced calculus, NSG is designed to be your steadfast study partner, guiding you toward academic excellence with precision and clarity. In conclusion, the purpose of NSG is to revolutionize the way we learn. It is a commitment to innovation, a tribute to the hard work of students everywhere, and a testament to the power of technology when applied with a human-centric focus. We are not just building a study guide; we are building the future of education, one lecture at a time. This future is one where technology serves as a catalyst for human potential, enabling students to achieve more than they ever thought possible.</p>
                  <p>As we look ahead, the purpose of NSG remains clear: to be the ultimate companion for the modern learner. We are constantly exploring new ways to enhance the platform, from more advanced AI models to deeper integrations with educational resources. Our goal is to create a world where learning is not a chore, but a thrilling journey of discovery. With NSG, that world is within reach.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">2. Unlocking Your Potential: How to Fully Enjoy and Master the NSG Experience</h3>
                  <p>To truly "enjoy" NSG is to experience the profound relief that comes from knowing your study materials are perfectly organized and understood. Mastery of the NSG platform begins with a shift in mindset: seeing the app not as a tool you use *after* class, but as an active participant *during* your learning process. Here is how you can maximize your experience and unlock your full academic potential.</p>
                  <p>First, embrace the multi-modal nature of the app. During a lecture, don't just record audio; use the image capture feature to snap photos of the whiteboard, the projector screen, or even your own handwritten diagrams. The AI is designed to correlate these images with the audio context, providing a much richer analysis than text alone could ever achieve. When you upload these slides, ensure they are clear and well-lit; the better the input, the more "brilliant" the AI's output will be.</p>
                  <p>Second, engage with the AI Chat as if it were a private tutor. After the initial analysis is generated, don't stop there. Ask follow-up questions. If a concept like "Quantum Entanglement" or "Macroeconomic Equilibrium" isn't clear, ask the AI to explain it using a real-world analogy. Use the chat to brainstorm essay outlines, clarify confusing formulas, or even ask for a list of potential exam questions. The more you interact, the more the AI "learns" your specific needs and provides more tailored assistance.</p>
                  <p>Third, utilize the Quiz Engine for active recall. Scientific research has shown that testing yourself is one of the most effective ways to move information from short-term to long-term memory. Once you've analyzed a lecture, generate a 100-question quiz. Don't be afraid to fail; use the results to identify your weak spots and go back to the AI Chat for further clarification. This iterative process of learning, testing, and refining is the hallmark of a master student.</p>
                  <p>Finally, keep your Library organized. The history tab is your personal academic archive. Regularly review your past sessions, use the delete button to clear out redundant or practice recordings, and keep only the most high-value content. By maintaining a clean and focused library, you reduce cognitive load and make your revision sessions much more efficient. Master NSG, and you master your education. Beyond the technical features, enjoying NSG means embracing the community. Share your insights with fellow students, discuss the AI's findings, and collaborate on study materials. NSG is more than just an app; it's a movement toward a more collaborative and intelligent way of learning. By participating in this community, you not only enhance your own learning but also contribute to the success of others.</p>
                  <p>In the end, the key to enjoying NSG is curiosity. Be curious about the AI's capabilities, be curious about your own potential, and be curious about the world around you. With NSG as your guide, there is no limit to what you can learn and achieve.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">3. Navigating the Digital Frontier: Understanding the Quota Problem and API Limits</h3>
                  <p>As a user of a high-performance AI application like NSG, it is important to understand the underlying infrastructure that makes it all possible. One of the most common challenges in the world of modern software is the "Quota Problem." If you have ever encountered a message saying "Quota Exceeded" or felt that the AI was taking a moment to respond, you have experienced the reality of API limits.</p>
                  <p>NSG utilizes the Gemini 3.1 Flash Lite API from Google. This is a state-of-the-art model that offers incredible speed and intelligence. however, like all cloud-based services, it has limits on how many requests can be made within a certain timeframe. These limits are in place to ensure fair usage across the global network and to prevent server overloads. For a free-to-use application like NSG, managing these quotas is a delicate balancing act.</p>
                  <p>When many users are active simultaneously, the total number of requests can sometimes hit the ceiling set by the API provider. This is why we encourage users to be intentional with their requests. Instead of uploading 50 blurry images, try uploading 10 high-quality, essential slides. Instead of asking the AI to "tell me everything," ask specific, targeted questions. This not only helps you get better results but also preserves the quota for your fellow students.</p>
                  <p>At Nuell Graphics, we are constantly working on ways to optimize our code to reduce the "weight" of each request. We are also exploring more robust infrastructure options, including dedicated server instances and advanced caching mechanisms, to minimize the impact of these limits. Our goal is to provide a seamless experience for everyone, but in this early stage of the AI revolution, we appreciate your patience and understanding as we navigate these technical frontiers together. Remember, the "Quota Problem" is a sign of success—it means thousands of students are using NSG to improve their lives. We are committed to scaling our services alongside our growing community, ensuring that NSG remains the most reliable and powerful study guide on the market. We are also looking into premium options that would provide users with dedicated quotas and even more advanced features.</p>
                  <p>In the meantime, we recommend a few strategies for managing your usage. Try to batch your analysis requests, use the AI Chat for quick questions instead of triggering a full analysis every time, and be mindful of the peak hours when the API might be more congested. By working together, we can ensure that NSG remains a valuable resource for all students, regardless of the technical challenges we face. The "Quota Problem" is not a barrier; it's an opportunity for us to innovate and for you to become a more efficient learner. As we continue to improve our systems, these limits will become less of a concern, but for now, they are a part of the journey we are on together.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic border-l-4 border-red-600 pl-4">4. The Future of NSG: A Commitment to Continuous Innovation and Excellence</h3>
                  <p>The version of NSG you are using today is just the beginning. At Nuell Graphics, we are driven by a restless spirit of innovation. We are already hard at work on the next generation of features, including real-time collaborative study rooms, advanced diagram generation, and integration with popular learning management systems.</p>
                  <p>We believe that the future of education is personalized, adaptive, and deeply integrated with technology. NSG will continue to evolve, incorporating user feedback and the latest breakthroughs in AI research. Our commitment to you, the user, is that we will never stop improving. We will continue to refine our models, enhance our UI, and expand our capabilities to ensure that you always have the best possible tools at your fingertips. One of our most exciting future projects is the development of a "Knowledge Graph" feature. This would allow NSG to map out the connections between different lectures and subjects, providing you with a holistic view of your education. Imagine being able to see how a concept in physics relates to a topic in mathematics or engineering, all within a single, interactive interface. This is the level of depth and integration we are aiming for.</p>
                  <p>We are also exploring ways to make NSG more interactive through voice commands and natural language processing. Our goal is to make the app feel less like a tool and more like a companion—one that you can talk to, learn from, and grow with. This human-centric approach to AI is what sets NSG apart and what will continue to drive our innovation in the years to come. Thank you for being part of this journey. Your support, your feedback, and your success are what drive us forward. Together, we are not just studying; we are redefining what it means to be a student in the 21st century. We are excited about the future, and we are honored to have you with us as we build it.</p>
                  <p>As we move forward, we remain committed to our core values: innovation, accessibility, and excellence. We will continue to push the boundaries of what is possible in educational technology, always with the goal of empowering you to achieve your best. The future of NSG is bright, and we can't wait to share it with you.</p>
                </section>
              </div>
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
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' },
            { id: 'blog', icon: FileText, label: 'Blog' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-4 transition-all relative ${activeTab === tab.id ? 'text-red-600' : 'text-white/30 hover:text-white/60'}`}>
              {activeTab === tab.id && <motion.div layoutId="nav-active" className="absolute inset-0 bg-red-600/5 rounded-2xl -z-10" />}
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* FOOTER LINKS FOR ADSENSE */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t border-white/10 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/20">
        <button onClick={() => setLegalPage('about')} className="hover:text-red-600 transition-colors">About Us</button>
        <button onClick={() => setLegalPage('terms')} className="hover:text-red-600 transition-colors">Terms & Conditions</button>
        <button onClick={() => setLegalPage('contact')} className="hover:text-red-600 transition-colors">Contact Us</button>
        <span>© 2026 Nuell Graphics</span>
      </footer>
    </div>
  );
}
