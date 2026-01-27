/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useMemo } from 'react'; // ✅ Added React import
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { 
  Clock, 
  Users, 
  CheckCircle, 
  LogOut, 
  Coffee, 
  Trash2, 
  ChevronRight, 
  Search, 
  Download, 
  X, 
  TrendingUp,
  User,
  Filter,
  ChevronDown,
  Eye,
  Shield,
  RefreshCw,
  FileText,
  CalendarDays,
  Clock4,
  Key,
  Crown,
  Sparkles,
  Zap,
  Database,
  AlertCircle,
  BarChart3,
  Home,
  FileSpreadsheet,
  ExternalLink,
  DownloadCloud,
  Hash,
  Activity,
  Calendar,
  MessageSquare,
  Image as ImageIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, parseISO, isValid } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Emoji mapping for Slack shortcodes
const emojiMap: Record<string, string> = {
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✅',
  ':ballot_box_with_check:': '☑️',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':exclamation:': '❗',
  ':question:': '❓',
  ':smile:': '😊',
  ':simple_smile:': '🙂',
  ':joy:': '😂',
  ':sob:': '😭',
  ':sweat_smile:': '😅',
  ':thumbsup:': '👍',
  ':+1:': '👍',
  ':thumbsdown:': '👎',
  ':-1:': '👎',
  ':ok_hand:': '👌',
  ':wave:': '👋',
  ':clap:': '👏',
  ':house:': '🏠',
  ':house_with_garden:': '🏡',
  ':office:': '🏢',
  ':briefcase:': '💼',
  ':computer:': '💻',
  ':airplane:': '✈️',
  ':car:': '🚗',
  ':oncoming_automobile:': '🚘',
  ':train:': '🚆',
  ':bus:': '🚌',
  ':palm_tree:': '🌴',
  ':beach_with_umbrella:': '🏖️',
  ':sun_with_face:': '🌞',
  ':hospital:': '🏥',
  ':pill:': '💊',
  ':thermometer:': '🌡️',
  ':mask:': '😷',
  ':face_with_thermometer:': '🤒',
  ':tada:': '🎉',
  ':fire:': '🔥',
  ':100:': '💯',
  ':heart:': '❤️',
  ':clock1:': '🕐',
  ':clock2:': '🕑',
  ':clock3:': '🕒',
  ':clock4:': '🕓',
  ':clock5:': '🕔',
  ':clock6:': '🕕',
  ':clock7:': '🕖',
  ':clock8:': '🕗',
  ':clock9:': '🕘',
  ':clock10:': '🕙',
  ':clock11:': '🕚',
  ':clock12:': '🕛',
  ':bell:': '🔔',
  ':alarm_clock:': '⏰',
  ':stopwatch:': '⏱️',
  ':hourglass:': '⏳',
  ':calendar:': '📅',
  ':date:': '📅',
  ':spiral_calendar_pad:': '📅',
  ':memo:': '📝',
  ':pencil:': '✏️',
  ':paperclip:': '📎',
  ':link:': '🔗',
  ':pushpin:': '📌',
  ':round_pushpin:': '📍',
  ':scissors:': '✂️',
  ':lock:': '🔒',
  ':unlock:': '🔓',
  ':key:': '🔑',
  ':mag:': '🔍',
  ':mag_right:': '🔎',
  ':bulb:': '💡',
  ':flashlight:': '🔦',
  ':battery:': '🔋',
  ':electric_plug:': '🔌',
  ':moneybag:': '💰',
  ':dollar:': '💵',
  ':yen:': '💴',
  ':euro:': '💶',
  ':pound:': '💷',
  ':email:': '📧',
  ':incoming_envelope:': '📨',
  ':envelope_with_arrow:': '📩',
  ':outbox_tray:': '📤',
  ':inbox_tray:': '📥',
  ':package:': '📦',
  ':mailbox:': '📫',
  ':mailbox_closed:': '📪',
  ':mailbox_with_mail:': '📬',
  ':mailbox_with_no_mail:': '📭',
  ':postbox:': '📮',
  ':postal_horn:': '📯',
  ':newspaper:': '📰',
  ':iphone:': '📱',
  ':calling:': '📲',
  ':vibration_mode:': '📳',
  ':mobile_phone_off:': '📴',
  ':no_mobile_phones:': '📵',
  ':signal_strength:': '📶',
  ':camera:': '📷',
  ':video_camera:': '📹',
  ':tv:': '📺',
  ':radio:': '📻',
  ':vhs:': '📼',
  ':film_projector:': '📽️',
  ':prayer_beads:': '📿',
  ':twisted_rightwards_arrows:': '🔀',
  ':repeat:': '🔁',
  ':repeat_one:': '🔂',
  ':arrow_forward:': '▶️',
  ':fast_forward:': '⏩',
  ':next_track_button:': '⏭️',
  ':play_or_pause_button:': '⏯️',
  ':arrow_backward:': '◀️',
  ':rewind:': '⏪',
  ':previous_track_button:': '⏮️',
  ':arrow_up_small:': '🔼',
  ':arrow_double_up:': '⏫',
  ':arrow_down_small:': '🔽',
  ':arrow_double_down:': '⏬',
  ':pause_button:': '⏸️',
  ':stop_button:': '⏹️',
  ':record_button:': '⏺️',
  ':eject_button:': '⏏️',
  ':cinema:': '🎦',
  ':low_brightness:': '🔅',
  ':high_brightness:': '🔆',
  ':signal_strength:': '📶',
  ':vibration_mode:': '📳',
  ':mobile_phone_off:': '📴',
  ':no_mobile_phones:': '📵',
  ':signal_strength:': '📶',
  ':camera:': '📷',
  ':video_camera:': '📹',
  ':tv:': '📺',
  ':radio:': '📻',
  ':vhs:': '📼',
  ':film_projector:': '📽️',
  ':prayer_beads:': '📿',
};

