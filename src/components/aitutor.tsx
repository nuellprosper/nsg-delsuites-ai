interface AITutorProps {
  topics: string[];
  quiz: any[];
}

export const AITutor = ({ topics }: AITutorProps) => {
  return (
    <div className="space-y-4">
      {topics && topics.map((topic, index) => (
        <div key={index} className="bg-white border-2 border-slate-100 p-5 rounded-2xl shadow-sm">
          <div className="text-[10px] font-black text-red-600 uppercase mb-2">Key Topic {index + 1}</div>
          <p className="text-slate-700 font-bold leading-relaxed">{topic}</p>
        </div>
      ))}
      {(!topics || topics.length === 0) && (
        <p className="text-slate-400 text-center font-bold italic py-10">No lecture summary available.</p>
      )}
    </div>
  );
};
