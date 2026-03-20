import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

interface Topic {
  name: string;
  explanation: string;
}

export function AITutor({ topics }: { topics: Topic[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b-4 border-black pb-2">
        <BookOpen size={24} className="text-yellow-500" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Lecture Insights</h2>
      </div>

      {topics.length === 0 ? (
        <div className="p-10 border-4 border-dashed border-gray-300 text-center bg-gray-50">
          <Sparkles size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="font-black text-gray-400 uppercase">Record a lecture to generate study notes!</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {topics.map((topic, index) => (
            <div 
              key={index} 
              className="p-5 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              <div className="inline-block bg-black text-white px-2 py-1 mb-3 text-xs font-black uppercase italic">
                Topic {index + 1}
              </div>
              <h3 className="font-black text-xl uppercase mb-3 border-b-2 border-yellow-400 pb-1">
                {topic.name}
              </h3>
              <p className="text-sm font-bold leading-relaxed text-gray-800">
                {topic.explanation}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