// Function to convert emoji shortcodes to actual emojis
const convertEmojis = (text: string): string => {
  if (!text) return '';
  let result = text;
  
  // Replace all emoji shortcodes
  Object.entries(emojiMap).forEach(([shortcode, emoji]) => {
    const regex = new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, emoji);
  });
  
  return result;
};

// Helper functions
const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

const getGradientColor = (userId: string) => {
  const colors = [
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
  ];
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

const safeParseDate = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(0);
  const date = parseISO(dateString);
  if (isValid(date)) return date;
  const parsed = new Date(dateString);
  if (isValid(parsed)) return parsed;
  return new Date(0);
};

const calculateWorkHours = (checkInTime: string, checkOutTime: string): string => {
  if (!checkInTime || !checkOutTime) return '0h 0m';
  try {
    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let totalMinutes = hours * 60 + minutes;
      if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
      if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
      return totalMinutes;
    };
    const startMinutes = parseTime(checkInTime);
    const endMinutes = parseTime(checkOutTime);
    const diffMinutes = endMinutes < startMinutes ? (24 * 60 - startMinutes) + endMinutes : endMinutes - startMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  } catch (error) {
    return '0h 0m';
  }
};

export default function Dashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => {
        const data = d.data();
        let timestamp = null;
        if (data.ts) {
          if (data.ts instanceof Timestamp) timestamp = data.ts.toDate();
          else if (data.ts.seconds) timestamp = new Date(data.ts.seconds * 1000);
          else timestamp = new Date(data.ts);
        }
        
        // Convert emojis in text
        const convertedText = convertEmojis(data.text || '');
        
        return { 
          id: d.id, 
          ...data,
          text: convertedText,
          timestamp 
        };
      });
      setLogs(logsData);
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
    return () => unsubscribe();
  }, []);

  const employees = useMemo(() => {
    const userMap = new Map();
    logs.forEach(log => {
      // Keep the LATEST log for each user to show current status
      if (!userMap.has(log.userId) || (userMap.get(log.userId).timestamp && log.timestamp && log.timestamp > userMap.get(log.userId).timestamp)) {
        userMap.set(log.userId, {
          userId: log.userId,
          userName: log.userName,
          userImage: log.userProfilePicture || log.userImage,
          userDisplayName: log.userDisplayName,
          lastActivity: log.type,
          lastTime: log.time,
          lastDate: log.date,
          text: log.text
        });
      }
    });
    
    let filtered = Array.from(userMap.values());
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.userId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(emp => emp.lastActivity?.toLowerCase() === filterType.toLowerCase());
    }
    return filtered;
  }, [logs, searchTerm, filterType]);

  const userHistory = useMemo(() => {
    if (!selectedUser) return [];
    return logs
      .filter(log => log.userId === selectedUser)
      .sort((a, b) => {
        const dateA = a.timestamp || new Date(0);
        const dateB = b.timestamp || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [logs, selectedUser]);

  useEffect(() => {
    if (selectedUser && employees.length > 0) {
      const user = employees.find(e => e.userId === selectedUser);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (user) setSelectedUserDetails(user);
    }
  }, [selectedUser, employees]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this record?")) {
      await deleteDoc(doc(db, "attendance", id));
    }
  };

  const getDetailedReportData = (logsData: any[]) => {
    const userMap = new Map<string, any>();
    
    logsData.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          userName: log.userName,
          userId: log.userId,
          userProfilePicture: log.userProfilePicture || log.userImage,
          userDisplayName: log.userDisplayName,
          days: new Map()
        });
      }
      
      const user = userMap.get(log.userId);
      let dateKey = log.date;
      if (!dateKey && log.timestamp) dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
      if (!dateKey) dateKey = 'Unknown Date';
      
      if (!user.days.has(dateKey)) {
        user.days.set(dateKey, { date: dateKey, checkIns: [], checkOuts: [], leaves: [] });
      }
      
      const day = user.days.get(dateKey);
      const record = { 
        id: log.id,
        time: log.time, 
        message: log.text || '', 
        image: log.imageUrl || null, 
        timestamp: log.timestamp 
      };
      
      if (log.type?.toLowerCase() === 'check-in') day.checkIns.push(record);
      else if (log.type?.toLowerCase() === 'check-out') day.checkOuts.push(record);
      else if (log.type?.toLowerCase() === 'leave') day.leaves.push(record);
    });
    
    return Array.from(userMap.values()).map(user => ({
      employeeName: user.userName,
      employeeId: user.userId,
      profilePicture: user.userProfilePicture,
      displayName: user.userDisplayName,
      days: Array.from(user.days.values()).sort((a: any, b: any) => {
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        return dateB.getTime() - dateA.getTime();
      })
    }));
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const reportData = getDetailedReportData(data);
    if (reportData.length === 0) return;
    
    const user = reportData[0];
    const wsData = [
      ['EMPLOYEE ATTENDANCE REPORT'],
      [`Employee: ${user.employeeName} (${user.employeeId})`],
      [''],
      ['Date', 'Check-In', 'Check-Out', 'Work Hours', 'Status', 'Messages', 'Images']
    ];

    user.days.forEach(day => {
      const checkIn = day.checkIns.length > 0 ? day.checkIns[0].time : '-';
      const checkOut = day.checkOuts.length > 0 ? day.checkOuts[day.checkOuts.length - 1].time : '-';
      let workHours = '-';
      if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
        workHours = calculateWorkHours(day.checkIns[0].time, day.checkOuts[day.checkOuts.length - 1].time);
      }
      const status = day.leaves.length > 0 ? 'Leave' : (day.checkIns.length > 0 ? 'Present' : 'Absent');
      const messages = [...day.checkIns, ...day.checkOuts, ...day.leaves]
        .map(r => r.message)
        .filter(Boolean)
        .join(' | ');
      const images = [...day.checkIns, ...day.checkOuts, ...day.leaves]
        .filter(r => r.image)
        .map(r => 'Yes')
        .join(', ') || 'No';

      wsData.push([day.date, checkIn, checkOut, workHours, status, messages, images]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = (data: any[], fileName: string) => {
    const reportData = getDetailedReportData(data);
    if (reportData.length === 0) return;
    
    const user = reportData[0];
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Employee: ${user.employeeName}`, 14, 30);
    doc.text(`ID: ${user.employeeId}`, 14, 37);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd')}`, 14, 44);

    const rows = user.days.map(day => {
      const checkIn = day.checkIns.length > 0 ? day.checkIns[0].time : '-';
      const checkOut = day.checkOuts.length > 0 ? day.checkOuts[day.checkOuts.length - 1].time : '-';
      let workHours = '-';
      if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
        workHours = calculateWorkHours(day.checkIns[0].time, day.checkOuts[day.checkOuts.length - 1].time);
      }
      const status = day.leaves.length > 0 ? 'Leave' : (day.checkIns.length > 0 ? 'Present' : 'Absent');
      return [day.date, checkIn, checkOut, workHours, status];
    });

    autoTable(doc, {
      head: [['Date', 'Check-In', 'Check-Out', 'Hours', 'Status']],
      body: rows,
      startY: 50,
    });

    doc.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const getActivityType = (type: string) => {
    switch(type?.toLowerCase()) {
      case 'check-in': return { 
        label: 'Check-In', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/20', 
        statusColor: 'bg-emerald-500',
        icon: CheckCircle 
      };
      case 'check-out': return { 
        label: 'Check-Out', 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10', 
        border: 'border-rose-500/20', 
        statusColor: 'bg-rose-500',
        icon: LogOut 
      };
      case 'leave': return { 
        label: 'Leave', 
        color: 'text-blue-400', 
        bg: 'bg-blue-500/10', 
        border: 'border-blue-500/20', 
        statusColor: 'bg-blue-500',
        icon: Coffee 
      };
      default: return { 
        label: type || 'Unknown', 
        color: 'text-gray-400', 
        bg: 'bg-gray-500/10', 
        border: 'border-gray-500/20', 
        statusColor: 'bg-gray-500',
        icon: Activity 
      };
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(log => log.date === today);
    return {
      totalEmployees: employees.length,
      activeToday: todayLogs.filter(log => log.type === 'Check-In').length,
      checkIns: logs.filter(log => log.type === 'Check-In').length,
      checkOuts: logs.filter(log => log.type === 'Check-Out').length,
      leaves: logs.filter(log => log.type === 'Leave').length,
      todayCheckIns: todayLogs.filter(log => log.type === 'Check-In').length,
      todayCheckOuts: todayLogs.filter(log => log.type === 'Check-Out').length,
    };
  }, [logs, employees]);

  // Get all records for the selected user, flattened by day
  const getUserRecordsByDay = () => {
    if (!selectedUser) return [];
    
    const userRecords = logs.filter(log => log.userId === selectedUser);
    const recordsByDay = new Map();
    
    userRecords.forEach(record => {
      const date = record.date || format(record.timestamp || new Date(), 'yyyy-MM-dd');
      if (!recordsByDay.has(date)) {
        recordsByDay.set(date, {
          date,
          records: []
        });
      }
      recordsByDay.get(date).records.push(record);
    });
    
    return Array.from(recordsByDay.values())
      .sort((a, b) => {
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        return dateB.getTime() - dateA.getTime();
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 text-white font-sans">
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-cyan-500 to-purple-600 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Workforce Pro
              </h1>
              <p className="text-xs text-gray-400">Slack Attendance Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="text-gray-300">{lastUpdate}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-5 hover:border-cyan-500/30 transition-colors">
            <div className="flex justify-between">
              <div><p className="text-gray-400 text-sm">Total Staff</p><p className="text-2xl font-bold text-white">{stats.totalEmployees}</p></div>
              <Users className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-5 hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between">
              <div><p className="text-gray-400 text-sm">Today&apos;s Active</p><p className="text-2xl font-bold text-emerald-400">{stats.todayCheckIns}</p></div>
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-5 hover:border-rose-500/30 transition-colors">
            <div className="flex justify-between">
              <div><p className="text-gray-400 text-sm">Today&apos;s Check-outs</p><p className="text-2xl font-bold text-rose-400">{stats.todayCheckOuts}</p></div>
              <LogOut className="h-5 w-5 text-rose-400" />
            </div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-5 hover:border-amber-500/30 transition-colors">
            <div className="flex justify-between">
              <div><p className="text-gray-400 text-sm">On Leave</p><p className="text-2xl font-bold text-amber-300">{stats.leaves}</p></div>
              <Coffee className="h-5 w-5 text-amber-300" />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search employee by name or ID..."
              className="w-full bg-gray-900/50 border border-gray-800 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-cyan-500/50 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {['All', 'Check-In', 'Check-Out', 'Leave'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type.toLowerCase())}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterType === type.toLowerCase() 
                    ? type === 'Check-In' ? 'bg-emerald-500 text-white' 
                    : type === 'Check-Out' ? 'bg-rose-500 text-white'
                    : type === 'Leave' ? 'bg-blue-500 text-white'
                    : 'bg-cyan-500 text-white'
                    : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {employees.map((emp) => {
            const activity = getActivityType(emp.lastActivity);
            const gradient = getGradientColor(emp.userId);
            const ActivityIcon = activity.icon;
            
            return (
              <div 
                key={emp.userId} 
                onClick={() => setSelectedUser(emp.userId)}
                className="group bg-gray-900/30 border border-gray-800/50 rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-gray-900/50 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`h-16 w-16 rounded-xl overflow-hidden ${emp.userImage ? 'bg-transparent' : `bg-gradient-to-br ${gradient}`} border-2 border-gray-700 group-hover:border-cyan-500/50 transition-all`}>
                    {emp.userImage ? (
                      <img src={emp.userImage} alt={emp.userName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xl font-bold">{getInitials(emp.userName)}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg truncate">{emp.userName}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Key className="h-3 w-3" />
                      {emp.userId}
                    </div>
                  </div>
                </div>
                
                <div className={`p-3 rounded-xl ${activity.bg} border ${activity.border} mb-4`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <ActivityIcon className="h-4 w-4" />
                      <span className={`text-sm font-bold ${activity.color}`}>{activity.label}</span>
                    </div>
                    <span className="text-xs text-gray-400">{emp.lastTime}</span>
                  </div>
                  <div className="text-xs text-gray-500">{emp.lastDate}</div>
                  {emp.text && (
                    <div className="mt-2 text-xs text-gray-400 truncate">
                      &quot;{emp.text}&quot;
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-gray-800/50">
                  <span className="flex items-center gap-1 group-hover:text-cyan-400 transition-colors">
                    View History <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Employee History Modal */}
      {selectedUser && selectedUserDetails && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-6xl max-h-[90vh] rounded-2xl border border-gray-800 shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-start bg-gray-950/50 rounded-t-2xl">
              <div className="flex items-center gap-5">
                <div className={`h-20 w-20 rounded-2xl overflow-hidden ${selectedUserDetails.userImage ? '' : `bg-gradient-to-br ${getGradientColor(selectedUserDetails.userId)}`} border-2 border-gray-700`}>
                  {selectedUserDetails.userImage ? (
                    <img src={selectedUserDetails.userImage} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl font-bold">{getInitials(selectedUserDetails.userName)}</div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedUserDetails.userName}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {selectedUserDetails.userId}
                    </span>
                    {selectedUserDetails.userDisplayName && (
                      <span className="text-sm text-gray-400">@{selectedUserDetails.userDisplayName}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    const data = userHistory;
                    if (exportFormat === 'excel') exportToExcel(data, selectedUserDetails.userName);
                    else exportToPDF(data, selectedUserDetails.userName);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors"
                  title="Download Report"
                >
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Export</span>
                </button>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content - History Table */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-cyan-400" />
                  Attendance History ({userHistory.length} records)
                </h3>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">
                    Format:
                    <select 
                      className="ml-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-gray-300"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    >
                      <option value="excel">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </div>
                </div>
              </div>

              {userHistory.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No attendance records found</p>
                </div>
              ) : (
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Time</th>
                        <th className="p-4 font-medium">Type</th>
                        <th className="p-4 font-medium">Message</th>
                        <th className="p-4 font-medium">Attachment</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {getUserRecordsByDay().map((dayGroup, dayIndex) => (
                        <React.Fragment key={dayIndex}>
                          {dayGroup.records.map((record: any, recordIndex: number) => {
                            const activity = getActivityType(record.type);
                            const ActivityIcon = activity.icon;
                            const isFirstOfDay = recordIndex === 0;
                            
                            return (
                              <tr key={record.id} className="hover:bg-gray-800/30 transition-colors group">
                                <td className="p-4">
                                  {isFirstOfDay ? (
                                    <div className="font-medium text-white flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-cyan-400" />
                                      {dayGroup.date}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="p-4 text-gray-300">
                                  <div className="flex items-center gap-2">
                                    <Clock4 className="h-4 w-4 text-gray-500" />
                                    {record.time}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${activity.bg} border ${activity.border}`}>
                                    <ActivityIcon className="h-3 w-3" />
                                    <span className={`text-xs font-bold ${activity.color}`}>
                                      {activity.label}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 text-gray-300 max-w-xs">
                                  {record.text ? (
                                    <div className="flex items-start gap-2">
                                      <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                      <span className="break-words">{record.text}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 italic">No message</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {record.imageUrl ? (
                                    <a 
                                      href={record.imageUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                      <span className="text-xs">View</span>
                                    </a>
                                  ) : (
                                    <span className="text-gray-500 text-xs">No</span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  <button 
                                    onClick={(e) => handleDelete(record.id, e)}
                                    className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete record"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Last updated: {lastUpdate}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    const data = userHistory;
                    if (exportFormat === 'excel') exportToExcel(data, selectedUserDetails.userName);
                    else exportToPDF(data, selectedUserDetails.userName);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export {exportFormat.toUpperCase()} Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}