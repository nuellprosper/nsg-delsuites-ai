import { useState } from 'react';

interface AITutorProps { topics: string[]; quiz: any[]; }

export const AITutor = ({ topics, quiz }: AITutorProps) => {
  const [mode, setMode] = useState<'summary' | 'quiz'>('summary');
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button onClick={() => setMode('summary')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${mode === 'summary' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Summary</button>
        <button onClick={() => setMode('quiz')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase ${mode === 'quiz' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Quiz</button>
      </div>

      {mode === 'summary' ? (
        <div className="space-y-4">
          {topics.map((t, i) => (
            <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
              <p className="text-slate-700 font-bold text-sm leading-relaxed">{t}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          {!done ? (
            <div className="space-y-4">
              <h3 className="font-black text-slate-800">{quiz[qIdx]?.question}</h3>
              {quiz[qIdx]?.options.map((o: string) => (
                <button key={o} onClick={() => { if(o === quiz[qIdx].correct) setScore(score+1); if(qIdx+1 < quiz.length) setQIdx(qIdx+1); else setDone(true); }} className="w-full text-left p-4 bg-slate-50 rounded-xl font-bold text-xs hover:bg-red-50">{o}</button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <h3 className="font-black text-xl">Score: {score}/{quiz.length}</h3>
              <button onClick={() => {setDone(false); setQIdx(0); setScore(0);}} className="mt-4 text-red-600 font-black uppercase text-[10px]">Restart</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
