/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import {
  MessageSquare,
  Hash,
  Users,
  Calendar,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  X,
  AlertCircle,
  FileText,
  DownloadCloud,
  BarChart3,
  Activity
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, isValid, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to safely parse dates
const safeParseDate = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(0);
  const date = parseISO(dateString);
  if (isValid(date)) return date;
  const parsed = new Date(dateString);
  if (isValid(parsed)) return parsed;
  return new Date(0);
};

export default function ChannelsDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<string[]>([
    'C0ABB105W3S', // Check-in channel
    'C0AAGM79J6N'  // Check-out channel
  ]);
  const [newChannelId, setNewChannelId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [showAddChannel, setShowAddChannel] = useState(false);

  // Load all logs
  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(logsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Add new channel
  const addChannel = () => {
    if (newChannelId.trim() && !channels.includes(newChannelId.trim())) {
      setChannels([...channels, newChannelId.trim()]);
      setNewChannelId('');
      setShowAddChannel(false);
    }
  };

  // Remove channel
  const removeChannel = (channelId: string) => {
    setChannels(channels.filter(id => id !== channelId));
    if (selectedChannel === channelId) {
      setSelectedChannel(null);
    }
  };

  // Filter logs based on selected channel
  const filteredLogs = useMemo(() => {
    let result = logs;
    
    // Filter by selected channel
    if (selectedChannel) {
      result = result.filter(log => {
        // Check if this log belongs to the selected channel
        // You might need to adjust this logic based on how you store channel info
        return log.channelId === selectedChannel || 
               log.channel === selectedChannel ||
               (selectedChannel === 'C0ABB105W3S' && log.type === 'Check-In') ||
               (selectedChannel === 'C0AAGM79J6N' && log.type === 'Check-Out');
      });
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.userName?.toLowerCase().includes(term) ||
        log.userId?.toLowerCase().includes(term) ||
        log.text?.toLowerCase().includes(term) ||
        log.channelId?.toLowerCase().includes(term) ||
        log.type?.toLowerCase().includes(term)
      );
    }

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      result = result.filter(log => {
        let matchesDate = true;
        const logDate = new Date(log.timestamp || log.ts || new Date());
        
        if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          startDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && logDate >= startDate;
        }
        
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && logDate <= endDate;
        }
        
        return matchesDate;
      });
    }

    return result;
  }, [logs, selectedChannel, searchTerm, dateRange]);

  // Get channel statistics
  const channelStats = useMemo(() => {
    const stats: Record<string, any> = {};
    
    channels.forEach(channelId => {
      const channelLogs = logs.filter(log => 
        log.channelId === channelId || 
        log.channel === channelId ||
        (channelId === 'C0ABB105W3S' && log.type === 'Check-In') ||
        (channelId === 'C0AAGM79J6N' && log.type === 'Check-Out')
      );
      
      stats[channelId] = {
        totalMessages: channelLogs.length,
        uniqueUsers: new Set(channelLogs.map(log => log.userId)).size,
        lastActivity: channelLogs[0]?.timestamp ? 
          format(new Date(channelLogs[0].timestamp), 'MMM dd, HH:mm') : 'No activity',
        checkIns: channelLogs.filter(log => log.type === 'Check-In').length,
        checkOuts: channelLogs.filter(log => log.type === 'Check-Out').length
      };
    });

    return stats;
  }, [logs, channels]);

  // Export to Excel
  const exportToExcel = (data: any[], fileName: string) => {
    const wb = XLSX.utils.book_new();
    
    const wsData = [
      ['SLACK CHANNELS HISTORY REPORT'],
      [''],
      [`Report Date: ${format(new Date(), 'MMMM dd, yyyy')}`],
      [`Total Channels: ${channels.length}`],
      [`Total Messages: ${data.length}`],
      [''],
      ['Channel ID', 'User Name', 'User ID', 'Type', 'Date', 'Time', 'Message', 'Attachment']
    ];
    
    data.forEach(log => {
      wsData.push([
        log.channelId || log.channel || (log.type === 'Check-In' ? 'C0ABB105W3S' : 'C0AAGM79J6N'),
        log.userName,
        log.userId,
        log.type || 'Message',
        log.date,
        log.time,
        log.text || 'No message',
        log.imageUrl ? 'Yes' : 'No'
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 12 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Channels History');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `${fileName}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = (data: any[], fileName: string) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('SLACK CHANNELS HISTORY REPORT', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, 105, 22, { align: 'center' });
    doc.text(`Channels: ${channels.length} • Messages: ${data.length}`, 105, 28, { align: 'center' });
    
    const headers = [['Channel', 'User', 'Type', 'Date', 'Time', 'Message']];
    
    const tableData = data.map(log => [
      log.channelId || log.channel || 'N/A',
      log.userName,
      log.type || 'Message',
      log.date,
      log.time,
      (log.text || '').substring(0, 60)
    ]);
    
    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { top: 10 },
      pageBreak: 'auto'
    });
    
    doc.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Handle export
  const handleExport = () => {
    if (exportFormat === 'excel') {
      exportToExcel(filteredLogs, 'Slack_Channels_History');
    } else {
      exportToPDF(filteredLogs, 'Slack_Channels_History');
    }
  };

  // Get all unique users
  const uniqueUsers = useMemo(() => {
    const users = new Set(filteredLogs.map(log => log.userId));
    return Array.from(users).map(userId => {
      const userLogs = filteredLogs.filter(log => log.userId === userId);
      const lastLog = userLogs[0];
      return {
        id: userId,
        name: lastLog?.userName || userId,
        messageCount: userLogs.length,
        lastSeen: lastLog?.timestamp ? format(new Date(lastLog.timestamp), 'MMM dd') : 'Never'
      };
    });
  }, [filteredLogs]);

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white font-sans">
      {/* Top Navigation */}
      <nav className="bg-black/40 backdrop-blur-xl border-b border-gray-800/50 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-10 w-10 rounded-xl flex items-center justify-center font-bold shadow-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent">
                Slack Channels Manager
              </h1>
              <p className="text-xs text-gray-400">Multi-channel history & analytics</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-800">
              <Hash className="h-4 w-4 text-blue-400" />
              <span className="text-gray-300">{channels.length} Channels</span>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
              
              <button 
                onClick={handleExport}
                className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export History
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Total Channels</p>
                <p className="text-3xl font-bold text-white">{channels.length}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <Hash className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-400">
              {selectedChannel ? `Viewing: ${selectedChannel}` : 'All channels'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Total Messages</p>
                <p className="text-3xl font-bold text-white">{filteredLogs.length}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <MessageSquare className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(filteredLogs.length / Math.max(logs.length, 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Unique Users</p>
                <p className="text-3xl font-bold text-white">{uniqueUsers.length}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-gray-400">Active users</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 p-6 rounded-2xl border border-blue-800/30 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-200 text-sm font-medium mb-2">System Status</p>
                <p className="text-3xl font-bold text-blue-300">Connected</p>
              </div>
              <div className="p-3 bg-blue-900/30 rounded-xl">
                <Activity className="h-6 w-6 text-blue-300" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-blue-200">Slack API Active</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Channels List */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800/50">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white">Slack Channels</h2>
                  <button 
                    onClick={() => setShowAddChannel(!showAddChannel)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Add Channel Form */}
              {showAddChannel && (
                <div className="p-6 border-b border-gray-800/50 bg-gray-900/30">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Add Slack Channel ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., C0AABBCCDD"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                        value={newChannelId}
                        onChange={(e) => setNewChannelId(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addChannel}
                        className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors"
                      >
                        Add Channel
                      </button>
                      <button
                        onClick={() => setShowAddChannel(false)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Channels List */}
              <div className="max-h-[600px] overflow-y-auto">
                {channels.map((channelId, index) => {
                  const stats = channelStats[channelId];
                  const isSelected = selectedChannel === channelId;
                  const channelName = channelId === 'C0ABB105W3S' ? 'Check-in Channel' :
                                    channelId === 'C0AAGM79J6N' ? 'Check-out Channel' :
                                    `Channel ${index + 1}`;
                  
                  return (
                    <div
                      key={channelId}
                      className={`p-6 border-b border-gray-800/50 hover:bg-gray-900/30 transition-all duration-200 cursor-pointer ${
                        isSelected ? 'bg-gray-900/50' : ''
                      }`}
                      onClick={() => setSelectedChannel(isSelected ? null : channelId)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                              channelId === 'C0ABB105W3S' ? 'bg-green-500/10' :
                              channelId === 'C0AAGM79J6N' ? 'bg-red-500/10' :
                              'bg-blue-500/10'
                            }`}>
                              <Hash className={`h-5 w-5 ${
                                channelId === 'C0ABB105W3S' ? 'text-green-400' :
                                channelId === 'C0AAGM79J6N' ? 'text-red-400' :
                                'text-blue-400'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{channelName}</p>
                                {isSelected && (
                                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
                                )}
                              </div>
                              <p className="text-sm text-gray-400 font-mono mt-1">{channelId}</p>
                            </div>
                          </div>
                          
                          {stats && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="text-gray-400">
                                <span className="block">Messages</span>
                                <span className="font-semibold text-white">{stats.totalMessages}</span>
                              </div>
                              <div className="text-gray-400">
                                <span className="block">Users</span>
                                <span className="font-semibold text-white">{stats.uniqueUsers}</span>
                              </div>
                              <div className="text-gray-400">
                                <span className="block">Last Active</span>
                                <span className="font-semibold text-white">{stats.lastActivity}</span>
                              </div>
                              <div className="text-gray-400">
                                <span className="block">Type</span>
                                <span className="font-semibold text-white">
                                  {channelId === 'C0ABB105W3S' ? 'Check-in' :
                                   channelId === 'C0AAGM79J6N' ? 'Check-out' : 'General'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeChannel(channelId);
                            }}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${
                            isSelected ? 'rotate-90' : ''
                          }`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Channels Summary */}
              <div className="p-6 border-t border-gray-800/50">
                <div className="text-sm text-gray-400">
                  <div className="flex items-center justify-between mb-2">
                    <span>Total Channels</span>
                    <span className="text-white font-semibold">{channels.length}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Check-in Channels</span>
                    <span className="text-white font-semibold">
                      {channels.filter(id => id === 'C0ABB105W3S').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Check-out Channels</span>
                    <span className="text-white font-semibold">
                      {channels.filter(id => id === 'C0AAGM79J6N').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Channel Analytics</h3>
              <div className="space-y-4">
                {channels.slice(0, 3).map(channelId => {
                  const stats = channelStats[channelId];
                  if (!stats) return null;
                  
                  return (
                    <div key={channelId} className="flex items-center justify-between">
                      <span className="text-sm text-gray-400 truncate max-w-[120px]">{channelId}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{stats.totalMessages} msgs</span>
                        <div className="w-20 bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(stats.totalMessages / Math.max(logs.length, 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Messages Table */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-800/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Channel Messages</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedChannel ? `Showing messages from: ${selectedChannel}` : 'Showing messages from all channels'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-400">
                      <span className="mr-2">Export:</span>
                      <select 
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                        className="bg-gray-900/50 border border-gray-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                      >
                        <option value="excel">Excel</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>
                    
                    <button 
                      onClick={handleExport}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm hover:bg-gray-800 transition-colors"
                    >
                      <DownloadCloud className="h-4 w-4" />
                      Export
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="p-6 border-b border-gray-800/50 bg-gray-900/30">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search messages, users, or content..."
                      className="w-full bg-gray-900/50 border border-gray-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        max={dateRange.end || formatDateForInput(new Date())}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        min={dateRange.start}
                        max={formatDateForInput(new Date())}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={resetFilters}
                    className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-sm hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    Reset Filters
                  </button>
                </div>

                {/* Active Filters */}
                {(searchTerm || dateRange.start || dateRange.end) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {searchTerm && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                        Search: &quot;{searchTerm}&quot;
                        <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {dateRange.start && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                        From: {dateRange.start}
                        <button onClick={() => setDateRange({...dateRange, start: ''})} className="ml-1 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {dateRange.end && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                        To: {dateRange.end}
                        <button onClick={() => setDateRange({...dateRange, end: ''})} className="ml-1 hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Messages Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900/30">
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Channel</th>
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Message</th>
                      <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-20"></div></td>
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-24"></div></td>
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-16"></div></td>
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-20"></div></td>
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-32"></div></td>
                          <td className="p-6"><div className="h-4 bg-gray-800 rounded w-10"></div></td>
                        </tr>
                      ))
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-900/50 mb-4">
                            <AlertCircle className="h-8 w-8 text-gray-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">No messages found</h3>
                          <p className="text-gray-400">Try adjusting your filters or add more channels</p>
                        </td>
                      </tr>
                    ) : filteredLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-900/30 transition-all duration-200">
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              log.type === 'Check-In' ? 'bg-green-500/10' :
                              log.type === 'Check-Out' ? 'bg-red-500/10' :
                              'bg-blue-500/10'
                            }`}>
                              <Hash className={`h-4 w-4 ${
                                log.type === 'Check-In' ? 'text-green-400' :
                                log.type === 'Check-Out' ? 'text-red-400' :
                                'text-blue-400'
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-mono text-gray-300">
                                {log.channelId || log.channel || (log.type === 'Check-In' ? 'C0ABB105W3S' : 'C0AAGM79J6N')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {log.type === 'Check-In' ? 'Check-in' :
                                 log.type === 'Check-Out' ? 'Check-out' : 'General'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div>
                            <p className="font-medium text-white">{log.userName}</p>
                            <p className="text-sm text-gray-400">{log.userId}</p>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            log.type === 'Check-In' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            log.type === 'Check-Out' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {log.type || 'Message'}
                          </span>
                        </td>
                        <td className="p-6">
                          <div>
                            <p className="font-mono text-white">{log.time}</p>
                            <p className="text-sm text-gray-400">{log.date}</p>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="max-w-xs">
                            <p className="text-gray-300 text-sm mb-2">{log.text || 'No message'}</p>
                            {log.imageUrl && (
                              <div className="flex items-center gap-2 text-blue-400">
                                <Eye className="h-3 w-3" />
                                <span className="text-xs">Has attachment</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            {log.imageUrl && (
                              <a
                                href={log.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-blue-500/10 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              {filteredLogs.length > 0 && (
                <div className="p-6 border-t border-gray-800/50">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-400">
                      Showing {filteredLogs.length} of {logs.length} messages • 
                      Last updated: {new Date().toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-400">
                        Channels: <span className="text-white font-semibold">{channels.length}</span> • 
                        Users: <span className="text-white font-semibold">{uniqueUsers.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Activity Summary */}
            <div className="mt-6 bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Top Users</h3>
                <span className="text-sm text-gray-400">{uniqueUsers.length} unique users</span>
              </div>
              
              <div className="space-y-4">
                {uniqueUsers.slice(0, 5).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-800/30 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-gray-400">Last seen: {user.lastSeen}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{user.messageCount}</p>
                      <p className="text-sm text-gray-400">messages</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}