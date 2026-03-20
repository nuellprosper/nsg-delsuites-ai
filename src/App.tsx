import { useState } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { AITutor } from './components/AITutor';
import { Quiz } from './components/Quiz';
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
  const [transcript, setTranscript] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1] || '';
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Analyze this lecture transcript from ${courseCode || 'a university lecture'}. 
        Extract key study topics as a JSON array: [{"name": "topic name", "explanation": "detailed explanation"}].
        Format: TOPICS: [json]`;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: "audio/webm" } }
        ]);
        
        const responseText = result.response.text();
        const topicsPart = responseText.split('TOPICS:')[1];
        
        const extractedTopics = JSON.parse(topicsPart.trim().replace(/```json|```/g, ''));
        setTopics(extractedTopics);
        setViewMode('tutor');
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('AI Error:', error);
      setIsProcessing(false);
      alert('AI processing failed. Check your API Key in Vercel!');
    }
  };

  const handleGenerateQuiz = async () => {
    setIsProcessing(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Based on these topics: ${JSON.stringify(topics)}, generate 3 multiple choice questions. 
      Return ONLY a JSON array: [{"question": "...", "options": ["a", "b", "c", "d"], "answer": "a"}]`;

      const result = await model.generateContent(prompt);
      const questions = JSON.parse(result.response.text().replace(/```json|```/g, ''));
      setQuizQuestions(questions);
      setViewMode('quiz');
    } catch (e) {
      alert("Error generating quiz");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-mono text-black">
      <header className="border-b-4 border-black p-4 bg-yellow-400">
        <h1 className="text-3xl font-black uppercase italic">NSG FOR DELSUITES</h1>
        <p className="text-xs font-bold bg-black text-white inline-block px-1">BY NUELLGRAPHICS</p>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isProcessing && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-black">GEMINI IS ANALYZING...</p>
          </div>
        )}

        {!isProcessing && viewMode === 'record' && (
          <div className="space-y-6 text-center">
            <input 
              className="w-full p-4 border-4 border-black text-xl font-bold placeholder:text-gray-400"
              placeholder="ENTER COURSE CODE (e.g. MTH 102)"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
            />
            <div className="py-10 border-4 border-dashed border-black bg-gray-50">
               <AudioRecorder onRecordingComplete={handleRecordingComplete} />
               <p className="mt-4 font-bold uppercase">Tap Mic to Record Lecture</p>
            </div>
          </div>
        )}

        {!isProcessing && viewMode === 'tutor' && (
          <div className="space-y-6">
            <AITutor topics={topics} />
            <button 
              onClick={handleGenerateQuiz} 
              className="w-full p-4 bg-black text-white font-black hover:bg-yellow-400 hover:text-black transition-colors border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              TAKE PRACTICE QUIZ
            </button>
          </div>
        )}

        {!isProcessing && viewMode === 'quiz' && (
          <Quiz questions={quizQuestions} onComplete={(score: number) => {
            setQuizScore(score);
            setViewMode('summary');
          }} />
        )}

        {!isProcessing && viewMode === 'summary' && (
          <div className="p-6 border-4 border-black bg-green-100 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-3xl font-black mb-4 uppercase">Session Complete!</h2>
            <p className="text-xl font-bold mb-6">Score: {quizScore} / {quizQuestions.length}</p>
            <button 
              onClick={() => setViewMode('record')} 
              className="w-full p-4 bg-yellow-400 border-4 border-black font-black uppercase"
            >
              Start New Lecture
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
