import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Settings, 
  Cpu, 
  Scale, 
  Languages, 
  Briefcase, 
  Upload, 
  Mic, 
  Volume2, 
  Search, 
  History, 
  ChevronRight, 
  Clock, 
  Globe,
  CheckCircle2,
  AlertCircle,
  FileText,
  Zap,
  BookOpen,
  FileSearch,
  TrendingDown,
  Newspaper,
  RefreshCcw,
  Sparkles,
  Plus,
  Copy,
  Check,
  X,
  Trash2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface VoiceSettings {
  pitch: number;
  rate: number;
  voice: string;
}

type Faculty = 'STEM' | 'LAW' | 'LANG' | 'BIZ' | 'SOC';

interface Formula {
  name: string;
  formula: string;
  desc: string;
}

interface LatinWord {
  word: string;
  meaning: string;
  context: string;
}

export const AILibrary: React.FC<{ 
  theme: 'dark'; 
  setUserNotification?: (msg: string) => void;
  onSaveHistory?: (id: string, title: string, type: string, score?: number, data?: any) => void;
  checkAndIncrementUsage: (type: string) => Promise<boolean>;
}> = ({ theme, setUserNotification, onSaveHistory, checkAndIncrementUsage }) => {
  const [activeFaculty, setActiveFaculty] = useState<Faculty>('STEM');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    pitch: 1,
    rate: 1,
    voice: 'default'
  });

  // AI Helpers
  const MODEL_NAME = "gemini-3.1-flash-lite-preview";
  
  const getAiInstance = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
    return new GoogleGenAI({ apiKey: key });
  };

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result) {
          resolve(result.split(',')[1] || "");
        } else {
          resolve("");
        }
      };
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  // STEM State
  const [stemTopic, setStemTopic] = useState('');
  const [stemFormulas, setStemFormulas] = useState<Formula[]>([]);
  const [stemFiles, setStemFiles] = useState<File[]>([]);
  const [stemPreviews, setStemPreviews] = useState<string[]>([]);
  const [stemSolution, setStemSolution] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // LAW State
  const [lawLatinQuery, setLawLatinQuery] = useState('');
  const [latinWords, setLatinWords] = useState<LatinWord[]>([]);
  const [constitutionQuery, setConstitutionQuery] = useState('');
  const [constitutionResult, setConstitutionResult] = useState<string | null>(null);

  // BIZ State
  const [bizFiles, setBizFiles] = useState<File[]>([]);
  const [bizPreviews, setBizPreviews] = useState<string[]>([]);
  const [bizAnalysis, setBizAnalysis] = useState<string | null>(null);

  // SOC State
  const [socFiles, setSocFiles] = useState<File[]>([]);
  const [socPreviews, setSocPreviews] = useState<string[]>([]);
  const [socNewsResult, setSocNewsResult] = useState<{ heading: string; correction: string } | null>(null);

  // LANG State
  const [langInput, setLangInput] = useState('');
  const [langOutput, setLangOutput] = useState<{ 
    original_analysis: { word: string; is_mistake: boolean }[]; 
    corrected_analysis: { word: string; is_correction: boolean }[];
    explanation: string;
  } | null>(null);
  const [transcribeInput, setTranscribeInput] = useState('');
  const [transcribeOutput, setTranscribeOutput] = useState('');

  const getWordCount = (str: string) => {
    if (!str.trim()) return 0;
    return str.trim().split(/\s+/).length;
  };

  const startListening = () => {
    console.log("Attempting to start speech recognition...");
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error("Speech recognition not supported in this browser");
      if (setUserNotification) setUserNotification("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        console.log("Speech recognition session started");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech recognition result received:", transcript);
        setStemTopic(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error event:", event.error);
        setIsListening(false);
        if (setUserNotification) {
          if (event.error === 'not-allowed') {
            setUserNotification("Microphone access denied. Please check your browser settings.");
          } else if (event.error === 'network') {
            setUserNotification("Network error during speech recognition.");
          } else if (event.error === 'no-speech') {
            setUserNotification("No speech detected. Please try again.");
          } else {
            setUserNotification(`Voice Lab Error: ${event.error}`);
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        console.log("Speech recognition session ended");
      };

      recognition.start();
    } catch (err) {
      console.error("Critical error starting speech recognition:", err);
      setIsListening(false);
      if (setUserNotification) setUserNotification("Failed to start Voice Lab. Please try again.");
    }
  };

  const speak = (text: string) => {
    console.log("Attempting to speak text:", text.substring(0, 50) + "...");
    if (!('speechSynthesis' in window)) {
      console.error("Speech synthesis not supported");
      return;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = voiceSettings.pitch;
      utterance.rate = voiceSettings.rate;
      
      if (voiceSettings.voice !== 'default') {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === voiceSettings.voice);
        if (selectedVoice) utterance.voice = selectedVoice;
      }

      utterance.onstart = () => console.log("Speech synthesis started");
      utterance.onend = () => console.log("Speech synthesis ended");
      utterance.onerror = (e) => console.error("Speech synthesis error:", e);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Error in speech synthesis:", err);
    }
  };

  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <button 
        onClick={handleCopy}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-[#DC2626]"
        title="Copy to clipboard"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    );
  };

  const MarkdownRenderer = ({ content }: { content: string }) => {
    // Pre-process content to ensure LaTeX is correctly formatted for remark-math
    const processedContent = (content || "")
      .replace(/\\\\\(/g, '$')
      .replace(/\\\\\)/g, '$')
      .replace(/\\\\\[/g, '$$')
      .replace(/\\\\\]/g, '$$')
      .replace(/\\\( /g, '$ ')
      .replace(/ \\\)/g, ' $')
      .replace(/\\\[ /g, '$$ ')
      .replace(/ \\\]/g, ' $$');

    return (
      <div className="prose prose-invert prose-xs max-w-none markdown-body">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeKatex]}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  };

  // --- STEM ACTIONS ---
  const generateFormulas = async () => {
    if (!stemTopic) return;
    
    const canProceed = await checkAndIncrementUsage('QUIZ');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const prompt = `Generate a list of 5 important formulas for the topic: ${stemTopic}. 
      Return ONLY a JSON array of objects with keys: name, formula, desc. 
      Use valid LaTeX for formulas. Return the raw LaTeX string for the 'formula' field WITHOUT any delimiters like $ or $$. 
      Ensure backslashes are properly escaped for JSON (e.g. use "\\\\frac" for \frac). 
      DO NOT use any other formatting.`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });
      const text = result?.text || "";
      const cleanedText = text.replace(/```json|```/g, '').trim();
      setStemFormulas(JSON.parse(cleanedText));
      
      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `${stemTopic} Formulas`, 'faculty', undefined, { type: 'formulas', topic: stemTopic });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to generate formulas"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const solveStemProblem = async () => {
    if (stemFiles.length === 0) return;
    
    const canProceed = await checkAndIncrementUsage('ASSIGNMENT');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const parts = await Promise.all(stemFiles.map(fileToGenerativePart));
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [...parts, { text: `
          Analyze these files/images. Provide pinpoint direct errors and corrections in a modern, structured style. 
          Use Markdown for formatting (bold, headings, lists). 
          IMPORTANT: For ALL mathematical formulas or scientific notations, ALWAYS use LaTeX. 
          Use $ ... $ for inline math (e.g. $x^2$) and $$ ... $$ for block math (e.g. $$E=mc^2$$).
          NEVER use other delimiters like \\( \\) or \\[ \\].
          NEVER wrap LaTeX in code blocks.
          Ensure all backslashes are preserved.
          Focus on math/science logic and accuracy.
        ` }] }
      });
      setStemSolution(result?.text || "");

      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `STEM Lab: ${stemFiles[0]?.name || 'Problem'}`, 'faculty', undefined, { type: 'solution', text: result?.text });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to analyze problem"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- LAW ACTIONS ---
  const findLatinMeaning = async () => {
    if (!lawLatinQuery) return;
    
    const canProceed = await checkAndIncrementUsage('QUIZ');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const prompt = `Find the meaning and legal context of the Latin word/phrase: ${lawLatinQuery}. Return ONLY a JSON array of objects with keys: word, meaning, context.`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
      });
      const text = result?.text || "";
      const cleanedText = text.replace(/```json|```/g, '').trim();
      setLatinWords(JSON.parse(cleanedText));

      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `Latin: ${lawLatinQuery}`, 'faculty', undefined, { type: 'latin', query: lawLatinQuery });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to find meaning"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const findConstitutionSection = async () => {
    if (!constitutionQuery) return;
    
    const canProceed = await checkAndIncrementUsage('QUIZ');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const prompt = `Identify the relevant sections in the Nigerian Constitution for the following idea/issue: ${constitutionQuery}. Provide pinpoint direct references and summaries in a modern style using Markdown.`;
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }] }
      });
      setConstitutionResult(result?.text || "");

      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `Law: ${constitutionQuery}`, 'faculty', undefined, { type: 'law', query: constitutionQuery });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to find sections"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- BIZ ACTIONS ---
  const analyzeBizData = async () => {
    if (bizFiles.length === 0) return;
    
    const canProceed = await checkAndIncrementUsage('ASSIGNMENT');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const parts = await Promise.all(bizFiles.map(fileToGenerativePart));
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [...parts, { text: `
          Analyze these financial documents/images. Provide pinpoint direct errors, discrepancies, and corrections in a modern business style. 
          Use Markdown for formatting. Identify exactly where money left or issues occurred. 
          IMPORTANT: For ALL mathematical formulas or calculations, ALWAYS use LaTeX. 
          Use $ ... $ for inline math (e.g. $x^2$) and $$ ... $$ for block math (e.g. $$E=mc^2$$).
          NEVER use other delimiters like \\( \\) or \\[ \\].
          NEVER wrap LaTeX in code blocks.
          Ensure all backslashes are preserved.
        ` }] }
      });
      setBizAnalysis(result?.text || "");

      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `Biz: ${bizFiles[0]?.name || 'Doc'}`, 'faculty', undefined, { type: 'biz', text: result?.text });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to analyze data"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- SOC ACTIONS ---
  const processNewsWriting = async () => {
    if (socFiles.length === 0) return;
    
    const canProceed = await checkAndIncrementUsage('ASSIGNMENT');
    if (!canProceed) return;

    setIsAiLoading(true);
    try {
      const ai = getAiInstance();
      const parts = await Promise.all(socFiles.map(fileToGenerativePart));
      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [...parts, { text: `
          Analyze these news drafts/images. Provide pinpoint direct journalistic errors and corrections in a modern style. 
          Use Markdown. Return ONLY a JSON object with keys: heading, correction (the correction should be the full corrected text with markdown for emphasis). 
          IMPORTANT: For ALL mathematical data or statistics mentioned, ALWAYS use LaTeX. 
          Use $ ... $ for inline math (e.g. $x^2$) and $$ ... $$ for block math (e.g. $$E=mc^2$$).
          NEVER use other delimiters like \\( \\) or \\[ \\].
          NEVER wrap LaTeX in code blocks.
          Ensure all backslashes are preserved.
        ` }] }
      });
      const text = result?.text || "";
      const cleanedText = text.replace(/```json|```/g, '').trim();
      setSocNewsResult(JSON.parse(cleanedText));

      if (onSaveHistory) {
        onSaveHistory(Math.random().toString(), `Journalism: ${socFiles[0]?.name || 'News'}`, 'faculty', undefined, { type: 'news', result: JSON.parse(cleanedText) });
      }
    } catch (err: any) {
      console.error(err);
      if (setUserNotification) setUserNotification(`AI Error: ${err.message || "Failed to process news"}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      {/* FIXED HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/5 border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#DC2626] rounded-lg flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
            <Zap size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-tighter italic leading-none">NSG AI Library</h1>
            <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest mt-1">Powered by Omni Ai</span>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <Settings size={20} className={showVoiceSettings ? 'text-[#DC2626]' : 'text-white/60'} />
          </button>

          <AnimatePresence>
            {showVoiceSettings && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 bg-[#0A0F1C] border border-white/10 rounded-2xl p-4 shadow-2xl z-[60]"
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Voice Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase">
                      <span>Pitch</span>
                      <span>{voiceSettings.pitch}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      value={voiceSettings.pitch}
                      onChange={(e) => setVoiceSettings({...voiceSettings, pitch: parseFloat(e.target.value)})}
                      className="w-full accent-[#DC2626]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase">
                      <span>Speed</span>
                      <span>{voiceSettings.rate}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      value={voiceSettings.rate}
                      onChange={(e) => setVoiceSettings({...voiceSettings, rate: parseFloat(e.target.value)})}
                      className="w-full accent-[#DC2626]"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* FACULTY SWITCHER */}
      <div className="p-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          {[
            { id: 'STEM', icon: Cpu, label: 'STEM' },
            { id: 'LAW', icon: Scale, label: 'LAW' },
            { id: 'SOC', icon: Newspaper, label: 'SOCIAL SCI' },
            { id: 'LANG', icon: Languages, label: 'LANG/EDU' },
            { id: 'BIZ', icon: Briefcase, label: 'BIZ' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFaculty(f.id as Faculty)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${
                activeFaculty === f.id 
                ? 'bg-[#DC2626] border-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20' 
                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <f.icon size={12} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TOOL CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {isAiLoading && (
          <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[#0A0F1C] border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
              <RefreshCcw className="animate-spin text-[#DC2626]" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Omni AI Processing...</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeFaculty === 'STEM' && (
            <motion.div 
              key="stem"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Formula Generator */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Formula Library</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">AI Generated Formula Cards</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={stemTopic}
                    onChange={(e) => setStemTopic(e.target.value)}
                    placeholder="Enter topic (e.g. Calculus)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[9px] outline-none focus:border-[#DC2626]/50 transition-all"
                  />
                  <button 
                    onClick={generateFormulas}
                    className="bg-[#DC2626] text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
                  >
                    Generate
                  </button>
                  {stemFormulas.length > 0 && (
                    <button 
                      onClick={() => setStemFormulas([])}
                      className="bg-white/5 border border-white/10 text-white/40 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-red-500 flex items-center gap-1"
                    >
                      <Trash2 size={10} /> Clear All
                    </button>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {stemFormulas.map((f, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="min-w-[140px] bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2 relative group"
                    >
                      <button 
                        onClick={() => {
                          const newFormulas = [...stemFormulas];
                          newFormulas.splice(i, 1);
                          setStemFormulas(newFormulas);
                        }}
                        className="absolute top-2 right-2 p-1 bg-black/40 rounded-lg text-white/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                      <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest">{f.name}</h4>
                      <div className="text-xs text-white font-bold overflow-x-auto no-scrollbar py-2">
                        <MarkdownRenderer content={`$$${f.formula}$$`} />
                      </div>
                      <p className="text-[7px] text-white/40 uppercase leading-tight">{f.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Upload & Scan */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Upload & Scan</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Engineering & Science Solver</p>
                  </div>
                </div>

                <div className="relative group">
                  <input 
                    type="file" 
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt" 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setStemFiles([...stemFiles, ...files]);
                        const newPreviews = files.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
                        setStemPreviews([...stemPreviews, ...newPreviews]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center group-hover:border-[#DC2626]/50 transition-all">
                    {stemPreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {stemPreviews.map((p, idx) => (
                          <div key={idx} className="relative aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {p ? (
                              <img src={p} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                <FileText size={16} className="text-white/20" />
                                <span className="text-[6px] text-white/40 truncate w-full px-1">{stemFiles[idx]?.name}</span>
                              </div>
                            )}
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newFiles = [...stemFiles];
                                const newPreviews = [...stemPreviews];
                                newFiles.splice(idx, 1);
                                newPreviews.splice(idx, 1);
                                setStemFiles(newFiles);
                                setStemPreviews(newPreviews);
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:text-red-500"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="aspect-square border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-1 text-white/20">
                          <Plus size={16} />
                          <span className="text-[6px] uppercase font-black">Add More</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={32} className="mx-auto text-white/20" />
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Drop problem images or docs here</p>
                      </div>
                    )}
                  </div>
                </div>

                {stemFiles.length > 0 && (
                  <button 
                    onClick={solveStemProblem}
                    className="w-full py-3 bg-[#DC2626] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                  >
                    Analyze with Omni AI
                  </button>
                )}

                {stemSolution && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 rounded-2xl p-4 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                        <FileText size={12} /> Solution Sheet
                      </h3>
                      <div className="flex items-center gap-2">
                        <CopyButton text={stemSolution} />
                        <button 
                          onClick={() => { setStemSolution(null); setStemFiles([]); setStemPreviews([]); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                          title="Clear Result"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-white/70 leading-relaxed">
                      <MarkdownRenderer content={stemSolution} />
                    </div>
                  </motion.div>
                )}

                <button 
                  onClick={() => {
                    if (stemSolution) {
                      speak(stemSolution);
                    } else {
                      startListening();
                    }
                  }}
                  disabled={isListening}
                  className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    isListening 
                    ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' 
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Mic size={14} className={isListening ? 'animate-pulse' : ''} />
                  {isListening ? 'Listening...' : 'Voice Lab'}
                </button>
              </div>
            </motion.div>
          )}

          {activeFaculty === 'LAW' && (
            <motion.div 
              key="law"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Latin Library */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Latin Library</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Legal Phrases & Meanings</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={lawLatinQuery}
                    onChange={(e) => setLawLatinQuery(e.target.value)}
                    placeholder="Enter Latin phrase (e.g. Habeas Corpus)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[9px] outline-none focus:border-[#DC2626]/50 transition-all"
                  />
                  <button 
                    onClick={findLatinMeaning}
                    className="bg-[#DC2626] text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest"
                  >
                    Search
                  </button>
                  {latinWords.length > 0 && (
                    <button 
                      onClick={() => setLatinWords([])}
                      className="bg-white/5 border border-white/10 text-white/40 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-red-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {latinWords.map((w, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                      <h4 className="text-xs font-black text-[#DC2626] uppercase tracking-widest italic mb-1">{w.word}</h4>
                      <p className="text-[10px] text-white font-bold mb-1">{w.meaning}</p>
                      <p className="text-[8px] text-white/40 uppercase tracking-widest leading-relaxed">{w.context}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Constitution Finder */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                    <FileSearch size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Constitution Finder</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Nigerian Constitution Search</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-1">Input Idea or Issue</p>
                  <textarea 
                    value={constitutionQuery}
                    onChange={(e) => setConstitutionQuery(e.target.value)}
                    placeholder="e.g. Fundamental Human Rights or Freedom of Speech"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none focus:border-[#DC2626]/50 transition-all h-24 resize-none"
                  />
                </div>
                <button 
                  onClick={findConstitutionSection}
                  className="w-full py-3 bg-[#DC2626] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                >
                  Find Sections
                </button>
                {constitutionResult && (
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest">Constitution Report</h4>
                      <div className="flex items-center gap-2">
                        <CopyButton text={constitutionResult} />
                        <button 
                          onClick={() => setConstitutionResult(null)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                          title="Clear Result"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/70 leading-relaxed">
                      <MarkdownRenderer content={constitutionResult} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeFaculty === 'SOC' && (
            <motion.div 
              key="soc"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                    <Newspaper size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">News Writing Preview</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Journalism & Mass Comm Suite</p>
                  </div>
                </div>

                <div className="relative group">
                  <input 
                    type="file" 
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt" 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setSocFiles([...socFiles, ...files]);
                        const newPreviews = files.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
                        setSocPreviews([...socPreviews, ...newPreviews]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center group-hover:border-[#DC2626]/50 transition-all">
                    {socPreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {socPreviews.map((p, idx) => (
                          <div key={idx} className="relative aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {p ? (
                              <img src={p} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                <FileText size={16} className="text-white/20" />
                                <span className="text-[6px] text-white/40 truncate w-full px-1">{socFiles[idx]?.name}</span>
                              </div>
                            )}
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newFiles = [...socFiles];
                                const newPreviews = [...socPreviews];
                                newFiles.splice(idx, 1);
                                newPreviews.splice(idx, 1);
                                setSocFiles(newFiles);
                                setSocPreviews(newPreviews);
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:text-red-500"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="aspect-square border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-1 text-white/20">
                          <Plus size={16} />
                          <span className="text-[6px] uppercase font-black">Add More</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={32} className="mx-auto text-white/20" />
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Upload Drafts or Images</p>
                      </div>
                    )}
                  </div>
                </div>

                {socFiles.length > 0 && (
                  <button 
                    onClick={processNewsWriting}
                    className="w-full py-3 bg-[#DC2626] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                  >
                    Correct & Generate Heading
                  </button>
                )}

                {socNewsResult && (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest">Suggested Heading</h4>
                        <div className="flex items-center gap-2">
                          <CopyButton text={socNewsResult.heading} />
                          <button 
                            onClick={() => setSocNewsResult(null)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                            title="Clear Result"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-black text-white italic">"{socNewsResult.heading}"</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[8px] font-black text-green-500 uppercase tracking-widest">Corrected Version</h4>
                        <CopyButton text={socNewsResult.correction} />
                      </div>
                      <div className="text-[10px] text-white/70 leading-relaxed">
                        <MarkdownRenderer content={socNewsResult.correction} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeFaculty === 'BIZ' && (
            <motion.div 
              key="biz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Financial Auditor</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Business & Accounting Suite</p>
                  </div>
                </div>

                <div className="relative group">
                  <input 
                    type="file" 
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setBizFiles([...bizFiles, ...files]);
                        const newPreviews = files.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
                        setBizPreviews([...bizPreviews, ...newPreviews]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center group-hover:border-[#DC2626]/50 transition-all">
                    {bizPreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {bizPreviews.map((p, idx) => (
                          <div key={idx} className="relative aspect-square bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {p ? (
                              <img src={p} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                <FileText size={16} className="text-white/20" />
                                <span className="text-[6px] text-white/40 truncate w-full px-1">{bizFiles[idx]?.name}</span>
                              </div>
                            )}
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newFiles = [...bizFiles];
                                const newPreviews = [...bizPreviews];
                                newFiles.splice(idx, 1);
                                newPreviews.splice(idx, 1);
                                setBizFiles(newFiles);
                                setBizPreviews(newPreviews);
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:text-red-500"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="aspect-square border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-1 text-white/20">
                          <Plus size={16} />
                          <span className="text-[6px] uppercase font-black">Add More</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={32} className="mx-auto text-white/20" />
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Upload Tables or Statements</p>
                      </div>
                    )}
                  </div>
                </div>

                {bizFiles.length > 0 && (
                  <button 
                    onClick={analyzeBizData}
                    className="w-full py-3 bg-[#DC2626] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                  >
                    Connect the Dots with AI
                  </button>
                )}

                {bizAnalysis && (
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest">Audit Report</h4>
                      <div className="flex items-center gap-2">
                        <CopyButton text={bizAnalysis} />
                        <button 
                          onClick={() => { setBizAnalysis(null); setBizFiles([]); setBizPreviews([]); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                          title="Clear Result"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/70 leading-relaxed">
                      <MarkdownRenderer content={bizAnalysis} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeFaculty === 'LANG' && (
            <motion.div 
              key="lang"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                    <Languages size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Language Diagnostic</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Grammar & Syntax Analysis</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Input Text (300 Words Max)</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${getWordCount(langInput) > 300 ? 'text-red-500' : 'text-white/20'}`}>
                        {getWordCount(langInput)} / 300
                      </span>
                    </div>
                    <textarea 
                      value={langInput}
                      onChange={(e) => setLangInput(e.target.value)}
                      placeholder="Type or paste text to analyze..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none focus:border-[#DC2626]/50 transition-all h-32 resize-none"
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      if (!langInput) return;
                      if (getWordCount(langInput) > 300) {
                        if (setUserNotification) setUserNotification("Text exceeds 300 word limit. Please shorten it.");
                        return;
                      }
                      setIsAiLoading(true);
                      try {
                        const ai = getAiInstance();
                        const prompt = `Analyze this text for grammar mistakes. 
                        Return ONLY a JSON object with:
                        1. "original_analysis": array of objects { word: string, is_mistake: boolean } - every word from the input exactly as is, with is_mistake true if it is part of a grammar error.
                        2. "corrected_analysis": array of objects { word: string, is_correction: boolean } - the full corrected text split into words, with is_correction true if the word was changed/added.
                        3. "explanation": string - brief markdown explanation of mistakes.
                        Ensure punctuation is attached to the words.
                        Text: ${langInput}`;
                        
                        const result = await ai.models.generateContent({
                          model: MODEL_NAME,
                          contents: { parts: [{ text: prompt }] },
                          config: { responseMimeType: "application/json" }
                        });
                        const text = result?.text || "";
                        const cleanedText = text.replace(/```json|```/g, '').trim();
                        setLangOutput(JSON.parse(cleanedText));
                      } catch (err: any) {
                        console.error(err);
                        if (setUserNotification) setUserNotification(`AI Error: ${err.message}`);
                      } finally {
                        setIsAiLoading(false);
                      }
                    }}
                    className="w-full py-3 bg-[#DC2626] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                  >
                    Run Diagnostic
                  </button>

                  {langOutput && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                          <h4 className="text-[8px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={10} /> Original Text Analysis
                          </h4>
                          <div className="text-xs leading-relaxed max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {langOutput.original_analysis.map((item, i) => (
                              <span 
                                key={i} 
                                className={item.is_mistake ? 'text-red-400 font-bold bg-red-400/10 px-0.5 rounded' : 'text-blue-400'}
                              >
                                {item.word}{' '}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[8px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                              <CheckCircle2 size={10} /> Corrected Version
                            </h4>
                            <div className="flex items-center gap-2">
                              <CopyButton text={langOutput.corrected_analysis.map(i => i.word).join(' ')} />
                              <button 
                                onClick={() => setLangOutput(null)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                                title="Clear Result"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="text-xs leading-relaxed max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {langOutput.corrected_analysis.map((item, i) => (
                              <span 
                                key={i} 
                                className={item.is_correction ? 'text-green-400 font-bold bg-green-400/10 px-0.5 rounded' : 'text-blue-400'}
                              >
                                {item.word}{' '}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {langOutput.explanation && (
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
                          <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest mb-2">Academic Logic</h4>
                          <div className="text-[10px] text-white/50 leading-relaxed">
                            <MarkdownRenderer content={langOutput.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Transcribe Tool */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <Mic size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight">Transcribe Tool</h2>
                    <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Text â†” Phonetic Sounds (/IPA/)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest ml-1">Input Text or /Sounds/</p>
                    <textarea 
                      value={transcribeInput}
                      onChange={(e) => setTranscribeInput(e.target.value)}
                      placeholder="Enter word/sentence to transcribe or /phonetic sounds/ to decode..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[10px] outline-none focus:border-[#DC2626]/50 transition-all h-24 resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        if (!transcribeInput) return;
                        setIsAiLoading(true);
                        try {
                          const ai = getAiInstance();
                          const prompt = `Convert this text to phonetic (IPA) transcription. 
                          Every single word sound must be enclosed in forward slashes, e.g. /kaÉªnd/. 
                          Full sentences should look like: /Ã°Éªs/ /Éªz/ /É™/ /test/.
                          Return ONLY the transcribed version.
                          Text: ${transcribeInput}`;
                          const result = await ai.models.generateContent({
                            model: MODEL_NAME,
                            contents: { parts: [{ text: prompt }] }
                          });
                          setTranscribeOutput(result?.text || "");
                        } catch (err: any) {
                          if (setUserNotification) setUserNotification(`AI Error: ${err.message}`);
                        } finally {
                          setIsAiLoading(false);
                        }
                      }}
                      className="flex-1 py-3 bg-[#DC2626] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#DC2626]/20"
                    >
                      Transcribe to Sound
                    </button>
                    <button 
                      onClick={async () => {
                        if (!transcribeInput) return;
                        setIsAiLoading(true);
                        try {
                          const ai = getAiInstance();
                          const prompt = `Convert these phonetic (IPA) sounds back to standard English text. 
                          Input will be sounds in slashes like /kaÉªnd/.
                          Return ONLY the English text.
                          Sounds: ${transcribeInput}`;
                          const result = await ai.models.generateContent({
                            model: MODEL_NAME,
                            contents: { parts: [{ text: prompt }] }
                          });
                          setTranscribeOutput(result?.text || "");
                        } catch (err: any) {
                          if (setUserNotification) setUserNotification(`AI Error: ${err.message}`);
                        } finally {
                          setIsAiLoading(false);
                        }
                      }}
                      className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Decode Sounds
                    </button>
                  </div>

                  {transcribeOutput && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-black/40 border border-white/5 rounded-2xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[8px] font-black text-[#DC2626] uppercase tracking-widest">Transcription Result</h4>
                        <div className="flex items-center gap-2">
                          <CopyButton text={transcribeOutput} />
                          <button 
                            onClick={() => setTranscribeOutput('')}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/40 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-white tracking-wide">{transcribeOutput}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
