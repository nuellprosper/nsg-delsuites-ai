import React, { useState } from 'react';
import { BrainCircuit, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
}

export function Quiz({ questions, onComplete }: { questions: Question[], onComplete: (score: number) => void }) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  if (!questions || questions.length === 0) {
    return <div className="p-8 text-center font-bold uppercase italic">No quiz data found. Record more audio!</div>;
  }

  const currentQ = questions[step];

  const handleSelect = (opt: string) => {
    if (isAnswered) return;
    setSelectedOption(opt);
    setIsAnswered(true);
    if (opt === currentQ.answer) setScore(score + 1);
  };

  const nextQuestion = () => {
    if (step + 1 < questions.length) {
      setStep(step + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      onComplete(score);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-4 border-black pb-2">
        <h2 className="text-xl font-black uppercase italic flex items-center gap-2">
          <BrainCircuit className="text-yellow-500" /> Knowledge Check
        </h2>
        <span className="font-black bg-black text-white px-2 py-1 text-xs">
          {step + 1} / {questions.length}
        </span>
      </div>

      <div className="p-6 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="text-lg font-black uppercase mb-6 leading-tight">{currentQ.question}</h3>
        
        <div className="grid gap-3">
          {currentQ.options.map((opt, i) => {
            const isCorrect = opt === currentQ.answer;
            const isSelected = opt === selectedOption;
            
            let btnClass = "w-full text-left p-4 border-4 border-black font-bold transition-all ";
            if (!isAnswered) {
              btnClass += "hover:bg-yellow-400 bg-white";
            } else if (isCorrect) {
              btnClass += "bg-green-400 shadow-none";
            } else if (isSelected && !isCorrect) {
              btnClass += "bg-red-400 shadow-none";
            } else {
              btnClass += "bg-gray-100 opacity-50 shadow-none";
            }

            return (
              <button key={i} onClick={() => handleSelect(opt)} className={btnClass}>
                <div className="flex justify-between items-center">
                  <span>{opt}</span>
                  {isAnswered && isCorrect && <CheckCircle2 size={20} />}
                  {isAnswered && isSelected && !isCorrect && <XCircle size={20} />}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <button 
            onClick={nextQuestion}
            className="mt-8 w-full bg-black text-white p-4 font-black uppercase flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
          >
            {step + 1 === questions.length ? "Finish Quiz" : "Next Question"} <ArrowRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
