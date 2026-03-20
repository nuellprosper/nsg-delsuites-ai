import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Quiz } from './components/quiz';
import { Mic, BookOpen, History, Download, Trash2, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Database Setup for Audio Blobs
const getDB = () => openDB('NSG_Database', 1, {
  upgrade(db) { db.createObjectStore('sessions', { keyPath: 'id' }); }
});

function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'tutor' | 'library'>('record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);

  // Load Library from Database
  useEffect(() => {
    const refreshLibrary = async () => {
      const db = await getDB();
      const all = await db.getAll('sessions');
      setSessions(all.sort((a, b) => b.timestamp - a.timestamp));
    };
    refreshLibrary();
  }, [activeTab]);

  const handleProcessAudio = async (blob: Blob) => {
    if (!courseCode) return alert("Please enter a Course Code (e.g., EEE 101) first!");
    setIsProcessing(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64 = await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const prompt = `Analyze this ${courseCode} lecture. Provide structured learning topics and 20 MCQs. Format exactly as: TOPICS: [...] QUIZ: [...]`;
      const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: "audio/webm" } }]);
      const resText = result.response.text();

      const newSession = {
        id: Date.now().toString(),
        courseCode,
        timestamp: Date.now(),
        topics: JSON.parse(resText.split('TOPICS:')[1].split('QUIZ:')[0].trim()),
        quiz: JSON.parse(resText.split('QUIZ:')[1].trim()),
        audioBlob: blob 
      };

      const db = await getDB();
      await db.put('sessions', newSession);
      setCurrentSession(newSession);
      setActiveTab('tutor');
    } catch (e) {
      alert("Error: Check your API key or connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const db = await getDB();
    await db.delete('sessions', id);
    setSessions(sessions.filter(s => s.id !== id));
  };

  const downloadAudio = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}_recording.webm`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900">
      <header className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10">
        <h1 className="text-xl font-black italic tracking-tighter text-red-600">NSG FOR DELSUITES</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase">AI Study Companion • NUELLGRAPHICS</p>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {/* RECORD TAB */}
        {activeTab === 'record' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Course Code</label>
              <input 
                type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. MTH 102" 
                className="w-full p-4 border-2 border-slate-200 rounded-2xl font-bold focus:border-red-600 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col items-center py-10 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
              <AudioRecorder onRecordingComplete={handleProcessAudio} />
              <p className="mt-4 text-sm font-bold text-slate-500">Tap to record lecture</p>
            </div>
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 font-black text-red-600 uppercase animate-pulse">
                <Loader2 className="animate-spin" /> Gemini is analyzing...
              </div>
            )}
          </div>
        )}

        {/* TUTOR TAB */}
        {activeTab === 'tutor' && currentSession && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-red-600 text-white p-5 rounded-2xl shadow-xl">
              <h2 className="font-black uppercase text-xl">{currentSession.courseCode}</h2>
              <p className="text-[10px] font-bold opacity-70">Generated on {new Date(currentSession.timestamp).toLocaleDateString()}</p>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 space-y-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Lecture Audio Replay</p>
              <audio controls src={URL.createObjectURL(currentSession.audioBlob)} className="w-full" />
              <button 
                onClick={() => downloadAudio(currentSession.audioBlob, currentSession.courseCode)}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 p-3 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
              >
                <Download size={14} /> Download to Phone
              </button>
            </div>

            <AITutor topics={currentSession.topics} />
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
          <div className="space-y-3 animate-in fade-in">
            <h2 className="text-[10px] font-black uppercase text-slate-400 px-2">Saved Lectures</h2>
            {sessions.map(s => (
              <div 
                key={s.id} 
                className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm active:scale-[0.98] transition-all"
                onClick={() => { setCurrentSession(s); setActiveTab('tutor'); }}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-red-50 p-2 rounded-lg text-red-600"><BookOpen size={20}/></div>
                  <div>
                    <p className="font-black text-slate-800 uppercase text-sm">{s.courseCode}</p>
                    <p className="text-[9px] font-bold text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-center py-10 text-slate-400 italic text-sm">No history yet.</p>}
          </div>
        )}
      </main>

      {/* FIXED NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-4 shadow-2xl z-50">
        <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'record' ? 'text-red-600' : 'text-slate-400'}`}>
          <Mic size={24} /><span className="text-[10px] font-black uppercase">Record</span>
        </button>
        <button onClick={() => setActiveTab('tutor')} disabled={!currentSession} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'tutor' ? 'text-red-600' : 'text-slate-400 opacity-20'}`}>
          <BookOpen size={24} /><span className="text-[10px] font-black uppercase">Tutor</span>
        </button>
        <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'library' ? 'text-red-600' : 'text-slate-400'}`}>
          <History size={24} /><span className="text-[10px] font-black uppercase">Library</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
