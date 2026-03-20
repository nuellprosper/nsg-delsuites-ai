import { useState, useEffect } from 'react';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Quiz } from './components/quiz';
import { Search, Loader2, FileAudio, ImageIcon, BrainCircuit, History, BookOpen, Trash2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface Session {
  id: string;
  courseCode: string;
  timestamp: number;
  topics: any[];
  quiz: any[];
}

function App() {
  const [viewMode, setViewMode] = useState<'record' | 'tutor' | 'quiz'>('record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [history, setHistory] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [selectedAudio, setSelectedAudio] = useState<File | Blob | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // Load History on Start
  useEffect(() => {
    const saved = localStorage.getItem('nsg_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (newSession: Session) => {
    const updatedHistory = [newSession, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('nsg_history', JSON.stringify(updatedHistory));
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    localStorage.setItem('nsg_history', JSON.stringify(updated));
  };

  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartAnalysis = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Analyze materials for ${courseCode || 'Engineering'}. 1. Detailed Topics. 2. 20 MCQ Quiz. Format: TOPICS: [...] QUIZ: [...]`;
      const parts: any[] = [prompt];
      if (selectedAudio) parts.push({ inlineData: { data: await fileToBase64(selectedAudio), mimeType: selectedAudio.type || "audio/webm" } });
      if (selectedImage) parts.push({ inlineData: { data: await fileToBase64(selectedImage), mimeType: selectedImage.type } });

      const result = await model.generateContent(parts);
      const resText = result.response.text();
      const tPart = JSON.parse(resText.split('TOPICS:')[1].split('QUIZ:')[0].trim());
      const qPart = JSON.parse(resText.split('QUIZ:')[1].trim());

      const newSession: Session = {
        id: Date.now().toString(),
        courseCode: courseCode || 'Untitled Lecture',
        timestamp: Date.now(),
        topics: tPart,
        quiz: qPart
      };

      saveToHistory(newSession);
      setCurrentSession(newSession);
      setViewMode('tutor');
    } catch (err: any) { setErrorMsg(err.message); }
    setIsProcessing(false);
  };

  const filteredHistory = history.filter(s => 
    s.courseCode.toLowerCase().includes(courseCode.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white font-mono text-black pb-10">
      <header className="bg-yellow-400 border-b-4 border-black p-6 sticky top-0 z-20 shadow-md">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">NSG FOR DELSUITES</h1>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs font-bold bg-black text-white px-2 py-1 uppercase">HISTORY & SEARCH ENABLED</p>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-20 h-20 animate-spin mb-6 text-yellow-500" />
            <p className="text-2xl font-black uppercase italic">Saving to History...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {viewMode === 'record' && (
              <>
                <div className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_black]">
                  <label className="block text-xs font-black uppercase mb-2">Search or Name Course</label>
                  <div className="flex gap-2">
                    <input type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. MTH 102" className="flex-1 border-4 border-black p-3 font-bold uppercase outline-none focus:bg-yellow-50" />
                    <div className="bg-black text-white p-3 border-4 border-black"><Search /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`border-4 border-black p-4 ${selectedImage ? 'bg-green-100' : 'bg-white'}`}>
                    <input type="file" accept="image/*" className="hidden" id="img-up" onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} />
                    <label htmlFor="img-up" className="cursor-pointer flex flex-col items-center"><ImageIcon /><span className="text-[10px] font-black uppercase mt-1">Image</span></label>
                  </div>
                  <div className={`border-4 border-black p-4 ${selectedAudio ? 'bg-green-100' : 'bg-white'}`}>
                    <input type="file" accept="audio/*" className="hidden" id="aud-up" onChange={(e) => setSelectedAudio(e.target.files?.[0] || null)} />
                    <label htmlFor="aud-up" className="cursor-pointer flex flex-col items-center"><FileAudio /><span className="text-[10px] font-black uppercase mt-1">Audio</span></label>
                  </div>
                </div>

                <AudioRecorder onRecordingComplete={(blob) => setSelectedAudio(blob)} />

                {(selectedAudio || selectedImage) && (
                  <button onClick={handleStartAnalysis} className="w-full bg-black text-white p-4 font-black uppercase text-xl shadow-[4px_4px_0px_#facc15]">Analyze New Lecture</button>
                )}

                {/* History List */}
                <div className="mt-10">
                  <h2 className="flex items-center gap-2 font-black uppercase text-xl mb-4"><History /> Recent Lectures</h2>
                  <div className="space-y-3">
                    {filteredHistory.map(session => (
                      <div key={session.id} onClick={() => { setCurrentSession(session); setViewMode('tutor'); }} className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_black] flex justify-between items-center cursor-pointer hover:bg-yellow-50">
                        <div>
                          <p className="font-black uppercase">{session.courseCode}</p>
                          <p className="text-[10px] text-gray-500">{new Date(session.timestamp).toLocaleDateString()}</p>
                        </div>
                        <button onClick={(e) => deleteSession(session.id, e)} className="text-red-500 p-2"><Trash2 size={20} /></button>
                      </div>
                    ))}
                    {filteredHistory.length === 0 && <p className="text-center italic text-gray-400">No lectures found.</p>}
                  </div>
                </div>
              </>
            )}

            {viewMode === 'tutor' && currentSession && (
              <div className="space-y-6">
                <AITutor topics={currentSession.topics} />
                <button onClick={() => setViewMode('quiz')} className="w-full border-4 border-black bg-black text-white p-5 font-black uppercase shadow-[6px_6px_0px_yellow] flex items-center justify-center gap-2 text-xl"><BrainCircuit /> Start 20-Question Quiz</button>
                <button onClick={() => setViewMode('record')} className="w-full border-4 border-black p-4 font-black uppercase">← Back to List</button>
              </div>
            )}

            {viewMode === 'quiz' && currentSession && (
              <div className="space-y-6">
                <Quiz questions={currentSession.quiz} />
                <button onClick={() => setViewMode('tutor')} className="w-full border-4 border-black p-4 font-black uppercase">← Back to Insights</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
