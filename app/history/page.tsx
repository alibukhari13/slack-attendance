/* eslint-disable @typescript-eslint/no-explicit-any */
// app/history/page.tsx
"use client";
import React, { useEffect, useState } from 'react';
// import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { Search, Calendar, Clock, MessageSquare, User, Filter, Download, ChevronDown, ChevronUp, Image as ImageIcon, Paperclip } from 'lucide-react';
import { db } from '../../lib/firebase';
import { convertEmojis } from '../../utils/emojiConverter';
// import { convertEmojis } from '@/utils/emojiConverter';

interface Message {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  text: string;
  timestamp: string;
  date: string;
  time: string;
  files: any[];
  user: string;
  createdAt: any;
}

export default function HistoryPage() {
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<string[]>([]);

  // Format date properly
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Fetch connected users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "slack_tokens"), (snap) => {
      setConnectedUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch messages for selected user
  useEffect(() => {
    if (!selectedUser) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/slack/manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_stored_history',
            targetUserId: selectedUser.id
          })
        });
        
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
          
          // Extract unique channels
          const uniqueChannels = Array.from(
            new Set(data.messages.map((m: any) => m.channelName || m.channelId))
          ) as string[];
          setChannels(uniqueChannels);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [selectedUser]);

  // Real-time updates for new messages
  useEffect(() => {
    if (!selectedUser) return;

    const messagesRef = collection(db, "slack_messages_history");
    const q = query(
      messagesRef,
      where("userId", "==", selectedUser.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      const uniqueChannels = Array.from(
        new Set(newMessages.map(m => m.channelName || m.channelId))
      ) as string[];
      setChannels(uniqueChannels);
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Filter messages
  const filteredMessages = messages.filter(message => {
    const matchesSearch = searchTerm === '' || 
      message.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.channelName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = dateFilter === '' || message.date === dateFilter;
    const matchesChannel = channelFilter === '' || 
      (message.channelName === channelFilter || message.channelId === channelFilter);
    
    return matchesSearch && matchesDate && matchesChannel;
  });

  // Group messages by date
  const groupedMessages = filteredMessages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = formatDate(message.date) || 'Unknown Date';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Toggle message expansion
  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  // Download messages as CSV
  const downloadCSV = () => {
    if (!selectedUser) return;
    
    const csvRows = [
      ['Date', 'Time', 'Channel', 'Message', 'User ID', 'Message ID'],
      ...filteredMessages.map(msg => [
        msg.date,
        msg.time,
        msg.channelName,
        `"${(msg.text || '').replace(/"/g, '""')}"`,
        msg.user,
        msg.id
      ])
    ];
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slack-history-${selectedUser.name}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Render message content
  const renderMessageContent = (message: Message) => {
    const textWithEmojis = convertEmojis(message.text || '');
    const isExpanded = expandedMessages.has(message.id);
    
    return (
      <div>
        <div className={`whitespace-pre-wrap break-words ${isExpanded ? '' : 'line-clamp-3'}`}>
          {textWithEmojis || <span className="text-gray-500 italic">[No text content]</span>}
        </div>
        
        {/* Show files if any */}
        {message.files && message.files.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.files.slice(0, isExpanded ? message.files.length : 2).map((file: any, index: number) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                {file.mime_type?.startsWith('image/') ? (
                  <>
                    <ImageIcon className="h-4 w-4 text-blue-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-300">{file.name || 'Image'}</div>
                      <img 
                        src={file.thumb_64 || file.url_private} 
                        alt={file.name}
                        className="mt-1 max-h-32 rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-300">{file.name || 'File'}</div>
                      <div className="text-xs text-gray-500">{file.filetype || 'Unknown type'}</div>
                    </div>
                  </>
                )}
                {file.url_private_download && (
                  <a 
                    href={file.url_private_download}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
            {!isExpanded && message.files.length > 2 && (
              <button
                onClick={() => toggleMessage(message.id)}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                + {message.files.length - 2} more files
              </button>
            )}
          </div>
        )}
        
        {/* Show expand/collapse button for long text */}
        {textWithEmojis.length > 300 && (
          <button
            onClick={() => toggleMessage(message.id)}
            className="mt-1 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show more
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-amber-500" />
            Complete Message History
          </h1>
          <p className="text-gray-400">
            View and search all messages from connected employees. All data is permanently stored.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - User List */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Connected Employees
              </h2>
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {connectedUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No employees connected yet.
                  </div>
                ) : (
                  connectedUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${selectedUser?.id === user.id ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-gray-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=374151&color=fff`}
                          className="w-10 h-10 rounded-full"
                          alt={user.name}
                        />
                        <div className="flex-1">
                          <div className="font-medium truncate">{user.name}</div>
                          <div className="text-xs text-gray-400 truncate">{user.id}</div>
                        </div>
                        <div className="text-xs bg-gray-800 px-2 py-1 rounded">
                          {messages.filter(m => m.userId === user.id).length}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Stats */}
            {selectedUser && (
              <div className="mt-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="font-semibold mb-3">Statistics</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-400">Total Messages</div>
                    <div className="text-2xl font-bold">{messages.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Channels</div>
                    <div className="text-xl font-semibold">{channels.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Date Range</div>
                    <div className="text-sm">
                      {messages.length > 0 ? (
                        <>
                          {new Date(Math.min(...messages.map(m => parseFloat(m.timestamp) * 1000))).toLocaleDateString()}
                          {' - '}
                          {new Date(Math.max(...messages.map(m => parseFloat(m.timestamp) * 1000))).toLocaleDateString()}
                        </>
                      ) : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {selectedUser ? (
              <>
                {/* Filters */}
                <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[300px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search messages..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                      
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <select
                          value={channelFilter}
                          onChange={(e) => setChannelFilter(e.target.value)}
                          className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none"
                        >
                          <option value="">All Channels</option>
                          {channels.map(channel => (
                            <option key={channel} value={channel}>
                              {channel}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <button
                        onClick={downloadCSV}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </button>
                      
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setDateFilter('');
                          setChannelFilter('');
                        }}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                  
                  {/* Selected User Info */}
                  <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={selectedUser.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=374151&color=fff`}
                        className="w-10 h-10 rounded-full"
                        alt={selectedUser.name}
                      />
                      <div>
                        <div className="font-semibold">{selectedUser.name}</div>
                        <div className="text-sm text-gray-400">Showing {filteredMessages.length} of {messages.length} messages</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      Last updated: {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                    <div className="mt-4 text-gray-400">Loading messages...</div>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800">
                    <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <div className="text-gray-400">No messages found</div>
                    {searchTerm || dateFilter || channelFilter ? (
                      <div className="mt-2 text-sm text-gray-500">Try changing your filters</div>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500">No messages stored for this user yet</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                      <div key={date} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-400" />
                              <span className="font-semibold">{date}</span>
                              <span className="text-sm text-gray-400 ml-2">
                                {dateMessages.length} messages
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">
                              {dateMessages.length} conversations
                            </div>
                          </div>
                        </div>
                        
                        <div className="divide-y divide-gray-800">
                          {dateMessages.map((message) => (
                            <div key={message.id} className="p-6 hover:bg-gray-800/30 transition-colors">
                              <div className="flex gap-4">
                                <div className="flex-shrink-0 w-48">
                                  <div className="text-sm text-gray-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {message.time}
                                  </div>
                                  <div className="mt-2 text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded inline-block">
                                    {message.channelName || message.channelId?.substring(0, 8)}
                                  </div>
                                </div>
                                
                                <div className="flex-1">
                                  <div className="mb-2">
                                    {renderMessageContent(message)}
                                  </div>
                                  
                                  <div className="flex items-center justify-between mt-4">
                                    <div className="text-xs text-gray-500">
                                      Message ID: {message.id.substring(0, 12)}...
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-xs bg-gray-800 px-2 py-1 rounded">
                                        {message.files?.length || 0} files
                                      </span>
                                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                        Permanent Storage
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-gray-800">
                <User className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <div className="text-xl font-medium text-gray-400 mb-2">Select an Employee</div>
                <div className="text-gray-500 max-w-md mx-auto">
                  Choose an employee from the left sidebar to view their complete message history.
                  All messages are permanently stored and will not disappear after 3 months.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
