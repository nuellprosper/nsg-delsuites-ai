interface AITutorProps {
  topics: string[];
  quiz: any[];
}

export const AITutor = ({ topics, quiz }: AITutorProps) => {
  return (
    <div className="space-y-8 mt-4">
      <div className="flex items-center gap-3 border-b-4 border-slate-900 pb-2 mb-6">
        <div className="text-yellow-500"><BookOpen size={32} /></div>
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Lecture Insights</h2>
      </div>

      <div className="space-y-6">
        {topics && topics.map((topic, index) => (
          <div key={index} className="relative group">
            <div className="absolute -inset-1 bg-slate-900 rounded-lg group-hover:bg-red-600 transition-colors duration-300"></div>
            <div className="relative bg-white border-2 border-slate-900 p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="inline-block bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-4 italic">
                Topic {index + 1}
              </div>
              <div className="w-full h-[2px] bg-yellow-400 mb-4 opacity-50"></div>
              {/* This line below is what displays the actual text */}
              <p className="text-slate-800 font-bold leading-relaxed text-sm md:text-base">
                {topic || "No detail provided for this topic."}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Quiz Section could follow here using the 'quiz' prop */}
    </div>
  );
};
