import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Box, 
  Layers, 
  Maximize2, 
  Download, 
  RefreshCcw, 
  Camera, 
  X,
  Info,
  Maximize,
  Grid3X3,
  Zap,
  Target,
  Ruler,
  FileCode
} from 'lucide-react';

interface TDLine {
  start: [number, number];
  end: [number, number];
  label?: string;
  type?: 'solid' | 'dashed' | 'dimension';
}

interface TD2DDrawing {
  perspective: string;
  lines: TDLine[];
  dimensions?: { width: number; height: number };
}

const TD2DRenderer = ({ drawing, unit, theme }: { drawing: TD2DDrawing, unit: string, theme: string }) => {
  const viewBox = drawing.dimensions ? `0 0 ${drawing.dimensions.width} ${drawing.dimensions.height}` : "0 0 1000 1000";
  
  return (
    <div className={`w-full h-full flex items-center justify-center p-8 ${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'}`}>
      <div className="relative w-full h-full max-w-4xl aspect-square border-4 border-black/10 bg-white shadow-2xl overflow-hidden rounded-sm">
        <svg 
          viewBox={viewBox} 
          className="w-full h-full"
          style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.1))' }}
        >
          {/* Background Grid for 2D */}
          <defs>
            <pattern id="grid2d" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid2d)" />

          {drawing.lines.map((line, i) => {
            const isDimension = line.type === 'dimension';
            const isDashed = line.type === 'dashed';
            
            return (
              <g key={i}>
                <line 
                  x1={line.start[0]} 
                  y1={line.start[1]} 
                  x2={line.end[0]} 
                  y2={line.end[1]} 
                  stroke={isDimension ? "#DC2626" : "black"} 
                  strokeWidth={isDimension ? 1 : 2}
                  strokeDasharray={isDashed ? "5,5" : "none"}
                />
                
                {line.label && (
                  <text
                    x={(line.start[0] + line.end[0]) / 2}
                    y={(line.start[1] + line.end[1]) / 2 - 10}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill={isDimension ? "#DC2626" : "black"}
                    className="font-mono"
                  >
                    {line.label}{line.label.includes(unit) ? '' : unit}
                  </text>
                )}
                
                {isDimension && (
                  <>
                    <circle cx={line.start[0]} cy={line.start[1]} r="2" fill="#DC2626" />
                    <circle cx={line.end[0]} cy={line.end[1]} r="2" fill="#DC2626" />
                  </>
                )}
              </g>
            );
          })}
          
          {/* Perspective Label */}
          <text x="20" y="40" fontSize="20" fontWeight="900" className="uppercase tracking-[0.2em] font-sans opacity-20">
            {drawing.perspective} VIEW
          </text>
        </svg>
      </div>
    </div>
  );
};

