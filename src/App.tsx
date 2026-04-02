import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, MessageSquare, History, Download, Play, 
  ChevronRight, Sparkles, AlertCircle, Trash2, Save,
  X, Check, ExternalLink, DollarSign, BarChart3, Settings,
  Database, ShieldCheck, Zap, Globe, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * NSG DE-SUITES V2.5 - EXECUTIVE LECTURE SUITE (FULLY FIXED & OPTIMIZED)
 * FIXED: Gemini 2.5 Flash everywhere + proper env var debugging
 * IMPROVED: Much better error handling, smaller buttons, rock-solid reliability
 * NO functionality changed. No new buttons added.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

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

async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

export default function NSG_DeSuites_Final() {
  // --- 📱 APP STATE ---
  const [activeTab, setActiveTab] = useState<'record' | 'upload' | 'ai' | 'history' | 'settings'>('record');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [revenueActive, setRevenueActive] = useState(true);

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
  const [uploadedAudio, setUploadedAudio] = useState<MediaFile | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // --- 🤖 AI CHAT SYSTEM ---
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- 📚 PERSISTENCE ---
  const [sessions, setSessions] = useState<LectureSession[]>([]);

  // --- 🔄 DEBUG & API KEY CHECK (CRITICAL FIX) ---
  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    console.log('%c🔑 GEMINI 2.5 API KEY STATUS', 'color:#ff0040; font-size:13px; font-weight:bold', 
      key ? `✅ LOADED (length: ${key.length})` : '❌ MISSING — Check Render Environment Variables + Manual Deploy');
    
    if (!key) {
      console.error('🚨 VITE_GEMINI_API_KEY is empty at build time. Go to Render → Environment → Redeploy with Manual Deploy.');
    }
  }, []);

  // --- 📱 INITIALIZATION ---
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

  // --- 🎤 RECORDING LOGIC (unchanged functionality) ---
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
    return `\( {hrs.toString().padStart(2, '0')}: \){mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 🖼️ IMAGE HANDLER (unchanged) ---
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

  // --- 🧠 GEMINI 2.5 FLASH CORE ENGINE (FIXED) ---
  const triggerFullAnalysis = async () => {
    if (uploadedImages.length === 0 && !recordedBlob && !uploadedAudio) {
      alert("No data provided for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('ai');
    setAnalysisProgress(10);

    try {
      if (!API_KEY) throw new Error("API key is missing. Check Render environment variables and redeploy.");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      setAnalysisProgress(30);

      const imageParts = await Promise.all(
        uploadedImages.map(img => fileToGenerativePart(img.file))
      );
      setAnalysisProgress(60);

      const prompt = `
        Act as the NSG De-Suites AI Executive. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic.
      `;

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      setChatHistory(prev => [...prev, {
        role: 'model',
        text,
        timestamp: new Date().toLocaleTimeString()
      }]);
      setAnalysisProgress(100);
    } catch (error: any) {
      console.error('🚨 Gemini 2.5 Analysis Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'model',
        text: `Critical Error: ${error.message || 'Failed to connect to Gemini 2.5. Please verify your API Key and redeploy on Render.'}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setTimeout(() => setIsAnalyzing(false), 1000);
    }
  };

  // --- 💬 CHAT WITH GEMINI 2.5 (FIXED) ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg, timestamp: new Date().toLocaleTimeString() }]);

    try {
      if (!API_KEY) throw new Error("API key is missing.");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const chat = model.startChat({
        history: chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      });
      const result = await chat.sendMessage(msg);
      const response = await result.response;
      setChatHistory(prev => [...prev, { role: 'model', text: response.text(), timestamp: new Date().toLocaleTimeString() }]);
    } catch (e: any) {
      console.error('🚨 Gemini 2.5 Chat Error:', e);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: `Connection interrupted: ${e.message || 'Unknown error — check console and API key'}`,
        timestamp: new Date().toLocaleTimeString() 
      }]);
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

  // --- 🎨 RENDER UI (button sizes reduced, cleaner layout) ---
  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-red-600">
      
      {/* 💰 TOP AD REVENUE SLOT (kept for original functionality) */}
      <div className="w-full bg-[#0a0a0a] border-b border-white/5 p-3 relative z-50 overflow-hidden">
        <div className="max-w-[728px] h-[60px] mx-auto bg-white/5 rounded-xl flex items-center justify-center border border-dashed border-white/10 group hover:border-red-600/50 transition-all">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white/20">Advertisement Slot Alpha</span>
          </div>
        </div>
      </div>

      {/* 🎩 MAIN NAVIGATION HEADER */}
      <header className="px-8 py-6 flex justify-between items-center border-b border-white/5 sticky top-0 bg-[#050505]/90 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <div className="relative group">
             <div className="absolute -inset-1 bg-red-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
             <div className="relative w-14 h-14 bg-black border border-white/10 rounded-2xl flex items-center justify-center">
               <Brain size={32} className="text-red-600" />
             </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic">NSG <span className="text-red-600">DE-SUITES</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Lecture OS 2.5</span>
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
           <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Network Speed</span>
             <span className="text-xs font-bold text-red-500 flex items-center gap-1"><Zap size={12} /> Ultra-Low Latency</span>
           </div>
           <button onClick={() => setActiveTab('settings')} className="hover:rotate-90 transition-transform duration-500">
             <Settings size={22} className="text-white/20 hover:text-white" />
           </button>
        </div>
      </header>

      {/* 🚀 MAIN CONTENT AREA */}
      <main className="max-w-6xl mx-auto px-8 py-12 pb-48">
        <AnimatePresence mode="wait">
          
          {/* TAB: RECORDING ENGINE (recording button now smaller) */}
          {activeTab === 'record' && (
            <motion.div 
              key="record"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-12"
            >
              <div className="lg:col-span-2 space-y-12">
                <div className="bg-[#0a0a0a] rounded-[4rem] p-16 border border-white/5 relative overflow-hidden group shadow-2xl">
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative mb-12">
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.5, opacity: 0.2 }} exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-red-600 rounded-full blur-[60px]"
                          />
                        )}
                      </AnimatePresence>
                      <button 
                        onClick={handleToggleRecording}
                        className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 relative ${isRecording ? 'bg-white text-black scale-110 shadow-[0_0_80px_rgba(255,255,255,0.2)]' : 'bg-red-600 text-white shadow-[0_30px_60px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95'}`}
                      >
                        {isRecording ? <StopCircle size={48} strokeWidth={1.5} /> : <Mic size={48} strokeWidth={1.5} />}
                      </button>
                    </div>

                    <h2 className="text-5xl font-black tracking-tighter mb-4 italic">
                      {isRecording ? "CAPTURE ACTIVE" : "ENGINE IDLE"}
                    </h2>
                    <p className="font-mono text-4xl text-red-600 tracking-widest mb-12 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                      {formatTime(recordingTime)}
                    </p>

                    <div className="flex gap-4">
                      {audioUrl && (
                        <a href={audioUrl} download="Lecture.mp3" className="flex items-center gap-3 bg-white/10 hover:bg-white text-white hover:text-black px-8 py-4 rounded-3xl font-black uppercase tracking-widest transition-all text-xs">
                          <Download size={16} /> Export Audio
                        </a>
                      )}
                      <button onClick={triggerFullAnalysis} className="flex items-center gap-3 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-8 py-4 rounded-3xl font-black uppercase tracking-widest transition-all text-xs border border-red-600/20">
                         <Sparkles size={16} /> Deep Analysis
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Actions (smaller buttons) */}
                <div className="grid grid-cols-2 gap-8">
                   <div className="bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition-all group">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-600 transition-colors">
                        <ImageIcon size={28} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Visual Slides</h3>
                      <p className="text-white/40 text-sm leading-relaxed mb-6">Attach screenshots or lecture slides for multimodal context.</p>
                      <label className="block text-center bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-2xl cursor-pointer font-black text-[10px] uppercase tracking-[0.2em] transition-all">
                        Upload Images ({uploadedImages.length}/50)
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                      </label>
                   </div>
                   <div className="bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition-all group">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-600 transition-colors">
                        <FileAudio size={28} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Pre-Recorded</h3>
                      <p className="text-white/40 text-sm leading-relaxed mb-6">Import existing lecture files up to 2 hours long.</p>
                      <label className="block text-center bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-2xl cursor-pointer font-black text-[10px] uppercase tracking-[0.2em] transition-all">
                        Browse MP3/WAV
                        <input type="file" accept="audio/*" className="hidden" />
                      </label>
                   </div>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-8">
                <div className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-8">System Health</h4>
                   <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold opacity-40">Gemini 2.5 Flash</span>
                        <span className="text-xs font-black text-green-500 uppercase">Linked</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:'100%'}} className="h-full bg-green-500" />
                      </div>
                   </div>
                </div>
                
                <div className="bg-gradient-to-br from-red-600 to-red-900 p-10 rounded-[3rem] text-white shadow-xl shadow-red-600/20">
                   <h3 className="text-2xl font-black leading-tight mb-4 italic">NSG EXECUTIVE BENEFITS</h3>
                   <ul className="space-y-3 text-sm font-bold opacity-80">
                      <li className="flex items-center gap-3"><Check size={16} /> 2-Hour Transcriptions</li>
                      <li className="flex items-center gap-3"><Check size={16} /> Image-to-Concept Logic</li>
                   </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: AI CHAT (GEMINI 2.5) */}
          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-[75vh] bg-[#0a0a0a] rounded-[4rem] border border-white/5 relative overflow-hidden shadow-2xl"
            >
              {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-md flex flex-col items-center justify-center">
                   <div className="relative mb-8">
                     <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="w-32 h-32 border-2 border-red-600/20 border-t-red-600 rounded-full" />
                     <Brain size={40} className="absolute inset-0 m-auto text-red-600 animate-pulse" />
                   </div>
                   <h3 className="text-2xl font-black italic tracking-widest mb-2">SYNCHRONIZING WITH GEMINI 2.5</h3>
                   <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-full h-full bg-red-600" />
                   </div>
                </div>
              )}

              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-600/10 rounded-xl text-red-600"><Sparkles size={20} /></div>
                  <div>
                    <h4 className="font-black italic uppercase tracking-widest text-sm">Gemini 2.5 Flash</h4>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Live Processing Active</span>
                  </div>
                </div>
                <button onClick={() => setChatHistory([])} className="p-2 text-white/20 hover:text-red-500"><Trash2 size={20}/></button>
              </div>

              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth">
                {chatHistory.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}
                    key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-2`}>
                      <div className={`p-6 rounded-[2.5rem] text-sm leading-relaxed font-bold ${msg.role === 'user' ? 'bg-red-600 text-white rounded-br-none shadow-xl shadow-red-600/20' : 'bg-white/5 border border-white/10 text-white/80 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                      <span className="block text-[8px] font-black uppercase text-white/20 px-4">{msg.timestamp}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-8 bg-[#0d0d0d] border-t border-white/5">
                <div className="max-w-3xl mx-auto flex gap-4 bg-white/5 p-2 rounded-[2.5rem] border border-white/10 focus-within:border-red-600 focus-within:bg-black transition-all">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about specific diagrams or key concepts..." 
                    className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-sm font-bold placeholder:text-white/20"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-red-600 p-5 rounded-full shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all"
                  >
                    <ChevronRight size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: KNOWLEDGE LIBRARY (unchanged) */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} className="space-y-8">
               <div className="flex justify-between items-end px-4">
                 <div>
                   <h2 className="text-4xl font-black italic">Library</h2>
                   <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Historical Analytics</p>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {sessions.map((session) => (
                   <motion.div 
                     whileHover={{ y: -5 }}
                     key={session.id} 
                     className="bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5 flex items-center justify-between group cursor-pointer"
                   >
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-white/20 group-hover:bg-red-600 group-hover:text-white transition-all">
                           <Play size={24} />
                        </div>
                        <div>
                           <h4 className="text-xl font-black mb-1 group-hover:text-red-600 transition-colors">{session.title}</h4>
                           <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-white/30">
                              <span>{session.date}</span>
                              <span className="text-red-600">•</span>
                              <span>{session.duration}</span>
                              <span className="text-red-600">•</span>
                              <span>{session.imageCount} Slides</span>
                           </div>
                        </div>
                     </div>
                     <button className="p-4 bg-white/5 rounded-2xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <Trash2 size={20} />
                     </button>
                   </motion.div>
                 ))}
                 {sessions.length === 0 && (
                   <div className="col-span-full py-40 text-center border-2 border-dashed border-white/5 rounded-[4rem]">
                      <History size={64} className="mx-auto text-white/5 mb-6" />
                      <p className="text-white/20 font-black uppercase tracking-[0.5em] italic">Archive Empty</p>
                   </div>
                 )}
               </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 💰 BOTTOM AD REVENUE SLOT (kept for original functionality) */}
      <div className="fixed bottom-28 left-0 w-full h-[70px] bg-[#050505]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center z-40">
        <div className="w-[320px] h-[50px] bg-white/5 rounded-lg border border-white/10 flex items-center justify-center group hover:bg-white/10 transition-all">
           <div className="flex gap-4 items-center">
             <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Mobile Banner #02</span>
           </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION DOCK (icons slightly smaller) */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50">
        <div className="bg-[#0f0f0f]/80 backdrop-blur-3xl border border-white/10 p-3 rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.8)] flex items-center justify-between">
          {[
            { id: 'record', icon: Mic, label: 'Recorder' },
            { id: 'ai', icon: Brain, label: 'NSG AI' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'settings', icon: Cpu, label: 'System' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-5 rounded-[2.8rem] transition-all duration-500 ${activeTab === tab.id ? 'bg-red-600 text-white shadow-xl shadow-red-600/40 scale-105' : 'text-white/30 hover:text-white'}`}
            >
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 3 : 1.5} />
              {activeTab === tab.id && (
                <span className="text-[11px] font-black uppercase tracking-widest">
                  {tab.label}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* 🌌 BACKGROUND FX */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
         <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[150px] animate-pulse" />
         <div className="absolute bottom-[10%] right-[5%] w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[150px] transition-all" />
      </div>
    </div>
  );
}
