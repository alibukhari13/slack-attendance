/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
// app/dm-manager/page.tsx

"use client";
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Send, User, MessageSquare, Shield, Link as LinkIcon, Lock, AlertCircle } from 'lucide-react';

export default function DMManager() {
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Invite System State
  const [inviteId, setInviteId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{msg: string, type: 'success' | 'error' | ''}>({msg: '', type: ''});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
      setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_chats', targetUserId: activeUser.id })
    })
    .then(r => r.json())
    .then(d => setChats(d.chats || []));
  }, [activeUser]);

  useEffect(() => {
    if (!activeChat) return;
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  const loadMessages = async () => {
    if(!activeUser || !activeChat) return;
    const res = await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'get_messages', 
            targetUserId: activeUser.id, 
            channelId: activeChat.id 
        })
    });
    const data = await res.json();
    if(data.messages) setMessages(data.messages);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inputText.trim()) return;
    await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'send_as_user', 
            targetUserId: activeUser.id, 
            channelId: activeChat.id,
            text: inputText
        })
    });
    setInputText('');
    loadMessages();
  };

  // 👇 UPDATED SEND INVITE FUNCTION
  const sendInvite = async () => {
    if(!inviteId) return;
    setInviteStatus({ msg: 'Sending...', type: '' });
    
    try {
        const res = await fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ action: 'send_invite', targetUserId: inviteId.trim() })
        });
        const data = await res.json();
        
        if(data.success) {
            setInviteStatus({ msg: '✅ Link sent successfully via Bot!', type: 'success' });
            setInviteId('');
        } else {
            // Ab ye Asal Error dikhayega
            setInviteStatus({ msg: `❌ Error: ${data.error}`, type: 'error' });
        }
    } catch (e) {
        setInviteStatus({ msg: '❌ Network Error', type: 'error' });
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        
        {/* LEFT: Sidebar */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-amber-500 flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Admin Control
                </h2>
            </div>
            
            {/* Invite Section */}
            <div className="p-4 bg-gray-800/50 m-2 rounded-xl border border-gray-700">
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider font-semibold">Connect New Employee</label>
                <div className="flex gap-2">
                    <input 
                        className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm w-full text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                        placeholder="e.g. U0AA167M1UP"
                        value={inviteId}
                        onChange={e => setInviteId(e.target.value)}
                    />
                    <button onClick={sendInvite} className="bg-blue-600 px-3 rounded-lg hover:bg-blue-500 transition-colors">
                        <LinkIcon className="h-4 w-4 text-white" />
                    </button>
                </div>
                {inviteStatus.msg && (
                    <div className={`mt-3 p-2 rounded text-xs flex items-start gap-2 ${inviteStatus.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-all">{inviteStatus.msg}</span>
                    </div>
                )}
            </div>

            {/* List Connected Users */}
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs text-gray-500 px-2 mb-2 mt-4 uppercase tracking-wider font-semibold">Connected Accounts</p>
                {connectedUsers.length === 0 && <p className="text-xs text-gray-600 px-2 italic">No employees connected yet.</p>}
                
                {connectedUsers.map(u => (
                    <button 
                        key={u.id}
                        onClick={() => { setActiveUser(u); setActiveChat(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all mb-1 ${activeUser?.id === u.id ? 'bg-amber-500/20 text-white border border-amber-500/50' : 'text-gray-400 hover:bg-gray-800'}`}
                    >
                        <img src={u.image || "https://ca.slack-edge.com/T00000000-U00000000-g00000000000-512"} className="w-8 h-8 rounded-full bg-gray-700" />
                        <div className="overflow-hidden">
                            <div className="font-medium text-sm truncate">{u.name}</div>
                            <div className="text-[10px] opacity-60 truncate">{u.id}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* MIDDLE: Chat List */}
        <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 h-16 flex items-center justify-between bg-gray-900">
                <h3 className="font-semibold text-gray-200">{activeUser ? activeUser.name.split(' ')[0] + "'s DMs" : 'Select User'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                {!activeUser && <div className="p-8 text-center text-gray-600 text-sm">Select an employee from the left sidebar to view their chats.</div>}
                
                {chats.map(chat => (
                    <button 
                        key={chat.id}
                        onClick={() => setActiveChat(chat)}
                        className={`w-full p-4 border-b border-gray-800/50 flex items-center gap-3 hover:bg-gray-800/50 transition-colors ${activeChat?.id === chat.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
                    >
                        {chat.image ? <img src={chat.image} className="w-9 h-9 rounded-lg" /> : <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center"><User className="w-5 h-5 text-gray-400" /></div>}
                        <div className="text-left overflow-hidden flex-1">
                            <div className="text-sm font-medium text-gray-200 truncate">{chat.name}</div>
                            <div className="text-xs text-gray-500 truncate">ID: {chat.user || chat.id}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* RIGHT: Active Chat */}
        <div className="flex-1 flex flex-col bg-gray-950">
            {activeChat ? (
                <>
                    {/* Header */}
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="font-bold text-lg text-white">{activeChat.name}</div>
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1 font-medium">
                                <Lock className="h-3 w-3" /> Live Control
                            </span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col-reverse gap-4">
                         <div className="flex flex-col gap-2">
                            {messages.map((m, i) => {
                                const isMe = m.user === activeUser.id; 
                                return (
                                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm'}`}>
                                            {m.text}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                            <input 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                className="flex-1 bg-gray-800 border-gray-700 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder={`Send message as ${activeUser.name}...`}
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Messages are sent directly from {activeUser.name}&apos;s Slack account.
                        </p>
                    </form>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 flex-col bg-gray-950/50">
                    <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
                        <MessageSquare className="h-10 w-10 opacity-30" />
                    </div>
                    <p className="text-gray-500 font-medium">Select a conversation to start</p>
                </div>
            )}
        </div>
    </div>
  );
}