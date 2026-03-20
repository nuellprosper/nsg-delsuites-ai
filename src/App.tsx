import { useState } from 'react';
import { AudioRecorder } from './components/audiorecorder';
import { AITutor } from './components/aitutor';
import { Quiz } from './components/quiz';
import { BookOpen, Mic, BrainCircuit, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface Topic {
  name: string;
  explanation: string;
}

type ViewMode = 'record' | 'tutor' | 'quiz' | 'summary';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1] || '';
        
        // FIXED LINE: Added "models/" prefix to fix the 404 error
        const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
        
        const prompt = `Analyze this lecture transcript from ${courseCode || 'a university lecture'}. Extract the key topics and explain them briefly. Format your response EXACTLY like this: TOPICS: [{"name": "Topic Name", "explanation": "Brief explanation"}]`;

        try {
          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: "audio/webm" } }
          ]);

          const responseText = result.response.text();
          const topicsPart = responseText.split('TOPICS:')[1];
          
          if (!topicsPart) {
             console.log("Raw Response:", responseText);
             throw new Error("The AI responded but not in the right format. Try speaking more clearly.");
          }
          
          const extractedTopics = JSON.parse(topicsPart.trim());
          setTopics(extractedTopics);
          setViewMode('tutor');
        } catch (apiErr: any) {
           setErrorMsg(`API ERROR: ${apiErr.message}`);
        }
        setIsProcessing(false);
      };
    } catch (err: any) {
      setErrorMsg(`SYSTEM ERROR: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-mono text-black">
      {/* Header */}
      <header className="bg-yellow-400 border-b-4 border-black p-6 sticky top-0 z-10">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">NSG FOR DELSUITES</h1>
        <p className="text-sm font-bold bg-black text-white inline-block px-2 py-1 mt-2">BY NUELLGRAPHICS</p>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {errorMsg && (
          <div className="bg-red-500 text-white p-4 border-4 border-black mb-6 font-bold uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            ⚠️ {errorMsg}
            <p className="mt-2 text-xs normal-case opacity-90">Tip: Ensure your VITE_GEMINI_API_KEY is set in Vercel.</p>
          </div>
        )}

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-16 h-16 animate-spin mb-4" />
            <p className="text-xl font-black uppercase italic">Gemini is analyzing lecture...</p>
          </div>
        ) : (
          <>
            {viewMode === 'record' && (
              <div className="space-y-8">
                <div className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                  <label className="block text-xs font-black uppercase mb-2">Enter Course Code (e.g. EEE 101)</label>
                  <input 
                    type="text" 
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="ENG 101..." 
                    className="w-full border-4 border-black p-3 font-bold uppercase focus:bg-yellow-50 outline-none"
                  />
                </div>
                <AudioRecorder onRecordingComplete={handleRecordingComplete} />
              </div>
            )}

            {viewMode === 'tutor' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                 <AITutor topics={topics} />
                 <button 
                  onClick={() => setViewMode('record')}
                  className="mt-8 w-full border-4 border-black bg-white p-4 font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                 >
                   ← Record New Lecture
                 </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
