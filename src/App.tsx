
import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Mic, BookOpen, History, Trash2, Loader2, Upload } from 'lucide-react';
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
    if (!courseCode) {
      alert("Please enter a Course Code (e.g., MTH 101) first!");
      return;
    }
    setIsProcessing(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const prompt = `Analyze this ${courseCode} lecture. Return ONLY a JSON object:
      {"topics": ["Summary 1", "Summary 2", "Summary 3"], "quiz": [{"question": "Q", "options": ["A","B","C","D"], "correct": "A"}]}`;
      
      const result = await model.generateContent([
        { text: prompt }, 
        { inlineData: { data: base64 as string, mimeType: "audio/webm" } }
      ]);
      
      const resText = result.response.text();
      const cleanData = JSON.parse(resText.substring(resText.indexOf('{'), resText.lastIndexOf('}') + 1));

      const newSession = {
        id: Date.now().toString(),
        courseCode: courseCode.toUpperCase(),
        timestamp: Date.now(),
        topics: cleanData.topics || [],
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

  return (
    <div className="min-h-screen bg-white pb-24 text-slate-900 font-sans">
      <header className="p-6 border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-md z-50 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-red-600">NSG FOR DELSUITES</h1>
        <div className="text-[10px] font-bold text-slate-300">75% CREDIT USED</div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'record' && (
          <div className="space-y-6">
            <input 
              type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
              placeholder="Enter Course Code..." 
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black focus:border-red-600 outline-none"
            />
            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              <label className="mt-8 flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-sm border border-slate-100 cursor-pointer">
                <Upload size={18} className="text-red-600" />
                <span className="text-xs font-black uppercase">Upload Audio</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleProcessAudio(e.target.files[0])} />
              </label>
            </div>
            {isProcessing && <div className="flex justify-center gap-2 font-black text-red-600 animate-pulse"><Loader2 className="animate-spin" /> ANALYZING...</div>}
          </div>
        )}

        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-6">
            <div className="bg-red-600 text-white p-6 rounded-[2.5rem] shadow-lg">
              <h2 className="font-black text-2xl uppercase">{currentSession.courseCode}</h2>
            </div>
            <AITutor topics={currentSession.topics} quiz={currentSession.quiz} />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }} className="bg-slate-50 p-5 rounded-2xl flex justify-between items-center shadow-sm">
                <span className="font-black text-slate-800 uppercase">{s.courseCode}</span>
                <Trash2 size={18} className="text-slate-200" onClick={async (e) => { e.stopPropagation(); const db = await initDB(); await db.delete('sessions', s.id); setActiveTab('record'); }}/>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900 rounded-[2rem] flex justify-around p-4 shadow-2xl">
        <button onClick={() => setActiveTab('record')} className={activeTab === 'record' ? 'text-red-600' : 'text-slate-500'}><Mic size={24} /></button>
        <button onClick={() => setActiveTab('tutor')} disabled={!currentSession} className={activeTab === 'tutor' ? 'text-red-600' : 'text-slate-500'}><BookOpen size={24} /></button>
        <button onClick={() => setActiveTab('library')} className={activeTab === 'library' ? 'text-red-600' : 'text-slate-500'}><History size={24} /></button>
      </nav>
    </div>
  );
}

export default App;