export const TDTool = ({ theme, getAiInstance, onClose }: any) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [drawing2D, setDrawing2D] = useState<TD2DDrawing | null>(null);
  const [activePerspective, setActivePerspective] = useState('Front');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [unit, setUnit] = useState('mm');
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const units = ['mm', 'cm', 'dm', 'm', 'inch'];
  const perspectives = ['Front', 'Top', 'Right', 'Left', 'Back', 'Isometric'];

  const setPerspective = (p: string) => {
    setActivePerspective(p);
  };

  const toggleFullscreen = () => {
    if (!viewportRef.current) return;
    if (!document.fullscreenElement) {
      viewportRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const exportBlueprint = () => {
    if (!drawing2D) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drawing2D, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `technical_drawing_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const generateDrawing = async () => {
    if (!prompt.trim() && !selectedFile) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const ai = getAiInstance();
      let promptParts: any[] = [];
      
      const systemPrompt = `
        You are a Technical Drawing AI. Analyze the user's input/image and generate a 2D Perspective Drawing JSON.
        The user is requesting the ${activePerspective} View.
        
        OUTPUT SPECIFICATION:
        Return ONLY a JSON object: { perspective: "${activePerspective}", lines: [{ start: [x,y], end: [x,y], label: "100", type: "solid"|"dashed"|"dimension" }], dimensions: { width: 1000, height: 1000 } }
        
        RULES:
        1. COORDINATES: Values between 0 and 1000 (0,0 is top-left).
        2. QUALITY: Create a detailed drawing with at least 15-30 lines representing the geometric structure accurately.
        3. MEASUREMENTS: Include at least 5 dimension lines (type: "dimension") with clear labels and units.
        4. STYLE: Use "dashed" for hidden edges.
        5. BLACK ON WHITE: This will be rendered as black lines on a white background. No symbols like $ or \( \). Plain text labels.
        6. PERSPECTIVE SHIFT: If an image is provided, look at its lines/measurements and carefully project them to the ${activePerspective} view.
      `;

      if (selectedFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
          const result = reader.result as string;
          if (result) {
            resolve(result.split(',')[1] || "");
          } else {
            resolve("");
          }
        };
          reader.readAsDataURL(selectedFile);
        });
        promptParts.push({
          inlineData: {
            data: base64,
            mimeType: selectedFile.type
          }
        });
        promptParts.push({ text: `Study image carefully. Goal: Generate ${activePerspective} 2D view. User intent: ${prompt}` });
      } else {
        promptParts.push({ text: `Create ${activePerspective} 2D view of: ${prompt}` });
      }

      promptParts.unshift({ text: systemPrompt });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: { parts: promptParts },
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const responseText = response.text || "";
      const cleanedJson = responseText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanedJson);
      
      if (parsedData.lines) {
        setDrawing2D(parsedData);
      } else {
        throw new Error("Invalid format received from AI.");
      }

      if (window.innerWidth < 1024) setIsSidebarVisible(false);
    } catch (err: any) {
      console.error("TD Generation Error:", err);
      setError("Failed to generate detailed drawing. Please ensure the prompt or image is clear and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[700] flex flex-col ${theme === 'dark' ? 'bg-[#050810]' : 'bg-slate-50'} overscroll-none h-full w-full overflow-hidden`}>
      {/* HEADER */}
      <div className={`px-4 h-12 sm:h-14 border-b ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-slate-200 bg-white'} backdrop-blur-2xl flex items-center justify-between shrink-0 z-[710]`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-[#DC2626] to-[#991B1B] rounded-lg flex items-center justify-center shadow-lg">
            <Ruler size={14} className="text-white" />
          </div>
          <div>
            <h2 className={`text-[10px] sm:text-xs font-black tracking-tighter uppercase leading-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              ACADEMIC <span className="text-[#DC2626]">2D ENGINE</span> <span className="opacity-40 font-bold ml-2">V3.5</span>
            </h2>
          </div>
        </div>
        
        <div className="hidden sm:flex bg-white/5 p-1 rounded-xl border border-white/10 mx-4 overflow-x-auto no-scrollbar">
           {perspectives.map(p => (
             <button 
               key={p}
               onClick={() => setPerspective(p)}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all whitespace-nowrap ${activePerspective === p ? 'bg-[#DC2626] text-white' : 'text-white/40 hover:text-white'}`}
             >
               {p}
             </button>
           ))}
        </div>

        <div className="flex gap-2">
           <button 
             onClick={() => setIsSidebarVisible(!isSidebarVisible)} 
             className={`p-2 rounded-lg transition-all border border-white/10 ${isSidebarVisible ? 'bg-[#DC2626] text-white' : 'bg-white/5 text-white/40'}`}
           >
             <Layers size={14} />
           </button>
           <button onClick={onClose} className="p-2 bg-white/5 hover:bg-[#DC2626] text-white rounded-lg transition-all border border-white/10 active:scale-90">
             <X size={14} />
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* PERSPECTIVE SELECTOR (FLOATING) */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[705] flex bg-black/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto max-w-[90vw] no-scrollbar">
           {perspectives.map(p => (
             <button 
               key={p}
               onClick={() => setPerspective(p)}
               className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activePerspective === p ? 'bg-[#DC2626] text-white' : 'text-white/30 hover:text-white'}`}
             >
               {p}
             </button>
           ))}
        </div>

        {/* VIEWPORT */}
        <div className="flex-1 relative bg-[#020408]">
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-30 pointer-events-none">
             <div className="bg-[#DC2626] text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-2">
                <Target size={10} className="animate-ping" /> 2D ENGINE ACTIVE
             </div>
             <div className="bg-white/5 text-white/40 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border border-white/5">
                Target View: {activePerspective}
             </div>
          </div>

          {!drawing2D && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 z-10 p-6 pointer-events-none">
              <div className="w-16 h-16 bg-[#DC2626]/10 rounded-full flex items-center justify-center border-2 border-[#DC2626]/20">
                <FileCode size={30} className="text-[#DC2626]" />
              </div>
              <h3 className="text-white font-black text-sm uppercase tracking-tighter italic">2D Engine Ready</h3>
              <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest max-w-[200px]">Upload a blueprint or specify a drawing task. Choose a view and click Render.</p>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4 z-[730] bg-[#020408]/90 backdrop-blur-xl p-6 pointer-events-none">
              <div className="relative w-24 h-24">
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="absolute inset-0 border-t-2 border-r-2 border-[#DC2626] rounded-full" />
                 <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 6, ease: "linear" }} className="absolute inset-4 border-b-2 border-l-2 border-[#DC2626]/50 rounded-full" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Zap size={24} className="text-[#DC2626] animate-pulse" />
                 </div>
              </div>
              <div className="space-y-1">
                <p className="text-[#DC2626] font-black text-[12px] uppercase tracking-[0.4em]">Projecting {activePerspective}</p>
                <p className="text-white/20 font-bold text-[8px] uppercase tracking-widest leading-tight">Analyzing geometric constraints & line data</p>
              </div>
            </div>
          )}

          <div ref={viewportRef} className="w-full h-full">
            {drawing2D && <TD2DRenderer drawing={drawing2D} unit={unit} theme={theme} />}
          </div>

          {/* VIEWPORT CONTROLS */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-30">
            <div className="bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/10 flex gap-1 items-center">
               <button onClick={() => setShowGrid(!showGrid)} className={`p-2.5 hover:bg-[#DC2626] rounded-lg transition-all ${showGrid ? 'text-white' : 'text-white/20'}`} title="Grid"><Grid3X3 size={14} /></button>
               <div className="w-px h-4 bg-white/10 mx-1" />
               <button onClick={toggleFullscreen} className="p-2.5 hover:bg-[#DC2626] text-white rounded-lg transition-all"><Maximize size={14} /></button>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <AnimatePresence>
          {isSidebarVisible && (
            <motion.div 
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              className={`w-full lg:w-[320px] flex flex-col absolute inset-y-0 right-0 lg:relative ${theme === 'dark' ? 'bg-[#0A0F1C] border-l border-white/5' : 'bg-white border-l border-slate-200 shadow-2xl'} z-[720] lg:z-10`}
            >
               <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="flex sm:hidden gap-1.5 pb-2 overflow-x-auto no-scrollbar">
                     {perspectives.map(p => (
                       <button 
                         key={p}
                         onClick={() => setPerspective(p)}
                         className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all whitespace-nowrap ${activePerspective === p ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white/5 text-white/40 border-white/10'}`}
                       >
                         {p}
                       </button>
                     ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-[#DC2626] uppercase tracking-[0.2em]">Study Task / Context</p>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Draw the Top View of this object showing its internal diameter..."
                      className={`w-full h-24 p-4 rounded-2xl text-[11px] outline-none transition-all placeholder:opacity-20 ${theme === 'dark' ? 'bg-white/5 text-white border-white/10 focus:border-[#DC2626]' : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-[#DC2626]'}`}
                    />
                  </div>

                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-[#DC2626] uppercase tracking-[0.2em]">Engineering Unit</p>
                     <div className="grid grid-cols-5 gap-1">
                        {units.map(u => (
                          <button 
                            key={u}
                            onClick={() => setUnit(u)}
                            className={`py-2 rounded-lg text-[8px] font-black uppercase transition-all border ${unit === u ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white/5 text-white/40 border-white/10'}`}
                          >
                            {u}
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-[#DC2626] uppercase tracking-[0.2em]">Blueprint Upload</p>
                     <div 
                       onClick={() => fileInputRef.current?.click()}
                       className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group relative overflow-hidden ${previewUrl ? 'border-[#DC2626]' : 'border-white/10 hover:border-[#DC2626]/50'}`}
                     >
                        {previewUrl ? (
                          <>
                            <img src={previewUrl} className="w-full h-full object-cover" alt="Ref" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <RefreshCcw size={18} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <Camera size={20} className="text-[#DC2626] opacity-40 group-hover:scale-110 transition-all" />
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Upload Drawing</p>
                          </>
                        )}
                     </div>
                     <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                       <Info size={14} className="text-red-500 shrink-0" />
                       <p className="text-[9px] font-bold text-red-500 uppercase leading-tight">{error}</p>
                    </div>
                  )}
               </div>

               <div className={`p-5 border-t ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-slate-200 bg-slate-50'} space-y-3`}>
                  <button 
                    onClick={() => generateDrawing()}
                    disabled={isGenerating || (!prompt.trim() && !selectedFile)}
                    className="w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-white shadow-xl shadow-[#DC2626]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                  >
                    {isGenerating ? <RefreshCcw className="animate-spin" size={16} /> : <Zap size={16} />}
                    RENDER {activePerspective.toUpperCase()} VIEW
                  </button>

                  <div className="flex gap-2">
                     <button 
                       onClick={exportBlueprint}
                       disabled={!drawing2D}
                       className="flex-1 h-12 bg-white/5 hover:bg-[#DC2626] hover:text-white text-white/40 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-20"
                     >
                       <Download size={14} /> EXPORT
                     </button>
                     <button 
                        onClick={() => { setDrawing2D(null); setPrompt(''); setPreviewUrl(null); setSelectedFile(null); }}
                        className="flex-1 h-12 bg-white/5 hover:bg-slate-500 text-white/40 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2"
                     >
                       <RefreshCcw size={14} /> CLEAR
                     </button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
