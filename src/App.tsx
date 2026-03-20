import { useState } from 'react';
import { CheckCircle2, Circle, HelpCircle, Trophy } from 'lucide-react';

interface AITutorProps {
  topics: string[];
  quiz: any[];
}

export const AITutor = ({ topics, quiz }: AITutorProps) => {
  const [view, setView] = useState<'topics' | 'quiz'>('topics');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (selectedOption: string) => {
    const correctAnswer = quiz[currentQuestion].correct;
    
    // SMART CHECK: Checks if the selected text contains the correct letter 
    // or if the strings match exactly.
    const isCorrect = 
      selectedOption === correctAnswer || 
      selectedOption.startsWith(correctAnswer + " ") ||
      selectedOption.startsWith(correctAnswer + ".");

    if (isCorrect) {
      setScore((prevScore) => prevScore + 1);
    }
    
    // Move to next question or show result
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
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button 
          onClick={() => setView('topics')} 
          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${view === 'topics' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}
        >
          Summary
        </button>
        <button 
          onClick={() => setView('quiz')} 
          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${view === 'quiz' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}
        >
          Exam Prep
        </button>
      </div>

      {view === 'topics' ? (
        <div className="space-y-4">
          {topics.map((t, i) => (
            <div key={i} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
              <div className="w-8 h-1 bg-red-600 mb-3 rounded-full"></div>
              <p className="text-slate-700 font-bold leading-relaxed text-sm">{t}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm min-h-[350px] flex flex-col justify-center">
          {quiz && quiz.length > 0 ? (
            !showResult ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  <span>Question {currentQuestion + 1} of {quiz.length}</span>
                  <HelpCircle size={16} />
                </div>
                <h3 className="font-black text-slate-800 text-lg leading-tight">{quiz[currentQuestion].question}</h3>
                <div className="grid gap-3">
                  {quiz[currentQuestion].options.map((opt: string, idx: number) => (
                    <button 
                      key={idx} 
                      onClick={() => handleAnswer(opt)} 
                      className="w-full text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-sm active:bg-red-600 active:text-white transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy size={40} />
                </div>
                <h3 className="font-black text-2xl uppercase text-slate-800">Test Complete!</h3>
                <p className="text-slate-400 font-bold mt-2">
                  You scored <span className="text-red-600 text-xl">{score}</span> out of {quiz.length}
                </p>
                <div className="mt-4 text-[10px] font-black uppercase text-slate-300">
                  {score === quiz.length ? "Engineering Genius!" : "Keep Studying, Delsuite!"}
                </div>
                <button 
                  onClick={resetQuiz} 
                  className="mt-8 w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-transform"
                >
                  Restart Quiz
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-10 text-slate-300 font-bold italic">
              Generating quiz... Try a longer recording.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
