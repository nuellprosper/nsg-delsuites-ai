import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, MessageSquare, History, Download, Play, 
  ChevronRight, Sparkles, AlertCircle, Trash2, Save,
  X, Check, ExternalLink, DollarSign, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Interfaces ---
interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'audio';
}

interface HistoryLog {
  id: string;
  date: string;
  title: string;
  type: 'lecture' | 'session';
  duration?: string;
  summary?: string;
}

// --- Main Application Component ---
export default function NSG_DeSuites_V2() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'record' | 'upload' | 'ai' | 'history'>('record');
  
  // 1. RECORDING SYSTEM (2-Hour Logic)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 2. UPLOAD SYSTEM (50 Images / 2hr Audio)
  const [uploadedImages, setUploadedImages] = useState<MediaFile[]>([]);
  const [uploadedAudio, setUploadedAudio] = useState<MediaFile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 3. AI CHAT & ANALYSIS
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Welcome, NSG Executive. Upload your lecture materials and I will begin the 2.5 analysis.' }
  ]);

  // 4. PERSISTENT HISTORY
  const [sessionHistory, setSessionHistory] = useState<HistoryLog[]>([]);

  // --- Recording Logic Implementation ---
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setAudioUrl(url);
        // Auto-save to history
        addHistoryEntry('New Lecture Recording', 'lecture', formatTime(recordingTime));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect data every second for safety
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert("Microphone access is required for lecture recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Upload Logic Implementation ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 50) {
      alert("Maximum 50 images allowed per lecture session.");
      return;
    }
    
    const newImages: MediaFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file: file,
      preview: URL.createObjectURL(file),
      type: 'image'
    }));
    
    setUploadedImages(prev => [...prev, ...newImages]);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedAudio({
        id: 'audio-main',
        file: file,
        type: 'audio'
      });
    }
  };

  // --- AI Analysis Implementation ---
  const runGeminiAnalysis = () => {
    if (uploadedImages.length === 0 && !uploadedAudio && !recordedBlob) {
      alert("Please provide audio or images for analysis.");
      return;
    }
    
    setIsAnalyzing(true);
    setActiveTab('ai');
    
    // Simulate Gemini 2.5 Processing
    setTimeout(() => {
      setIsAnalyzing(false);
      setChatHistory(prev => [...prev, {
        role: 'ai',
        text: `Analysis Complete. I have processed ${uploadedImages.length} lecture slides and the audio recording. You can now ask questions about specific diagrams or key concepts mentioned in the lecture.`
      }]);
    }, 3000);
  };

  const addHistoryEntry = (title: string, type: 'lecture' | 'session', duration?: string) => {
    const newEntry: HistoryLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      title,
      type,
      duration
    };
    setSessionHistory(prev => [newEntry, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-red-600 selection:text-white overflow-x-hidden">
      
      {/* 6. TOP AD PLACEMENT (Z-Index High) */}
      <div className="w-full bg-[#111] border-b border-white/5 p-2 text-center relative z-50">
        <div className="max-w-[728px] h-[90px] mx-auto bg-white/5 rounded flex items-center justify-center border border-dashed border-white/10 group">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-red-600 transition-colors cursor-default">
            NSG Network Ad Space #01
          </span>
        </div>
      </div>

      {/* HEADER SECTION */}
      <header className="px-6 py-8 flex justify-between items-center border-b border-white/5 backdrop-blur-md sticky top-0 z-40 bg-[#0a0a0a]/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)]">
            <Brain size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">DE-SUITES</h1>
            <span className="text-[10px] font-bold text-red-600 tracking-[0.4em] uppercase">Executive AI</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('history')} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/60 hover:text-white">
            <History size={20} />
          </button>
          <div className="h-10 w-[1px] bg-white/10 mx-2"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Revenue Status</span>
            <span className="text-xs font-bold text-green-500 flex items-center gap-1"><DollarSign size={10} /> Active</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 pb-40">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: RECORDING ENGINE */}
          {activeTab === 'record' && (
            <motion.div 
              key="record"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="bg-gradient-to-b from-white/5 to-transparent p-12 rounded-[4rem] border border-white/10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]" />
                
                <div className="relative mb-8">
                  {isRecording && (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 bg-red-600 rounded-full blur-3xl opacity-20"
                    />
                  )}
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all duration-500 relative z-10 ${isRecording ? 'bg-white text-black scale-110 shadow-2xl' : 'bg-red-600 text-white shadow-[0_20px_50px_rgba(220,38,38,0.3)] hover:scale-105'}`}
                  >
                    {isRecording ? <StopCircle size={48} /> : <Mic size={48} />}
                  </button>
                </div>

                <h2 className="text-3xl font-black tracking-tight mb-2">
                  {isRecording ? "Capturing Lecture..." : "Start Recording"}
                </h2>
                <p className="text-white/40 font-mono text-2xl tracking-widest mb-8">{formatTime(recordingTime)}</p>
                
                {audioUrl && !isRecording && (
                  <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                    <a 
                      href={audioUrl} 
                      download="NSG_DeSuites_Lecture.mp3"
                      className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl"
                    >
                      <Download size={18} /> Download Recording
                    </a>
                    <button onClick={() => {setAudioUrl(null); setRecordingTime(0);}} className="text-white/20 text-[10px] font-bold uppercase tracking-widest hover:text-red-600">Discard and Restart</button>
                  </div>
                )}
              </div>

              {/* Quick Upload Action */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 flex flex-col items-center text-center gap-4 group hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
                  <div className="bg-white/5 p-4 rounded-2xl group-hover:bg-red-600/20 group-hover:text-red-600 transition-all">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold">Visual Context</h4>
                    <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mt-1">Upload up to 50 slides</p>
                  </div>
                  <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                
                <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 flex flex-col items-center text-center gap-4 group hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
                  <div className="bg-white/5 p-4 rounded-2xl group-hover:bg-red-600/20 group-hover:text-red-600 transition-all">
                    <FileAudio size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold">Pre-recorded Audio</h4>
                    <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mt-1">Import 2hr lecture file</p>
                  </div>
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: MEDIA MANAGEMENT */}
          {activeTab === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end px-2">
                <div>
                  <h2 className="text-3xl font-black italic">Lecture Media</h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-1">Ready for Gemini 2.5 Analysis</p>
                </div>
                <button 
                  onClick={runGeminiAnalysis}
                  disabled={uploadedImages.length === 0 && !uploadedAudio && !recordedBlob}
                  className="bg-red-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-20"
                >
                  Process with NSG AI
                </button>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {uploadedImages.map((img) => (
                  <div key={img.id} className="aspect-square rounded-3xl overflow-hidden bg-white/5 border border-white/10 group relative">
                    <img src={img.preview} alt="slide" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    <button 
                      onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))}
                      className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>
                ))}
                {uploadedImages.length < 50 && (
                  <label className="aspect-square rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-red-600/50 hover:bg-red-600/5 transition-all cursor-pointer">
                    <Upload size={24} className="text-white/20" />
                    <span className="text-[8px] font-black uppercase text-white/30">Add Image</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              {/* Audio Status */}
              {(uploadedAudio || recordedBlob) && (
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                    <Check size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">Audio Source Ready</h4>
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Type: {recordedBlob ? 'Internal Capture' : 'External MP3'}</p>
                  </div>
                  <button onClick={() => {setUploadedAudio(null); setRecordedBlob(null);}} className="text-red-500 font-bold text-[10px] uppercase tracking-widest">Remove</button>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: AI CHAT (Gemini 2.5 Logic) */}
          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col h-[65vh] bg-[#111] rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden"
            >
              {isAnalyzing && (
                <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                    <Sparkles size={32} className="absolute inset-0 m-auto text-red-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-black italic tracking-widest">NSG 2.5 PROCESSING</h3>
                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.3em] mt-2 animate-pulse">Syncing Transcription & Vision Buffers...</p>
                  </div>
                </div>
              )}

              {/* Chat Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-600/10 rounded-lg text-red-600"><Sparkles size={18} /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI Tutor Insight</span>
                </div>
                <span className="bg-green-500/10 text-green-500 text-[8px] font-black px-3 py-1 rounded-full uppercase">Multimodal Active</span>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {chatHistory.map((chat, i) => (
                  <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-5 rounded-3xl font-bold text-sm leading-relaxed ${chat.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-white/5 text-white/80 border border-white/5 rounded-tl-none'}`}>
                      {chat.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-6 bg-[#161616] border-t border-white/5">
                <div className="flex gap-3 bg-white/5 p-2 rounded-3xl border border-white/5 focus-within:border-red-600 transition-all">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && setChatInput('')}
                    placeholder="Ask about the lecture..." 
                    className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm font-bold placeholder:text-white/20"
                  />
                  <button className="bg-red-600 p-4 rounded-2xl shadow-lg shadow-red-600/20 active:scale-90 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-black italic px-2">Knowledge Base</h2>
              {sessionHistory.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20"><History size={32} /></div>
                  <p className="text-white/20 text-xs font-bold uppercase tracking-widest italic">No past sessions found in local cache</p>
                </div>
              ) : (
                sessionHistory.map((item) => (
                  <div key={item.id} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-red-600/20 text-red-600 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                        <Play size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm tracking-tight">{item.title}</h4>
                        <div className="flex gap-3 mt-1 text-[8px] font-black uppercase tracking-widest text-white/40">
                          <span>{item.date}</span>
                          <span className="text-red-600">•</span>
                          <span>{item.duration || '00:00'}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-3 bg-white/5 rounded-xl text-white/20 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 6. BOTTOM AD PLACEMENT */}
      <div className="fixed bottom-28 left-0 w-full h-[60px] bg-[#111] border-t border-white/5 flex items-center justify-center z-40">
        <div className="w-[320px] h-[50px] bg-white/5 rounded border border-white/10 flex items-center justify-center">
           <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Banner Ad #02 (320x50)</span>
        </div>
      </div>

      {/* NAVIGATION SYSTEM */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-2 rounded-[3rem] shadow-2xl flex items-center justify-between">
          {[
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'upload', icon: Upload, label: 'Media' },
            { id: 'ai', icon: Brain, label: 'AI Tutor' },
            { id: 'history', icon: History, label: 'Library' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 px-6 py-4 rounded-[2.5rem] transition-all duration-500 ${activeTab === item.id ? 'bg-red-600 text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)]' : 'text-white/40 hover:text-white'}`}
            >
              <item.icon size={18} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === item.id ? 'block' : 'hidden'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* BG DECOR */}
      <div className="fixed top-1/4 -left-20 w-64 h-64 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-64 h-64 bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
