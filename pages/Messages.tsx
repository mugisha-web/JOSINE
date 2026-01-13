
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { ChatMessage, UserProfile, UserRole } from '../types';
import { Send, UserCircle, Users, Sparkles, Search, MessageCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { GoogleGenAI } from "@google/genai";

const Messages: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null); // null means Group Chat
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all users for DM list
  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile?.uid));
    };
    fetchUsers();
  }, [profile?.uid]);

  // Listen for messages
  useEffect(() => {
    setLoading(true);
    let q;
    if (!selectedUser) {
      // Global Group Chat
      q = query(
        collection(db, 'messages'),
        where('recipientId', '==', null),
        orderBy('createdAt', 'asc')
      );
    } else {
      // Private DM
      q = query(
        collection(db, 'messages'),
        where('recipientId', 'in', [profile?.uid, selectedUser.uid]),
        orderBy('createdAt', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as ChatMessage)
        .filter(m => {
          if (!selectedUser) return true;
          return (m.senderId === profile?.uid && m.recipientId === selectedUser.uid) ||
                 (m.senderId === selectedUser.uid && m.recipientId === profile?.uid);
        });
      setMessages(msgs);
      setLoading(false);
    });

    return unsubscribe;
  }, [selectedUser, profile?.uid]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile) return;

    const text = inputText;
    setInputText('');
    setSending(true);

    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId: profile.uid,
        senderName: profile.name,
        senderPhoto: profile.photoURL || null,
        recipientId: selectedUser ? selectedUser.uid : null,
        createdAt: serverTimestamp(),
        isAi: false
      });

      // AI Response Hook - checks for mention or random engagement in global room
      if (text.toLowerCase().includes('@system') || (selectedUser === null && text.length > 3 && Math.random() > 0.8)) {
        await callAI(text);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  /**
   * Gemini AI Integration
   * Using GoogleGenAI with Gemini 3 Flash model
   */
  const callAI = async (prompt: string) => {
    try {
      // Always initialize with named parameter apiKey
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Use ai.models.generateContent with model name and prompt directly
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `User asks: ${prompt}`,
        config: { 
          systemInstruction: "You are IGIHOZO AI, a smart stock management assistant for a retail shop. Answer briefly and help with calculations or stock advice. Be friendly and professional.",
          temperature: 0.7
        }
      });

      // Access text output using the .text property (not a method)
      const aiText = response.text;

      if (aiText) {
        await addDoc(collection(db, 'messages'), {
          text: aiText,
          senderId: 'SYSTEM_AI',
          senderName: 'IGIHOZO AI',
          recipientId: selectedUser ? selectedUser.uid : null,
          createdAt: serverTimestamp(),
          isAi: true
        });
      }
    } catch (e) {
      console.error("AI Error:", e);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4">
      {/* Sidebar - Chat List */}
      <div className="w-full md:w-80 bg-white dark:bg-gray-900 rounded-3xl border dark:border-gray-800 flex flex-col shadow-sm overflow-hidden">
        <div className="p-6 border-b dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button 
            onClick={() => setSelectedUser(null)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${!selectedUser ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            <div className={`p-2 rounded-xl ${!selectedUser ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
              <Users size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Global Lounge</p>
              <p className={`text-[10px] ${!selectedUser ? 'text-blue-100' : 'text-gray-400'}`}>Everyone in IGIHOZO</p>
            </div>
          </button>

          <div className="px-4 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Direct Messages</p>
          </div>

          {users.map(user => (
            <button 
              key={user.uid}
              onClick={() => setSelectedUser(user)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${selectedUser?.uid === user.uid ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
            >
              <div className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt={user.name} /> : <UserCircle size={24} className="text-gray-400" />}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user.name}</p>
                <p className={`text-[10px] uppercase font-bold ${selectedUser?.uid === user.uid ? 'text-blue-100' : 'text-gray-400'}`}>{user.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl border dark:border-gray-800 flex flex-col shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              {selectedUser ? (
                selectedUser.photoURL ? <img src={selectedUser.photoURL} className="w-full h-full rounded-full object-cover" alt={selectedUser.name} /> : <UserCircle />
              ) : <Users />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{selectedUser ? selectedUser.name : 'Global Lounge'}</h3>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {selectedUser ? 'Direct Message' : 'Public Channel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold flex items-center gap-1">
              <Sparkles size={12} /> AI Powered
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-gray-950/20">
          {loading ? <LoadingSpinner /> : (
            <>
              {messages.map((msg) => {
                const isMine = msg.senderId === profile?.uid;
                const isAi = msg.isAi;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMine && (
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 shrink-0">
                          {msg.senderPhoto ? <img src={msg.senderPhoto} className="w-full h-full object-cover" alt={msg.senderName} /> : <UserCircle size={24} className="text-gray-400" />}
                        </div>
                      )}
                      <div className={`
                        px-4 py-2.5 rounded-2xl text-sm shadow-sm
                        ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 
                          isAi ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-bl-none' : 
                          'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border dark:border-gray-700 rounded-bl-none'}
                      `}>
                        {!isMine && <p className={`text-[10px] font-black mb-1 ${isAi ? 'text-purple-600' : 'text-blue-500'}`}>{msg.senderName}</p>}
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef}></div>
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
          <form onSubmit={handleSend} className="flex gap-3">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={selectedUser ? `Message ${selectedUser.name}...` : "Ask @system something or chat with team..."}
              className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl px-6 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-gray-100 transition-all"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || sending}
              className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 shadow-lg active:scale-95 disabled:opacity-50 transition-all"
            >
              {sending ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Messages;
