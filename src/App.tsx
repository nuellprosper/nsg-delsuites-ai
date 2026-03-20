import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Mic, BookOpen, History, Trash2, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    if (!API_KEY) return alert("API Key Missing in Settings!");
    if (!courseCode) return alert("Please enter a Course Code!");
    setIsProcessing(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // Simplified Prompt for maximum stability
      const prompt = `Analyze this ${courseCode} lecture. Return ONLY a JSON object. 
      Structure: {"topics": ["Topic 1 summary", "Topic 2 summary", "Topic 3 summary"], "quiz": []}`;
      
      const result = await model.generateContent([
        { text: prompt }, 
        { inlineData: { data: base64 as string, mimeType: "audio/webm" } }
      ]);
      
      const resText = result.response.text();
      
      // Safety: This tries to find the JSON safely without crashing
      let cleanData;
      try {
        const start = resText.indexOf('{');
        const end = resText.lastIndexOf('}') + 1;
        cleanData = JSON.parse(resText.substring(start, end));
      } catch (e) {
        throw new Error("The AI response was not in the right format. Try again.");
      }

      const newSession = {
        id: Date.now().toString(),
        courseCode: courseCode.toUpperCase(),
        timestamp: Date.now(),
        topics: cleanData.topics || ["No summary available"],
        quiz: cleanData.quiz || [],
        audioBlob: blob 
      };

      const db = await initDB();
      await db.put('sessions', newSession);
      setCurrentSession(newSession);
      setActiveTab('tutor');
    } catch (error: any) {
      alert(error.message);
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
    <div className="min-h-screen bg-white font-sans pb-28 text-slate-900">
      <header className="p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black italic text-red-600">NSG FOR DELSUITES</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase">AI STUDY SYSTEM</p>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'record' && (
          <div className="space-y-6">
            <input 
              type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. MTH 101" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-red-600 outline-none"
            />
            <div className="flex flex-col items-center py-12">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              {isProcessing ? (
                <div className="mt-6 flex items-center gap-2 font-black text-red-600 animate-pulse">
                  <Loader2 className="animate-spin" /> ANALYZING...
                </div>
              ) : (
                <p className="mt-6 text-sm font-bold text-slate-300">Tap to start recording</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-6">
            <div className="bg-red-600 text-white p-6 rounded-3xl shadow-xl">
              <h2 className="font-black text-2xl uppercase">{currentSession.courseCode}</h2>
              <p className="text-[10px] font-bold opacity-70">LECTURE INSIGHTS</p>
            </div>
            <AITutor topics={currentSession.topics} quiz={currentSession.quiz} />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 px-2">YOUR LECTURES</h2>
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }} className="bg-slate-50 p-5 rounded-2xl flex justify-between items-center active:scale-95 transition-transform">
                <span className="font-black text-slate-700 uppercase">{s.courseCode}</span>
                <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-300"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around p-6">
        <button onClick={() => setActiveTab('record')} className={activeTab === 'record' ? 'text-red-600' : 'text-slate-300'}><Mic size={24} /></button>
        <button onClick={() => setActiveTab('tutor')} disabled={!currentSession} className={activeTab === 'tutor' ? 'text-red-600' : 'text-slate-300'}><BookOpen size={24} /></button>
        <button onClick={() => setActiveTab('library')} className={activeTab === 'library' ? 'text-red-600' : 'text-slate-300'}><History size={24} /></button>
      </nav>
    </div>
  );
}

export default App;
