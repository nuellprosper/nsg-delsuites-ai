import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Quiz } from './components/quiz';
import { Mic, BookOpen, History, Download, Trash2, Loader2, PlayCircle } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Database initialization for large audio files
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

  // Sync with IndexedDB whenever the Library tab is opened
  useEffect(() => {
    const loadSessions = async () => {
      const db = await initDB();
      const all = await db.getAll('sessions');
      setSessions(all.sort((a, b) => b.timestamp - a.timestamp));
    };
    loadSessions();
  }, [activeTab]);

  const handleProcessAudio = async (blob: Blob) => {
    if (!courseCode) return alert("Please enter a Course Title (e.g., EEE 101) first!");
    setIsProcessing(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Convert audio to base64 for Gemini
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const prompt = `Analyze this ${courseCode} lecture. Provide detailed study topics and a 20-question MCQ quiz. Format strictly as: TOPICS: [...] QUIZ: [...]`;
      
      const result = await model.generateContent([
        prompt, 
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
    } catch (error) {
      console.error(error);
      alert("Failed to analyze. Ensure your API key is active.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this lecture from your history?")) {
      const db = await initDB();
      await db.delete('sessions', id);
      setSessions(sessions.filter(s => s.id !== id));
      if (currentSession?.id === id) setCurrentSession(null);
    }
  };

  const saveToPhone = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_NSG_Recording.webm`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28 text-slate-900">
      <header className="p-6 bg-white border-b border-slate-200 sticky top-0 z-30">
        <h1 className="text-xl font-black italic tracking-tighter text-red-600">NSG FOR DELSUITES</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI STUDY SYSTEM • NUELLGRAPHICS</p>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {/* RECORD SCREEN */}
        {activeTab === 'record' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Current Subject</label>
              <input 
                type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. MTH 102 - Calculus" 
                className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none transition-all shadow-sm"
              />
            </div>
            
            <div className="flex flex-col items-center py-12 bg-white rounded-[2rem] border-2 border-slate-100 shadow-md">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              <p className="mt-6 text-sm font-bold text-slate-500 italic">Record your lecture now</p>
            </div>

            {isProcessing && (
              <div className="flex items-center justify-center gap-3 font-black text-red-600 uppercase animate-pulse pt-4">
                <Loader2 className="animate-spin" /> Transcribing Audio...
              </div>
            )}
          </div>
        )}

        {/* TUTOR SCREEN */}
        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-red-600 text-white p-6 rounded-3xl shadow-lg shadow-red-100">
              <h2 className="font-black uppercase text-2xl leading-tight">{currentSession.courseCode}</h2>
              <p className="text-[10px] font-bold opacity-75 mt-1">Sesssion ID: {currentSession.id}</p>
            </div>
            
            {/* Audio Replay Component */}
            <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <PlayCircle size={18} className="text-red-500" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Original Lecture Audio</span>
              </div>
              <audio controls src={URL.createObjectURL(currentSession.audioBlob)} className="w-full" />
              <button 
                onClick={() => saveToPhone(currentSession.audioBlob, currentSession.courseCode)}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 p-4 rounded-2xl text-[11px] font-black uppercase text-slate-600 border border-slate-100 active:bg-slate-200 transition-all"
              >
                <Download size={16} /> Save Audio to Phone
              </button>
            </div>

            <AITutor topics={currentSession.topics} />
          </div>
        )}

        {/* LIBRARY SCREEN */}
        {activeTab === 'library' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h2 className="text-[11px] font-black uppercase text-slate-400 px-2 tracking-widest">Study History</h2>
            <div className="grid gap-3">
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  className="bg-white p-5 rounded-[1.5rem] border border-slate-200 flex justify-between items-center shadow-sm active:scale-[0.97] transition-all"
                  onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }}
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-red-50 p-3 rounded-2xl text-red-600"><BookOpen size={22}/></div>
                    <div>
                      <p className="font-black text-slate-800 uppercase text-sm leading-none mb-1">{s.courseCode}</p>
                      <p className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-200 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                </div>
              ))}
            </div>
            {sessions.length === 0 && (
              <div className="text-center py-20 text-slate-300">
                <History size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold italic">No lectures saved yet.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-around p-5 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] z-50">
        <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'record' ? 'text-red-600 scale-110' : 'text-slate-300'}`}>
          <Mic size={26} /><span className="text-[9px] font-black uppercase tracking-tighter">Record</span>
        </button>
        <button 
          onClick={() => setActiveTab('tutor')} 
          disabled={!currentSession} 
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'tutor' ? 'text-red-600 scale-110' : 'text-slate-300'} ${!currentSession && 'opacity-20'}`}
        >
          <BookOpen size={26} /><span className="text-[9px] font-black uppercase tracking-tighter">Tutor</span>
        </button>
        <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'library' ? 'text-red-600 scale-110' : 'text-slate-300'}`}>
          <History size={26} /><span className="text-[9px] font-black uppercase tracking-tighter">Library</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
