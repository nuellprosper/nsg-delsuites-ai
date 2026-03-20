import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Mic, BookOpen, History, Trash2, Loader2, Upload, Settings } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configured for Gemini 2.5 Flash
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const initDB = async () => {
  return openDB('NSG_Database', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    },
  });
};

function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'tutor' | 'library'>('record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    const loadSessions = async () => {
      const db = await initDB();
      const all = await db.getAll('sessions');
      setSessions(all.sort((a, b) => b.timestamp - a.timestamp));
    };
    loadSessions();
  }, [activeTab]);

  const handleProcessAudio = async (blob: Blob) => {
    if (!courseCode) return alert("Please enter a Course Code (e.g., EEE 101) first!");
    if (!API_KEY) return alert("API Key missing. Please check your Environment Variables.");
    
    setIsProcessing(true);

    try {
      // SET TO GEMINI 2.5 FLASH AS REQUESTED
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const prompt = `You are a DELSU Engineering Tutor. Analyze this ${courseCode} lecture audio. 
      Return ONLY a JSON object with this structure:
      {
        "topics": ["Point 1 summary", "Point 2 summary", "Point 3 summary"],
        "quiz": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": "A"}]
      }`;
      
      const result = await model.generateContent([
        { text: prompt }, 
        { inlineData: { data: base64 as string, mimeType: "audio/webm" } }
      ]);
      
      const resText = result.response.text();
      
      // Safety: Robust JSON parsing
      let cleanData;
      try {
        const start = resText.indexOf('{');
        const end = resText.lastIndexOf('}') + 1;
        cleanData = JSON.parse(resText.substring(start, end));
      } catch (e) {
        throw new Error("AI response format error. Please try a clearer recording.");
      }

      const newSession = {
        id: Date.now().toString(),
        courseCode: courseCode.toUpperCase(),
        timestamp: Date.now(),
        topics: cleanData.topics || ["No summary generated"],
        quiz: cleanData.quiz || [],
        audioBlob: blob 
      };

      const db = await initDB();
      await db.put('sessions', newSession);
      
      setCurrentSession(newSession);
      setActiveTab('tutor');
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessAudio(file);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this lecture?")) {
      const db = await initDB();
      await db.delete('sessions', id);
      setSessions(sessions.filter(s => s.id !== id));
      if (currentSession?.id === id) setCurrentSession(null);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 text-slate-900 font-sans">
      <header className="p-6 border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-md z-50 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black italic tracking-tighter text-red-600">NSG FOR DELSUITES</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Engineering AI Tutor</p>
        </div>
        <button className="text-slate-300 hover:text-red-600"><Settings size={20} /></button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'record' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-2">Current Course</label>
              <input 
                type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. EEE 101" 
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black focus:border-red-600 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              <div className="mt-8">
                <label className="flex items-center gap-2 bg-white px-8 py-3 rounded-full shadow-md border border-slate-100 cursor-pointer active:scale-95 transition-all">
                  <Upload size={18} className="text-red-600" />
                  <span className="text-xs font-black uppercase tracking-tight">Upload Lecture</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            {isProcessing && (
              <div className="flex flex-col items-center gap-3 font-black text-red-600 uppercase pt-4 animate-pulse">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs tracking-widest">Gemini 2.5 Analyzing...</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
             <div className="bg-red-600 text-white p-7 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <h2 className="font-black text-3xl uppercase leading-none">{currentSession.courseCode}</h2>
                <p className="text-[10px] font-bold opacity-80 mt-2 tracking-widest uppercase">2.5 Flash Analysis</p>
             </div>
             
             <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-3">
               <div className="bg-white p-2 rounded-full text-red-600 shadow-sm"><Mic size={16}/></div>
               <audio controls src={URL.createObjectURL(currentSession.audioBlob)} className="w-full h-8 opacity-70" />
             </div>

             <AITutor topics={currentSession.topics} quiz={currentSession.quiz} />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-[10px] font-black text-slate-400 px-2 tracking-widest uppercase">Your Archives</h2>
            {sessions.length === 0 ? (
              <div className="text-center py-20 font-bold italic text-slate-300">No lectures saved yet.</div>
            ) : (
              sessions.map(s => (
                <div key={s.id} onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center active:bg-red-50 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl text-red-600"><BookOpen size={20}/></div>
                    <div>
                      <span className="font-black text-slate-800 uppercase block">{s.courseCode}</span>
                      <span className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={(e) => deleteSession(s.id, e)} className="p-2 text-slate-200 hover:text-red-500">
                    <Trash2 size={18}/>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 left-8 right-8 bg-slate-900 rounded-[2.5rem] flex justify-around p-4 shadow-2xl z-50 ring-4 ring-white">
        <button onClick={() => setActiveTab('record')} className={`p-3 rounded-2xl transition-all ${activeTab === 'record' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>
          <Mic size={24} />
        </button>
        <button onClick={() => setActiveTab('tutor')} disabled={!currentSession} className={`p-3 rounded-2xl transition-all ${activeTab === 'tutor' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 disabled:opacity-20'}`}>
          <BookOpen size={24} />
        </button>
        <button onClick={() => setActiveTab('library')} className={`p-3 rounded-2xl transition-all ${activeTab === 'library' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>
          <History size={24} />
        </button>
      </nav>
    </div>
  );
}

export default App;
