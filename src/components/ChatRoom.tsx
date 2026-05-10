import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Users, Phone, Video, MoreVertical, 
  Search, Plus, Send, Image as ImageIcon, Mic, 
  Check, CheckCheck, Lock, ArrowLeft, AtSign,
  Smile, Paperclip, UserPlus, RefreshCw, StopCircle,
  Copy, X, Brain, Info, Calendar, MapPin, User, GraduationCap, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, 
  getDocs, getDoc, setDoc, arrayUnion, arrayRemove,
  limit, limitToLast
} from 'firebase/firestore';
import { db, auth } from '../firebase';

interface Message {
  id: string;
  senderId: string;
  senderHandle: string;
  senderName?: string;
  text: string;
  timestamp: any;
  type: 'text' | 'image' | 'audio';
  replyTo?: string;
  encrypted?: boolean;
  mediaUrl?: string;
  seenBy?: string[];
}

interface Chat {
  id: string;
  name: string;
  type: 'direct' | 'group';
  members: string[]; // Handles/UIDs
  photoURL?: string;
  lastMessage?: string;
  lastMessageSender?: string;
  updatedAt: any;
  unreadCount?: number;
  isOmni?: boolean;
}

interface ChatRoomProps {
  theme: 'dark' | 'light';
  user: any;
  userHandle: string;
  onTagOmni: (text: string, replyToId: string) => void;
  uploadToCloudinary: (file: File | Blob) => Promise<string>;
  setUserNotification: (msg: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ 
  theme, user, userHandle, onTagOmni, uploadToCloudinary, setUserNotification
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'calls'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingChat, setIsAddingChat] = useState(false);
  const [newChatHandle, setNewChatHandle] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [recipientStatus, setRecipientStatus] = useState<string>('offline');
  const [activeCall, setActiveCall] = useState<{ type: 'voice' | 'video', chatName: string } | null>(null);
  const [callLogs, setCallLogs] = useState<{ id: string, name: string, type: 'voice' | 'video', timestamp: any, direction: 'incoming' | 'outgoing' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [longPressedMessage, setLongPressedMessage] = useState<string | null>(null);
  const pressTimerRef = useRef<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const emojis = ['👍', '⭐', '📚', '🔥', '🎓', '📝', '💡', '🚀', '🧠', '✅', '❤️', '🙏', '💯', '👏'];

  useEffect(() => {
    if (!user) return;

    // Ensure Omni AI constant contact
    const syncOmni = async () => {
      if (!user) return;

      const omniId = `omni_${user.uid}`;
      const omniRef = doc(db, 'chats', omniId);
      try {
        const snap = await getDoc(omniRef);
        if (!snap.exists()) {
          const members = [user.uid, 'Omni AI'];
          if (userHandle) members.push(userHandle);
          
          await setDoc(omniRef, {
            name: 'Omni AI Tutor',
            type: 'direct',
            isOmni: true,
            photoURL: 'https://images.unsplash.com/photo-1675557009875-436f09789900?q=80&w=200&auto=format&fit=crop',
            ownerId: user.uid,
            members: members,
            updatedAt: serverTimestamp(),
            lastMessage: 'Hello! I am Omni, your AI study buddy.'
          });
        }
      } catch (err) {
        console.error("Omni Sync Error:", err);
      }
    };
    syncOmni();
  }, [user, userHandle]);

  useEffect(() => {
    if (!user) return;
    const callsQ = query(collection(db, 'users', user.uid, 'callLogs'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(callsQ, (snapshot) => {
      setCallLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any);
    }, (err) => console.error("Call logs sync error:", err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const queryMembers = [user.uid];
    if (userHandle) queryMembers.push(userHandle);

    // Listen for chats where user is a member
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains-any', queryMembers),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        // Auto-migration: Ensure current user UID is in members if their handle is there
        if (user && !data.members.includes(user.uid) && data.members.includes(userHandle)) {
          updateDoc(docSnap.ref, {
            members: arrayUnion(user.uid)
          }).catch(err => console.error("Auto-migration failed", err));
        }

        return {
          id: docSnap.id,
          ...data
        };
      }) as Chat[];
      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user, userHandle]);

  useEffect(() => {
    if (!selectedChat || selectedChat.isOmni) {
      setRecipientStatus('offline');
      return;
    }
    
    const fetchRecipientStatus = async () => {
      const otherId = selectedChat.members.find(m => m !== user.uid && m !== userHandle);
      if (!otherId) return;

      const userDocRef = doc(db, 'users', otherId);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate() : null;
          const isOnline = lastSeen && (Date.now() - lastSeen.getTime() < 300000); // 5 minutes
          setRecipientStatus(isOnline ? 'Online' : 'Offline');
        }
      });
      return unsubscribe;
    };

    let unsub: any;
    fetchRecipientStatus().then(u => unsub = u);
    return () => unsub && unsub();
  }, [selectedChat, user.uid, userHandle]);

  useEffect(() => {
    if (!selectedChat) return;
    setMessages([]); // Clear messages when switching chats
    lastMessageIdRef.current = null; // Reset for new chat load

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('timestamp', 'asc'),
      limitToLast(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Message[];

      const lastMsg = msgList[msgList.length - 1];
      const isNewMessage = lastMsg && lastMsg.id !== lastMessageIdRef.current;
      
      setMessages(msgList);

      if (isNewMessage) {
        const wasEmpty = !lastMessageIdRef.current;
        lastMessageIdRef.current = lastMsg.id;
        
        // If it's my own message or it's the first load, force scroll
        if (lastMsg.senderId === user.uid || wasEmpty) {
          setTimeout(() => scrollToBottom(true), 100);
        } else {
          // Only scroll for others' messages if we're already at the bottom
          setTimeout(() => scrollToBottom(), 100);
        }
      }

      // Mark messages as seen
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.senderId !== user.uid && (!data.seenBy || !data.seenBy.includes(user.uid))) {
          updateDoc(docSnap.ref, {
            seenBy: arrayUnion(user.uid)
          }).catch(() => {});
        }
      });
    }, (err) => {
      console.error("Messages Sync Error:", err);
      if (err.message.includes('quota')) {
        setUserNotification("Quota exceeded. Some messages may not be loaded.");
      }
    });

    return () => unsubscribe();
  }, [selectedChat]);

  const scrollToBottom = (force = false) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;

    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedChat) return;

    const text = inputText;
    const senderName = user.displayName || userHandle;
    setInputText('');

    try {
      const msgData: any = {
        senderId: user.uid,
        senderHandle: userHandle,
        senderName: senderName,
        text: text,
        timestamp: serverTimestamp(),
        type: 'text',
        encrypted: true,
        seenBy: [user.uid]
      };

      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), msgData);
      
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastMessageSender: senderName,
        updatedAt: serverTimestamp()
      });

      // Trigger Omni AI if it's the Omni chat or user tagged @omni
      if (selectedChat.id.startsWith('omni_') || text.toLowerCase().includes('@omni')) {
        onTagOmni(text, selectedChat.id);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const createChat = async () => {
    if (!newChatHandle.trim()) return;
    
    // Check if user exists
    const userQ = query(collection(db, 'users'), where('username', '==', newChatHandle.trim()));
    const userSnap = await getDocs(userQ);
    
    if (userSnap.empty) {
      setUserNotification("User handle not found. Please check and try again.");
      return;
    }

    const targetUser = userSnap.docs[0].data();
    
    // Create new direct chat
    const chatData = {
      name: targetUser.fullName || targetUser.displayName || newChatHandle,
      type: 'direct',
      members: [user.uid, userHandle, targetUser.uid, newChatHandle.trim()],
      photoURL: targetUser.photoURL || null,
      updatedAt: serverTimestamp(),
      lastMessage: 'Chat started'
    };

    const docRef = await addDoc(collection(db, 'chats'), chatData);
    setIsAddingChat(false);
    setSelectedChat({ id: docRef.id, ...chatData } as Chat);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;

    const chatData = {
      name: groupName.trim(),
      type: 'group',
      members: [user.uid, userHandle],
      updatedAt: serverTimestamp(),
      lastMessage: 'Group created'
    };

    const docRef = await addDoc(collection(db, 'chats'), chatData);
    setIsCreatingGroup(false);
    setSelectedChat({ id: docRef.id, ...chatData } as Chat);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedChat) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'text';
      
      const msgData: any = {
        senderId: user.uid,
        senderHandle: userHandle,
        text: type === 'image' ? 'Sent an image' : type === 'audio' ? 'Sent audio' : file.name,
        timestamp: serverTimestamp(),
        type: type,
        mediaUrl: url,
        encrypted: true
      };

      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), msgData);
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: `📎 ${type.toUpperCase()}`,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setIsUploading(true);
        try {
          const url = await uploadToCloudinary(blob);
          const msgData: any = {
            senderId: user.uid,
            senderHandle: userHandle,
            senderName: user.displayName || userHandle,
            text: 'Voice Note',
            timestamp: serverTimestamp(),
            type: 'audio',
            mediaUrl: url,
            encrypted: true
          };
          await addDoc(collection(db, 'chats', selectedChat!.id, 'messages'), msgData);
          await updateDoc(doc(db, 'chats', selectedChat!.id), {
            lastMessage: '🎤 Voice Note',
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Audio upload failed", err);
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("Recording error", err);
      setUserNotification("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startCall = async (type: 'voice' | 'video') => {
    if (!selectedChat) return;
    const callData = {
      name: selectedChat.name,
      type,
      timestamp: serverTimestamp(),
      direction: 'outgoing'
    };
    await addDoc(collection(db, 'users', user.uid, 'callLogs'), callData);
    setActiveCall({ type, chatName: selectedChat.name });
  };

  const handleViewUser = async () => {
    if (!selectedChat) return;
    setShowMoreMenu(false);
    
    if (selectedChat.id.startsWith('omni_')) {
        setViewingUser({
            displayName: "Omni AI Tutor",
            fullName: "NSG Artificial Intelligence",
            about: "Your professional academic assistant. I'm here to help you solve problems, write essays, and prepare for exams.",
            photoURL: null,
            role: "AI",
            isOmni: true
        });
        return;
    }

    try {
        const members = selectedChat.members || [];
        const otherMemberInfo = members.find((m: string) => m !== user.uid && m !== userHandle);
        
        if (otherMemberInfo) {
            const userRef = doc(db, 'users', otherMemberInfo);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                setViewingUser(userSnap.data());
            } else {
                const q = query(collection(db, 'users'), where('username', '==', otherMemberInfo));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setViewingUser(snap.docs[0].data());
                } else {
                    setUserNotification("Could not find user details.");
                }
            }
        }
    } catch (err) {
        console.error("Error viewing user:", err);
        setUserNotification("Error loading user profile.");
    }
  };

  const handleLongPressStart = (id: string) => {
    pressTimerRef.current = setTimeout(() => {
      setLongPressedMessage(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleLongPressEnd = () => {
    clearTimeout(pressTimerRef.current);
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-slate-50'}`}>
      {!selectedChat ? (
        <>
          {/* Header Removed to flush to top */}
          <div className="flex px-4 gap-2 pt-4 mb-2">
            {[
              { id: 'chats', icon: MessageSquare, label: 'Chats' },
              { id: 'groups', icon: Users, label: 'Groups' },
              { id: 'calls', icon: Phone, label: 'Calls' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-[6px] rounded-xl border transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white/10 border-[#DC2626] text-white' 
                  : 'bg-white/5 border-transparent text-white/40'
                }`}
              >
                <tab.icon size={9} />
                <span className="text-[7px] font-black uppercase tracking-[0.15em]">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-20">
            {activeTab === 'calls' ? (
              <div className="space-y-2">
                {callLogs.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Phone size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No call history</p>
                  </div>
                ) : (
                  callLogs.map(log => (
                    <div key={log.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                           {log.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                         </div>
                         <div>
                            <p className="text-xs font-black text-white uppercase tracking-tight">{log.name}</p>
                            <div className="flex items-center gap-1 opacity-40">
                               <ArrowLeft size={10} className={log.direction === 'outgoing' ? 'rotate-[135deg] text-emerald-400' : 'rotate-[-45deg] text-red-400'} />
                               <p className="text-[8px] font-bold uppercase tracking-widest">{log.direction} | {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Recent'}</p>
                            </div>
                         </div>
                       </div>
                       <motion.button 
                         whileTap={{ scale: 0.9 }}
                         onClick={() => startCall(log.type)} 
                         className="p-[10px] bg-white/5 rounded-xl text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-all shadow-lg active:shadow-none"
                       >
                          {log.type === 'video' ? <Video size={13} /> : <Phone size={13} />}
                       </motion.button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              chats.filter(c => 
                (activeTab === 'groups' ? c.type === 'group' : c.type === 'direct') &&
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(chat => (
                <motion.div 
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-all group"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#DC2626] to-red-900 flex items-center justify-center text-white font-black text-base overflow-hidden border border-white/10">
                    {chat.id.startsWith('omni_') ? (
                      <Brain size={22} className="text-white" />
                    ) : chat.photoURL ? (
                      <img src={chat.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      chat.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="text-xs font-bold text-white truncate">{chat.name}</h3>
                      <span className="text-[9px] text-white/20">
                        {chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 truncate flex items-center gap-1">
                      {chat.lastMessage}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            {chats.length === 0 && activeTab !== 'calls' && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={32} className="text-white/20" />
                </div>
                <p className="text-white/40 text-sm">No chats yet.</p>
                <button onClick={() => setIsAddingChat(true)} className="mt-4 text-[#DC2626] text-xs font-black uppercase underline">Start new conversation</button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Individual Chat View */
        <div className="flex flex-col h-full overflow-visible">
          <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-black/20 backdrop-blur-md z-20">
            <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
              <ArrowLeft size={20} className="text-white/60" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-black overflow-hidden border border-white/10">
              {selectedChat.id.startsWith('omni_') ? (
                <Brain size={20} className="text-white" />
              ) : selectedChat.photoURL ? (
                <img src={selectedChat.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                selectedChat.name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-white uppercase tracking-tight truncate">{selectedChat.name}</h3>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${recipientStatus === 'Online' ? 'text-green-500' : 'text-white/20'}`}>
                {selectedChat.isOmni ? 'AI Assistant' : recipientStatus}
              </p>
            </div>
            <div className="flex gap-2 relative">
              <motion.button 
                whileTap={{ scale: 0.85 }}
                onClick={() => startCall('voice')}
                className="p-1.5 text-white/40 hover:text-white"
              >
                <Phone size={17} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.85 }}
                onClick={() => startCall('video')}
                className="p-1.5 text-white/40 hover:text-white"
              >
                <Video size={17} />
              </motion.button>
              <div className="relative">
                <button 
                   onClick={() => setShowMoreMenu(!showMoreMenu)}
                   className="p-1.5 text-white/40 hover:text-white"
                >
                  <MoreVertical size={17} />
                </button>
                <AnimatePresence>
                  {showMoreMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                    >
                      {[
                        { label: 'View User', icon: User, action: handleViewUser },
                        { label: 'Clear Chat', icon: RefreshCw },
                        { label: 'Search', icon: Search },
                        { label: 'Block', icon: Lock, color: 'text-red-500' }
                      ].map((item, i) => (
                        <button 
                          key={i}
                          onClick={() => {
                            if (item.action) {
                              item.action();
                            } else {
                              setUserNotification(`${item.label} is coming soon.`);
                              setShowMoreMenu(false);
                            }
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-all text-left text-xs font-black uppercase tracking-widest ${item.color || 'text-white/60'}`}
                        >
                          <item.icon size={14} />
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 pb-10"
          >
            {messages.map((msg, idx) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'} relative scroll-mt-2`}
                onTouchStart={() => handleLongPressStart(msg.id)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(msg.id)}
                onMouseUp={handleLongPressEnd}
              >
                {longPressedMessage === msg.id && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute z-50 bg-slate-900 border border-white/10 p-2 rounded-2xl shadow-2xl flex gap-2 -top-12 left-1/2 -translate-x-1/2"
                  >
                    <button onClick={() => { setInputText(`@quote [${msg.text}] `); setLongPressedMessage(null); }} className="p-2 hover:bg-white/10 rounded-xl text-white/60"><AtSign size={14}/></button>
                    <button onClick={() => { navigator.clipboard.writeText(msg.text); setLongPressedMessage(null); setUserNotification("Copied!"); }} className="p-2 hover:bg-white/10 rounded-xl text-white/60"><Copy size={14}/></button>
                    <button onClick={() => setLongPressedMessage(null)} className="p-2 hover:bg-white/10 rounded-xl text-red-500"><X size={14}/></button>
                  </motion.div>
                )}
                <div className={`max-w-[80%] space-y-1 ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                  {(selectedChat.type === 'group' || msg.senderId !== user.uid) && (
                    <span className="text-[8px] font-black text-[#DC2626] ml-2 opacity-60 uppercase tracking-widest">
                      {msg.senderName || `@${msg.senderHandle}`}
                    </span>
                  )}
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.senderId === user.uid 
                      ? 'bg-[#DC2626] text-white rounded-tr-none' 
                      : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'
                  }`}>
                    {msg.type === 'image' && msg.mediaUrl ? (
                      <img src={msg.mediaUrl} className="rounded-xl max-w-full h-auto mb-2 shadow-2xl" />
                    ) : msg.type === 'audio' && msg.mediaUrl ? (
                      <audio controls src={msg.mediaUrl} className="w-full h-10 mb-2 filter invert" />
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[8px] text-white/20 uppercase">
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {msg.senderId === user.uid && (
                      msg.seenBy && msg.seenBy.length > 1 ? (
                        <CheckCheck size={10} className="text-blue-400" />
                      ) : (
                        <Check size={10} className="text-white/20" />
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-black/40 border-t border-white/5 relative">
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-full left-4 mb-4 p-4 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl grid grid-cols-7 gap-2 z-[100]"
                >
                  {emojis.map(e => (
                    <button 
                      key={e} 
                      onClick={() => { setInputText(prev => prev + e); setShowEmojiPicker(false); }}
                      className="text-xl hover:scale-125 transition-transform p-2"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 max-w-4xl mx-auto">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-white/40 hover:text-white transition-colors"
              >
                <Smile size={22} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 text-white/40 hover:text-white transition-colors relative"
              >
                {isUploading ? <RefreshCw size={22} className="animate-spin text-emerald-400" /> : <Paperclip size={22} />}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </button>
              <div className="flex-1 relative flex items-center gap-2">
                {isRecording ? (
                  <div className="flex-1 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-2xl px-4 py-3 flex items-center justify-between text-[#DC2626]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest">Recording... {recordingTime}s</span>
                    </div>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#DC2626]/50 transition-all"
                  />
                )}
              </div>
              <button 
                onClick={inputText.trim() ? handleSendMessage : isRecording ? stopRecording : startRecording}
                disabled={isUploading}
                className={`p-3 rounded-2xl shadow-lg transition-all ${
                  inputText.trim() || isRecording
                  ? 'bg-[#DC2626] text-white shadow-[#DC2626]/20' 
                  : 'bg-white/5 text-white/40 hover:text-white'
                }`}
              >
                {inputText.trim() ? <Send size={20} /> : isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
              </button>
            </div>
            <p className="text-[8px] text-center mt-2 text-white/10 flex items-center justify-center gap-1 uppercase tracking-[0.2em]">
              <Lock size={8} /> End-to-end encrypted
            </p>
          </div>
        </div>
      )}

      {/* User Details Overlay (WhatsApp style) */}
      <AnimatePresence>
        {viewingUser && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-0 z-[200] flex flex-col ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-slate-50'}`}
          >
            <div className={`p-4 flex items-center gap-4 ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white shadow-sm'} z-20`}>
              <button 
                onClick={() => setViewingUser(null)} 
                className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/60' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Contact Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Profile Image & Name Section */}
              <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-8 flex flex-col items-center gap-4 mb-4 border-b border-white/5`}>
                <div className="w-40 h-40 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-black text-6xl shadow-2xl border-4 border-white/10 overflow-hidden relative group">
                  {viewingUser.isOmni ? (
                    <Brain size={80} className="text-white" />
                  ) : viewingUser.photoURL ? (
                    <img src={viewingUser.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    viewingUser.displayName?.charAt(0) || 'U'
                  )}
                </div>
                <div className="text-center">
                  <h3 className={`text-2xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{viewingUser.fullName || viewingUser.displayName}</h3>
                  <p className={`text-xs font-bold tracking-[0.2em] uppercase mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>@{viewingUser.username || viewingUser.uid?.slice(0, 8)}</p>
                </div>
              </div>

              {/* Info Section */}
              <div className="space-y-4 px-4 pb-10">
                {/* About Section */}
                <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-2 border border-white/5`}>
                  <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                    <Info size={12} /> About
                  </p>
                  <p className={`text-sm leading-relaxed font-medium ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>
                    {viewingUser.about || "Hey there! I am using NSG."}
                  </p>
                </div>

                {/* Academic Details (if applicable) */}
                {!viewingUser.isOmni && (
                  <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-4 border border-white/5`}>
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                      <GraduationCap size={12} /> Academic Info
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { label: 'University', value: viewingUser.university, icon: MapPin },
                        { label: 'Department', value: viewingUser.department, icon: AtSign },
                        { label: 'Level', value: viewingUser.level, icon: Calendar },
                        { label: 'Faculty', value: viewingUser.faculty, icon: AtSign }
                      ].filter(f => f.value).map((field, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center ${theme === 'dark' ? 'text-white/40' : 'text-slate-300'}`}>
                            <field.icon size={14} />
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">{field.label}</p>
                            <p className={`text-xs font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{field.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Media Section Placeholder */}
                <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-4 border border-white/5 opacity-50`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                      <ImageIcon size={12} /> Media, Links, and Docs
                    </p>
                    <ArrowLeft className={`rotate-180 ${theme === 'dark' ? 'text-white/20' : 'text-slate-200'}`} size={14} />
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3].map(i => <div key={i} className="w-16 h-16 rounded-xl bg-white/5 border border-white/10" />)}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <button className="w-full p-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-500/20">
                    <Check size={16} className="rotate-45" /> Block Contact
                  </button>
                  <button className="w-full p-5 bg-red-600/10 hover:bg-red-600/20 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-600/20">
                    <Phone size={16} className="rotate-90" /> Report User
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {activeCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] bg-slate-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="absolute top-10 left-10 flex items-center gap-2 text-emerald-500 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Secure Line</span>
            </div>

            <div className="relative mb-12">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#DC2626] to-red-900 flex items-center justify-center text-white text-4xl font-black shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                {activeCall.chatName.charAt(0)}
              </div>
              <div className="absolute -inset-4 rounded-full border border-[#DC2626]/20 animate-ping" />
              <div className="absolute -inset-8 rounded-full border border-[#DC2626]/10 animate-pulse" />
            </div>
            
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">{activeCall.chatName}</h2>
            <p className="text-[#DC2626] text-sm font-black uppercase tracking-widest mb-20 animate-pulse shadow-sm">
              {activeCall.type === 'voice' ? 'Connecting Secure Audio...' : 'Initiating Encrypted Video...'}
            </p>

            <div className="flex gap-8">
              <button 
                onClick={() => setActiveCall(null)}
                className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all group"
              >
                <Phone size={32} className="rotate-[135deg] group-hover:animate-bounce" />
              </button>
              <button 
                className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <Mic size={24} />
              </button>
              {activeCall.type === 'video' && (
                <button 
                  className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Video size={24} />
                </button>
              )}
            </div>
            
            <div className="mt-24 grid grid-cols-2 gap-4 w-full max-w-xs">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] text-white/20 uppercase font-black mb-1">Signal Quality</p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="w-[90%] h-full bg-emerald-500" />
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] text-white/20 uppercase font-black mb-1">Encryption</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-full h-1 bg-[#DC2626] rounded-full" />)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isAddingChat && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm space-y-6">
              <h3 className="text-xl font-black text-white uppercase italic">New Direct Chat</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">User Handle</span>
                  <input 
                    autoFocus
                    placeholder="e.g. user_abcde_1234"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-[#DC2626]"
                    value={newChatHandle}
                    onChange={(e) => setNewChatHandle(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsAddingChat(false)} className="flex-1 py-4 text-white/40 font-black uppercase text-xs">Cancel</button>
                  <button onClick={createChat} className="flex-[2] bg-[#DC2626] text-white py-4 rounded-2xl font-black uppercase text-xs">Start Chat</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isCreatingGroup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm space-y-6">
              <h3 className="text-xl font-black text-white uppercase italic">Create Group</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Group Name</span>
                  <input 
                    autoFocus
                    placeholder="e.g. Study Group 101"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-[#DC2626]"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsCreatingGroup(false)} className="flex-1 py-4 text-white/40 font-black uppercase text-xs">Cancel</button>
                  <button onClick={createGroup} className="flex-[2] bg-[#DC2626] text-white py-4 rounded-2xl font-black uppercase text-xs">Create</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
