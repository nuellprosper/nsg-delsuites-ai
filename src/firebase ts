import { useState, useEffect } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { AITutor } from './components/AITutor';
import { Quiz } from './components/Quiz';
import { supabase } from './lib/supabase';
import { Share2, BookOpen, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface Topic {
  name: string;
  explanation: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

type ViewMode = 'record' | 'tutor' | 'quiz' | 'summary';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('record');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [transcript, setTranscript] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [sessionSummary, setSessionSummary] = useState('');
  const [quizScore, setQuizScore] = useState<number | null>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) await supabase.auth.signInAnonymously();
    
    const { data: session } = await supabase
      .from('study_sessions')
      .insert({ title: 'Study Session', course_code: '' })
      .select().single();

    if (session) setSessionId(session.id);
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // 1. Convert Audio to Base64 for Gemini
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1] || '';
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 2. Ask Gemini to Transcribe & Explain (The "Handshake")
        const prompt = `Analyze this audio from a ${courseCode || 'university'} lecture. 
        First, provide a full transcript. 
        Second, extract the key topics as a JSON array: [{"name": "topic name", "explanation": "detailed explanation"}].
        Format the output as: TRANSCRIPT: [text] TOPICS: [json]`;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: "audio/webm" } }
        ]);
        
        const responseText = result.response.text();
        const [transcriptPart, topicsPart] = responseText.split('TOPICS:');
        
        setTranscript(transcriptPart.replace('TRANSCRIPT:', '').trim());
        const extractedTopics = JSON.parse(topicsPart.trim());
        setTopics(extractedTopics);

        setViewMode('tutor');
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('AI Error:', error);
      setIsProcessing(false);
      alert('AI connection failed. Check your API Key!');
    }
  };

  const handleGenerateQuiz = async () => {
    setIsProcessing(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Based on this transcript: "${transcript}", generate 5 multiple choice questions. 
      Return ONLY a JSON array: [{"question": "...", "options": ["a", "b", "c", "d"], "correctAnswer": 0, "explanation": "..."}]`;

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

  const handleQuizComplete = (score: number) => {
    setQuizScore(score);
    setSessionSummary(`You mastered ${topics.length} topics from ${courseCode || 'the lecture'} with a quiz score of ${score}/${quizQuestions.length}.`);
    setViewMode('summary');
  };

  const handleNewRecording = () => {
    setViewMode('record');
    setTranscript('');
    setTopics([]);
  };

  return (
    <div className="min-h-screen bg-white font-mono">
      <header className="border-b-4 border-black p-4 bg-yellow-400">
        <h1 className="text-3xl font-black">NSG FOR DELSUITES</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        {isProcessing && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-bold">AI IS THINKING...</p>
          </div>
        )}

        {!isProcessing && viewMode === 'record' && (
          <div className="space-y-6">
            <input 
              className="w-full p-4 border-4 border-black text-xl font-bold"
              placeholder="COURSE CODE (e.g. EEE 101)"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
            />
            <AudioRecorder onRecordingComplete={handleRecordingComplete} />
          </div>
        )}

        {!isProcessing && viewMode === 'tutor' && (
          <div className="space-y-6">
            <AITutor topics={topics} />
            <button onClick={handleGenerateQuiz} className="w-full p-4 bg-black text-white font-bold">GENERATE QUIZ</button>
          </div>
        )}

        {!isProcessing && viewMode === 'quiz' && <Quiz questions={quizQuestions} onComplete={handleQuizComplete} />}

        {!isProcessing && viewMode === 'summary' && (
          <div className="p-6 border-4 border-black">
            <h2 className="text-2xl font-black mb-4">SUMMARY</h2>
            <p className="mb-6">{sessionSummary}</p>
            <button onClick={handleNewRecording} className="w-full p-4 bg-yellow-400 border-4 border-black font-bold">NEW SESSION</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
