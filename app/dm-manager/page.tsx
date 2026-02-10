//app/dm-manager/page.ts


/* eslint-disable react-hooks/immutability */
/* eslint-disable prefer-const */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Send, User, MessageSquare, Shield, Link as LinkIcon, Trash2, Edit2, X, Check, Image as ImageIcon, FileText, Download, AlertTriangle, XCircle } from 'lucide-react';
import { db } from '../../lib/firebase';

const emojiMap: Record<string, string> = {
  ':smile:': '😊', ':simple_smile:': '🙂', ':joy:': '😂', ':sob:': '😭',
  ':heart:': '❤️', ':fire:': '🔥', ':thumbsup:': '👍', ':tada:': '🎉',
  ':white_check_mark:': '✅', ':x:': '❌', ':warning:': '⚠️',
  ':wink:': '😉', ':sunglasses:': '😎', ':thinking_face:': '🤔'
};

const convertEmojis = (text: string) => {
  if (!text) return '';
  let result = text;
  Object.entries(emojiMap).forEach(([code, emoji]) => {
    result = result.split(code).join(emoji);
  });
  return result;
};

const getFormattedDate = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const getFormattedTime = (ts: string) => {
    const date = new Date(parseFloat(ts) * 1000);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function DMManager() {
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{msg: string, type: string}>({msg: '', type: ''});
  const [dbError, setDbError] = useState(false);
  
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  useEffect(() => {
    try {
        const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
            setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setDbError(false);
        }, () => { setDbError(true); });
        return () => unsub();
    } catch(e) { setDbError(true); }
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    const fetchChats = () => {
        fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ action: 'list_chats', targetUserId: activeUser.id })
        })
        .then(r => r.json())
        .then(d => {
            if(d.chats) setChats(d.chats);
        });
    };
    fetchChats();
    const chatInterval = setInterval(fetchChats, 10000); 
    return () => clearInterval(chatInterval);
  }, [activeUser]);

  useEffect(() => {
    if (!activeChat) return;
    setMessages([]);
    setLoadingMsg(true);
    setUserScrolledUp(false);
    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  useLayoutEffect(() => {
    if (!userScrolledUp) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, userScrolledUp]);

  const handleScroll = () => {
      if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          if (scrollHeight - scrollTop - clientHeight < 50) setUserScrolledUp(false);
          else setUserScrolledUp(true);
      }
  };

  const loadMessages = async (isFirstLoad: boolean) => {
    if(!activeUser || !activeChat) return;
    try {
        const res = await fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ action: 'get_messages', targetUserId: activeUser.id, channelId: activeChat.id })
        });
        const data = await res.json();
        if(data.messages) {
            setMessages(data.messages);
            if(isFirstLoad) setLoadingMsg(false);
        }
    } catch(e) { console.error(e); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inputText.trim()) return;
    const tempMsg = { text: inputText, user: activeUser.id, ts: (Date.now()/1000).toString() };
    setMessages(prev => [...prev, tempMsg]); 
    const txt = inputText;
    setInputText('');
    setUserScrolledUp(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_as_user', targetUserId: activeUser.id, channelId: activeChat.id, text: txt })
    });
    loadMessages(false);
  };

  const formatMessageText = (text: string) => {
    if(!text) return null;
    let formattedText = convertEmojis(text);
    const parts = formattedText.split(/(<@[A-Z0-9]+>)/g);
    return parts.map((part, index) => {
        if (part.match(/<@[A-Z0-9]+>/)) {
            const userId = part.replace(/[<@>]/g, '');
            let userName = `@${userId}`;
            const connectedUser = connectedUsers.find(u => u.id === userId);
            if (connectedUser) userName = `@${connectedUser.name}`;
            else if (activeChat?.user === userId) userName = `@${activeChat.name}`;
            else if (activeUser?.id === userId) userName = `@${activeUser.name}`;
            return <span key={index} className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded mx-0.5 font-medium text-xs"> {userName} </span>;
        }
        return part;
    });
  };

  const getDownloadUrl = (originalUrl: string) => {
      return `/api/slack/file-proxy?url=${encodeURIComponent(originalUrl)}&userId=${activeUser.id}`;
  };

  const handleDeleteMsg = async (ts: string) => {
      if(!confirm("Delete this message?")) return;
      setMessages(prev => prev.filter(m => m.ts !== ts));
      await fetch('/api/slack/manager', { method: 'POST', body: JSON.stringify({ action: 'delete_message', targetUserId: activeUser.id, channelId: activeChat.id, messageTs: ts }) });
  };

  const submitEdit = async () => {
      if(!editingMsgId) return;
      setMessages(prev => prev.map(m => m.ts === editingMsgId ? { ...m, text: editInput } : m));
      const ts = editingMsgId;
      const txt = editInput;
      setEditingMsgId(null);
      await fetch('/api/slack/manager', { method: 'POST', body: JSON.stringify({ action: 'edit_message', targetUserId: activeUser.id, channelId: activeChat.id, messageTs: ts, newText: txt }) });
  };

  const sendInvite = async () => {
    if(!inviteId) return;
    setInviteStatus({ msg: 'Sending...', type: '' });
    const res = await fetch('/api/slack/manager', { method: 'POST', body: JSON.stringify({ action: 'send_invite', targetUserId: inviteId.trim() }) });
    const data = await res.json();
    if(data.success) { setInviteStatus({ msg: '✅ Sent!', type: 'success' }); setInviteId(''); }
    else { setInviteStatus({ msg: `❌ ${data.error}`, type: 'error' }); }
  };

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Remove user?")) return;
    if(activeUser?.id === userId) { setActiveUser(null); setChats([]); setActiveChat(null); }
    await fetch('/api/slack/manager', { method: 'POST', body: JSON.stringify({ action: 'delete_user', targetUserId: userId }) });
  };

  const groupedMessages: { [key: string]: any[] } = {};
  messages.forEach(msg => {
      const dateKey = getFormattedDate(msg.ts);
      if (!groupedMessages[dateKey]) groupedMessages[dateKey] = [];
      groupedMessages[dateKey].push(msg);
  });

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        
        {/* LEFT: Sidebar */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-amber-500 flex items-center gap-2"><Shield className="h-5 w-5" /> Admin Panel</h2>
            </div>
            {dbError && <div className="bg-red-900/50 p-3 m-2 rounded text-xs text-red-200 border border-red-500/50 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><strong>DB Limit Reached!</strong></div>}
            
            <div className="p-4 bg-gray-800/50 m-2 rounded-xl border border-gray-700">
                <label className="text-xs text-gray-400 mb-2 block font-semibold">ADD TARGET</label>
                <div className="flex gap-2">
                    <input className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm w-full text-white outline-none focus:border-blue-500" placeholder="User ID (U0...)" value={inviteId} onChange={e => setInviteId(e.target.value)} />
                    <button onClick={sendInvite} className="bg-blue-600 px-3 rounded-lg hover:bg-blue-500"><LinkIcon className="h-4 w-4" /></button>
                </div>
                {inviteStatus.msg && <div className={`mt-2 text-xs ${inviteStatus.type==='error'?'text-red-400':'text-green-400'}`}>{inviteStatus.msg}</div>}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs text-gray-500 px-2 mb-2 mt-4 font-semibold">ACTIVE TARGETS</p>
                {connectedUsers.map(u => (
                    <div key={u.id} onClick={() => { setActiveUser(u); setActiveChat(null); }} className={`group w-full flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 ${activeUser?.id === u.id ? 'bg-amber-500/20 border border-amber-500/50' : 'hover:bg-gray-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src={u.image} className="w-8 h-8 rounded-full bg-gray-700" />
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                            </div>
                            <div>
                                <div className="font-medium text-sm">{u.name}</div>
                                <div className="text-[10px] opacity-60">Connected</div>
                            </div>
                        </div>
                        <button onClick={(e) => handleDeleteUser(u.id, e)} className="p-1.5 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                    </div>
                ))}
            </div>
        </div>

        {/* MIDDLE: Chat List */}
        {activeUser && (
            <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col animate-in slide-in-from-left duration-200">
                <div className="p-4 border-b border-gray-800 h-16 flex items-center justify-between bg-gray-900">
                    <h3 className="font-semibold text-gray-200 truncate pr-2">{activeUser.name}'s DMs</h3>
                    {/* CLOSE BUTTON */}
                    <button 
                        onClick={() => { setActiveUser(null); setActiveChat(null); }} 
                        className="text-gray-400 hover:text-white hover:bg-red-500/20 p-1.5 rounded-full transition-all"
                        title="Close DMs"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {chats.map(chat => (
                        <button key={chat.id} onClick={() => setActiveChat(chat)} className={`w-full p-4 border-b border-gray-800/50 flex items-center gap-3 hover:bg-gray-800/50 ${activeChat?.id === chat.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}>
                            {chat.image ? <img src={chat.image} className="w-9 h-9 rounded-lg" /> : <div className="w-9 h-9 bg-gray-700 rounded-lg flex center"><User className="w-5 h-5 text-gray-400" /></div>}
                            <div className="text-left overflow-hidden flex-1">
                                <div className="text-sm font-medium text-gray-200 truncate">{chat.name}</div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-500 truncate">{chat.id}</span>
                                    {chat.unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{chat.unread}</span>}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* RIGHT: Active Chat */}
        <div className="flex-1 flex flex-col bg-gray-950">
            {activeChat ? (
                <>
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="font-bold text-lg">{activeChat.name} <span className="text-xs bg-red-900 text-red-200 px-2 rounded ml-2">LIVE</span></div>
                        <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-400"><X className="h-6 w-6" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scroll-smooth" ref={scrollContainerRef} onScroll={handleScroll}>
                        {loadingMsg && <div className="text-center text-gray-500 mb-4">Loading...</div>}
                        <div className="flex flex-col gap-6">
                            {Object.keys(groupedMessages).map((date) => (
                                <div key={date}>
                                    <div className="flex justify-center mb-6 sticky top-0 z-0">
                                        <span className="bg-gray-800/80 backdrop-blur text-gray-400 text-xs px-4 py-1.5 rounded-full border border-gray-700 font-medium shadow-sm">{date}</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {groupedMessages[date].map((m, i) => {
                                            const isMe = m.user === activeUser.id;
                                            const isEditing = editingMsgId === m.ts;
                                            return (
                                                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                                    {isMe && !isEditing && (
                                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mr-2 transition-opacity">
                                                            <button onClick={() => { setEditingMsgId(m.ts); setEditInput(m.text); }} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"><Edit2 className="h-3 w-3" /></button>
                                                            <button onClick={() => handleDeleteMsg(m.ts)} className="p-1.5 bg-gray-800 hover:bg-red-900/50 rounded-full text-gray-400 hover:text-red-300"><Trash2 className="h-3 w-3" /></button>
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[75%] p-3.5 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm'}`}>
                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                                <input autoFocus value={editInput} onChange={e => setEditInput(e.target.value)} className="bg-black/20 p-2 rounded text-white outline-none border border-white/20" />
                                                                <div className="flex gap-2 justify-end">
                                                                    <button onClick={() => setEditingMsgId(null)} className="p-1 hover:bg-black/20 rounded"><X className="h-4 w-4" /></button>
                                                                    <button onClick={submitEdit} className="p-1 bg-green-500 rounded hover:bg-green-600"><Check className="h-4 w-4" /></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-2">
                                                                {m.files && m.files.map((file: any, fIdx: number) => {
                                                                    const downloadLink = getDownloadUrl(file.url_private);
                                                                    return (
                                                                        <div key={fIdx} className="mb-2">
                                                                            {file.mimetype?.startsWith('image') ? (
                                                                                <a href={downloadLink} target="_blank" rel="noopener noreferrer" className="block relative group cursor-pointer">
                                                                                    <img src={downloadLink} alt="Loading..." className="rounded-lg max-h-60 border border-white/10 min-w-[150px] min-h-[100px] bg-black/20" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"><Download className="h-8 w-8 text-white drop-shadow-lg" /></div>
                                                                                </a>
                                                                            ) : (
                                                                                <a href={downloadLink} target="_blank" className="flex items-center gap-3 bg-black/30 p-3 rounded-lg border border-white/10 hover:bg-black/50 transition-colors">
                                                                                    <div className="bg-blue-500/20 p-2 rounded"><FileText className="h-5 w-5 text-blue-300" /></div>
                                                                                    <div className="flex-1 overflow-hidden"><div className="truncate text-sm font-medium">{file.name}</div><div className="text-[10px] opacity-60">{file.filetype}</div></div>
                                                                                    <Download className="h-4 w-4 text-gray-400" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="whitespace-pre-wrap leading-relaxed break-words">{formatMessageText(m.text)}</div>
                                                                <div className="text-[10px] opacity-60 flex justify-end gap-1 mt-0.5 select-none">{getFormattedTime(m.ts)} {isMe && <span className="opacity-80">✓</span>}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                            <input value={inputText} onChange={e => setInputText(e.target.value)} className="flex-1 bg-gray-800 border-gray-700 border rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all placeholder-gray-500" placeholder={`Reply as ${activeUser?.name}...`} />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl transition-colors shadow-lg"><Send className="h-5 w-5" /></button>
                        </div>
                    </form>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 flex-col bg-gray-950/50">
                    <MessageSquare className="h-12 w-12 opacity-20 mb-3" />
                    <p className="font-medium">Select a conversation to start spying</p>
                </div>
            )}
        </div>
    </div>
  );
}