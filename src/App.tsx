import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Mic, BookOpen, History, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key pulled from Vercel Environment Variables
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
    if (!API_KEY) {
      alert("Missing API Key! Please add VITE_GEMINI_API_KEY to Vercel.");
      return;
    }

    if (!courseCode) return alert("Please enter a Course Code!");
    setIsProcessing(true);

    try {
      // UPDATED TO MARCH 2026 STANDARD: Gemini 3.1 Flash-Lite
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview" 
      });
      
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const prompt = `Analyze this ${courseCode} lecture. Provide study topics and 20 MCQs. Format: TOPICS: [JSON array] QUIZ: [JSON array]`;
      
      const result = await model.generateContent([
        { text: prompt }, 
        { inlineData: { data: base64 as string, mimeType: "audio/webm" } }
      ]);
      
      const resText = result.response.text();

      const newSession = {
        id: Date.now().toString(),
        courseCode,
        timestamp: Date.now(),
        topics: JSON.parse(resText.split('TOPICS:')[1].split('QUIZ:')[0].trim()),
        quiz: JSON.parse(resText.split('QUIZ:')[1].trim()),
        audioBlob: blob 
      };

      const db = await initDB();
      await db.put('sessions', newSession);
      setCurrentSession(newSession);
      setActiveTab('tutor');
    } catch (error: any) {
      console.error("Gemini Error:", error);
      alert(`AI Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this session?")) {
      const db = await initDB();
      await db.delete('sessions', id);
      setSessions(sessions.filter(s => s.id !== id));
      if (currentSession?.id === id) setCurrentSession(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 text-slate-900">
      <header className="p-6 bg-white border-b border-slate-200 sticky top-0 z-30 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black italic tracking-tighter text-red-600">NSG FOR DELSUITES</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase">AI STUDY SYSTEM • NUELLGRAPHICS</p>
        </div>
        {!API_KEY && <AlertCircle className="text-red-500 animate-pulse" size={20} />}
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'record' && (
          <div className="space-y-6">
            <input 
              type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g., EEE 101" 
              className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none shadow-sm"
            />
            
            <div className="flex flex-col items-center py-12 bg-white rounded-[2rem] border-2 border-slate-100 shadow-md">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              <p className="mt-6 text-sm font-bold text-slate-400 italic">Tap to record lecture</p>
            </div>

            {isProcessing && (
              <div className="flex items-center justify-center gap-3 font-black text-red-600 uppercase animate-pulse pt-4">
                <Loader2 className="animate-spin" /> Gemini 3.1 is analyzing...
              </div>
            )}
          </div>
        )}

        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-5">
            <div className="bg-red-600 text-white p-5 rounded-3xl">
              <h2 className="font-black uppercase text-xl leading-none">{currentSession.courseCode}</h2>
              <p className="text-[10px] font-bold opacity-60 mt-1">{new Date(currentSession.timestamp).toLocaleDateString()}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border-2 border-slate-100">
              <audio controls src={URL.createObjectURL(currentSession.audioBlob)} className="w-full" />
            </div>
            <AITutor topics={currentSession.topics} />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2 rounded-xl text-red-600"><BookOpen size={20}/></div>
                  <span className="font-black text-slate-800 uppercase text-sm">{s.courseCode}</span>
                </div>
                <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-5 z-50">
        <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center ${activeTab === 'record' ? 'text-red-600' : 'text-slate-300'}`}>
          <Mic size={24} /><span className="text-[9px] font-black uppercase">Record</span>
        </button>
        <button onClick={() => setActiveTab('tutor')} disabled={!currentSession} className={`flex flex-col items-center ${activeTab === 'tutor' ? 'text-red-600' : 'text-slate-300'} ${!currentSession && 'opacity-20'}`}>
          <BookOpen size={24} /><span className="text-[9px] font-black uppercase">Tutor</span>
        </button>
        <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center ${activeTab === 'library' ? 'text-red-600' : 'text-slate-300'}`}>
          <History size={24} /><span className="text-[9px] font-black uppercase">Library</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
