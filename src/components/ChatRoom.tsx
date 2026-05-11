import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, Users, Phone, Video, MoreVertical, 
  Search, Plus, Send, Image as ImageIcon, Mic, 
  Check, CheckCheck, Lock, ArrowLeft, AtSign, Pin, Eye, Shield,
  Smile, Paperclip, UserPlus, RefreshCw, StopCircle,
  Copy, X, Brain, Info, Calendar, MapPin, User, GraduationCap, Trash2,
  Reply, BellRing, PhoneOff, VideoOff, Volume2, VolumeX, MicOff, GraduationCap as SchoolIcon,
  Play, Pause, Camera, FileText, AlertTriangle, ShieldOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, 
  getDocs, getDoc, setDoc, arrayUnion, arrayRemove,
  limit, limitToLast, deleteDoc
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
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  encrypted?: boolean;
  mediaUrl?: string;
  seenBy?: string[];
  isViewOnce?: boolean;
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
  unreadBy?: string[];
  isPinned?: boolean;
  description?: string;
  ownerId?: string;
  isPublic?: boolean;
  allowOthersAdd?: boolean;
  allowOthersMessage?: boolean;
  shareLink?: string | null;
}

const AudioMessage: React.FC<{ url: string, theme: 'dark' | 'light', isOwn: boolean }> = ({ url, theme, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const waveHeights = useMemo(() => Array.from({ length: 40 }).map(() => 4 + Math.random() * 20), []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
          console.error("Audio play failed:", err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration) {
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-2 min-w-[200px] p-2 rounded-2xl ${isOwn ? 'bg-[#DC2626]/20' : 'bg-white/5'}`}>
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="w-12 h-12 rounded-full flex items-center justify-center bg-[#DC2626] text-white shadow-lg active:scale-95 transition-all">
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-1" fill="currentColor" />}
        </button>
        
        <div className="flex-1 flex flex-col gap-1">
          <div className="h-6 flex items-end gap-[2px]">
            {waveHeights.map((h, i) => (
              <motion.div
                key={i}
                animate={{
                  height: isPlaying ? [h, h * 0.4, h] : h,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5 + Math.random(),
                  ease: "easeInOut"
                }}
                className={`w-[2px] rounded-full ${
                  progress > (i / waveHeights.length) * 100 
                  ? 'bg-[#DC2626]' 
                  : (theme === 'dark' ? 'bg-white/20' : 'bg-slate-300')
                }`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};

interface ChatRoomProps {
  theme: 'dark' | 'light';
  user: any;
  userHandle: string;
  onTagOmni: (chatId: string, text: string, attachments?: { url: string, type: string, name: string }[]) => void;
  uploadToCloudinary: (file: File | Blob) => Promise<string>;
  setUserNotification: (msg: string) => void;
}

const UserAvatar = ({ chat, user, userHandle }: { chat: Chat, user: any, userHandle: string }) => {
  const [photoURL, setPhotoURL] = useState(chat.photoURL);
  
  useEffect(() => {
    setPhotoURL(chat.photoURL);
  }, [chat.photoURL]);

  useEffect(() => {
    if (chat.type !== 'direct' || chat.id.startsWith('omni_')) return;
    
    const otherMember = chat.members.find(m => m !== user.uid && m !== userHandle);
    if (!otherMember) return;

    // Search for user by ID or username
    let unsub: any;
    if (otherMember.length > 20) {
      unsub = onSnapshot(doc(db, 'users', otherMember), (docSnap) => {
        if (docSnap.exists()) setPhotoURL(docSnap.data().photoURL);
      });
    } else {
      unsub = onSnapshot(query(collection(db, 'users'), where('username', '==', otherMember.toLowerCase())), (snap) => {
        if (!snap.empty) setPhotoURL(snap.docs[0].data().photoURL);
      });
    }
    return () => unsub && unsub();
  }, [chat.id, chat.members, chat.type, user.uid, userHandle]);

  if (chat.id.startsWith('omni_')) {
    return <Brain size={22} className="text-white" />;
  }
  if (photoURL) {
    return <img src={photoURL} alt="" className="w-full h-full object-cover" />;
  }
  return <span className="uppercase">{chat.name.charAt(0)}</span>;
};

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
  const [groupDescription, setGroupDescription] = useState('');
  const [isGroupPublic, setIsGroupPublic] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [viewingGroup, setViewingGroup] = useState<any>(null);
  const [isAdminOfGroup, setIsAdminOfGroup] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditDesc, setGroupEditDesc] = useState('');
  const [recipientStatus, setRecipientStatus] = useState<string>('offline');
  const [activeCall, setActiveCall] = useState<{ type: 'voice' | 'video', chatName: string } | null>(null);
  const [callLogs, setCallLogs] = useState<{ id: string, name: string, type: 'voice' | 'video', timestamp: any, direction: 'incoming' | 'outgoing' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [longPressedMessage, setLongPressedMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [deliveredTo, setDeliveredTo] = useState<Record<string, string[]>>({});
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<{ url: string, file: File } | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [activeCallStatus, setActiveCallStatus] = useState<'ringing' | 'connected' | 'ended' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const pressTimerRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const emojis = useMemo(() => ([
    { category: 'Smileys', items: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕'] },
    { category: 'Gestures', items: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦾'] },
    { category: 'Hearts', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️'] },
    { category: 'Academic', items: ['📚', '🎓', '📝', '🧠', '💡', '🧪', '🧬', '🔬', '🔭', '📡', '📜', '⚖️', '📐', '📏', '📊', '📈', '📉', '📅', '📝', '🖋️', '🖊️', '🖌️', '🖍️'] },
    { category: 'Objects', items: ['🔥', '✨', '⚡', '🌈', '☀️', '🌙', '⭐', '🚀', '🛸', '💻', '📱', '📷', '🎥', '📞', '💾', '💿', '📼', '📷', '⏲️', '⏱️', '⏰', '🔋', '🔌', '🕯️', '💡'] },
    { category: 'Food', items: ['🍎', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🍞'] }
  ]), []);

  const [activeEmojiCategory, setActiveEmojiCategory] = useState(emojis[0].category);

  useEffect(() => {
    if (!user) return;

    // Ensure Omni constant contact
    const syncOmni = async () => {
      if (!user) return;

      const omniId = `omni_${user.uid}`;
      const omniRef = doc(db, 'chats', omniId);
      try {
        const snap = await getDoc(omniRef);
        if (!snap.exists()) {
          const members = [user.uid, 'Omni'];
          if (userHandle) members.push(userHandle);
          
          await setDoc(omniRef, {
            name: 'Omni',
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
    if (activeCallStatus === 'ringing') {
      const playBeep = () => {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          oscillator.start();
          setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
          }, 500); // 0.5s beep
        } catch (e) {
          console.error("Audio beep failed", e);
        }
      };

      const interval = setInterval(playBeep, 2000); // Ring every 2s
      playBeep();
      return () => clearInterval(interval);
    }
  }, [activeCallStatus]);

  const handleSearchUsers = async (queryStr: string) => {
    setNewChatHandle(queryStr);
    if (queryStr.length < 2) {
      setUserSuggestions([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', queryStr.toLowerCase()),
        where('username', '<=', queryStr.toLowerCase() + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      const suggestions = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => u.username !== userHandle);
      setUserSuggestions(suggestions);
    } catch (error) {
      console.error("Search users error:", error);
    } finally {
      setIsSearchingUsers(false);
    }
  };

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
      
      // Sort: Pinned first, then Omni, then recent
      const sorted = chatList.sort((a, b) => {
        // Omni always first
        if (a.id.startsWith('omni_') && !b.id.startsWith('omni_')) return -1;
        if (!a.id.startsWith('omni_') && b.id.startsWith('omni_')) return 1;
        // Pinned second
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then by time
        return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
      });
      
      // Filter out duplicate chats based on members (if multiple direct chats exist)
      const unique = sorted.reduce((acc: Chat[], curr) => {
        if (curr.type === 'direct' && !curr.id.startsWith('omni_')) {
          const otherMember = curr.members.find(m => m !== user.uid && m !== userHandle);
          if (!otherMember) {
             acc.push(curr);
             return acc;
          }
          const exists = acc.find(c => 
            c.type === 'direct' && 
            !c.id.startsWith('omni_') &&
            c.members.includes(otherMember)
          );
          if (!exists) acc.push(curr);
        } else {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setChats(unique);
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
          const isOnline = lastSeen && (Date.now() - lastSeen.getTime() < 120000); // 2 minutes
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

    const checkBlocked = async () => {
      const otherId = selectedChat.members.find(m => m !== user.uid && m !== userHandle);
      if (otherId) {
        const otherDoc = await getDoc(doc(db, 'users', otherId));
        if (otherDoc.exists()) {
           const blocked = otherDoc.data().blockedUsers || [];
           if (blocked.includes(user.uid)) {
             setUserNotification("You are blocked by this user.");
           }
        }
      }
    };
    checkBlocked();

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
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 350;

    if (force || isAtBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedChat) return;

    const text = inputText;
    const senderName = user.displayName || userHandle;
    const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName || replyingTo.senderHandle
    } : null;
    
    setInputText('');
    setReplyingTo(null);

    try {
      const msgData: any = {
        senderId: user.uid,
        senderHandle: userHandle,
        senderName: senderName,
        text: text,
        timestamp: serverTimestamp(),
        type: 'text',
        encrypted: true,
        seenBy: [user.uid],
        replyTo: replyData
      };

      const otherMembers = selectedChat.members.filter((m: string) => m !== user.uid && m !== userHandle);

      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), msgData);
      
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastMessageSender: senderName,
        updatedAt: serverTimestamp(),
        unreadBy: arrayUnion(...otherMembers)
      });

      // Trigger Omni if it's the Omni chat or user tagged @omni
      if (selectedChat.id.startsWith('omni_') || text.toLowerCase().includes('@omni')) {
        onTagOmni(selectedChat.id, text);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const createChat = async (targetUser?: any) => {
    const handle = targetUser?.username || newChatHandle.toLowerCase().trim();
    if (!handle) return;
    
    try {
      let otherUser = targetUser;
      if (!otherUser) {
        const q = query(collection(db, 'users'), where('username', '==', handle));
        const snap = await getDocs(q);
        if (snap.empty) {
          setUserNotification("User not found.");
          return;
        }
        otherUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }

      if (otherUser.id === user.uid) {
        setUserNotification("You cannot chat with yourself.");
        return;
      }

      // Check if chat already exists
      const existing = chats.find(c => 
        c.type === 'direct' && 
        !c.id.startsWith('omni_') &&
        (c.members.includes(otherUser.id || otherUser.uid) || c.members.includes(handle.toLowerCase()))
      );
      
      if (existing) {
        setSelectedChat(existing);
        setIsAddingChat(false);
        setNewChatHandle('');
        setUserSuggestions([]);
        return;
      }

      const chatData: any = {
        name: otherUser.displayName || handle,
        type: 'direct',
        members: [user.uid, userHandle, otherUser.id || otherUser.uid, handle],
        photoURL: otherUser.photoURL || null,
        updatedAt: serverTimestamp(),
        lastMessage: 'Chat started'
      };

      const docRef = await addDoc(collection(db, 'chats'), chatData);
      setIsAddingChat(false);
      setSelectedChat({ id: docRef.id, ...chatData } as Chat);
      setNewChatHandle('');
      setUserSuggestions([]);
    } catch (err) {
      console.error("Create Chat Error:", err);
      setUserNotification("Failed to start chat.");
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;

    const chatData = {
      name: groupName.trim(),
      description: groupDescription,
      type: 'group',
      isPublic: isGroupPublic,
      ownerId: user.uid,
      members: [user.uid, userHandle, ...selectedGroupMembers],
      updatedAt: serverTimestamp(),
      lastMessage: 'Group created',
      allowOthersAdd: true,
      allowOthersMessage: true,
      shareLink: isGroupPublic ? Math.random().toString(36).substring(7) : null
    };

    const docRef = await addDoc(collection(db, 'chats'), chatData);
    setIsCreatingGroup(false);
    setSelectedGroupMembers([]);
    setGroupName('');
    setGroupDescription('');
    setSelectedChat({ id: docRef.id, ...chatData } as Chat);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedChat) return;
    const file = e.target.files[0];
    
    if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setEditingImage({ url, file });
        return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      const type = file.type.startsWith('audio/') ? 'audio' : 'text';
      
      const msgData: any = {
        senderId: user.uid,
        senderHandle: userHandle,
        senderName: user.displayName || userHandle,
        text: type === 'audio' ? 'Sent audio' : file.name,
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

  const handleSendEditedImage = async () => {
    if (!editingImage || !selectedChat) return;
    
    setIsUploading(true);
    const fileToUpload = editingImage.file;
    const caption = imageCaption;
    const viewOnce = isViewOnce;

    setEditingImage(null);
    setImageCaption('');
    setIsViewOnce(false);

    try {
        const url = await uploadToCloudinary(fileToUpload);
        const msgData: any = {
            senderId: user.uid,
            senderHandle: userHandle,
            senderName: user.displayName || userHandle,
            text: caption || 'Sent an image',
            timestamp: serverTimestamp(),
            type: 'image',
            mediaUrl: url,
            encrypted: true,
            isViewOnce: viewOnce,
            seenBy: [user.uid]
        };

        const otherMembers = selectedChat.members.filter((m: string) => m !== user.uid && m !== userHandle);

        await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), msgData);
        await updateDoc(doc(db, 'chats', selectedChat.id), {
            lastMessage: `📸 ${caption || 'Image'}`,
            lastMessageSender: user.displayName || userHandle,
            updatedAt: serverTimestamp(),
            unreadBy: arrayUnion(...otherMembers)
        });

        if (selectedChat.id.startsWith('omni_') || caption.toLowerCase().includes('@omni')) {
            onTagOmni(selectedChat.id, caption || 'Analyze this image', [{ url, type: 'image', name: 'User upload' }]);
        }
    } catch (err) {
        console.error("Image upload failed", err);
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

  const handleUpdateGroup = async () => {
    if (!viewingGroup || !isAdminOfGroup) return;
    try {
      await updateDoc(doc(db, 'chats', viewingGroup.id), {
        name: groupEditName,
        description: groupEditDesc,
        updatedAt: serverTimestamp()
      });
      setViewingGroup({ ...viewingGroup, name: groupEditName, description: groupEditDesc });
      setIsEditingGroup(false);
      setUserNotification("Group updated successfully!");
    } catch (err) {
      console.error("Group update error:", err);
      setUserNotification("Failed to update group.");
    }
  };

  const handleAddMemberToGroup = async (targetUserId: string, targetHandle: string) => {
    if (!viewingGroup || (!isAdminOfGroup && !viewingGroup.allowOthersAdd)) return;
    try {
      await updateDoc(doc(db, 'chats', viewingGroup.id), {
        members: arrayUnion(targetUserId, targetHandle),
        updatedAt: serverTimestamp()
      });
      setViewingGroup({ 
        ...viewingGroup, 
        members: [...viewingGroup.members, targetUserId, targetHandle] 
      });
      setUserNotification("Member added!");
    } catch (err) {
      console.error("Add member error:", err);
      setUserNotification("Failed to add member.");
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetHandle: string) => {
    if (!viewingGroup || !isAdminOfGroup) return;
    if (targetUserId === user.uid) return; // Cannot remove self this way

    try {
      await updateDoc(doc(db, 'chats', viewingGroup.id), {
        members: arrayRemove(targetUserId, targetHandle),
        updatedAt: serverTimestamp()
      });
      setViewingGroup({ 
        ...viewingGroup, 
        members: viewingGroup.members.filter((m: string) => m !== targetUserId && m !== targetHandle) 
      });
      setUserNotification("Member removed.");
    } catch (err) {
      console.error("Remove member error:", err);
      setUserNotification("Failed to remove member.");
    }
  };

  const handleToggleGroupSetting = async (setting: string, value: boolean) => {
    if (!viewingGroup || !isAdminOfGroup) return;
    try {
      await updateDoc(doc(db, 'chats', viewingGroup.id), {
        [setting]: value,
        updatedAt: serverTimestamp()
      });
      setViewingGroup({ ...viewingGroup, [setting]: value });
    } catch (err) {
      console.error("Setting toggle error:", err);
    }
  };

  const handleChangeGroupPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !viewingGroup || !isAdminOfGroup) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(e.target.files[0]);
      await updateDoc(doc(db, 'chats', viewingGroup.id), {
        photoURL: url,
        updatedAt: serverTimestamp()
      });
      setViewingGroup({ ...viewingGroup, photoURL: url });
      setUserNotification("Group photo updated!");
    } catch (err) {
      console.error("Photo update error:", err);
      setUserNotification("Failed to update photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const groupParticipants = useMemo(() => {
    if (!viewingGroup) return [];
    // Filter out handles, keep UIDs (roughly check by length > 20)
    return viewingGroup.members.filter((m: string) => m.length > 20);
  }, [viewingGroup?.members]);

  const [participantDetails, setParticipantDetails] = useState<any[]>([]);

  useEffect(() => {
    if (!viewingGroup) {
      setParticipantDetails([]);
      return;
    }

    const uids = viewingGroup.members.filter((m: string) => m.length > 20);
    if (uids.length === 0) return;

    const fetchDetails = async () => {
      const details = [];
      for (const uid of uids) {
        const d = await getDoc(doc(db, 'users', uid));
        if (d.exists()) details.push({ id: d.id, ...d.data() });
      }
      setParticipantDetails(details);
    };
    fetchDetails();
  }, [viewingGroup?.members]);

  const handleViewUser = async (targetUser?: any) => {
    if (!selectedChat && !targetUser) return;
    setShowMoreMenu(false);
    
    if (targetUser) {
        setViewingUser(targetUser);
        return;
    }

    if (selectedChat?.id.startsWith('omni_')) {
        setViewingUser({
            displayName: "Omni",
            fullName: "NSG Artificial Intelligence",
            about: "Your professional academic assistant. I'm here to help you solve problems, write essays, and prepare for exams.",
            photoURL: null,
            role: "AI",
            isOmni: true
        });
        return;
    }

    if (selectedChat?.type === 'group') {
      setViewingGroup(selectedChat);
      setIsAdminOfGroup(selectedChat.ownerId === user.uid);
      setGroupEditName(selectedChat.name);
      setGroupEditDesc(selectedChat.description || '');
      return;
    }

    try {
      const members = selectedChat?.members || [];
      const otherMemberInfo = members.find((m: string) => m !== user.uid && m !== userHandle);
      
      if (otherMemberInfo) {
          const userRef = doc(db, 'users', otherMemberInfo);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
              setViewingUser({ id: userSnap.id, ...userSnap.data() });
          } else {
              const q = query(collection(db, 'users'), where('username', '==', otherMemberInfo));
              const snap = await getDocs(q);
              if (!snap.empty) {
                  setViewingUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
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

  const handleBlockAction = async (targetId: string) => {
    if (!window.confirm("Are you sure you want to block this user? They will no longer be able to message you.")) return;
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            blockedUsers: arrayUnion(targetId)
        });
        setUserNotification("User blocked.");
        setShowMoreMenu(false);
        setViewingUser(null);
    } catch (err) {
        console.error("Block failed", err);
    }
  };

  const handleReportAction = async (targetUser: any) => {
    if (!window.confirm("Report this user for investigation? The last 5 messages in this chat will be reviewed by admins.")) return;
    try {
        const lastMsgs = messages.slice(-5);
        await addDoc(collection(db, 'reports'), {
            reporterId: user.uid,
            reporterHandle: userHandle,
            reportedId: targetUser.id || targetUser.uid,
            reportedHandle: targetUser.username || targetUser.displayName,
            chatId: selectedChat?.id,
            messages: lastMsgs.map(m => ({ text: m.text, sender: m.senderHandle, time: m.timestamp?.toDate?.() || new Date() })),
            timestamp: serverTimestamp(),
            status: 'pending'
        });
        setUserNotification("Report submitted. Thank you for helping keep NSG safe.");
        setShowMoreMenu(false);
        setViewingUser(null);
    } catch (err) {
        console.error("Report failed", err);
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

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string, messages: Message[] }[] = [];
    msgs.forEach(msg => {
      if (!msg.timestamp) return;
      const date = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date();
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      
      let displayDate = "";
      if (diffDays === 0 && date.toDateString() === now.toDateString()) displayDate = 'Today';
      else if (diffDays === 1 || (diffDays === 0 && date.toDateString() !== now.toDateString())) displayDate = 'Yesterday';
      else if (diffDays < 7) displayDate = date.toLocaleDateString('en-US', { weekday: 'long' });
      else displayDate = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === displayDate) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: displayDate, messages: [msg] });
      }
    });
    return groups;
  };

  const deleteMessage = async (msgId: string) => {
    if (!selectedChat) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    if (!window.confirm("Delete this message?")) return;

    const isOwn = msg.senderId === user.uid;
    const choice = isOwn ? window.confirm("Delete for everyone? (OK for Everyone, Cancel for Me Only)") : false;

    try {
      if (isOwn && choice) {
        await updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msgId), {
            text: "🚫 This message was deleted",
            mediaUrl: null,
            type: 'text',
            deletedForEveryone: true
        });
      } else {
        await updateDoc(doc(db, 'chats', selectedChat.id, 'messages', msgId), {
            deletedBy: arrayUnion(user.uid)
        });
      }
      setLongPressedMessage(null);
      setUserNotification("Message deleted.");
    } catch (err) {
      console.error("Delete failed", err);
      setUserNotification("Failed to delete message.");
    }
  };

  const togglePinChat = async (chatId: string, isCurrentlyPinned: boolean) => {
    try {
        await updateDoc(doc(db, 'chats', chatId), {
            isPinned: !isCurrentlyPinned,
            updatedAt: serverTimestamp()
        });
        setUserNotification(!isCurrentlyPinned ? "Chat pinned" : "Chat unpinned");
    } catch (err) {
        console.error("Pin failed", err);
    }
  };

  useEffect(() => {
    if (selectedChat) {
      const markAsRead = async () => {
        try {
          await updateDoc(doc(db, 'chats', selectedChat.id), {
            unreadBy: arrayRemove(user.uid)
          });
        } catch (err) {
          console.error("Mark as read failed", err);
        }
      };
      markAsRead();
    }
  }, [selectedChat, user.uid]);

  const totalUnreadCount = useMemo(() => {
    return chats.filter(c => c.unreadBy && c.unreadBy.includes(user.uid)).length;
  }, [chats, user.uid]);

  useEffect(() => {
    if (!user) return;
    // Basic browser notifications - filtered to user's chats
    const q = query(collection(db, 'chats'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified') {
                const data = change.doc.data();
                if (data.unreadBy && data.unreadBy.includes(user.uid) && data.lastMessageSender !== 'Omni') {
                    if (Notification.permission === 'granted') {
                        new Notification(`New message in ${data.name}`, {
                            body: data.lastMessage,
                        });
                    }
                }
            }
        });
    });
    return () => unsubscribe();
  }, [user.uid]);

  const bulkDeleteChats = async () => {
    if (selectedChatIds.length === 0) return;
    
    // EXCLUDE OMNI FROM DELETION
    const chatsToDelete = selectedChatIds.filter(id => !id.startsWith('omni_'));
    const omniInSelection = selectedChatIds.length !== chatsToDelete.length;

    if (omniInSelection && chatsToDelete.length === 0) {
      alert("The Omni chat is protected and cannot be deleted.");
      return;
    }

    if (chatsToDelete.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${chatsToDelete.length} chats? This action cannot be undone.`)) return;

    try {
      for (const id of chatsToDelete) {
        await deleteDoc(doc(db, 'chats', id));
      }
      setSelectedChatIds([]);
      setIsSelectionMode(false);
      setUserNotification(omniInSelection ? "Chats deleted (Omni was protected)." : "Chats deleted successfully.");
    } catch (err) {
      console.error("Bulk delete failed", err);
      setUserNotification("Failed to delete some chats.");
    }
  };

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds(prev => 
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-slate-50'}`}>
      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black flex flex-col pt-10"
          >
            <div className="flex justify-between items-center px-4 mb-4">
              <button onClick={() => setFullscreenImage(null)} className="p-2 text-white/60 hover:text-white">
                <X size={24} />
              </button>
              <h4 className="text-[10px] font-black uppercase text-white/40 tracking-widest">Image Preview</h4>
              <div className="w-10 h-10" />
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img src={fullscreenImage} className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedChat ? (
        <>
          {/* Header Action Bar for Selection Mode */}
          <AnimatePresence>
            {isSelectionMode && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-[#DC2626] text-white px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <button onClick={() => { setIsSelectionMode(false); setSelectedChatIds([]); }} className="p-1 hover:bg-white/10 rounded-lg">
                    <ArrowLeft size={20} />
                  </button>
                  <span className="text-sm font-black uppercase tracking-widest">{selectedChatIds.length} Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={bulkDeleteChats} className="p-2 hover:bg-white/10 rounded-xl">
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex px-4 gap-2 pt-4 mb-2">
            {[
              {id: 'chats', icon: MessageSquare, label: 'Chats', count: totalUnreadCount},
              {id: 'groups', icon: Users, label: 'Groups'}
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-[6px] rounded-xl border transition-all relative ${
                  activeTab === tab.id 
                  ? 'bg-white/10 border-[#DC2626] text-white' 
                  : 'bg-white/5 border-transparent text-white/40'
                }`}
              >
                <tab.icon size={11} />
                <span className="text-[7px] font-black uppercase tracking-[0.15em]">{tab.label}</span>
                {tab.count ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] text-white text-[8px] font-black flex items-center justify-center rounded-full border border-[#0A0F1C]">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
            <button 
              onClick={() => setShowSearchInChat(!showSearchInChat)}
              className={`flex items-center justify-center w-10 h-10 border rounded-xl transition-all ${showSearchInChat ? 'bg-[#DC2626]/20 border-[#DC2626]/50 text-[#DC2626]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
              title="Search"
            >
              <Search size={18} />
            </button>
            <button 
              onClick={() => activeTab === 'groups' ? setIsCreatingGroup(true) : setIsAddingChat(true)}
              className="flex items-center justify-center w-10 h-10 bg-[#DC2626] text-white rounded-xl shadow-lg shadow-red-900/20 active:scale-95 transition-all"
            >
              <Plus size={18} />
            </button>
          </div>

          {showSearchInChat && activeTab !== 'calls' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="px-4 py-2"
            >
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input 
                  autoFocus
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:border-[#DC2626]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          )}

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
              chats.sort((a: any, b: any) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
              }).filter(c => 
                (activeTab === 'groups' ? c.type === 'group' : c.type === 'direct') &&
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(chat => (
                <motion.div 
                  key={chat.id}
                  onClick={() => isSelectionMode ? toggleChatSelection(chat.id) : setSelectedChat(chat)}
                  onContextMenu={(e) => { e.preventDefault(); setIsSelectionMode(true); toggleChatSelection(chat.id); }}
                  className={`p-3 border rounded-2xl flex items-center gap-3 cursor-pointer transition-all group relative ${
                    selectedChatIds.includes(chat.id) ? 'bg-[#DC2626]/10 border-[#DC2626]' : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  {isSelectionMode && (
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedChatIds.includes(chat.id) ? 'bg-[#DC2626] border-[#DC2626]' : 'border-white/20'}`}>
                      {selectedChatIds.includes(chat.id) && <Check size={12} className="text-white" />}
                    </div>
                  )}
                  <div 
                    onClick={(e) => {
                      if (!isSelectionMode) {
                        e.stopPropagation();
                        setFullscreenImage(chat.photoURL || 'https://images.unsplash.com/photo-1675557009875-436f09789900?q=80&w=200&auto=format&fit=crop');
                      }
                    }}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-[#DC2626] to-red-900 flex items-center justify-center text-white font-black text-base overflow-hidden border border-white/10 shrink-0"
                  >
                    <UserAvatar chat={chat} user={user} userHandle={userHandle} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={`text-xs font-bold truncate ${chat.unreadBy?.includes(user.uid) ? 'text-white' : 'text-white/80'}`}>{chat.name}</h3>
                      <span className={`text-[9px] ${chat.unreadBy?.includes(user.uid) ? 'text-[#DC2626]' : 'text-white/20'}`}>
                        {chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-[10px] truncate flex items-center gap-1 ${chat.unreadBy?.includes(user.uid) ? 'text-white/90 font-medium' : 'text-white/40'}`}>
                        {chat.lastMessage}
                      </p>
                      <div className="flex items-center gap-1">
                         {chat.isPinned && <Pin size={10} className="text-[#DC2626] rotate-45" />}
                         {chat.unreadBy?.includes(user.uid) && (
                            <div className="w-2 h-2 bg-[#DC2626] rounded-full" />
                         )}
                      </div>
                    </div>
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
        <div className="flex flex-col h-full overflow-hidden relative">
          {/* Message Selection Header (WhatsApp style) */}
          <AnimatePresence>
            {longPressedMessage && (
              <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="absolute top-0 left-0 right-0 z-[110] bg-[#DC2626] px-4 py-3 flex items-center justify-between shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <button onClick={() => setLongPressedMessage(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                    <ArrowLeft size={20} className="text-white" />
                  </button>
                  <span className="text-sm font-black uppercase text-white tracking-widest">1 Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                        const msg = messages.find(m => m.id === longPressedMessage);
                        if (msg) { setReplyingTo(msg); setLongPressedMessage(null); }
                    }} 
                    className="p-2 hover:bg-white/10 rounded-xl text-white"
                  >
                    <Reply size={20} />
                  </button>
                  <button 
                    onClick={() => {
                        const msg = messages.find(m => m.id === longPressedMessage);
                        if (msg) {
                            navigator.clipboard.writeText(msg.text);
                            setLongPressedMessage(null);
                            setUserNotification("Copied!");
                        }
                    }} 
                    className="p-2 hover:bg-white/10 rounded-xl text-white"
                  >
                    <Copy size={20} />
                  </button>
                  <button 
                    onClick={() => {
                        const msg = messages.find(m => m.id === longPressedMessage);
                        if (msg) {
                            const info = `Sent: ${msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : 'Just now'}\nStatus: ${msg.seenBy && msg.seenBy.length > 1 ? 'Read' : 'Delivered'}`;
                            setUserNotification(info);
                            setLongPressedMessage(null);
                        }
                    }} 
                    className="p-2 hover:bg-white/10 rounded-xl text-white"
                  >
                    <Info size={20} />
                  </button>
                  <button 
                    onClick={() => deleteMessage(longPressedMessage)} 
                    className="p-2 hover:bg-white/10 rounded-xl text-white"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-black/20 backdrop-blur-md z-20">
            <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
              <ArrowLeft size={20} className="text-white/60" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-black overflow-hidden border border-white/10">
              <UserAvatar chat={selectedChat} user={user} userHandle={userHandle} />
            </div>
            <div 
              onClick={handleViewUser}
              className="flex-1 min-w-0 cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-all"
            >
              <h3 className="text-sm font-black text-white uppercase tracking-tight truncate">{selectedChat.name}</h3>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${recipientStatus === 'Online' ? 'text-green-500' : 'text-white/20'}`}>
                {selectedChat.type === 'group' 
                  ? `${selectedChat.members.filter((m: string) => m.length > 20).length} Participants` 
                  : selectedChat.isOmni ? 'AI Assistant' : recipientStatus}
              </p>
            </div>
            <div className="flex gap-2 relative">
              <motion.button 
                whileTap={{ scale: 0.85 }}
                onClick={() => setShowSearchInChat(!showSearchInChat)}
                className={`p-1.5 transition-colors ${showSearchInChat ? 'text-[#DC2626]' : 'text-white/40 hover:text-white'}`}
              >
                <Search size={17} />
              </motion.button>
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
                        { label: 'View Profile', icon: User, action: handleViewUser },
                        { label: 'Clear Chat', icon: Trash2, action: () => {
                            if (window.confirm("Clear all messages in this chat? This cannot be undone.")) {
                                messages.forEach(m => deleteMessage(m.id));
                            }
                        }},
                        { label: 'Block User', icon: ShieldOff, color: 'text-red-500', action: () => {
                            const otherId = selectedChat?.members.find(m => m !== user.uid && m !== userHandle);
                            if (otherId) handleBlockAction(otherId);
                        }},
                        { label: 'Report Abuse', icon: AlertTriangle, color: 'text-orange-500', action: () => {
                            handleReportAction(viewingUser || { id: selectedChat?.members.find(m => m !== user.uid && m !== userHandle), username: selectedChat?.name });
                        }}
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

          {showSearchInChat && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="px-4 py-2 border-b border-white/5 bg-black/40"
            >
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input 
                  autoFocus
                  placeholder="Search in conversation..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-1.5 text-[10px] text-white outline-none focus:border-[#DC2626]/50"
                />
                {messageSearchQuery && (
                  <button onClick={() => setMessageSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                    <X size={10} />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 pb-10"
          >
            {groupMessagesByDate(messages.filter(m => m.text.toLowerCase().includes(messageSearchQuery.toLowerCase()))).map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-4">
                <div className="flex justify-center my-6">
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black uppercase text-white/30 tracking-widest border border-white/5 shadow-sm">
                    {group.date}
                  </span>
                </div>
                {group.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'} relative scroll-mt-2`}
                    onContextMenu={(e) => { e.preventDefault(); setLongPressedMessage(msg.id); }}
                    onTouchStart={() => handleLongPressStart(msg.id)}
                    onTouchEnd={handleLongPressEnd}
                  >
                    <div className={`max-w-[80%] space-y-1 ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                      {(selectedChat.type === 'group' || msg.senderId !== user.uid) && (
                        <span className="text-[8px] font-black text-[#DC2626] ml-2 opacity-60 uppercase tracking-widest">
                          {msg.senderName || `@${msg.senderHandle}`}
                        </span>
                      )}
                      <div 
                        className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all relative ${
                          longPressedMessage === msg.id ? ' ring-2 ring-[#DC2626] ring-offset-2 ring-offset-black' : ''
                        } ${
                          msg.senderId === user.uid 
                            ? 'bg-[#DC2626] text-white rounded-tr-none' 
                            : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'
                        }`}
                      >
                        {msg.replyTo && (
                          <div className={`mb-2 p-2 rounded-xl text-[10px] border-l-4 ${
                            msg.senderId === user.uid ? 'bg-black/20 border-white/30 text-white/70' : 'bg-white/5 border-[#DC2626] text-white/50'
                          }`}>
                            <p className="font-black uppercase tracking-widest mb-1 truncate">{msg.replyTo.senderName}</p>
                            <p className="line-clamp-2 italic">{msg.replyTo.text}</p>
                          </div>
                        )}
                        {msg.type === 'image' && msg.mediaUrl ? (
                          <div className="relative group/msgimg cursor-pointer max-w-full overflow-hidden rounded-xl">
                            <img 
                                src={msg.mediaUrl} 
                                onClick={() => setFullscreenImage(msg.mediaUrl!)}
                                className={`h-auto w-full mb-2 shadow-2xl transition-all duration-500 scale-100 active:scale-[0.98] ${msg.isViewOnce && msg.seenBy && msg.seenBy.includes(user.uid) && msg.senderId !== user.uid ? 'blur-2xl grayscale' : ''}`} 
                            />
                            {msg.isViewOnce && (
                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5 border border-white/10">
                                    <div className="w-3 h-3 rounded-full border border-white flex items-center justify-center text-[7px] font-bold">1</div>
                                    <span className="text-[7px] font-black uppercase tracking-widest text-white">View Once</span>
                                </div>
                            )}
                          </div>
                        ) : msg.type === 'audio' && msg.mediaUrl ? (
                          <AudioMessage url={msg.mediaUrl} theme={theme} isOwn={msg.senderId === user.uid} />
                        ) : (
                          <div className="relative">
                            <div className={`markdown-body ${expandedMessages.includes(msg.id) ? '' : 'max-h-[300px] overflow-hidden'}`}>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                            {msg.text.length > 500 && (
                              <button 
                                onClick={() => setExpandedMessages(prev => prev.includes(msg.id) ? prev.filter(id => id !== msg.id) : [...prev, msg.id])}
                                className="mt-2 text-[10px] font-black uppercase text-[#38BDF8] hover:underline"
                              >
                                {expandedMessages.includes(msg.id) ? 'Read Less' : 'Read More...'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-[8px] text-white/20 uppercase">
                          {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {msg.senderId === user.uid && (
                          msg.seenBy && msg.seenBy.length > 1 ? (
                            <CheckCheck size={10} className="text-[#38BDF8]" />
                          ) : (
                            <CheckCheck size={10} className="text-white/30" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-black/40 border-t border-white/5 relative mb-2 sm:mb-0">
            <AnimatePresence>
              {replyingTo && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 bg-white/5 border-l-4 border-[#DC2626] p-3 rounded-tr-2xl rounded-br-2xl flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-[0.2em] mb-1">Replying to {replyingTo.senderName || replyingTo.senderHandle}</p>
                    <p className="text-xs text-white/60 truncate italic">{replyingTo.text}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-2 text-white/20 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
              {showEmojiPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-full left-4 mb-4 w-64 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-[100] overflow-hidden"
                >
                  <div className="flex border-b border-white/5 overflow-x-auto custom-scrollbar">
                    {emojis.map(cat => (
                      <button 
                        key={cat.category}
                        onClick={() => setActiveEmojiCategory(cat.category)}
                        className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeEmojiCategory === cat.category ? 'text-[#DC2626] border-b-2 border-[#DC2626]' : 'text-white/40'}`}
                      >
                        {cat.category}
                      </button>
                    ))}
                  </div>
                  <div className="p-4 grid grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {emojis.find(c => c.category === activeEmojiCategory)?.items.map(e => (
                      <button 
                        key={e} 
                        onClick={() => { setInputText(prev => prev + e); }}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
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
              <div className="relative">
                <button 
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  disabled={isUploading}
                  className="p-2 text-white/40 hover:text-white transition-colors relative"
                >
                  {isUploading ? <RefreshCw size={22} className="animate-spin text-emerald-400" /> : <Paperclip size={22} />}
                </button>
                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full left-0 mb-4 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                    >
                      {[
                        { label: 'Gallery', icon: ImageIcon, action: () => fileInputRef.current?.click() },
                        { label: 'Camera', icon: Camera, action: () => setUserNotification("Camera coming soon...") },
                        { label: 'Document', icon: FileText, action: () => fileInputRef.current?.click() },
                        { label: 'Add User', icon: UserPlus, action: () => setIsAddingChat(true) },
                        { label: 'Tag Omni', icon: Brain, action: () => setInputText(prev => prev + '@Omni ') }
                      ].map((item, i) => (
                        <button 
                          key={i}
                          onClick={() => { item.action(); setShowAttachmentMenu(false); }}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-all text-left text-[10px] font-black uppercase tracking-widest text-white/60"
                        >
                          <item.icon size={14} />
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>
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
        {viewingGroup && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-0 z-[200] flex flex-col ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-slate-50'}`}
          >
            <div className={`p-4 flex items-center gap-4 ${theme === 'dark' ? 'bg-[#0A0F1C]' : 'bg-white shadow-sm'} z-20`}>
              <button 
                onClick={() => setViewingGroup(null)} 
                className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/60' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Group Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Group Profile Image */}
              <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-8 flex flex-col items-center gap-4 mb-4 border-b border-white/5`}>
                <div className="w-40 h-40 rounded-full bg-[#DC2626] flex items-center justify-center text-white font-black text-6xl shadow-2xl border-4 border-white/10 overflow-hidden relative group">
                  {viewingGroup.photoURL ? (
                    <img src={viewingGroup.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    viewingGroup.name?.charAt(0)
                  )}
                  {isAdminOfGroup && (
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                      <Camera size={32} className="text-white" />
                      <input type="file" className="hidden" onChange={handleChangeGroupPhoto} accept="image/*" />
                    </label>
                  )}
                </div>
                <div className="text-center w-full max-w-xs">
                  {isEditingGroup ? (
                    <div className="space-y-3">
                      <input 
                        value={groupEditName}
                        onChange={(e) => setGroupEditName(e.target.value)}
                        className="w-full bg-white/5 border border-[#DC2626] rounded-xl px-4 py-2 text-center text-white outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setIsEditingGroup(false)} className="flex-1 py-2 text-[10px] font-black uppercase text-white/40">Cancel</button>
                        <button onClick={handleUpdateGroup} className="flex-1 py-2 bg-[#DC2626] text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <h3 className={`text-2xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{viewingGroup.name}</h3>
                      {isAdminOfGroup && (
                        <button onClick={() => setIsEditingGroup(true)} className="p-1 text-[#DC2626] hover:text-white transition-all">
                          <Check size={14} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  )}
                  <p className={`text-xs font-bold tracking-[0.2em] uppercase mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
                    Group · {participantDetails.length} Participants
                  </p>
                </div>
              </div>

              {/* Group Description */}
              <div className="px-4 space-y-4 pb-10">
                <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-2 border border-white/5`}>
                   <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                      <Info size={12} /> Description
                    </p>
                    {isAdminOfGroup && !isEditingGroup && (
                       <button onClick={() => setIsEditingGroup(true)} className="text-[8px] font-black uppercase text-[#DC2626]">Edit</button>
                    )}
                   </div>
                   {isEditingGroup ? (
                      <textarea 
                        value={groupEditDesc}
                        onChange={(e) => setGroupEditDesc(e.target.value)}
                        className="w-full bg-white/5 border border-[#DC2626]/40 rounded-2xl p-3 text-sm text-white outline-none h-24"
                      />
                   ) : (
                    <p className={`text-sm leading-relaxed font-medium ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>
                      {viewingGroup.description || "No description provided."}
                    </p>
                   )}
                </div>

                {/* Group Settings (Admins only) */}
                {isAdminOfGroup && (
                  <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-4 border border-white/5`}>
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                      <Shield size={12} /> Group Settings
                    </p>
                    <div className="space-y-3">
                      {[
                        { id: 'allowOthersAdd', label: 'Members can add users', icon: UserPlus },
                        { id: 'allowOthersMessage', label: 'Members can message', icon: MessageSquare }
                      ].map(setting => (
                        <div key={setting.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[#DC2626]">
                               <setting.icon size={14} />
                            </div>
                            <span className="text-xs font-bold text-white/80">{setting.label}</span>
                          </div>
                          <button 
                            onClick={() => handleToggleGroupSetting(setting.id, !viewingGroup[setting.id])}
                            className={`w-10 h-5 rounded-full relative transition-all ${viewingGroup[setting.id] ? 'bg-[#DC2626]' : 'bg-white/10'}`}
                          >
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${viewingGroup[setting.id] ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Participants List */}
                <div className={`${theme === 'dark' ? 'bg-[#0F172A]' : 'bg-white'} p-5 rounded-3xl shadow-lg space-y-4 border border-white/5`}>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-[#DC2626] uppercase tracking-widest flex items-center gap-2">
                      <Users size={12} /> {participantDetails.length} Participants
                    </p>
                    {(isAdminOfGroup || viewingGroup.allowOthersAdd) && (
                      <button 
                        onClick={() => setIsAddingMember(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#DC2626]/10 text-[#DC2626] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#DC2626] hover:text-white transition-all"
                      >
                        <UserPlus size={12} /> Add
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {participantDetails.map(member => (
                      <div key={member.id} className="flex items-center justify-between group/member">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            {member.photoURL ? (
                              <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-white/20">{member.username?.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                                {member.displayName || member.username}
                                {member.id === viewingGroup.ownerId && <span className="text-[7px] bg-[#DC2626]/20 text-[#DC2626] px-1.5 py-0.5 rounded-full border border-[#DC2626]/20">Admin</span>}
                                {member.id === user.uid && <span className="text-[7px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full border border-white/10">You</span>}
                            </p>
                            <p className="text-[9px] text-white/30 truncate max-w-[150px]">{member.about || "Available"}</p>
                          </div>
                        </div>
                        {isAdminOfGroup && member.id !== user.uid && (
                          <button 
                            onClick={() => handleRemoveMember(member.id, member.username)}
                            className="p-2 text-red-500/0 group-hover/member:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Remove from group"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to exit this group?")) {
                       handleRemoveMember(user.uid, userHandle);
                       setViewingGroup(null);
                       setSelectedChat(null);
                    }
                  }}
                  className="w-full p-5 bg-red-600/10 hover:bg-red-600/20 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-600/20"
                >
                  <ArrowLeft size={16} /> Exit Group
                </button>
              </div>
            </div>

            {/* Add Member Modal (Internal to Group Info) */}
            <AnimatePresence>
              {isAddingMember && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
                   <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 p-8 rounded-3xl border border-white/10 w-full max-w-sm space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white italic uppercase">Add Member</h3>
                        <button onClick={() => { setIsAddingMember(false); setUserSuggestions([]); setNewChatHandle(''); }} className="text-white/20 hover:text-white"><X size={20} /></button>
                      </div>
                      <div className="space-y-4">
                        <div className="relative">
                          <input 
                            autoFocus
                            placeholder="Search by username..."
                            value={newChatHandle}
                            onChange={(e) => handleSearchUsers(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-[#DC2626]"
                          />
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                           {userSuggestions.map(suggestion => (
                              <button 
                                key={suggestion.id}
                                onClick={() => {
                                   handleAddMemberToGroup(suggestion.id, suggestion.username);
                                   setIsAddingMember(false);
                                   setUserSuggestions([]);
                                   setNewChatHandle('');
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl border border-transparent hover:border-white/5 transition-all group"
                              >
                                 <div className="w-10 h-10 rounded-full bg-[#DC2626]/20 flex items-center justify-center text-[#DC2626] font-black uppercase text-[10px]">
                                    {suggestion.photoURL ? <img src={suggestion.photoURL} className="w-full h-full rounded-full object-cover"/> : suggestion.username.charAt(0)}
                                 </div>
                                 <div className="text-left flex-1">
                                    <p className="text-xs font-black text-white uppercase tracking-tight">{suggestion.displayName || suggestion.username}</p>
                                    <p className="text-[9px] text-white/40">@{suggestion.username}</p>
                                 </div>
                                 <Plus size={14} className="text-[#DC2626]" />
                              </button>
                           ))}
                        </div>
                        <button onClick={() => setIsAddingMember(false)} className="w-full py-4 text-white/40 font-black uppercase text-xs">Close</button>
                      </div>
                   </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

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
                  <button 
                    onClick={() => {
                        const otherId = viewingUser.id || viewingUser.uid;
                        if (otherId) handleBlockAction(otherId);
                    }}
                    className="w-full p-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-500/20"
                  >
                    <Check size={16} className="rotate-45" /> Block Contact
                  </button>
                  <button 
                    onClick={() => handleReportAction(viewingUser)}
                    className="w-full p-5 bg-red-600/10 hover:bg-red-600/20 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-600/20"
                  >
                    <Shield size={16} /> Report User
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
              {activeCallStatus === 'ringing' ? 'Ringing...' : activeCallStatus === 'connected' ? 'Connected' : 'Connecting Secure Link...'}
            </p>

            <div className="flex items-center gap-8">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              <button 
                onClick={() => {
                  setActiveCall(null);
                  setActiveCallStatus(null);
                }}
                className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all group"
              >
                <PhoneOff size={32} className="group-hover:animate-bounce" />
              </button>

              <button 
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
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
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase italic">Add User</h3>
                <button onClick={() => { setIsAddingChat(false); setUserSuggestions([]); }} className="text-white/20 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1 relative">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Search Username</span>
                  <input 
                    autoFocus
                    placeholder="Type handle..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-[#DC2626]"
                    value={newChatHandle}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                  />
                  {isSearchingUsers && (
                    <div className="absolute right-4 bottom-4">
                      <RefreshCw size={14} className="text-[#DC2626] animate-spin" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {userSuggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 bg-white/5 p-2 rounded-2xl border border-white/10"
                    >
                      {userSuggestions.map(suggestion => (
                        <button 
                          key={suggestion.id}
                          onClick={() => createChat(suggestion)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#DC2626]/20 flex items-center justify-center text-[#DC2626] font-black uppercase text-xs">
                            {suggestion.photoURL ? (
                              <img src={suggestion.photoURL} alt={suggestion.username} className="w-full h-full rounded-lg object-cover" />
                            ) : (
                              suggestion.username.charAt(0)
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black text-white uppercase tracking-tight group-hover:text-[#DC2626] transition-colors">{suggestion.displayName || suggestion.username}</p>
                            <p className="text-[9px] text-white/40 font-mono">@{suggestion.username}</p>
                          </div>
                          <UserPlus size={14} className="ml-auto text-white/20 group-hover:text-[#DC2626]" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!userSuggestions.length && newChatHandle.length >= 2 && !isSearchingUsers && (
                  <p className="text-[9px] text-center text-white/20 uppercase tracking-widest italic">No users found matching "{newChatHandle}"</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setIsAddingChat(false); setUserSuggestions([]); }} className="flex-1 py-4 text-white/40 font-black uppercase text-xs">Cancel</button>
                  <button 
                    onClick={() => createChat()}
                    disabled={!newChatHandle.trim()} 
                    className="flex-[2] bg-[#DC2626] text-white py-4 rounded-2xl font-black uppercase text-xs disabled:opacity-50"
                  >
                    Direct Start
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      {/* Image Editing Overlay */}
      <AnimatePresence>
        {editingImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[300] bg-[#0A0F1C] flex flex-col pt-10"
          >
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <button 
                onClick={() => { setEditingImage(null); setImageCaption(''); }}
                className="p-2 text-white/60 hover:text-white"
              >
                <X size={24} />
              </button>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#DC2626]">Preview Image</h3>
              <button 
                onClick={handleSendEditedImage}
                disabled={isUploading}
                className="flex items-center gap-2 px-6 py-2 bg-[#DC2626] text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95 transition-all"
              >
                {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Send
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="relative max-w-full max-h-full">
                    <img src={editingImage.url} className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-2xl" />
                </div>
                
                <div className="w-full max-w-lg mt-8 space-y-4">
                    <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-2xl">
                        <input 
                            placeholder="Add a caption..."
                            value={imageCaption}
                            onChange={(e) => setImageCaption(e.target.value)}
                            className="flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none"
                        />
                        <button 
                           onClick={() => setIsViewOnce(!isViewOnce)}
                           className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isViewOnce ? 'bg-[#DC2626] border-[#DC2626] text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                           title="View Once"
                        >
                            <div className="relative">
                                <Eye size={18} />
                                <div className="absolute -top-1 -right-1 bg-inherit border border-current rounded-full w-3 h-3 flex items-center justify-center text-[7px] font-bold">1</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {isCreatingGroup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-sm space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase italic">Create Group</h3>
                <button onClick={() => setIsCreatingGroup(false)} className="text-white/20 hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Group Name</span>
                  <input 
                    autoFocus
                    placeholder="e.g. Science Hub"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-[#DC2626]"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest ml-1">Description</span>
                  <textarea 
                    placeholder="What's this group about?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-[#DC2626] resize-none h-20"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                   <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">Public Group</p>
                      <p className="text-[8px] text-white/40 uppercase">Anyone with link can join</p>
                   </div>
                   <button 
                      onClick={() => setIsGroupPublic(!isGroupPublic)}
                      className={`w-12 h-6 rounded-full transition-all relative ${isGroupPublic ? 'bg-[#DC2626]' : 'bg-white/10'}`}
                   >
                      <motion.div 
                        animate={{ x: isGroupPublic ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md" 
                      />
                   </button>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Select Members</span>
                      <span className="text-[9px] font-black text-[#DC2626] uppercase">{selectedGroupMembers.length} Selected</span>
                   </div>
                   <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {chats.filter(c => c.type === 'direct').map(chat => (
                         <button 
                            key={chat.id}
                            onClick={() => {
                               const otherId = chat.members.find(m => m !== user.uid && m !== userHandle);
                               if (!otherId) return;
                               setSelectedGroupMembers(prev => 
                                  prev.includes(otherId) ? prev.filter(id => id !== otherId) : [...prev, otherId]
                               );
                            }}
                            className={`w-full p-2 flex items-center gap-3 rounded-xl border transition-all ${
                               chat.members.some(m => selectedGroupMembers.includes(m))
                               ? 'bg-[#DC2626]/10 border-[#DC2626]/40' 
                               : 'bg-white/5 border-transparent hover:bg-white/10'
                            }`}
                         >
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                               {chat.photoURL ? <img src={chat.photoURL} className="w-full h-full rounded-full object-cover"/> : chat.name.charAt(0)}
                            </div>
                            <span className="text-xs text-white/80 font-bold truncate">{chat.name}</span>
                            {chat.members.some(m => selectedGroupMembers.includes(m)) && <Check size={14} className="ml-auto text-[#DC2626]" />}
                         </button>
                      ))}
                   </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setIsCreatingGroup(false)} className="flex-1 py-4 text-white/40 font-black uppercase text-xs">Cancel</button>
                  <button 
                    onClick={createGroup}
                    disabled={!groupName.trim()}
                    className="flex-[2] bg-[#DC2626] text-white py-4 rounded-2xl font-black uppercase text-xs disabled:opacity-30"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
