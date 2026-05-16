import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, Users, Phone, Video, MoreVertical, 
  Search, Plus, Send, Image as ImageIcon, Mic, 
  Check, CheckCheck, Lock, ArrowLeft, AtSign, Pin, Eye, ShieldAlert,
  Smile, Paperclip, UserPlus, RefreshCw, StopCircle,
  Copy, X, Brain, Info, Calendar, MapPin, User, GraduationCap, Trash2,
  Reply, BellRing, PhoneOff, VideoOff, Volume2, VolumeX, MicOff, GraduationCap as SchoolIcon,
  Play, Pause, History, Camera, FileText
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
import { db, auth, handleFirestoreError, FirestoreOperation, circularSafeStringify } from '../firebase';

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
  status?: 'sending' | 'sent' | 'error';
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
}

interface ChatRoomProps {
  theme: 'dark' | 'light';
  user: any;
  userHandle: string;
  onTagOmni: (text: string, chatId: string, attachments?: { url: string, type: string, name: string }[]) => void;
  uploadToCloudinary: (file: File | Blob) => Promise<string>;
  setUserNotification: (msg: string) => void;
  onChatSelect?: (isActive: boolean) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ 
  theme, user, userHandle, onTagOmni, uploadToCloudinary, setUserNotification, onChatSelect
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
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Audio setup
  const sendSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
  const receiveSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3');
  
  const playSendSound = () => {
    sendSound.volume = 0.5;
    sendSound.play().catch(e => console.log('Audio play failed:', e));
  };
  
  const playReceiveSound = () => {
    receiveSound.volume = 0.5;
    receiveSound.play().catch(e => console.log('Audio play failed:', e));
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);

