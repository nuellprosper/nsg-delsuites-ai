import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, StopCircle, Upload, FileAudio, Image as ImageIcon, 
  Brain, History, Download, Play, 
  ChevronRight, Sparkles, Trash2, Settings, UserPlus, CreditCard,
  Database, Zap, Cpu, CheckCircle2, XCircle, RefreshCcw, ArrowLeft, FileText,
  Sun, Moon, ArrowDown, PlusCircle, Copy, User, Clock, Lock, ShieldCheck, FileDown, LayoutDashboard, ListChecks,
  Pin, Edit3, Share2, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { usePaystackPayment } from 'react-paystack';
import { toPng } from 'html-to-image';

/**
 * NSG (Nuell Study Guide) V4.0 - PROFESSIONAL CBT & AI UPGRADE
 * ✅ Professional CBT Infrastructure (Exam Lobby, Info Page, Exam Engine)
 * ✅ Admin Backend Control (Score Sheet, Timer Restart, Results Download)
 * ✅ Advanced AI Chat (Copy Response, History Sidebar)
 * ✅ Enhanced Quiz (Customization, Deep Assessment, Report to AI)
 * ✅ Paystack Payment Integration
 */

const getApiKey = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  return key.trim();
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const PAYSTACK_PUBLIC_KEY = "pk_test_14a5b8ee0a06e063a8b0e46fc7e0e76ed66f2746";

interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'audio';
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  history: ChatMessage[];
  timestamp: string;
  isPinned?: boolean;
}

interface LectureSession {
  id: string;
  title: string;
  date: string;
  duration: string;
  imageCount: number;
  summary: string;
  fullAnalysis: string;
  images: string[]; 
  audioUrl?: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface ExamQuestion extends QuizQuestion {
  id: string;
}

interface StudentResult {
  matric: string;
  name: string;
  score: number;
  total: number;
  timestamp: string;
}

interface RegisteredStudent {
  matric: string;
  name: string;
  paymentEnabled: boolean;
  isActive?: boolean;
  lastActive?: number;
}

interface ExamConfig {
  questionCount: number;
  duration: number; // in seconds
  price: number; // in Naira
}

async function fileToGenerativePart(file: File | Blob) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  
  // Ensure we have a valid mimeType for Gemini
  let mimeType = file.type;
  if (!mimeType || mimeType === "") {
    mimeType = "audio/webm"; // Default fallback for recorded blobs
  }

  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType },
  };
}

