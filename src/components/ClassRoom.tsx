import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, PhoneOff, 
  Users, MessageSquare, Monitor, Share2, 
  Layout, Type, Image as ImageIcon, FileAudio,
  ChevronRight, ArrowLeft, Send, Sparkles, Shield, Plus,
  X, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, doc, onSnapshot, updateDoc, 
  setDoc, serverTimestamp, getDoc, arrayUnion, addDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

interface ClassRoomProps {
  theme: 'dark' | 'light';
  user: any;
  userHandle: string;
  isHost: boolean;
  classId: string;
  onExit: () => void;
  uploadToCloudinary: (file: File | Blob) => Promise<string>;
}

export const ClassRoom: React.FC<ClassRoomProps> = ({ 
  theme, user, userHandle, isHost, classId, onExit, uploadToCloudinary 
}) => {
  const [classData, setClassData] = useState<any>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [boardText, setBoardText] = useState('');
  const [activeTab, setActiveTab] = useState<'video' | 'board'>('video');
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!classId) return;

    const unsubscribe = onSnapshot(doc(db, 'classes', classId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setClassData(data);
        setBoardText(data.boardText || '');
        setParticipants(data.participants || []);
      }
    });

    // Listen for messages
    const q = query(collection(db, 'classes', classId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    return () => {
      unsubscribe();
      unsubscribeMessages();
    };
  }, [classId]);

  useEffect(() => {
    if (isCamOn) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isCamOn]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera access failed:", err);
      setIsCamOn(false);
    }
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleBoardChange = async (newText: string) => {
    if (!isHost) return;
    setBoardText(newText);
    try {
      await updateDoc(doc(db, 'classes', classId), {
        boardText: newText,
        lastUpdate: serverTimestamp()
      });
    } catch (err) {
      console.error("Board sync failed:", err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !classId) return;
    const text = chatInput;
    setChatInput('');
    try {
      await addDoc(collection(db, 'classes', classId, 'messages'), {
        sender: userHandle,
        text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Message failed", err);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      const url = await uploadToCloudinary(file);
      const isAudio = file.type.startsWith('audio');
      await updateDoc(doc(db, 'classes', classId), {
        media: arrayUnion({
          url,
          type: isAudio ? 'audio' : 'image',
          sender: userHandle,
          timestamp: Date.now()
        })
      });
    } catch (err) {
      console.error("Media upload failed:", err);
    }
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <div className="p-4 bg-[#0A0F1C]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
            <Video size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight">{classData?.name || 'Class Session'}</h2>
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{classId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <Users size={14} className="text-[#DC2626]" />
            <span className="text-[10px] font-black">{participants.length}</span>
          </div>
          <button 
            onClick={onExit}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-600/20 transition-all uppercase"
          >
            <PhoneOff size={14} /> End
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative">
        {/* Viewport (Video or Board) */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          {activeTab === 'video' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Local Participant */}
              <div className="bg-slate-900 rounded-[2rem] border border-white/10 overflow-hidden relative aspect-video flex items-center justify-center">
                {isCamOn ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-[#DC2626]/10 rounded-full flex items-center justify-center">
                      <User size={40} className="text-[#DC2626]" />
                    </div>
                    <span className="text-xs font-black uppercase text-white/40">{userHandle} (You)</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[10px] font-bold uppercase">{userHandle}</span>
                  {!isMicOn && <MicOff size={10} className="text-red-500" />}
                </div>
              </div>

              {/* Guest/Participants Rendering would go here */}
              <div className="bg-slate-900 rounded-[2rem] border border-white/5 aspect-video flex items-center justify-center opacity-40">
                <div className="text-center space-y-2">
                  <Users size={32} className="mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Waiting for participants...</p>
                </div>
              </div>
            </div>
          ) : (
            /* Classboard */
            <div className={`flex-1 flex flex-col p-8 rounded-[3rem] ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white'} border border-white/5 shadow-2xl relative`}>
              <div className="absolute top-8 left-8 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#DC2626]/10 flex items-center justify-center">
                  <Layout size={18} className="text-[#DC2626]" />
                </div>
                <span className="text-xs font-black uppercase tracking-tighter">Live Classboard</span>
              </div>
              
              <textarea 
                value={boardText}
                onChange={(e) => handleBoardChange(e.target.value)}
                readOnly={!isHost}
                placeholder={isHost ? "Type instructions for the class here..." : "Host is updating the board..."}
                className="flex-1 mt-12 bg-transparent border-none outline-none text-xl sm:text-3xl font-bold leading-relaxed resize-none text-white/80 placeholder:text-white/10"
              />

              {/* Media Strip */}
              <div className="flex gap-4 overflow-x-auto no-scrollbar pt-4">
                {classData?.media?.map((m: any, idx: number) => (
                  <div key={idx} className="flex-shrink-0 w-32 h-32 rounded-2xl border border-white/10 bg-white/5 overflow-hidden group relative">
                    {m.type === 'image' ? (
                      <img src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <FileAudio size={24} className="text-[#DC2626]" />
                        <span className="text-[8px] font-black uppercase">Audio File</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-2">
                       <span className="text-[8px] font-black uppercase text-center">{m.sender}</span>
                    </div>
                  </div>
                ))}
                {isHost && (
                  <label className="flex-shrink-0 w-32 h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-[#DC2626]/50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer">
                    <Plus size={24} className="text-white/20" />
                    <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter text-center">Add Image/Audio</span>
                    <input type="file" className="hidden" accept="image/*,audio/*" onChange={handleMediaUpload} />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel (Chat Overlay) */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute sm:relative top-0 right-0 bottom-0 w-full sm:w-80 bg-[#0A0F1C] border-l border-white/5 flex flex-col shadow-2xl z-30"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#DC2626]" />
                  <span className="text-xs font-black uppercase tracking-tighter text-white">Class Chat</span>
                </div>
                <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.sender === userHandle ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-black uppercase text-white/20 mb-1">@{m.sender}</span>
                    <div className={`p-3 rounded-2xl text-xs max-w-[90%] ${m.sender === userHandle ? 'bg-[#DC2626] text-white rounded-tr-none' : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-[8px] text-white/20 text-center uppercase tracking-widest mt-20">Chat session started. No messages yet.</p>
                )}
              </div>
              <div className="p-4 border-t border-white/5 flex gap-2">
                <input 
                  placeholder="Send to everyone..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-[#DC2626]/50"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button onClick={handleSendMessage} className="p-2 bg-[#DC2626] text-white rounded-xl"><Send size={16} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Bar */}
      <div className="p-6 bg-black flex items-center justify-center gap-4 sm:gap-8 z-20">
        <div className="flex items-center gap-2 sm:gap-4 bg-white/5 p-2 px-6 rounded-full border border-white/5 backdrop-blur-xl">
           <button 
             onClick={() => setIsMicOn(!isMicOn)}
             className={`p-3 rounded-2xl transition-all ${isMicOn ? 'bg-white/5 text-white/60' : 'bg-red-600 text-white shadow-lg shadow-red-600/20'}`}
           >
             {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
           </button>
           <button 
             onClick={() => setIsCamOn(!isCamOn)}
             className={`p-3 rounded-2xl transition-all ${isCamOn ? 'bg-white/5 text-white/60' : 'bg-red-600 text-white shadow-lg shadow-red-600/20'}`}
           >
             {isCamOn ? <Video size={22} /> : <VideoOff size={22} />}
           </button>
           
           <div className="w-px h-6 bg-white/10 mx-2" />

           <button 
             onClick={() => setActiveTab('video')}
             className={`p-3 rounded-2xl transition-all ${activeTab === 'video' ? 'text-[#DC2626] bg-[#DC2626]/10' : 'text-white/40'}`}
           >
             <Monitor size={22} />
           </button>
           <button 
             onClick={() => setActiveTab('board')}
             className={`p-3 rounded-2xl transition-all ${activeTab === 'board' ? 'text-[#DC2626] bg-[#DC2626]/10' : 'text-white/40'}`}
           >
             <Layout size={22} />
           </button>
           
           <button 
             onClick={() => setShowChat(!showChat)}
             className={`p-3 rounded-2xl transition-all ${showChat ? 'text-[#DC2626] bg-[#DC2626]/10' : 'text-white/40'}`}
           >
             <MessageSquare size={22} />
           </button>
        </div>
        
        <button className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all">
           <Share2 size={16} /> Invite
        </button>
      </div>

      {/* Floating Status */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/5 z-10">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-60">Session Fully Secured | DELSU NODE 01</span>
      </div>
    </div>
  );
};
