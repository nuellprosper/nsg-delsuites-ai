import { useState } from 'react';
import { CheckCircle2, Circle, HelpCircle, Trophy, RotateCcw } from 'lucide-react';

interface AITutorProps {
  topics: string[];
  quiz: {
    question: string;
    options: string[];
    correct: string;
  }[];
}

export const AITutor = ({ topics, quiz }: AITutorProps) => {
  const [view, setView] = useState<'topics' | 'quiz'>('topics');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (selectedOption: string) => {
    if (!quiz || quiz.length === 0) return;

    const correctAnswer = quiz[currentQuestion].correct;
    
    // SMART SCORING LOGIC:
    // 1. Checks if the option matches the letter (e.g., "A")
    // 2. Checks if the option starts with the letter and a period (e.g., "A. Ohms Law")
    // 3. Checks if the whole string matches
    const isCorrect = 
      selectedOption.trim() === correctAnswer.trim() || 
      selectedOption.trim().startsWith(correctAnswer + ".") ||
      selectedOption.trim().startsWith(correctAnswer + ")") ||
      selectedOption.trim().startsWith(correctAnswer + " ");

    if (isCorrect) {
      setScore((prevScore) => prevScore + 1);
    }
    
    // Progress to next question or show final score
    if (currentQuestion + 1 < quiz.length) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setScore(0);
    setCurrentQuestion(0);
    setShowResult(false);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Navigation Switch */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
        <button 
          onClick={() => setView('topics')} 
          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${view === 'topics' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}
        >
          Lecture Summary
        </button>
        <button 
          onClick={() => setView('quiz')} 
          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${view === 'quiz' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}
        >
          Exam Practice
        </button>
      </div>

      {/* Summary View */}
      {view === 'topics' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {topics.map((t, i) => (
            <div key={i} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600/20 group-hover:bg-red-600 transition-colors"></div>
              <p className="text-slate-700 font-bold leading-relaxed text-sm">{t}</p>
            </div>
          ))}
        </div>
      ) : (
        /* Quiz View */
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px] flex flex-col justify-center relative">
          {quiz && quiz.length > 0 ? (
            !showResult ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  <span className="bg-slate-50 px-3 py-1 rounded-full">Question {currentQuestion + 1} / {quiz.length}</span>
                  <div className="flex items-center gap-1 text-red-600/50">
                    <HelpCircle size={14} />
                    <span>DELSU Mock</span>
                  </div>
                </div>
                
                <h3 className="font-black text-slate-800 text-lg leading-tight px-2">
                  {quiz[currentQuestion].question}
                </h3>
                
                <div className="grid gap-3">
                  {quiz[currentQuestion].options.map((opt, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleAnswer(opt)} 
                      className="w-full text-left p-5 rounded-2xl bg-slate-50 border-2 border-slate-50 font-bold text-sm hover:border-red-100 active:bg-red-600 active:text-white active:border-red-600 transition-all shadow-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Results View */
              <div className="text-center py-6 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Trophy size={48} />
                </div>
                <h3 className="font-black text-2xl uppercase text-slate-800 tracking-tighter">Exam Result</h3>
                <div className="mt-4 inline-block px-6 py-2 bg-slate-900 text-white rounded-full font-black text-xl">
                  {score} <span className="text-slate-400 text-sm mx-1">/</span> {quiz.length}
                </div>
                
                <p className="text-slate-400 font-bold mt-6 uppercase text-[10px] tracking-[0.2em]">
                  {score === quiz.length ? "Engineering Distinction!" : "Keep Pushing, Delsuite!"}
                </p>
                
                <button 
                  onClick={resetQuiz} 
                  className="mt-10 w-full flex items-center justify-center gap-2 bg-red-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all"
                >
                  <RotateCcw size={16} />
                  Retake Practice Test
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-20 text-slate-300 font-bold italic">
              AI is preparing your exam questions...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
                       