export default function App() {
  // --- 📱 APP STATE ---
  const [activeTab, setActiveTab] = useState<'record' | 'ai' | 'history' | 'quiz' | 'blog' | 'exam'>('record');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareName, setShareName] = useState('');
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [legalPage, setLegalPage] = useState<'about' | 'terms' | 'contact' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showScrollButton, setShowScrollButton] = useState(false);

  // --- 🎙️ RECORDING ENGINE ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 📂 MEDIA & UPLOAD ---
  const [uploadedImages, setUploadedImages] = useState<MediaFile[]>([]);

  // --- 🤖 AI CHAT SYSTEM ---
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [showChatSidebarMobile, setShowChatSidebarMobile] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null);

  // --- 📚 PERSISTENCE ---
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LectureSession | null>(null);

  // --- 📝 QUIZ STATE ---
  const [quizTopic, setQuizTopic] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Professional'>('Medium');
  const [quizQuestionCount, setQuizQuestionCount] = useState(25);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'active' | 'finished' | 'review'>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // --- 🎓 CBT EXAM STATE ---
  const [matricNumber, setMatricNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [examLobbyState, setExamLobbyState] = useState<'login' | 'briefing' | 'exam' | 'result'>('login');
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examTimer, setExamTimer] = useState(3600); // 1 hour default
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [currentExamIndex, setCurrentExamIndex] = useState(0);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 🛠️ ADMIN STATE ---
  const [adminMode, setAdminMode] = useState(false);
  const [adminQuestionsRaw, setAdminQuestionsRaw] = useState('');
  const [scoreSheet, setScoreSheet] = useState<StudentResult[]>([]);
  const [isGeneratingAdminQuestions, setIsGeneratingAdminQuestions] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    questionCount: 25,
    duration: 3600,
    price: 2000
  });
  const [newStudentMatric, setNewStudentMatric] = useState('');
  const [newStudentName, setNewStudentName] = useState('');

  const handleAdminLogin = () => {
    if (adminPin === '286900') {
      setAdminMode(true);
      setShowAdminLogin(false);
      setAdminPin('');
    } else {
      setAdminNotification("Invalid Admin PIN");
    }
  };

  // --- 💳 PAYSTACK INTEGRATION ---
  // --- 📱 INITIALIZATION ---
  useEffect(() => {
    const savedSessions = localStorage.getItem('nsg_sessions');
    if (savedSessions) setSessions(JSON.parse(savedSessions));

    const savedTheme = localStorage.getItem('nsg_theme');
    if (savedTheme) setTheme(savedTheme as 'dark' | 'light');

    const savedChatHistory = localStorage.getItem('nsg_chat_history');
    if (savedChatHistory) setChatHistory(JSON.parse(savedChatHistory));

    const savedChatSessions = localStorage.getItem('nsg_chat_sessions');
    if (savedChatSessions) setChatSessions(JSON.parse(savedChatSessions));

    const savedScoreSheet = localStorage.getItem('nsg_score_sheet');
    if (savedScoreSheet) setScoreSheet(JSON.parse(savedScoreSheet));

    const savedAdminQuestions = localStorage.getItem('nsg_admin_questions');
    if (savedAdminQuestions) setExamQuestions(JSON.parse(savedAdminQuestions));

    const savedRegisteredStudents = localStorage.getItem('nsg_registered_students');
    if (savedRegisteredStudents) setRegisteredStudents(JSON.parse(savedRegisteredStudents));

    const savedExamConfig = localStorage.getItem('nsg_exam_config');
    if (savedExamConfig) setExamConfig(JSON.parse(savedExamConfig));

    const savedQuiz = localStorage.getItem('nsg_quiz_data');
    if (savedQuiz) {
      const quizData = JSON.parse(savedQuiz);
      setQuizQuestions(quizData.questions || []);
      setCurrentQuestionIndex(quizData.index || 0);
      setQuizScore(quizData.score || 0);
      setQuizState(quizData.state || 'idle');
      setSelectedOption(quizData.selectedOption !== undefined ? quizData.selectedOption : null);
      setIsAnswered(quizData.isAnswered || false);
      setQuizTopic(quizData.topic || '');
    }

    const hasSeenWelcome = localStorage.getItem('nsg_welcome_seen');
    if (!hasSeenWelcome) setShowWelcome(true);

    // Sync across tabs
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.onmessage = (event) => {
      const { type, matric, result, isActive } = event.data;
      if (type === 'RESULT_SUBMITTED') {
        setScoreSheet(prev => [result, ...prev]);
      } else if (type === 'STATUS_UPDATE') {
        setRegisteredStudents(prev => prev.map(s => 
          s.matric.toLowerCase() === matric.toLowerCase() ? { ...s, isActive, lastActive: Date.now() } : s
        ));
      } else if (type === 'RESET_EXAM') {
        if (matricNumber.toLowerCase() === matric.toLowerCase()) {
          setExamLobbyState('login');
          setExamTimer(0);
          setUserNotification("Your exam session has been reset by the admin.");
        }
      }
    };

    // Default chat session
    if (savedChatSessions) {
      const sessions = JSON.parse(savedChatSessions);
      if (sessions.length === 0) {
        resetChat();
      }
    } else {
      resetChat();
    }

    return () => channel.close();
  }, []);

  useEffect(() => {
    localStorage.setItem('nsg_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('nsg_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('nsg_chat_sessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    localStorage.setItem('nsg_score_sheet', JSON.stringify(scoreSheet));
  }, [scoreSheet]);

  useEffect(() => {
    localStorage.setItem('nsg_admin_questions', JSON.stringify(examQuestions));
  }, [examQuestions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRegisteredStudents(prev => prev.map(s => {
        if (s.isActive && s.lastActive && Date.now() - s.lastActive > 300000) {
          return { ...s, isActive: false };
        }
        return s;
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('nsg_registered_students', JSON.stringify(registeredStudents));
  }, [registeredStudents]);

  useEffect(() => {
    localStorage.setItem('nsg_exam_config', JSON.stringify(examConfig));
  }, [examConfig]);

  useEffect(() => {
    const quizData = {
      questions: quizQuestions,
      index: currentQuestionIndex,
      score: quizScore,
      state: quizState,
      selectedOption: selectedOption,
      isAnswered: isAnswered,
      topic: quizTopic
    };
    localStorage.setItem('nsg_quiz_data', JSON.stringify(quizData));
  }, [quizQuestions, currentQuestionIndex, quizScore, quizState, selectedOption, isAnswered, quizTopic]);

  useEffect(() => {
    if (chatContainerRef.current && !showScrollButton) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('nsg_theme', newTheme);
  };

  const handleChatScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setUserNotification("Copied to clipboard!");
  };

  // --- 🎓 CBT & ADMIN LOGIC ---
  const shuffleArray = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const generateAdminQuestions = async () => {
    if (!adminQuestionsRaw.trim()) return;
    setIsGeneratingAdminQuestions(true);
    try {
      const prompt = `
        Convert the following raw text into a professional Multiple Choice Question (MCQ) pool.
        Each question must have 4 options (A-D) and one correct answer index (0-3).
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number,
              "explanation": "string"
            }
          ]
        }
        Raw Text: ${adminQuestionsRaw}
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      if (data.questions) {
        const formatted = data.questions.map((q: any) => ({ ...q, id: Math.random().toString(36).substr(2, 9) }));
        setExamQuestions(formatted);
        setAdminNotification(`Successfully generated ${formatted.length} questions.`);
      }
    } catch (e) {
      console.error(e);
      setAdminNotification("Failed to generate questions.");
    } finally {
      setIsGeneratingAdminQuestions(false);
    }
  };

  const [userNotification, setUserNotification] = useState<string | null>(null);

  useEffect(() => {
    if (userNotification) {
      const timer = setTimeout(() => setUserNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [userNotification]);

  const handleMatricLogin = () => {
    if (!matricNumber.trim()) {
      setUserNotification("Please enter your matric number.");
      return;
    }

    let student = registeredStudents.find(s => s.matric.toLowerCase() === matricNumber.toLowerCase());
    
    if (student) {
      setStudentName(student.name);
      const session = localStorage.getItem(`nsg_exam_session_${student.matric}`);
      if (session) {
        const data = JSON.parse(session);
        if (data.status === 'completed') {
          setUserNotification("You have already completed this exam.");
          return;
        }
      }

      if (student.paymentEnabled && !paymentVerified) {
        // Payment is required and not yet verified
      } else {
        setExamLobbyState('briefing');
      }
    } else {
      setUserNotification("You are not included for this exam");
      return;
    }
  };

  const startExam = () => {
    if (examQuestions.length < examConfig.questionCount) {
      setUserNotification(`Admin has not uploaded enough questions (Minimum ${examConfig.questionCount} required).`);
      return;
    }
    const shuffled = shuffleArray(examQuestions).slice(0, examConfig.questionCount);
    setExamQuestions(shuffled);
    setExamTimer(examConfig.duration);
    setExamLobbyState('exam');
    setExamAnswers({});
    setCurrentExamIndex(0);
    setExamFinished(false);
    
    // Mark as active
    setRegisteredStudents(prev => prev.map(s => 
      s.matric.toLowerCase() === matricNumber.toLowerCase() ? { ...s, isActive: true, lastActive: Date.now() } : s
    ));
    
    // Broadcast status
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.postMessage({ type: 'STATUS_UPDATE', matric: matricNumber, isActive: true });
    channel.close();

    localStorage.setItem(`nsg_exam_session_${matricNumber}`, JSON.stringify({ status: 'in-progress', startTime: Date.now() }));

    examTimerRef.current = setInterval(() => {
      setExamTimer(prev => {
        if (prev <= 1) {
          submitExam();
          return 0;
        }
        // Refresh active status every 30 seconds
        if (prev % 30 === 0) {
          setRegisteredStudents(curr => curr.map(s => 
            s.matric.toLowerCase() === matricNumber.toLowerCase() ? { ...s, lastActive: Date.now(), isActive: true } : s
          ));
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitExam = () => {
    if (examTimerRef.current) clearInterval(examTimerRef.current);
    
    let score = 0;
    examQuestions.forEach((q, idx) => {
      if (examAnswers[idx] === q.correctAnswer) score++;
    });

    setExamScore(score);
    setExamFinished(true);
    setExamLobbyState('result');

    // Mark as inactive
    setRegisteredStudents(prev => prev.map(s => 
      s.matric.toLowerCase() === matricNumber.toLowerCase() ? { ...s, isActive: false } : s
    ));

    const result: StudentResult = {
      matric: matricNumber,
      name: studentName,
      score: score,
      total: examQuestions.length,
      timestamp: new Date().toLocaleString()
    };
    const newSheet = [result, ...scoreSheet];
    setScoreSheet(newSheet);
    localStorage.setItem('nsg_score_sheet', JSON.stringify(newSheet));
    localStorage.setItem(`nsg_exam_session_${matricNumber}`, JSON.stringify({ status: 'completed', score }));

    // Broadcast result
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.postMessage({ type: 'RESULT_SUBMITTED', result });
    channel.close();
  };

  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  useEffect(() => {
    if (adminNotification) {
      const timer = setTimeout(() => setAdminNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [adminNotification]);

  const restartStudentTimer = (matric: string) => {
    localStorage.removeItem(`nsg_exam_session_${matric}`);
    setRegisteredStudents(prev => prev.map(s => 
      s.matric === matric ? { ...s, isActive: false } : s
    ));
    setAdminNotification(`Session for ${matric} has been reset.`);

    // Broadcast reset
    const channel = new BroadcastChannel('nsg_exam_sync');
    channel.postMessage({ type: 'RESET_EXAM', matric });
    channel.close();
  };

  const addStudent = () => {
    if (!newStudentMatric.trim() || !newStudentName.trim()) return;
    if (registeredStudents.some(s => s.matric === newStudentMatric)) {
      setAdminNotification("Matric number already exists.");
      return;
    }
    setRegisteredStudents([...registeredStudents, { matric: newStudentMatric, name: newStudentName, paymentEnabled: true }]);
    setNewStudentMatric('');
    setNewStudentName('');
    setAdminNotification("Student added successfully.");
  };

  const togglePayment = (matric: string) => {
    setRegisteredStudents(registeredStudents.map(s => 
      s.matric === matric ? { ...s, paymentEnabled: !s.paymentEnabled } : s
    ));
  };

  const deleteStudent = (matric: string) => {
    setRegisteredStudents(registeredStudents.filter(s => s.matric !== matric));
  };

  const downloadResults = () => {
    const content = scoreSheet.map(r => `${r.timestamp} | ${r.matric} | ${r.name} | Score: ${r.score}/${r.total}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NSG_Exam_Results_${Date.now()}.txt`;
    a.click();
  };

  // --- 💳 PAYSTACK INTEGRATION ---
  const handlePaystackSuccess = (reference: any) => {
    setPaymentVerified(true);
    setExamLobbyState('briefing');
  };

  const handlePaystackClose = () => {
    setUserNotification("Payment cancelled. You must pay to take the exam.");
  };

  const paystackConfig = {
    reference: (new Date()).getTime().toString(),
    email: `${matricNumber}@nsg.com`,
    amount: examConfig.price * 100, // Amount in kobo
    publicKey: PAYSTACK_PUBLIC_KEY,
    onSuccess: handlePaystackSuccess,
    onClose: handlePaystackClose
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  // --- 🎤 RECORDING LOGIC ---
  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      audioChunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      } catch (err) {
        setUserNotification("Microphone access denied. Please check permissions.");
      }
    }
  };

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 🖼️ IMAGE HANDLER ---
  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 50) {
      setUserNotification("Limit Reached: 50 images max.");
      return;
    }
    const mapped = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      preview: URL.createObjectURL(f),
      type: 'image' as const
    }));
    setUploadedImages([...uploadedImages, ...mapped]);
  };

  // --- 🧠 GEMINI ANALYSIS ---
  const triggerFullAnalysis = async () => {
    if (uploadedImages.length === 0 && !recordedBlob) {
      setUserNotification("No data provided for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('ai');

    try {
      const parts: any[] = [];

      // 1. Add Audio if exists
      if (recordedBlob) {
        const audioPart = await fileToGenerativePart(recordedBlob);
        parts.push(audioPart);
      }

      // 2. Add Images if exist
      if (uploadedImages.length > 0) {
        const imageParts = await Promise.all(
          uploadedImages.map(img => fileToGenerativePart(img.file))
        );
        imageParts.forEach(p => parts.push(p));
      }

      // 3. Add the Analysis Prompt
      parts.push({ text: `
        Act as the NSG (Nuell Study Guide) AI Executive. I have provided ${uploadedImages.length} lecture slides 
        and an audio recording. 
        1. Provide a concise Executive Summary.
        2. Extract 5 Key Technical Concepts with clear explanations.
        3. Create a bulleted "Action Plan" for studying this content.
        Style: Professional, sharp, and academic. Use markdown for better formatting. 
        IMPORTANT: For any mathematical formulas, use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$E=mc^2$$) or single dollar signs for inline (e.g. $x^2$).
      ` });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts }]
      });

      const text = response.text || "Analysis failed to generate text.";

      setChatHistory(prev => [...prev, {
        role: 'model',
        text,
        timestamp: new Date().toLocaleTimeString()
      }]);

      const base64Images = await Promise.all(uploadedImages.map(async (img) => {
        const part = await fileToGenerativePart(img.file);
        return `data:${img.file.type};base64,${part.inlineData.data}`;
      }));

      const newSession: LectureSession = { 
        id: Date.now().toString(), 
        title: `Lecture ${new Date().toLocaleTimeString()}`, 
        date: new Date().toLocaleDateString(), 
        duration: formatTime(recordingTime), 
        imageCount: uploadedImages.length, 
        summary: text.substring(0, 100) + "...",
        fullAnalysis: text,
        images: base64Images,
        audioUrl: audioUrl || undefined
      };
      setSessions([newSession, ...sessions]);
    } catch (error: any) {
      console.error('🚨 Gemini Analysis Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'model',
        text: `Critical Error: ${error.message || 'Failed to connect to Gemini.'}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat Session",
      history: [{
        role: 'model',
        text: "System Online. How can I assist your studies today?",
        timestamp: new Date().toLocaleTimeString()
      }],
      timestamp: new Date().toLocaleString(),
      isPinned: false
    };
    setChatSessions([newSession, ...chatSessions]);
    setActiveChatSessionId(newSession.id);
    setChatHistory(newSession.history);
    chatInstanceRef.current = null;
  };

  const renameChatSession = (id: string, newTitle: string) => {
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const togglePinChatSession = (id: string) => {
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s));
  };

  const handleShareResult = () => {
    setShowShareModal(true);
  };

  const generateShareImage = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `NSG_Score_${shareName || 'Student'}.png`;
      link.href = dataUrl;
      link.click();
      setShowShareModal(false);
      setUserNotification("Score card generated successfully!");
    } catch (err) {
      console.error('oops, something went wrong!', err);
      setUserNotification("Failed to generate image.");
    }
  };

  const loadChatSession = (id: string) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setActiveChatSessionId(id);
      setChatHistory(session.history);
      chatInstanceRef.current = null;
    }
  };

  const deleteChatSession = (id: string) => {
    const updated = chatSessions.filter(s => s.id !== id);
    setChatSessions(updated);
    if (activeChatSessionId === id && updated.length > 0) {
      loadChatSession(updated[0].id);
    } else if (updated.length === 0) {
      resetChat();
    }
  };

  // --- 💬 CHAT WITH GEMINI ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: msg, timestamp: new Date().toLocaleTimeString() }];
    setChatHistory(newHistory);

    try {
      if (!chatInstanceRef.current) {
        const history = chatHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

        chatInstanceRef.current = ai.chats.create({
          model: "gemini-3.1-flash-lite-preview",
          history: history,
          config: { systemInstruction: "You are the NSG (Nuell Study Guide) AI Executive. Provide sharp, technical, and academic assistance. Use markdown for all responses. For any mathematical formulas, ALWAYS use LaTeX notation wrapped in double dollar signs for blocks (e.g. $$\\int x dx$$) or single dollar signs for inline (e.g. $x^2$). Make your responses interesting, engaging, and highly structured like a premium AI assistant." }
        });
      }

      const response = await chatInstanceRef.current.sendMessage({ message: msg });
      const modelMsg: ChatMessage = { 
        role: 'model', 
        text: response.text || "I couldn't process that request.", 
        timestamp: new Date().toLocaleTimeString() 
      };
      
      const finalHistory = [...newHistory, modelMsg];
      setChatHistory(finalHistory);

      // Update Session
      setChatSessions(prev => prev.map(s => {
        if (s.id === activeChatSessionId) {
          // Auto-name if it's the first user message (history was just the system greeting)
          const newTitle = s.history.length <= 1 ? (msg.length > 30 ? msg.substring(0, 30) + '...' : msg) : s.title;
          return { ...s, title: newTitle, history: finalHistory };
        }
        return s;
      }));

    } catch (e: any) {
      console.error('🚨 Gemini Chat Error:', e);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: `Connection interrupted: ${e.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString() 
      }]);
    }
  };

  // --- 📝 QUIZ LOGIC ---
  const generateQuiz = async () => {
    if (!quizTopic.trim()) {
      setUserNotification("Please enter a topic first.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizState('idle');

    try {
      const prompt = `
        Generate a ${quizQuestionCount}-question multiple choice quiz about "${quizTopic}".
        Difficulty Level: ${quizDifficulty}.
        Return ONLY a JSON object with this structure:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": number (0-3),
              "explanation": "Detailed explanation of why the correct answer is right and others are wrong."
            }
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctAnswer", "explanation"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.questions) {
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setQuizState('active');
        setSelectedOption(null);
        setIsAnswered(false);
      }
    } catch (error) {
      console.error("Quiz Generation Error:", error);
      setUserNotification("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const sendQuizReportToAI = () => {
    const report = `
      I just completed a quiz on ${quizTopic}.
      Score: ${quizScore}/${quizQuestions.length}.
      Difficulty: ${quizDifficulty}.
      Please analyze my performance and provide a study plan based on these results.
    `;
    setChatHistory(prev => [...prev, { role: 'user', text: report, timestamp: new Date().toLocaleTimeString() }]);
    setActiveTab('ai');
    handleSendMessage();
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === quizQuestions[currentQuestionIndex].correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizState('finished');
    }
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('nsg_welcome_seen', 'true');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-red-600 pb-24 ${theme === 'dark' ? 'bg-[#050505] text-[#e0e0e0] dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* WELCOME MODAL */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center">
                  <Brain size={40} className="text-red-600" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">Welcome to <span className="text-red-600">NSG</span></h2>
                <p className="text-sm text-slate-600 dark:text-white/70 leading-relaxed">
                  Welcome to NSG (Nuell Study Guide), powered by Nuell Graphics. Transform your learning experience by recording classes, generating AI transcriptions, chatting with our intelligent assistant, and creating custom quizzes. We are constantly improving NSG to better serve your academic journey. Thank you for choosing us as your study partner!
                </p>
                <button onClick={closeWelcome} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-red-600/20">GET STARTED</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEGAL MODAL */}
      <AnimatePresence>
        {legalPage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 p-8 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                  {legalPage === 'about' && "About Us"}
                  {legalPage === 'terms' && "Terms & Conditions"}
                  {legalPage === 'contact' && "Contact Us"}
                </h2>
                <button onClick={() => setLegalPage(null)} className="text-slate-400 hover:text-red-600 transition-colors"><XCircle size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm text-slate-600 dark:text-white/70 leading-relaxed">
                {legalPage === 'about' && (
                  <>
                    <p>NSG (Nuell Study Guide) is a cutting-edge educational tool designed to empower students and lifelong learners. Powered by Nuell Graphics, we leverage advanced AI to simplify complex learning processes.</p>
                    <p>Our mission is to provide a seamless interface for capturing lecture content, analyzing it with state-of-the-art language models, and providing interactive tools like AI chat and custom quizzes to reinforce knowledge.</p>
                  </>
                )}
                {legalPage === 'terms' && (
                  <>
                    <p>By using NSG, you agree to the following terms:</p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>NSG is provided "as is" for educational purposes.</li>
                      <li>Users are responsible for the content they upload and record.</li>
                      <li>We do not guarantee 100% accuracy of AI-generated content.</li>
                      <li>Your data is stored locally on your device for privacy.</li>
                    </ul>
                  </>
                )}
                {legalPage === 'contact' && (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto"><Settings size={32} className="text-red-600" /></div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">Need Assistance?</p>
                    <p>If you have any issues, pls contact us at:</p>
                    <div className="space-y-1 font-mono text-red-600 font-bold">
                      <p>nuellkelechi@gmail.com</p>
                      <p>07046732569</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="px-5 py-4 flex justify-between items-center border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#050505]/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black border border-white/10 rounded-2xl flex items-center justify-center">
            <Brain size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic leading-none text-slate-900 dark:text-white">NSG <span className="text-red-600">(NUELL STUDY GUIDE)</span></h1>
            <span className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest">Lecture OS 4.0</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:text-red-600 transition-all">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 uppercase">SYSTEM READY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          
          {/* RECORD TAB */}
          {activeTab === 'record' && (
            <motion.div key="record" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity: 0}} className="space-y-6">
              <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-sm">
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="relative mb-6">
                    {isRecording && <motion.div animate={{ scale: 1.6, opacity: 0.1 }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-600 rounded-full blur-2xl" />}
                    <button onClick={handleToggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isRecording ? 'bg-white text-black scale-105' : 'bg-red-600 text-white hover:scale-105 active:scale-95'}`}>
                      {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                    </button>
                  </div>

                  <h2 className="text-xl font-black tracking-tighter mb-1 uppercase text-slate-900 dark:text-white">{isRecording ? "Capture Active" : "Engine Idle"}</h2>
                  <p className="font-mono text-4xl text-red-600 font-bold mb-6 tracking-tight">{formatTime(recordingTime)}</p>

                  {audioUrl && (
                    <div className="w-full max-w-sm bg-slate-100 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10 mb-6">
                      <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase mb-2">Recording Preview</p>
                      <audio src={audioUrl} controls className="w-full h-8" />
                    </div>
                  )}

                  <div className="flex gap-2 w-full max-w-xs">
                    {audioUrl && (
                      <a href={audioUrl} download="NSG_Lecture.mp3" className="flex-1 flex items-center justify-center gap-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all border border-slate-200 dark:border-white/10">
                        <Download size={16} /> Download
                      </a>
                    )}
                    <button onClick={triggerFullAnalysis} disabled={isAnalyzing || (uploadedImages.length === 0 && !recordedBlob)} className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-4 py-3 rounded-2xl text-xs font-bold border border-red-600/30 transition-all disabled:opacity-50">
                      <Sparkles size={16} /> Analyze
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all"><ImageIcon size={20} className="text-red-500 group-hover:text-white" /></div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Upload Slides</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">({uploadedImages.length}/50)</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImages} />
                </label>

                <label className="bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-600/30 cursor-pointer transition-all flex flex-col items-center group shadow-sm">
                  <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-red-600 group-hover:text-white transition-all"><FileAudio size={20} className="text-red-500 group-hover:text-white" /></div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Import Audio</span>
                  <span className="text-[9px] text-slate-400 dark:text-white/40 mt-1 uppercase tracking-widest">MP3 / WAV</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAudioUrl(URL.createObjectURL(file));
                      setRecordedBlob(file);
                    }
                  }} />
                </label>
              </div>

              {uploadedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <img src={img.preview} alt="slide" className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-white/10" />
                      <button onClick={() => setUploadedImages(prev => prev.filter(i => i.id !== img.id))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-lg"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AI CHAT TAB */}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="flex h-[calc(100vh-220px)] bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden relative shadow-sm">
              
              {/* Chat Sidebar */}
              <div className={`${showChatSidebarMobile ? 'flex absolute inset-0 z-50 w-full' : 'hidden'} md:flex md:relative md:w-64 border-r border-slate-200 dark:border-white/10 flex-col bg-slate-50 dark:bg-[#080808] transition-all`}>
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <button onClick={() => { resetChat(); setShowChatSidebarMobile(false); }} className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">
                    <PlusCircle size={16} /> New Chat
                  </button>
                  {showChatSidebarMobile && (
                    <button onClick={() => setShowChatSidebarMobile(false)} className="md:hidden p-2 text-slate-400 ml-2"><XCircle size={20} /></button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {chatSessions
                    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                    .map(session => (
                    <div key={session.id} className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${activeChatSessionId === session.id ? 'bg-red-600/10 border border-red-600/20 text-red-600' : 'hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-white/40'}`}>
                      <div onClick={() => { loadChatSession(session.id); setShowChatSidebarMobile(false); }} className="flex items-center gap-2 overflow-hidden flex-1">
                        {session.isPinned ? <Pin size={12} className="text-red-600" /> : <FileText size={14} className="flex-shrink-0" />}
                        <span className="text-[10px] font-bold truncate">{session.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); togglePinChatSession(session.id); }} className="p-1 hover:text-red-600">
                          <Pin size={12} className={session.isPinned ? 'fill-red-600' : ''} />
                        </button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const newTitle = prompt("Rename Chat Session:", session.title);
                          if (newTitle) renameChatSession(session.id, newTitle);
                        }} className="p-1 hover:text-red-600">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setChatSessions(prev => prev.filter(s => s.id !== session.id)); }} className="p-1 hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col relative">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowChatSidebarMobile(true)} className="md:hidden p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-white/60"><History size={18} /></button>
                    <div className="w-8 h-8 bg-red-600/10 rounded-lg flex items-center justify-center"><Brain size={18} className="text-red-600" /></div>
                    <div><p className="font-bold text-xs text-slate-900 dark:text-white">Gemini 3.1 Flash Lite</p><p className="text-[9px] text-slate-400 dark:text-white/40 uppercase font-bold tracking-tighter">Optimized Intelligence</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setChatHistory([])} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>

                <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-slate-50/50 dark:bg-transparent">
                  {chatHistory.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3.5 rounded-2xl relative group ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-tl-none shadow-sm'}`}>
                        <div className={`markdown-body ${msg.role === 'user' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                          <p className={`text-[8px] font-mono uppercase tracking-tighter ${msg.role === 'user' ? 'text-white/60' : 'text-slate-400 dark:text-white/30'}`}>{msg.timestamp}</p>
                          <button onClick={() => copyToClipboard(msg.text)} className={`p-1.5 rounded-lg transition-all ${msg.role === 'user' ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-600/5'}`} title="Copy message">
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute bottom-24 right-6 p-3 bg-red-600 text-white rounded-full shadow-xl z-20"><ArrowDown size={20} /></motion.button>
                  )}
                </AnimatePresence>

                <div className="p-4 bg-white dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-white/10">
                  <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/10">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask NSG Executive..." className="flex-1 bg-transparent border-none outline-none px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20" />
                    <button onClick={handleSendMessage} className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20"><ChevronRight size={18} /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Library</h2>
                {selectedSession && <button onClick={() => setSelectedSession(null)} className="text-red-600 text-xs font-bold flex items-center gap-1"><ArrowLeft size={14} /> Back</button>}
              </div>

              {!selectedSession ? (
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-[#0a0a0a] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">
                      <History size={40} className="mx-auto mb-4 text-slate-200 dark:text-white/10" />
                      <p className="text-sm font-bold text-slate-400 dark:text-white/30">No saved lectures found</p>
                    </div>
                  ) : (
                    sessions.map(session => (
                      <div key={session.id} className="w-full bg-white dark:bg-[#0a0a0a] p-4 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-white/10 hover:border-red-600/30 transition-all group shadow-sm">
                        <div onClick={() => setSelectedSession(session)} className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-red-600/10 transition-all"><FileAudio size={20} className="text-slate-400 dark:text-white/20 group-hover:text-red-500" /></div>
                          <div><p className="font-bold text-sm text-slate-900 dark:text-white">{session.title}</p><p className="text-[10px] text-slate-400 dark:text-white/40 font-mono uppercase">{session.date} • {session.duration}</p></div>
                        </div>
                        <button onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#0a0a0a] p-6 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedSession.title}</h3>
                    <button onClick={() => {
                      setChatHistory([{ role: 'model', text: selectedSession.fullAnalysis, timestamp: new Date().toLocaleTimeString() }]);
                      setActiveTab('ai');
                      setSelectedSession(null);
                    }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/20"><Brain size={14} /> Continue in Chat</button>
                  </div>
                  <div className="markdown-body text-sm leading-relaxed text-slate-700 dark:text-white/70">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedSession.fullAnalysis}</ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* QUIZ TAB */}
          {activeTab === 'quiz' && (
            <motion.div key="quiz" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Quiz Engine</h2>
                <Zap size={20} className="text-red-600" />
              </div>

              {quizState === 'idle' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="text-center space-y-2 mb-4">
                    <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><Sparkles size={24} className="text-red-600" /></div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Generate Interactive Quiz</h3>
                    <p className="text-xs text-slate-500 dark:text-white/40">Test your knowledge with AI-generated questions.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase mb-2 ml-1">Topic</p>
                      <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. Quantum Physics, EEE 101..." className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-red-600/50 transition-all text-slate-900 dark:text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase mb-2 ml-1">Questions</p>
                        <div className="flex flex-wrap gap-2">
                          {[15, 25, 50, 100].map(count => (
                            <button key={count} onClick={() => setQuizQuestionCount(count)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${quizQuestionCount === count ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/40'}`}>
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase mb-2 ml-1">Difficulty</p>
                        <div className="flex flex-wrap gap-2">
                          {['Easy', 'Medium', 'Hard', 'Professional'].map(level => (
                            <button key={level} onClick={() => setQuizDifficulty(level as any)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${quizDifficulty === level ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/40'}`}>
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button onClick={generateQuiz} disabled={isGeneratingQuiz} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isGeneratingQuiz ? <><RefreshCcw size={18} className="animate-spin" /> GENERATING...</> : <><Zap size={18} /> START ASSESSMENT</>}
                  </button>
                </div>
              )}

              {quizState === 'active' && quizQuestions.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0a0a0a] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <button onClick={() => setQuizState('idle')} className="text-slate-400 hover:text-red-600 flex items-center gap-1 text-xs font-bold uppercase"><ArrowLeft size={14} /> Back</button>
                    <div className="text-center"><p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase">Progress</p><p className="text-sm font-black text-red-600">{currentQuestionIndex + 1} / {quizQuestions.length}</p></div>
                    <div className="text-right"><p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase">Score</p><p className="text-sm font-black text-green-500">{quizScore}</p></div>
                  </div>
                  <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-8 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{quizQuestions[currentQuestionIndex].question}</h3>
                    <div className="space-y-3">
                      {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={isAnswered} className={`w-full text-left p-4 rounded-2xl border transition-all ${isAnswered ? (idx === quizQuestions[currentQuestionIndex].correctAnswer ? 'bg-green-500/10 border-green-500 text-green-500' : (selectedOption === idx ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-slate-50 dark:bg-white/5 opacity-40')) : (selectedOption === idx ? 'border-red-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80')}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    {isAnswered && <button onClick={nextQuestion} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">{currentQuestionIndex === quizQuestions.length - 1 ? "FINISH QUIZ" : "NEXT QUESTION"} <ChevronRight size={18} /></button>}
                  </div>
                </div>
              )}

              {quizState === 'finished' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-3xl border border-slate-200 dark:border-white/10 text-center space-y-8 shadow-sm">
                  <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center mx-auto relative">
                    <Trophy size={48} className="text-red-600" />
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-red-600/5 rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Assessment Complete</h3>
                    <p className="text-slate-500 dark:text-white/40 text-sm mt-1">You've successfully finished the quiz.</p>
                  </div>
                  <div className="py-8 border-y border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1">Your Score</p>
                    <p className="text-6xl font-black text-red-600">{quizScore} / {quizQuestions.length}</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-white/30 mt-2 uppercase tracking-widest">{Math.round((quizScore/quizQuestions.length)*100)}% Proficiency</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleShareResult} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2">
                      <Share2 size={18} /> SHARE SCORE CARD
                    </button>
                    <button onClick={() => setQuizState('idle')} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">TRY ANOTHER TOPIC</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* EXAM TAB */}
          {activeTab === 'exam' && (
            <motion.div key="exam" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity: 0}} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">CBT Examination</h2>
                <ShieldCheck size={20} className="text-red-600" />
              </div>

              {examLobbyState === 'login' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2"><User size={24} className="text-red-600" /></div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Student Verification</h3>
                    <p className="text-xs text-slate-500 dark:text-white/40">Enter your credentials to access the examination hall.</p>
                    <AnimatePresence>
                      {userNotification && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-red-600/10 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-600/20 mt-2">
                          {userNotification}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {!showAdminLogin ? (
                    <div className="space-y-4">
                      {studentName ? (
                        <div className="p-6 bg-slate-100 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 space-y-4 text-center">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-red-600/20">{studentName.charAt(0)}</div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Authenticated Student</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{studentName}</p>
                            <p className="text-xs font-mono text-red-600 font-bold">{matricNumber}</p>
                          </div>
                          
                          {registeredStudents.find(s => s.matric.toLowerCase() === matricNumber.toLowerCase())?.paymentEnabled && !paymentVerified ? (
                            <div className="pt-4 space-y-3 border-t border-slate-200 dark:border-white/10">
                              <p className="text-[10px] text-slate-500 dark:text-white/40 leading-relaxed italic">This examination requires a one-time access fee of <span className="font-black text-slate-900 dark:text-white">₦{examConfig.price}</span>. Please complete payment to proceed.</p>
                              <button onClick={() => initializePayment({ onSuccess: handlePaystackSuccess, onClose: handlePaystackClose })} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2">
                                <CreditCard size={18} /> PAY ₦{examConfig.price} & PROCEED
                              </button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className="w-full text-[10px] font-black text-slate-400 dark:text-white/30 uppercase hover:text-red-600 transition-all">Not you? Switch Account</button>
                            </div>
                          ) : (
                            <div className="pt-4 space-y-3 border-t border-slate-200 dark:border-white/10">
                              <button onClick={handleMatricLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all">PROCEED TO HALL</button>
                              <button onClick={() => { setStudentName(''); setMatricNumber(''); }} className="w-full text-[10px] font-black text-slate-400 dark:text-white/30 uppercase hover:text-red-600 transition-all">Not you? Switch Account</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter Matric Number" className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-slate-900 dark:text-white focus:border-red-600/50 transition-all" />
                          <button onClick={handleMatricLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all">VERIFY MATRIC</button>
                          <button onClick={() => setShowAdminLogin(true)} className="w-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-3 rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-all">ADMIN ACCESS</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="Admin PIN" className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-slate-900 dark:text-white" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm">BACK</button>
                        <button onClick={handleAdminLogin} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all">LOGIN AS ADMIN</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {examLobbyState === 'briefing' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-6 shadow-sm">
                  <div className="flex items-center gap-4 p-4 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-xl">{studentName.charAt(0)}</div>
                    <div><p className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">{studentName}</p><p className="text-[10px] text-slate-400 dark:text-white/40 font-mono">{matricNumber}</p></div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Examination Briefing</h3>
                    <div className="p-4 bg-red-600/5 border border-red-600/20 rounded-2xl space-y-3">
                      <p className="text-xs text-red-600 font-bold flex items-center gap-2"><XCircle size={14} /> WARNING: {studentName}, if you leave this app, you automatically forfeit the exam.</p>
                      <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">This is a professional CBT Mock Exam. You have {Math.floor(examConfig.duration / 60)} minutes to answer {examConfig.questionCount} randomized questions. Use only your brain. Good luck.</p>
                    </div>
                  </div>
                  <button onClick={startExam} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-2">
                    <Zap size={18} /> START EXAMINATION NOW
                  </button>
                </div>
              )}

              {examLobbyState === 'exam' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0a0a0a] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm sticky top-20 z-30">
                    <div className="flex items-center gap-2 text-red-600 font-black">
                      <Clock size={18} />
                      <span className="font-mono text-lg">{Math.floor(examTimer / 60)}:{(examTimer % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="text-center"><p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase">Question</p><p className="text-sm font-black text-slate-900 dark:text-white">{currentExamIndex + 1} / {examQuestions.length}</p></div>
                    <button onClick={submitExam} disabled={Object.keys(examAnswers).length < Math.min(examQuestions.length, 5)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30">Submit</button>
                  </div>

                  <div className="bg-white dark:bg-[#0a0a0a] p-8 rounded-3xl border border-slate-200 dark:border-white/10 space-y-8 shadow-sm">
                    <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{examQuestions[currentExamIndex].question}</h3>
                    <div className="space-y-3">
                      {examQuestions[currentExamIndex].options.map((option, idx) => (
                        <button key={idx} onClick={() => setExamAnswers({ ...examAnswers, [currentExamIndex]: idx })} className={`w-full text-left p-4 rounded-2xl border transition-all ${examAnswers[currentExamIndex] === idx ? 'border-red-600 bg-red-600/5 text-red-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80'}`}>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between pt-4">
                      <button onClick={() => setCurrentExamIndex(prev => Math.max(0, prev - 1))} disabled={currentExamIndex === 0} className="p-3 text-slate-400 hover:text-red-600 disabled:opacity-20"><ArrowLeft size={24} /></button>
                      <button onClick={() => setCurrentExamIndex(prev => Math.min(examQuestions.length - 1, prev + 1))} disabled={currentExamIndex === examQuestions.length - 1} className="p-3 text-slate-400 hover:text-red-600 disabled:opacity-20"><ChevronRight size={24} /></button>
                    </div>
                  </div>
                </div>
              )}

              {examLobbyState === 'result' && (
                <div className="bg-white dark:bg-[#0a0a0a] p-10 rounded-3xl border border-slate-200 dark:border-white/10 text-center space-y-6 shadow-sm">
                  <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Exam Submitted</h3>
                    <p className="text-slate-500 dark:text-white/40 text-sm mt-1">Your results have been recorded in the system.</p>
                  </div>
                  <div className="py-6 border-y border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1">Final Score</p>
                    <p className="text-5xl font-black text-red-600">{examScore} / {examQuestions.length}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-2">{Math.round((examScore / examQuestions.length) * 100)}% Proficiency</p>
                  </div>
                  <button onClick={() => setExamLobbyState('login')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl text-sm transition-all">LOGOUT</button>
                </div>
              )}
            </motion.div>
          )}

          {/* ADMIN PANEL */}
          {adminMode && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl p-6 overflow-y-auto">
              <div className="max-w-6xl mx-auto space-y-8 pb-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3"><LayoutDashboard className="text-red-600" /> Admin Control Panel</h2>
                    <div className="px-3 py-1 bg-red-600/20 border border-red-600/30 rounded-full flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{registeredStudents.filter(s => s.isActive).length} Active Now</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AnimatePresence>
                      {adminNotification && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20">
                          {adminNotification}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={() => setAdminMode(false)} className="text-white/50 hover:text-red-600 transition-all"><XCircle size={32} /></button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Student Management */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                      <h3 className="font-bold text-white flex items-center gap-2"><UserPlus size={18} className="text-red-600" /> Student Registration</h3>
                      <div className="flex gap-3">
                        <input type="text" value={newStudentMatric} onChange={(e) => setNewStudentMatric(e.target.value)} placeholder="Matric Number" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-600/50" />
                        <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Full Name" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-red-600/50" />
                        <button onClick={addStudent} className="bg-red-600 hover:bg-red-700 text-white px-6 rounded-xl text-xs font-black transition-all">ADD</button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                          <thead>
                            <tr className="text-white/30 uppercase tracking-widest border-b border-white/5">
                              <th className="py-3 px-2">Matric</th>
                              <th className="py-3 px-2">Name</th>
                              <th className="py-3 px-2">Status</th>
                              <th className="py-3 px-2">Payment</th>
                              <th className="py-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="text-white/70">
                            {registeredStudents.map(student => (
                              <tr key={student.matric} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-2 font-mono">{student.matric}</td>
                                <td className="py-3 px-2 font-bold">{student.name}</td>
                                <td className="py-3 px-2">
                                  <div className="flex flex-col">
                                    <span className={`text-[10px] font-black uppercase ${student.isActive ? 'text-green-500' : 'text-white/20'}`}>
                                      {student.isActive ? 'Active' : 'Offline'}
                                    </span>
                                    {student.lastActive && (
                                      <span className="text-[8px] text-white/20">
                                        {new Date(student.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-2">
                                  <button onClick={() => togglePayment(student.matric)} className={`px-2 py-1 rounded-md font-black uppercase tracking-tighter ${student.paymentEnabled ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>
                                    {student.paymentEnabled ? 'Enabled' : 'Disabled'}
                                  </button>
                                </td>
                                <td className="py-3 px-2 text-right space-x-2">
                                  <button onClick={() => restartStudentTimer(student.matric)} className="p-2 text-white/30 hover:text-red-600 transition-all" title="Reset Session"><RefreshCcw size={12} /></button>
                                  <button onClick={() => deleteStudent(student.matric)} className="p-2 text-white/30 hover:text-red-600 transition-all" title="Delete Student"><Trash2 size={12} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Exam Config */}
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} className="text-red-600" /> Exam Configuration</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[8px] font-black text-white/30 uppercase mb-1">Question Count</p>
                            <input type="number" value={examConfig.questionCount} onChange={(e) => setExamConfig({...examConfig, questionCount: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none" />
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-white/30 uppercase mb-1">Duration (Seconds)</p>
                            <input type="number" value={examConfig.duration} onChange={(e) => setExamConfig({...examConfig, duration: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none" />
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-white/30 uppercase mb-1">Price (Naira)</p>
                            <input type="number" value={examConfig.price} onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val === 400 || val === 700) {
                                setAdminNotification("Price cannot be 400 or 700 Naira.");
                                return;
                              }
                              setExamConfig({...examConfig, price: val});
                            }} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none" />
                          </div>
                        </div>
                      </div>

                      {/* Question Generation */}
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                        <h3 className="font-bold text-white flex items-center gap-2"><PlusCircle size={18} className="text-red-600" /> Question Pool</h3>
                        <textarea value={adminQuestionsRaw} onChange={(e) => setAdminQuestionsRaw(e.target.value)} placeholder="Paste raw text here to generate MCQs..." className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] text-white outline-none focus:border-red-600/50" />
                        <button onClick={generateAdminQuestions} disabled={isGeneratingAdminQuestions} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                          {isGeneratingAdminQuestions ? <RefreshCcw size={16} className="animate-spin" /> : <Cpu size={16} />} GENERATE QUESTIONS
                        </button>
                        <p className="text-[10px] text-white/30 text-center">Current Pool: {examQuestions.length} Questions</p>
                      </div>
                    </div>
                  </div>

                  {/* Score Sheet & Question Log */}
                  <div className="grid grid-rows-2 gap-4 h-full">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white flex items-center gap-2"><ListChecks size={18} className="text-red-600" /> Real-time Scores</h3>
                        <button onClick={downloadResults} className="text-red-600 hover:text-red-500 transition-all"><FileDown size={20} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {scoreSheet.length === 0 ? (
                          <p className="text-[10px] text-white/20 text-center py-10">No results recorded yet</p>
                        ) : (
                          scoreSheet.map((res, i) => (
                            <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between group">
                              <div>
                                <p className="text-[10px] font-bold text-white">{res.name}</p>
                                <p className="text-[8px] text-white/40 font-mono">{res.matric} • {res.score}/{res.total}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-red-600">{Math.round((res.score/res.total)*100)}%</p>
                                <p className="text-[6px] text-white/20 uppercase">{res.timestamp}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 flex flex-col overflow-hidden">
                      <h3 className="font-bold text-white flex items-center gap-2"><FileText size={18} className="text-red-600" /> Question Log</h3>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {examQuestions.length === 0 ? (
                          <p className="text-[10px] text-white/20 text-center py-10">No questions in pool</p>
                        ) : (
                          examQuestions.map((q, i) => (
                            <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
                              <p className="text-[10px] font-bold text-white leading-tight">{i + 1}. {q.question}</p>
                              <div className="grid grid-cols-2 gap-1">
                                {q.options.map((opt, idx) => (
                                  <p key={idx} className={`text-[8px] px-2 py-1 rounded ${idx === q.correctAnswer ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}>{opt}</p>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 z-50 shadow-2xl">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { id: 'record', icon: Mic, label: 'Record' },
            { id: 'ai', icon: Brain, label: 'AI Chat' },
            { id: 'history', icon: History, label: 'Library' },
            { id: 'quiz', icon: Zap, label: 'Quiz' },
            { id: 'exam', icon: ListChecks, label: 'Exam' },
            { id: 'blog', icon: FileText, label: 'Blog' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center py-2 px-4 transition-all relative ${activeTab === tab.id ? 'text-red-600' : 'text-slate-400 dark:text-white/30 hover:text-red-500'}`}>
              {activeTab === tab.id && <motion.div layoutId="nav-active" className="absolute inset-0 bg-red-600/5 rounded-2xl -z-10" />}
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* SHARE MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-8 max-w-sm w-full border border-slate-200 dark:border-white/10 space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Share Your Result</h3>
                <p className="text-xs text-slate-500 dark:text-white/40">Enter your name to generate your score card.</p>
              </div>
              
              <input type="text" value={shareName} onChange={(e) => setShareName(e.target.value)} placeholder="Your Full Name" className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm outline-none text-slate-900 dark:text-white focus:border-red-600/50 transition-all" />

              <div className="flex gap-2">
                <button onClick={() => setShowShareModal(false)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 font-bold py-4 rounded-2xl text-sm">CANCEL</button>
                <button onClick={generateShareImage} disabled={!shareName.trim()} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl text-sm shadow-xl shadow-red-600/20 transition-all disabled:opacity-50">GENERATE IMAGE</button>
              </div>

              {/* HIDDEN SHARE CARD FOR GENERATION */}
              <div className="fixed -left-[9999px] top-0">
                <div ref={shareCardRef} className="w-[600px] h-[400px] bg-white p-10 flex flex-col items-center justify-center text-center relative overflow-hidden border-[10px] border-red-600">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/5 rounded-full -translate-x-16 -translate-y-16" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-red-600/5 rounded-full translate-x-24 translate-y-24" />
                  
                  <div className="mb-6">
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-1">NSG STUDY GUIDE</h1>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">Official Assessment Certificate</p>
                  </div>

                  <div className="space-y-2 mb-8">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">This certifies that</p>
                    <p className="text-3xl font-black text-slate-900 uppercase">{shareName || 'Student'}</p>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">has achieved a score of</p>
                  </div>

                  <div className="bg-red-600 text-white px-10 py-4 rounded-2xl">
                    <p className="text-5xl font-black">{quizScore} / {quizQuestions.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{Math.round((quizScore/quizQuestions.length)*100)}% Proficiency</p>
                  </div>

                  <div className="mt-10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Generated by NSG AI Executive • {new Date().toLocaleDateString()}</p>
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t border-slate-200 dark:border-white/10 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">
        <button onClick={() => setLegalPage('about')} className="hover:text-red-600 transition-colors">About Us</button>
        <button onClick={() => setLegalPage('terms')} className="hover:text-red-600 transition-colors">Terms & Conditions</button>
        <button onClick={() => setLegalPage('contact')} className="hover:text-red-600 transition-colors">Contact Us</button>
        <span>© 2026 Nuell Graphics</span>
      </footer>
    </div>
  );
}