  // Mobile Back Button Handling
  useEffect(() => {
    if (!isDesktop && selectedChat) {
      window.history.pushState({ chatOpen: true }, '');
      
      const handlePopState = () => {
        onChatSelect(null);
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [selectedChat, isDesktop, onChatSelect]);

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
  
  const toggleChatSelection = (id: string) => {
    setSelectedChatIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

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
    onChatSelect?.(!!selectedChat);
  }, [selectedChat, onChatSelect]);

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
            name: 'Omni by NSG',
            type: 'direct',
            isOmni: true,
            photoURL: 'https://images.unsplash.com/photo-1675557009875-436f09789900?q=80&w=200&auto=format&fit=crop',
            ownerId: user.uid,
            members: members,
            updatedAt: serverTimestamp(),
            lastMessage: 'Hello! I am Omni by NSG, your AI study buddy.'
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
    }, (err) => handleFirestoreError(err, FirestoreOperation.LIST, `users/${user.uid}/callLogs`));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const omniId = `omni_${user.uid}`;
    const localChats = localStorage.getItem(`nsg_chats_${user.uid}`);
    if (localChats && chats.length === 0) {
      try {
        setChats(JSON.parse(localChats));
      } catch (e) {
        console.error("Local chats parse error", e);
      }
    }

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
          }).catch(err => handleFirestoreError(err, FirestoreOperation.UPDATE, `chats/${docSnap.id}`));
        }

        // Only take serializable fields for the chat object
        return {
          id: docSnap.id,
          name: data.name || 'Unknown',
          type: data.type || 'direct',
          members: data.members || [],
          photoURL: data.photoURL || null,
          lastMessage: data.lastMessage || '',
          lastMessageSender: data.lastMessageSender || '',
          isOmni: data.isOmni || false,
          unreadBy: data.unreadBy || [],
          isPinned: data.isPinned || false,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now())
        };
      }) as Chat[];
      
      setChats(chatList);
      try {
        // Double safety with circularSafeStringify
        localStorage.setItem(`nsg_chats_${user.uid}`, circularSafeStringify(chatList));
      } catch (e) {
        console.error("Local chats save error", e);
      }
    }, (err) => handleFirestoreError(err, FirestoreOperation.LIST, 'chats'));

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
      }, (err) => handleFirestoreError(err, FirestoreOperation.GET, `users/${otherId}`));
      return unsubscribe;
    };

    let unsub: any;
    fetchRecipientStatus().then(u => unsub = u);
    return () => unsub && unsub();
  }, [selectedChat, user.uid, userHandle]);

  useEffect(() => {
    if (!selectedChat) return;
    
    // Load from local storage first
    const localMsgs = localStorage.getItem(`nsg_msgs_${selectedChat.id}`);
    if (localMsgs) {
      try {
        setMessages(JSON.parse(localMsgs));
      } catch (e) {
        console.error("Local messages parse error", e);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }

    lastMessageIdRef.current = null; // Reset for new chat load

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('timestamp', 'asc'),
      limitToLast(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Only take serializable fields for the message object
        return {
          id: docSnap.id,
          senderId: data.senderId || '',
          senderHandle: data.senderHandle || '',
          senderName: data.senderName || '',
          text: data.text || '',
          type: data.type || 'text',
          mediaUrl: data.mediaUrl || null,
          isViewOnce: data.isViewOnce || false,
          seenBy: data.seenBy || [],
          replyTo: data.replyTo ? {
            id: data.replyTo.id,
            text: data.replyTo.text,
            senderName: data.replyTo.senderName
          } : undefined,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (typeof data.timestamp === 'number' ? data.timestamp : Date.now())
        };
      }) as Message[];

      const lastMsg = msgList[msgList.length - 1];
      const isNewMessage = lastMsg && lastMsg.id !== lastMessageIdRef.current;
      
      setMessages(msgList);
      try {
        localStorage.setItem(`nsg_msgs_${selectedChat.id}`, circularSafeStringify(msgList));
      } catch (e) {
        console.error("Local messages save error", e);
      }

      if (isNewMessage) {
        const wasEmpty = !lastMessageIdRef.current;
        lastMessageIdRef.current = lastMsg.id;
        
        // Play receive sound for new messages NOT sent by me
        if (lastMsg.senderId !== user.uid && !wasEmpty) {
          playReceiveSound();
        }

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
          }).catch(err => handleFirestoreError(err, FirestoreOperation.UPDATE, `chats/${selectedChat.id}/messages/${docSnap.id}`));
        }
      });
    }, (err) => handleFirestoreError(err, FirestoreOperation.LIST, `chats/${selectedChat.id}/messages`));

    return () => unsubscribe();
  }, [selectedChat, user.uid]);

  useEffect(() => {
    // Correct Omni name if it's outdated in state
    if (selectedChat?.isOmni && selectedChat.name !== 'Omni by NSG') {
      setSelectedChat(prev => prev ? { ...prev, name: 'Omni by NSG' } : null);
    }
  }, [selectedChat]);

  const playTapSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
  };

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

    // Play sound
    playSendSound();

    const text = inputText;
    const senderName = user.displayName || userHandle;
    const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName || replyingTo.senderHandle
    } : null;
    
    playTapSound();
    setInputText('');
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user.uid,
      senderHandle: userHandle,
      senderName: senderName,
      text: text,
      timestamp: Date.now(),
      type: 'text',
      seenBy: [user.uid],
      replyTo: replyData || undefined,
      status: 'sending'
    };

    // Update locally for instant feel
    setMessages(prev => {
      const newMsgs = [...prev, optimisticMsg];
      try {
        localStorage.setItem(`nsg_msgs_${selectedChat.id}`, circularSafeStringify(newMsgs));
      } catch (e) {
        console.error("Local messages optimistic save error", e);
      }
      return newMsgs;
    });
    setTimeout(() => scrollToBottom(true), 50);

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

      // We don't await addDoc for UI responsiveness
      addDoc(collection(db, 'chats', selectedChat.id, 'messages'), msgData).then(() => {
        // Optimistic UI will be replaced by server data in onSnapshot
      });
      
      updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastMessageSender: senderName,
        updatedAt: serverTimestamp(),
        unreadBy: arrayUnion(...otherMembers)
      });

      if (selectedChat.id.startsWith('omni_') || text.toLowerCase().includes('@omni')) {
        onTagOmni(text, selectedChat.id);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      handleFirestoreError(err, FirestoreOperation.UPDATE, `chats/${selectedChat.id}`);
      // Mark as error locally
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
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
      const existing = chats.find(c => c.type === 'direct' && (c.members.includes(handle) || c.members.includes(otherUser.id)));
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
            onTagOmni(caption || 'Analyze this image', selectedChat.id, [{ url, type: 'image', name: 'User upload' }]);
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

  const handleViewUser = async () => {
    if (!selectedChat) return;
    setShowMoreMenu(false);
    
    if (selectedChat.id.startsWith('omni_')) {
        setViewingUser({
            displayName: "Omni by NSG",
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
    }, 2000);
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

    const isOwn = msg.senderId === user.uid;
    const choice = isOwn ? window.confirm("Delete for everyone? (OK for Everyone, Cancel for Me - simplified for now)") : false;

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
    }, (err) => handleFirestoreError(err, FirestoreOperation.LIST, 'chats'));
    return () => unsubscribe();
  }, [user.uid]);

  const bulkDeleteChats = async () => {
    if (selectedChatIds.length === 0) return;
    if (!confirm(`Delete ${selectedChatIds.length} chats? This cannot be undone.`)) return;

    try {
      for (const id of selectedChatIds) {
        await deleteDoc(doc(db, 'chats', id));
      }
      setSelectedChatIds([]);
      setIsSelectionMode(false);
      setUserNotification("Chats deleted.");
    } catch (err) {
      console.error("Bulk delete failed", err);
      setUserNotification("Failed to delete some chats.");
    }
  };

  const [isViewingGroupSettings, setIsViewingGroupSettings] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [groupSettingsName, setGroupSettingsName] = useState('');
  const [groupSettingsDesc, setGroupSettingsDesc] = useState('');
  const [groupSettingsPhoto, setGroupSettingsPhoto] = useState<string | null>(null);
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<string[]>([]);
  const [isAddingGroupMember, setIsAddingGroupMember] = useState(false);
  const [newGroupMemberHandle, setNewGroupMemberHandle] = useState('');

  const bulkArchiveChats = async () => {
    if (selectedChatIds.length === 0) return;
    try {
      for (const id of selectedChatIds) {
        await updateDoc(doc(db, 'chats', id), { isArchived: true });
      }
      setSelectedChatIds([]);
      setIsSelectionMode(false);
      setUserNotification("Chats archived.");
    } catch (err) {
      console.error("Bulk archive failed", err);
      setUserNotification("Failed to archive some chats.");
    }
  };

  const createGroupFromSelected = async () => {
    if (selectedChatIds.length === 0) return;
    const allMembers = new Set([userHandle]);
    selectedChatIds.forEach(id => {
      const chat = chats.find(c => c.id === id);
      if (chat && chat.type === 'direct') {
        chat.members.forEach(m => allMembers.add(m));
      }
    });
    setGroupName('New Group');
    setSelectedGroupMembers(Array.from(allMembers).filter(m => m !== userHandle));
    setIsCreatingGroup(true);
    setIsSelectionMode(false);
    setSelectedChatIds([]);
  };

  const handleReportChat = async () => {
    if (!selectedChat) return;
    try {
      const evidence = messages.slice(-5).map(m => ({
        senderId: m.senderId,
        text: m.text,
        timestamp: m.timestamp
      }));

      await addDoc(collection(db, 'reports'), {
        suspectId: selectedChat.members.find(m => m !== user.uid) || selectedChat.id,
        suspectHandle: selectedChat.name,
        reporterId: user.uid,
        reporterEmail: user.email,
        messages: evidence,
        timestamp: serverTimestamp(),
        chatId: selectedChat.id
      });

      setUserNotification("Report sent to safety team.");
    } catch (err) {
      console.error("Report failed:", err);
      setUserNotification("Failed to send report.");
    }
  };

  const updateGroupSettings = async () => {
    if (!selectedChat) return;
    setIsUpdatingGroup(true);
    try {
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        name: groupSettingsName,
        description: groupSettingsDesc,
        photoURL: groupSettingsPhoto,
        members: groupSettingsMembers
      });
      setUserNotification("Group updated.");
      setIsViewingGroupSettings(false);
    } catch (err) {
      console.error("Group update failed", err);
      setUserNotification("Failed to update group.");
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const toggleGroupMember = (member: string) => {
    setGroupSettingsMembers(prev => 
      prev.includes(member) ? prev.filter(m => m !== member) : [...prev, member]
    );
  };

  const AudioMessage: React.FC<{ url: string, theme: 'dark' | 'light', isOwn: boolean }> = ({ url, theme, isOwn }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
            console.error("Audio play failed:", err);
            setUserNotification("Audio playback error.");
        });
      }
      setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
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
      <div className={`flex items-center gap-3 p-3 rounded-2xl ${isOwn ? 'bg-black/20' : 'bg-white/5'} min-w-[200px]`}>
        <button onClick={togglePlay} className="w-12 h-12 rounded-full flex items-center justify-center bg-[#DC2626] text-white shadow-lg active:scale-95 transition-all">
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-0.5" />}
        </button>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-0.5 h-6">
            {[...Array(20)].map((_, i) => {
              const isActive = progress > (i / 20) * 100;
              const height = 4 + Math.random() * 16;
              return (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full transition-all duration-300 ${isActive ? 'bg-[#DC2626]' : 'bg-white/20'}`} 
                  style={{ height: `${height}px` }} 
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] font-black uppercase text-white/40 tracking-widest">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <audio 
          ref={audioRef} 
          src={url} 
          onTimeUpdate={handleTimeUpdate} 
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)} 
          className="hidden" 
          preload="metadata"
          crossOrigin="anonymous"
        />
      </div>
    );
  };

  return (
    <div className={`flex flex-1 h-full overflow-hidden min-h-0 ${theme === 'dark' ? 'bg-[#13111C]' : 'bg-slate-50'}`}>
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

      {/* Group Settings Modal */}
      <AnimatePresence>
        {isViewingGroupSettings && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#13111C] border border-white/10 rounded-[2.5rem] w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Group Intelligence</h3>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Group Hub Control</p>
                </div>
                <button onClick={() => setIsViewingGroupSettings(false)} className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative group p-1 bg-white/5 rounded-[3rem] border border-white/5 shadow-2xl">
                    <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-[#DC2626] to-red-900 flex items-center justify-center text-white font-black text-4xl overflow-hidden border-4 border-white/10 shadow-inner">
                      {groupSettingsPhoto ? <img src={groupSettingsPhoto} alt="" className="w-full h-full object-cover" /> : groupSettingsName.charAt(0)}
                    </div>
                    {(selectedChat as any).admin === user.uid && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-all rounded-[2.5rem] backdrop-blur-md"
                      >
                        <Camera size={32} className="mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Update Hub Profile</span>
                      </button>
                    )}
                  </div>
                  <div className="w-full space-y-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] ml-4">Hub Designation</p>
                      <input 
                        value={groupSettingsName} 
                        onChange={e => setGroupSettingsName(e.target.value)} 
                        disabled={(selectedChat as any).admin !== user.uid}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#DC2626] transition-all disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] ml-4">Hub Directive</p>
                      <textarea 
                        value={groupSettingsDesc} 
                        onChange={e => setGroupSettingsDesc(e.target.value)} 
                        disabled={(selectedChat as any).admin !== user.uid}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white/60 outline-none focus:border-[#DC2626] transition-all h-24 resize-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 italic">
                       <Users size={16} className="text-[#DC2626]" /> Hub Nodes ({groupSettingsMembers.length})
                    </h4>
                    {(selectedChat as any).admin === user.uid && (
                      <button 
                        onClick={() => setIsAddingGroupMember(true)}
                        className="p-2 bg-[#DC2626] text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                      >
                        <UserPlus size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {groupSettingsMembers.map(member => (
                      <div key={member} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-[#DC2626] text-xs">@{member.charAt(0)}</div>
                           <div>
                             <p className="text-xs font-black text-white uppercase truncate">@{member}</p>
                             {member === userHandle && <p className="text-[7px] font-bold text-[#DC2626] uppercase">Primary Node</p>}
                           </div>
                        </div>
                        {(selectedChat as any).admin === user.uid && member !== userHandle && (
                          <button onClick={() => toggleGroupMember(member)} className="p-2 text-white/20 hover:text-red-500 transition-all">
                            <Trash2 size={16} />
                          </button>
                        )}
                        {(selectedChat as any).admin === member && (
                          <span className="text-[7px] font-black text-[#DC2626] uppercase border border-[#DC2626]/40 px-2 py-0.5 rounded italic">Admin Hub</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">
                <button onClick={() => setIsViewingGroupSettings(false)} className="flex-1 px-8 py-4 bg-white/5 text-white/40 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:text-white transition-all">Abort</button>
                <button 
                  onClick={updateGroupSettings} 
                  disabled={isUpdatingGroup}
                  className="flex-[2] px-8 py-4 bg-[#DC2626] text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-red-900/30 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isUpdatingGroup ? 'SYNCHRONIZING...' : 'UPLOAD DIRECTIVE'}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingGroupMember && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/90">
             <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-[#0F172A] border border-white/10 rounded-3xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
                <div className="text-center space-y-2">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Merge Node</h3>
                   <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Connect external user handle</p>
                </div>
                <input 
                   placeholder="e.g. nsg_pro_user"
                   value={newGroupMemberHandle}
                   onChange={e => setNewGroupMemberHandle(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-[#DC2626]"
                />
                <div className="flex gap-3">
                   <button onClick={() => setIsAddingGroupMember(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-white/40">Cancel</button>
                   <button 
                    onClick={() => {
                       if (newGroupMemberHandle.trim()) {
                         toggleGroupMember(newGroupMemberHandle.trim());
                         setNewGroupMemberHandle('');
                         setIsAddingGroupMember(false);
                       }
                    }}
                    className="flex-1 py-4 bg-[#DC2626] text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-900/20"
                   >
                     Merge Node
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Left Pane (Chat List) */}
      <div className={`flex flex-col border-r border-white/5 bg-black/20 overflow-hidden h-full transition-all duration-300 ${isDesktop ? 'w-[400px] shrink-0' : (selectedChat ? 'hidden' : 'w-full')}`}>
        {!selectedChat || isDesktop ? (
          <div className="flex flex-col flex-1 h-full overflow-hidden min-h-0">
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
                  <button onClick={createGroupFromSelected} title="Create Group" className="p-2 hover:bg-white/10 rounded-xl">
                    <Users size={20} />
                  </button>
                  <button onClick={bulkArchiveChats} title="Archive" className="p-2 hover:bg-white/10 rounded-xl">
                    <History size={20} />
                  </button>
                  <button onClick={bulkDeleteChats} title="Delete" className="p-2 hover:bg-white/10 rounded-xl">
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-6 pt-6 mb-4">
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">Messages</h2>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#DC2626] transition-colors" size={16} />
              <input 
                placeholder="Search chats, groups or contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-xs text-white outline-none focus:border-[#DC2626] transition-all"
              />
            </div>
          </div>

          <div className="flex px-4 gap-2 mb-2">
            {[
              {id: 'chats', icon: MessageSquare, label: 'Chats', count: totalUnreadCount},
              {id: 'groups', icon: Users, label: 'Groups'},
              {id: 'calls', icon: Phone, label: 'Calls'}
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
                <tab.icon size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">{tab.label}</span>
                {tab.count ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] text-white text-[8px] font-black flex items-center justify-center rounded-full border border-[#13111C]">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
            <button 
              onClick={() => setUserNotification("Chat History coming soon!")}
              className="flex items-center justify-center w-10 h-10 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white transition-all"
              title="History"
            >
              <History size={18} />
            </button>
            <button 
              onClick={() => activeTab === 'groups' ? setIsCreatingGroup(true) : setIsAddingChat(true)}
              className="flex items-center justify-center w-12 h-12 bg-[#DC2626] text-white rounded-2xl shadow-lg shadow-red-900/20 active:scale-95 transition-all shrink-0"
            >
              <Plus size={22} />
            </button>
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
              chats.sort((a: any, b: any) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
              }).filter(c => 
                (activeTab === 'groups' ? c.type === 'group' : c.type === 'direct') &&
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(chat => (
                <div key={chat.id} className="border-b border-white/5 last:border-0 mx-2">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => isSelectionMode ? toggleChatSelection(chat.id) : setSelectedChat(chat)}
                    onContextMenu={(e) => { e.preventDefault(); setIsSelectionMode(true); toggleChatSelection(chat.id); }}
                    onTouchStart={() => {
                      (window as any).chatLongPressTimer = setTimeout(() => {
                        setIsSelectionMode(true);
                        toggleChatSelection(chat.id);
                        if (navigator.vibrate) navigator.vibrate(50);
                      }, 1200);
                    }}
                    onTouchEnd={() => clearTimeout((window as any).chatLongPressTimer)}
                    className={`p-4 flex items-center gap-3 cursor-pointer transition-all group relative ${
                      selectedChatIds.includes(chat.id) ? 'bg-[#DC2626]/10' : 'bg-transparent hover:bg-white/5'
                    }`}
                  >
                    {isSelectionMode && (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedChatIds.includes(chat.id) ? 'bg-[#DC2626] border-[#DC2626]' : 'border-white/20'}`}>
                        {selectedChatIds.includes(chat.id) && <Check size={12} className="text-white" />}
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg overflow-hidden border border-white/10 shrink-0 ${chat.id.startsWith('omni_') ? 'bg-black shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-[#DC2626]'}`}>
                      {chat.id.startsWith('omni_') ? (
                        <Brain size={24} className="text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                      ) : chat.photoURL ? (
                        <img src={chat.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        chat.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className="text-sm font-black text-white uppercase tracking-tight truncate whitespace-nowrap group-hover:text-[#DC2626] transition-colors">{chat.name}</h3>
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest whitespace-nowrap">
                          {chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-white/40 truncate font-medium">
                          {chat.lastMessage}
                        </p>
                        <div className="flex items-center gap-1">
                           {chat.isPinned && <Pin size={10} className="text-[#DC2626] rotate-45" />}
                           {chat.unreadBy?.includes(user.uid) && (
                              <div className="min-w-[16px] h-[16px] bg-[#38BDF8] rounded-full flex items-center justify-center text-[8px] font-black text-white">
                                1
                              </div>
                           )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
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
          </div>
        ) : null}
      </div>

      {/* Right Pane (Conversation) */}
      <div className={`flex flex-col flex-1 h-full overflow-hidden ${!isDesktop && !selectedChat ? 'hidden' : 'flex'}`}>
        {selectedChat ? (
          /* Individual Chat View */
          <div className="flex flex-col flex-1 h-full overflow-hidden relative min-h-0">
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
          
          <div className="pt-8 pb-1.5 px-3 border-b border-white/5 flex items-center gap-3 bg-black/20 backdrop-blur-md z-20 shrink-0">
            {!isDesktop && (
              <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                <ArrowLeft size={20} className="text-white/60" />
              </button>
            )}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black overflow-hidden border border-white/10 ${selectedChat.id.startsWith('omni_') ? 'bg-black shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'bg-[#DC2626]'}`}>
              {selectedChat.id.startsWith('omni_') ? (
                <Brain size={16} className="text-red-600 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]" />
              ) : selectedChat.photoURL ? (
                <img src={selectedChat.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                selectedChat.name.charAt(0)
              )}
            </div>
            <div 
              onClick={handleViewUser}
              className="flex-1 min-w-0 cursor-pointer hover:bg-white/5 p-0.5 rounded-lg transition-all"
            >
              <h3 className="text-sm font-black text-white uppercase tracking-tight italic leading-tight whitespace-nowrap overflow-visible">
                {selectedChat.name}
              </h3>
              <p className={`text-[7px] font-bold uppercase tracking-[0.2em] ${recipientStatus === 'Online' ? 'text-green-500' : 'text-white/20'}`}>
                {selectedChat.isOmni ? 'Omni by NSG | AI Assistant' : recipientStatus}
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
                   onClick={() => {
                     if (selectedChat.type === 'group') {
                       setGroupSettingsName(selectedChat.name);
                       setGroupSettingsDesc((selectedChat as any).description || '');
                       setGroupSettingsPhoto(selectedChat.photoURL || null);
                       setGroupSettingsMembers(selectedChat.members);
                       setIsViewingGroupSettings(true);
                     } else {
                       setShowMoreMenu(!showMoreMenu);
                     }
                   }}
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

          {showSearchInChat && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="px-4 py-2 border-b border-white/5 bg-black/40 shrink-0"
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
                  <div key={msg.id} className="relative group overflow-hidden">
                    {/* Swipe Reveal Icon (Behind message) */}
                    <div className="absolute inset-y-0 left-0 flex items-center pl-6 -z-10 opacity-0 group-active:opacity-100 transition-opacity">
                      <Reply size={22} className="text-[#DC2626] animate-pulse" />
                    </div>

                    <motion.div 
                      key={msg.id} 
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.4}
                      animate={{ x: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x > 80) {
                          setReplyingTo(msg);
                          if (navigator.vibrate) navigator.vibrate(50);
                        }
                      }}
                      className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'} relative scroll-mt-2 overflow-visible`}
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
                          !msg.timestamp || msg.status === 'sending' ? (
                             <RefreshCw size={8} className="text-white/20 animate-spin" />
                          ) : msg.seenBy && msg.seenBy.length > 1 ? (
                             <CheckCheck size={10} className="text-[#38BDF8]" />
                          ) : (
                             <Check size={10} className="text-white/30" />
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-1.5 sm:p-2 bg-black/40 border-t border-white/5 relative mb-1 sm:mb-0 shrink-0">
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

              <div className="flex items-center gap-2 w-full px-2">
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-white/40 hover:text-white transition-colors"
                >
                  <Smile size={20} />
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    disabled={isUploading}
                    className="p-1.5 text-white/40 hover:text-white transition-colors relative"
                  >
                    {isUploading ? <RefreshCw size={20} className="animate-spin text-emerald-400" /> : <Paperclip size={20} />}
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
                        { label: 'Add User', icon: UserPlus, action: () => setIsAddingChat(true) }
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#DC2626]/50 transition-all"
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
      ) : isDesktop ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/5 p-12 text-center bg-black/40">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(220,38,38,0.1)] border border-white/5">
              <Brain size={48} className="text-red-600/20" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.3em] mb-2 opacity-30 italic">Omni by NSG</h3>
            <p className="max-w-xs text-[10px] font-bold leading-relaxed opacity-20 uppercase tracking-[0.2em]">Select an active node to begin synchronized intelligence transfer</p>
          </div>
        ) : (null) }
      </div>

      {/* User Details Overlay (WhatsApp style) */}
      <AnimatePresence>
        {viewingUser && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-0 z-[200] flex flex-col ${theme === 'dark' ? 'bg-[#13111C]' : 'bg-slate-50'}`}
          >
            <div className={`p-4 flex items-center gap-4 ${theme === 'dark' ? 'bg-[#13111C]' : 'bg-white shadow-sm'} z-20`}>
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
                  <button 
                    onClick={handleReportChat}
                    className="w-full p-5 bg-red-600/10 hover:bg-red-600/20 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-3 border border-red-600/20"
                  >
                    <ShieldAlert size={16} /> Report User
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
            className="fixed inset-0 z-[300] bg-[#13111C] flex flex-col pt-10"
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
