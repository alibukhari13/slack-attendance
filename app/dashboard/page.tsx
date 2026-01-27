/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { 
  Clock, 
  Users, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Download, 
  Filter, 
  Search, 
  Calendar,
  ChevronRight,
  Trash2,
  Eye,
  MoreVertical,
  TrendingUp,
  UserCheck,
  BarChart3,
  X,
  ChevronDown,
  FileText,
  Shield,
  AlertCircle,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  ExternalLink,
  DownloadCloud,
  Home,
  LogOut,
  Coffee,
  CalendarDays,
  Clock4,
  FileBarChart,
  User,
  Hash,
  Target,
  Award,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, isValid, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Define TypeScript interfaces
interface CheckInOutRecord {
  time: string;
  message: string;
  image: string | null;
  timestamp: Date | null;
}

interface LeaveRecord {
  time: string;
  message: string;
  image: string | null;
  timestamp: Date | null;
}

interface DayRecord {
  date: string;
  checkIns: CheckInOutRecord[];
  checkOuts: CheckInOutRecord[];
  leaves: LeaveRecord[];
}

interface UserReport {
  employeeName: string;
  employeeId: string;
  profilePicture: string | null;
  displayName: string | null;
  days: DayRecord[];
}

// Helper function to safely parse dates
const safeParseDate = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(0);
  
  const date = parseISO(dateString);
  if (isValid(date)) return date;
  
  const parsed = new Date(dateString);
  if (isValid(parsed)) return parsed;
  
  return new Date(0);
};

// Helper function to calculate hours between check-in and check-out
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
    
    // Handle overnight work (if check-out is before check-in, assume next day)
    const diffMinutes = endMinutes < startMinutes 
      ? (24 * 60 - startMinutes) + endMinutes 
      : endMinutes - startMinutes;
    
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
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => {
        const data = d.data();
        let timestamp = null;
        
        if (data.ts) {
          if (data.ts instanceof Timestamp) {
            timestamp = data.ts.toDate();
          } else if (data.ts.seconds) {
            timestamp = new Date(data.ts.seconds * 1000);
          } else {
            timestamp = new Date(data.ts);
          }
        }
        
        return { 
          id: d.id, 
          ...data,
          timestamp: timestamp
        };
      });
      setLogs(logsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Permanently delete this record?")) {
      await deleteDoc(doc(db, "attendance", id));
    }
  };

  // Get unique users for latest reports
  const latestReports = useMemo(() => {
    const userMap = new Map();
    logs.forEach(log => {
      if (!userMap.has(log.userId) || 
          (userMap.get(log.userId).timestamp && log.timestamp && 
           log.timestamp > userMap.get(log.userId).timestamp)) {
        userMap.set(log.userId, log);
      }
    });
    return Array.from(userMap.values());
  }, [logs]);

  // Get user history when user is selected
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

  // Apply all filters
  const filteredLogs = useMemo(() => {
    return latestReports.filter(log => {
      // Search filter
      const matchesSearch = 
        searchTerm === '' ||
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.text?.toLowerCase().includes(searchTerm.toLowerCase());

      // Type filter
      const matchesFilter = 
        filterType === 'all' || 
        log.type?.toLowerCase() === filterType.toLowerCase();

      // Date range filter
      let matchesDateRange = true;
      if (dateRange.start && log.timestamp) {
        const logDate = new Date(log.timestamp);
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        matchesDateRange = logDate >= startDate;
      }
      if (dateRange.end && log.timestamp) {
        const logDate = new Date(log.timestamp);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && logDate <= endDate;
      }

      return matchesSearch && matchesFilter && matchesDateRange;
    });
  }, [latestReports, searchTerm, filterType, dateRange]);

  // Group logs by user and date for detailed report
  const getDetailedReportData = (logsData: any[]): UserReport[] => {
    const userMap = new Map<string, {
      userName: string;
      userId: string;
      userProfilePicture: string | null;
      userDisplayName: string | null;
      days: Map<string, DayRecord>;
    }>();
    
    logsData.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          userName: log.userName,
          userId: log.userId,
          userProfilePicture: log.userProfilePicture,
          userDisplayName: log.userDisplayName,
          days: new Map()
        });
      }
      
      const user = userMap.get(log.userId)!;
      let dateKey: string;
      
      if (log.date) {
        dateKey = log.date;
      } else if (log.timestamp) {
        dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
      } else {
        dateKey = format(new Date(), 'yyyy-MM-dd');
      }
      
      if (!user.days.has(dateKey)) {
        user.days.set(dateKey, {
          date: dateKey,
          checkIns: [],
          checkOuts: [],
          leaves: []
        });
      }
      
      const day = user.days.get(dateKey)!;
      if (log.type?.toLowerCase() === 'check-in') {
        day.checkIns.push({
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || null,
          timestamp: log.timestamp
        });
        // Sort check-ins by time
        day.checkIns.sort((a, b) => {
          const timeA = a.time?.toLowerCase() || '';
          const timeB = b.time?.toLowerCase() || '';
          return timeA.localeCompare(timeB);
        });
      } else if (log.type?.toLowerCase() === 'check-out') {
        day.checkOuts.push({
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || null,
          timestamp: log.timestamp
        });
        // Sort check-outs by time
        day.checkOuts.sort((a, b) => {
          const timeA = a.time?.toLowerCase() || '';
          const timeB = b.time?.toLowerCase() || '';
          return timeA.localeCompare(timeB);
        });
      } else if (log.type?.toLowerCase() === 'leave') {
        day.leaves.push({
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || null,
          timestamp: log.timestamp
        });
      }
    });
    
    return Array.from(userMap.values()).map(user => ({
      employeeName: user.userName,
      employeeId: user.userId,
      profilePicture: user.userProfilePicture,
      displayName: user.userDisplayName,
      days: Array.from(user.days.values()).sort((a, b) => {
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        return dateB.getTime() - dateA.getTime();
      })
    }));
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const checkIns = logs.filter(log => log.type?.toLowerCase() === 'check-in').length;
    const checkOuts = logs.filter(log => log.type?.toLowerCase() === 'check-out').length;
    const leaves = logs.filter(log => log.type?.toLowerCase() === 'leave').length;
    
    // Calculate average check-in time
    const checkInTimes = logs
      .filter(log => log.type?.toLowerCase() === 'check-in' && log.time)
      .map(log => {
        const timeStr = log.time;
        const [time, period] = timeStr?.split(' ') || ['09:00', 'AM'];
        // eslint-disable-next-line prefer-const
        let [hours, minutes] = time.split(':').map(Number);
        
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      });

    const avgCheckInMinutes = checkInTimes.length > 0 
      ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
      : 540;
    
    const avgHours = Math.floor(avgCheckInMinutes / 60);
    const avgMinutes = avgCheckInMinutes % 60;
    const formattedHours = avgHours > 12 ? avgHours - 12 : avgHours;
    const avgTime = `${formattedHours.toString().padStart(2, '0')}:${avgMinutes.toString().padStart(2, '0')} ${avgHours >= 12 ? 'PM' : 'AM'}`;

    return {
      totalLogs: logs.length,
      activeMembers: latestReports.length,
      checkIns,
      checkOuts,
      leaves,
      avgCheckInTime: avgTime,
      systemUptime: '99.9%',
      totalEmployees: new Set(logs.map(log => log.userId)).size
    };
  }, [logs, latestReports]);

  // Export to Excel with detailed formatting
  const exportToExcelDetailed = (data: any[], fileName: string, isSingleUser = false) => {
    const wb = XLSX.utils.book_new();
    const reportData = getDetailedReportData(data);
    
    if (isSingleUser && reportData.length > 0) {
      // Single user detailed report
      const user = reportData[0];
      const wsData = [
        ['EMPLOYEE ATTENDANCE DETAILED REPORT'],
        [''],
        [`Employee Name: ${user.employeeName}`],
        [`Employee ID: ${user.employeeId}`],
        [`Report Date: ${format(new Date(), 'MMMM dd, yyyy')}`],
        [''],
        ['Date', 'Check-In Count', 'Check-In Times', 'Check-In Messages', 'Check-Out Count', 'Check-Out Times', 'Check-Out Messages', 'Leave Status', 'Work Hours']
      ];
      
      user.days.forEach((day: DayRecord) => {
        const checkInTimes = day.checkIns.map(c => c.time).join(', ') || '-';
        const checkInMessages = day.checkIns.map(c => c.message).join(' | ') || '-';
        const checkOutTimes = day.checkOuts.map(c => c.time).join(', ') || '-';
        const checkOutMessages = day.checkOuts.map(c => c.message).join(' | ') || '-';
        const leaveStatus = day.leaves.length > 0 ? 'On Leave' : 'Present';
        
        let workHours = '0h 0m';
        if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
          const firstCheckIn = day.checkIns[0];
          const lastCheckOut = day.checkOuts[day.checkOuts.length - 1];
          workHours = calculateWorkHours(firstCheckIn.time, lastCheckOut.time);
        }
        
        wsData.push([
          day.date,
          day.checkIns.length,
          checkInTimes,
          checkInMessages,
          day.checkOuts.length,
          checkOutTimes,
          checkOutMessages,
          leaveStatus,
          workHours
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      const colWidths = [
        { wch: 15 },  // Date
        { wch: 12 },  // Check-In Count
        { wch: 25 },  // Check-In Times
        { wch: 40 },  // Check-In Messages
        { wch: 12 },  // Check-Out Count
        { wch: 25 },  // Check-Out Times
        { wch: 40 },  // Check-Out Messages
        { wch: 12 },  // Leave Status
        { wch: 15 },  // Work Hours
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
    } else {
      // Multiple users summary report
      const summaryWsData = [
        ['ATTENDANCE SUMMARY REPORT'],
        [''],
        [`Report Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`],
        [`Total Employees: ${reportData.length}`],
        [''],
        ['Employee Name', 'Employee ID', 'Total Days', 'Total Check-Ins', 'Total Check-Outs', 'Leave Days', 'Avg. Work Hours/Day', 'Status', 'Last Activity']
      ];
      
      reportData.forEach(user => {
        const totalDays = user.days.length;
        const totalCheckIns = user.days.reduce((sum, day) => sum + day.checkIns.length, 0);
        const totalCheckOuts = user.days.reduce((sum, day) => sum + day.checkOuts.length, 0);
        const leaveDays = user.days.filter(day => day.leaves.length > 0).length;
        
        // Calculate average work hours
        let totalWorkMinutes = 0;
        let workedDays = 0;
        
        user.days.forEach((day: DayRecord) => {
          if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
            const firstCheckIn = day.checkIns[0];
            const lastCheckOut = day.checkOuts[day.checkOuts.length - 1];
            const workHours = calculateWorkHours(firstCheckIn.time, lastCheckOut.time);
            const [hours, minutes] = workHours.split(' ')[0].split('h');
            totalWorkMinutes += parseInt(hours) * 60 + parseInt(minutes);
            workedDays++;
          }
        });
        
        const avgWorkHours = workedDays > 0 
          ? `${Math.floor(totalWorkMinutes / workedDays / 60)}h ${Math.round(totalWorkMinutes / workedDays % 60)}m` 
          : '0h 0m';
        
        const lastDay = user.days[0];
        let lastActivity = 'No activity';
        if (lastDay) {
          if (lastDay.leaves.length > 0) {
            lastActivity = `Leave (${lastDay.leaves[0]?.time || 'N/A'})`;
          } else if (lastDay.checkIns.length > 0) {
            lastActivity = `Check-In (${lastDay.checkIns[0]?.time || 'N/A'})`;
          } else if (lastDay.checkOuts.length > 0) {
            lastActivity = `Check-Out (${lastDay.checkOuts[0]?.time || 'N/A'})`;
          }
        }
        
        const status = leaveDays > 0 ? 'On Leave' : (totalCheckIns > 0 ? 'Active' : 'Inactive');
        
        summaryWsData.push([
          user.employeeName,
          user.employeeId,
          totalDays,
          totalCheckIns,
          totalCheckOuts,
          leaveDays,
          avgWorkHours,
          status,
          lastActivity
        ]);
      });
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData);
      summaryWs['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 20 }
      ];
      
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    }
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `${fileName}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = (data: any[], fileName: string, isSingleUser = false) => {
    const doc = new jsPDF();
    const reportData = getDetailedReportData(data);
    
    // Add header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('ATTENDANCE REPORT', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, 105, 22, { align: 'center' });
    
    let yPos = 30;
    
    if (isSingleUser && reportData.length > 0) {
      const user = reportData[0];
      
      // User info
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text(`Employee: ${user.employeeName}`, 14, yPos);
      doc.text(`ID: ${user.employeeId}`, 14, yPos + 7);
      
      yPos += 20;
      
      // Table headers
      const headers = [['Date', 'Check-Ins', 'Check-Outs', 'Leave', 'Work Hours', 'Messages']];
      
      // Table data
      const tableData = user.days.map((day: DayRecord) => {
        const checkInCount = day.checkIns.length;
        const checkOutCount = day.checkOuts.length;
        const leaveStatus = day.leaves.length > 0 ? 'Yes' : 'No';
        
        let workHours = '0h 0m';
        if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
          const firstCheckIn = day.checkIns[0];
          const lastCheckOut = day.checkOuts[day.checkOuts.length - 1];
          workHours = calculateWorkHours(firstCheckIn.time, lastCheckOut.time);
        }
        
        const messages = [
          ...day.checkIns.map(c => c.message),
          ...day.checkOuts.map(c => c.message),
          ...day.leaves.map(l => l.message)
        ].filter(m => m && m !== 'No message').join('; ') || 'None';
        
        return [
          day.date,
          checkInCount > 0 ? `${checkInCount} (${day.checkIns.map(c => c.time).join(', ')})` : '0',
          checkOutCount > 0 ? `${checkOutCount} (${day.checkOuts.map(c => c.time).join(', ')})` : '0',
          leaveStatus,
          workHours,
          messages.substring(0, 40) + (messages.length > 40 ? '...' : '')
        ];
      });
      
      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { top: 10 }
      });
    } else {
      // Summary for all users
      doc.setFontSize(12);
      doc.text(`Total Employees: ${reportData.length}`, 14, yPos);
      yPos += 10;
      
      const headers = [['Employee Name', 'Employee ID', 'Total Days', 'Check-Ins', 'Check-Outs', 'Leaves', 'Status']];
      
      const tableData = reportData.map(user => {
        const totalDays = user.days.length;
        const totalCheckIns = user.days.reduce((sum, day) => sum + day.checkIns.length, 0);
        const totalCheckOuts = user.days.reduce((sum, day) => sum + day.checkOuts.length, 0);
        const leaveDays = user.days.filter(day => day.leaves.length > 0).length;
        const status = leaveDays > 0 ? 'On Leave' : (totalCheckIns > 0 ? 'Active' : 'Inactive');
        
        return [
          user.employeeName,
          user.employeeId,
          totalDays.toString(),
          totalCheckIns.toString(),
          totalCheckOuts.toString(),
          leaveDays.toString(),
          status
        ];
      });
      
      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { top: 10 },
        pageBreak: 'auto'
      });
    }
    
    doc.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Handle export based on selected format
  const handleExport = (data: any[], fileName: string, isSingleUser = false) => {
    if (exportFormat === 'excel') {
      exportToExcelDetailed(data, fileName, isSingleUser);
    } else {
      exportToPDF(data, fileName, isSingleUser);
    }
  };

  // Export current view
  const handleExportCurrentView = () => {
    const userIds = filteredLogs.map(log => log.userId);
    const filteredLogsForUsers = logs.filter(log => userIds.includes(log.userId));
    handleExport(filteredLogsForUsers, 'Attendance_Current_View');
  };

  // Export full history
  const handleExportFullHistory = () => {
    handleExport(logs, 'Attendance_Full_History');
  };

  // Export user history
  const handleExportUserHistory = () => {
    if (selectedUser && userHistory.length > 0) {
      handleExport(userHistory, `Attendance_${selectedUserDetails?.userName}_History`, true);
    }
  };

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setDateRange({ start: '', end: '' });
  };

  // When user is selected, get their details
  useEffect(() => {
    if (selectedUser && userHistory.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedUserDetails(userHistory[0]);
    }
  }, [selectedUser, userHistory]);

  // Calculate user statistics
  const getUserStats = (userId: string) => {
    const userLogs = logs.filter(log => log.userId === userId);
    const checkIns = userLogs.filter(log => log.type?.toLowerCase() === 'check-in').length;
    const checkOuts = userLogs.filter(log => log.type?.toLowerCase() === 'check-out').length;
    const leaves = userLogs.filter(log => log.type?.toLowerCase() === 'leave').length;
    const daysPresent = new Set(userLogs.map(log => log.date)).size;
    
    return { checkIns, checkOuts, leaves, daysPresent };
  };

  // Get detailed user report data for modal
  const getUserDetailedReport = (): UserReport | null => {
    if (!selectedUser || userHistory.length === 0) return null;
    const reportData = getDetailedReportData(userHistory);
    return reportData[0] || null;
  };

  // Get status color based on type
  const getStatusColor = (type: string) => {
    switch(type?.toLowerCase()) {
      case 'check-in': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'check-out': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'leave': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Get status icon based on type
  const getStatusIcon = (type: string) => {
    switch(type?.toLowerCase()) {
      case 'check-in': return <CheckCircle className="h-3 w-3" />;
      case 'check-out': return <LogOut className="h-3 w-3" />;
      case 'leave': return <Coffee className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white font-sans">
      {/* Top Navigation */}
      <nav className="bg-black/40 backdrop-blur-xl border-b border-gray-800/50 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 h-10 w-10 rounded-xl flex items-center justify-center font-bold shadow-lg">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                Attendance Pro
              </h1>
              <p className="text-xs text-gray-400">Employee Tracking & History System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-800">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-gray-300">Asia/Karachi (PKT)</span>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
              
              <button 
                onClick={handleExportFullHistory}
                className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Full History
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
                <p className="text-gray-400 text-sm font-medium mb-2">Total Employees</p>
                <p className="text-3xl font-bold text-white">{stats.totalEmployees}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-green-400">Active: {stats.activeMembers}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Total Logs</p>
                <p className="text-3xl font-bold text-white">{stats.totalLogs}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.activeMembers / Math.max(stats.totalEmployees, 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Check-Ins Today</p>
                <p className="text-3xl font-bold text-green-400">{stats.checkIns}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-gray-400">Live updates enabled</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/30 to-amber-900/10 p-6 rounded-2xl border border-amber-800/30 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-amber-200 text-sm font-medium mb-2">On Leave Today</p>
                <p className="text-3xl font-bold text-amber-300">{stats.leaves}</p>
              </div>
              <div className="p-3 bg-amber-900/30 rounded-xl">
                <Coffee className="h-6 w-6 text-amber-300" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span className="text-sm text-amber-200">{Math.round((stats.leaves / stats.totalEmployees) * 100)}% of team</span>
            </div>
          </div>
        </div>

        {/* Export Options Card */}
        <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                Export Options
              </h3>
              <p className="text-sm text-gray-400">Generate detailed attendance reports with daily check-in/out history</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleExportCurrentView}
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" />
                Export Current View
              </button>
              <button 
                onClick={handleExportFullHistory}
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl text-sm font-medium transition-all"
              >
                <Download className="h-4 w-4" />
                Full History ({exportFormat.toUpperCase()})
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search employees by name, ID, or messages..."
                  className="bg-gray-900/50 border border-gray-800 rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-sm hover:bg-gray-800 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
              <button 
                onClick={resetFilters}
                className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-sm hover:bg-gray-800 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status Filter</label>
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'}`}
                      onClick={() => setFilterType('all')}
                    >
                      All Status
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'check-in' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'}`}
                      onClick={() => setFilterType('check-in')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Check-In Only
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'check-out' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'}`}
                      onClick={() => setFilterType('check-out')}
                    >
                      <LogOut className="h-4 w-4" />
                      Check-Out Only
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'leave' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'}`}
                      onClick={() => setFilterType('leave')}
                    >
                      <Coffee className="h-4 w-4" />
                      Leave Only
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Date Range</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        max={dateRange.end || formatDateForInput(new Date())}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        min={dateRange.start}
                        max={formatDateForInput(new Date())}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Quick Actions</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setDateRange({
                        start: formatDateForInput(new Date()),
                        end: formatDateForInput(new Date())
                      })}
                      className="flex-1 px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-xl text-sm hover:bg-gray-800 transition-colors"
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setDateRange({
                          start: formatDateForInput(yesterday),
                          end: formatDateForInput(yesterday)
                        });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-xl text-sm hover:bg-gray-800 transition-colors"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {(filterType !== 'all' || dateRange.start || dateRange.end || searchTerm) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {filterType !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                  Status: {filterType === 'check-in' ? 'Check-In' : filterType === 'check-out' ? 'Check-Out' : 'Leave'}
                  <button onClick={() => setFilterType('all')} className="ml-1 hover:text-red-400">
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
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                  Search: &quot;{searchTerm}&quot;
                  <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Main Table */}
        <div className="bg-gradient-to-br from-gray-900/50 to-black/50 rounded-2xl border border-gray-800/50 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800/50">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Employee Activity</h2>
                <p className="text-sm text-gray-400 mt-1">Click on any employee to view complete daily history</p>
              </div>
              <div className="text-sm text-gray-400">
                Showing <span className="text-white font-semibold">{filteredLogs.length}</span> of <span className="text-white font-semibold">{latestReports.length}</span> employees
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/30">
                  <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                  <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Details</th>
                  <th className="text-left p-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-6"><div className="h-4 bg-gray-800 rounded w-32"></div></td>
                      <td className="p-6"><div className="h-4 bg-gray-800 rounded w-16"></div></td>
                      <td className="p-6"><div className="h-4 bg-gray-800 rounded w-24"></div></td>
                      <td className="p-6"><div className="h-4 bg-gray-800 rounded w-20"></div></td>
                      <td className="p-6"><div className="h-4 bg-gray-800 rounded w-10"></div></td>
                    </tr>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-900/50 mb-4">
                        <AlertCircle className="h-8 w-8 text-gray-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">No records found</h3>
                      <p className="text-gray-400">Try adjusting your search or filter criteria</p>
                    </td>
                  </tr>
                ) : filteredLogs.map((row: any) => {
                  const userStats = getUserStats(row.userId);
                  
                  return (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedUser(row.userId)}
                      className="hover:bg-gray-900/30 transition-all duration-200 cursor-pointer group"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {/* Profile Picture or Initial */}
                            {row.userProfilePicture ? (
                              <img 
                                src={row.userProfilePicture} 
                                alt={row.userName}
                                className="h-12 w-12 rounded-xl object-cover border-2 border-gray-700 group-hover:border-amber-500/50 transition-all duration-300"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallbackDiv = document.createElement('div');
                                    fallbackDiv.className = 'h-12 w-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center font-bold text-lg group-hover:from-amber-900/30 group-hover:to-amber-900/10 transition-all duration-300';
                                    fallbackDiv.textContent = row.userName?.charAt(0) || 'U';
                                    parent.appendChild(fallbackDiv);
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center font-bold text-lg group-hover:from-amber-900/30 group-hover:to-amber-900/10 transition-all duration-300">
                                {row.userName?.charAt(0) || 'U'}
                              </div>
                            )}
                            {row.type?.toLowerCase() === 'check-in' && (
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                            )}
                            {row.type?.toLowerCase() === 'leave' && (
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{row.userName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">
                                {row.userId}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                                {userStats.daysPresent} days
                              </span>
                              {userStats.leaves > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                                  {userStats.leaves} leaves
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getStatusColor(row.type)}`}>
                          {getStatusIcon(row.type)}
                          {row.type || 'Unknown'}
                        </div>
                      </td>
                      <td className="p-6">
                        <div>
                          <p className="font-mono text-white">{row.time}</p>
                          <p className="text-sm text-gray-400">{row.date}</p>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="max-w-xs">
                          {row.imageUrl ? (
                            <div className="flex items-center gap-2 text-amber-400">
                              <Eye className="h-4 w-4" />
                              <span className="text-sm">View Attachment</span>
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm truncate">{row.text || 'No message'}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleDelete(row.id, e)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => setSelectedUser(row.userId)}
                            className="p-2 hover:bg-amber-500/10 rounded-lg text-gray-400 hover:text-amber-400 transition-colors"
                            title="View complete history"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const userLogs = logs.filter(log => log.userId === row.userId);
                              handleExport(userLogs, `Attendance_${row.userName}_Report`, true);
                            }}
                            className="p-2 hover:bg-green-500/10 rounded-lg text-gray-400 hover:text-green-400 transition-colors"
                            title="Export individual report"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {filteredLogs.length > 0 && (
            <div className="p-6 border-t border-gray-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-400">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-400">
                  Export Format:
                  <select 
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf')}
                    className="ml-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  >
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <button 
                  onClick={handleExportCurrentView}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm hover:bg-gray-800 transition-colors"
                >
                  <DownloadCloud className="h-4 w-4" />
                  Export Current View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User History Modal */}
      {selectedUser && selectedUserDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-black">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  {selectedUserDetails.userProfilePicture ? (
                    <img 
                      src={selectedUserDetails.userProfilePicture} 
                      alt={selectedUserDetails.userName}
                      className="h-16 w-16 rounded-xl object-cover border-2 border-amber-500/50"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallbackDiv = document.createElement('div');
                          fallbackDiv.className = 'h-16 w-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-2xl font-bold';
                          fallbackDiv.textContent = selectedUserDetails.userName?.charAt(0) || 'U';
                          parent.appendChild(fallbackDiv);
                        }
                      }}
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-2xl font-bold">
                      {selectedUserDetails.userName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedUserDetails.userName}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 rounded-full text-sm">
                        <Hash className="h-3 w-3" />
                        {selectedUserDetails.userId}
                      </span>
                      {selectedUserDetails.userDisplayName && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm">
                          <User className="h-3 w-3" />
                          {selectedUserDetails.userDisplayName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="p-6">
                {/* Employee Performance Stats */}
                <div className="mb-8 bg-gray-900/30 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-amber-400" />
                    Daily Attendance History
                  </h4>
                  
                  {(() => {
                    const userReport = getUserDetailedReport();
                    if (!userReport) {
                      return (
                        <div className="text-center py-8">
                          <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-400">No attendance data available</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-800">
                              <th className="pb-3 text-left">Date</th>
                              <th className="pb-3 text-left">Check-Ins</th>
                              <th className="pb-3 text-left">Check-In Times</th>
                              <th className="pb-3 text-left">Check-Outs</th>
                              <th className="pb-3 text-left">Check-Out Times</th>
                              <th className="pb-3 text-left">Work Hours</th>
                              <th className="pb-3 text-left">Status</th>
                              <th className="pb-3 text-left">Messages</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userReport.days.map((day: DayRecord, index: number) => {
                              const checkInTimes = day.checkIns.map(c => c.time).join(', ') || '-';
                              const checkOutTimes = day.checkOuts.map(c => c.time).join(', ') || '-';
                              const messages = [
                                ...day.checkIns.map(c => c.message),
                                ...day.checkOuts.map(c => c.message),
                                ...day.leaves.map(l => l.message)
                              ].filter(m => m && m !== 'No message').join('; ') || 'None';
                              
                              let workHours = '0h 0m';
                              if (day.checkIns.length > 0 && day.checkOuts.length > 0) {
                                const firstCheckIn = day.checkIns[0];
                                const lastCheckOut = day.checkOuts[day.checkOuts.length - 1];
                                workHours = calculateWorkHours(firstCheckIn.time, lastCheckOut.time);
                              }
                              
                              return (
                                <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                                  <td className="py-4 font-medium">{day.date}</td>
                                  <td className="py-4">
                                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${day.checkIns.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                                      {day.checkIns.length}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    {day.checkIns.length > 0 ? (
                                      <div className="text-green-400 text-xs space-y-1">
                                        {day.checkIns.map((checkIn, idx) => (
                                          <div key={idx} className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {checkIn.time}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="py-4">
                                    <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${day.checkOuts.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
                                      {day.checkOuts.length}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    {day.checkOuts.length > 0 ? (
                                      <div className="text-red-400 text-xs space-y-1">
                                        {day.checkOuts.map((checkOut, idx) => (
                                          <div key={idx} className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {checkOut.time}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </td>
                                  <td className="py-4">
                                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${workHours !== '0h 0m' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                                      {workHours}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    {day.leaves.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">
                                        <Coffee className="h-3 w-3" />
                                        On Leave
                                      </span>
                                    ) : day.checkIns.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
                                        <Home className="h-3 w-3" />
                                        Present
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs">
                                        <AlertCircle className="h-3 w-3" />
                                        Absent
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 max-w-xs">
                                    <p className="text-gray-300 text-xs truncate" title={messages}>
                                      {messages}
                                    </p>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Export Options */}
                <div className="bg-gray-900/30 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Download className="h-5 w-5 text-green-400" />
                    Export Options for {selectedUserDetails.userName}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Excel Report</p>
                          <p className="text-sm text-gray-400">Detailed daily attendance with check-in/out times</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setExportFormat('excel');
                          handleExportUserHistory();
                        }}
                        className="w-full mt-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-sm font-medium transition-colors"
                      >
                        Export as Excel
                      </button>
                    </div>
                    
                    <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                          <FileText className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">PDF Report</p>
                          <p className="text-sm text-gray-400">Professional formatted document</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setExportFormat('pdf');
                          handleExportUserHistory();
                        }}
                        className="w-full mt-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                      >
                        Export as PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-400">
                    <p className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Reports include: Daily check-in/out counts, times, messages, leave status, and work hours
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 bg-black/20">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  Showing {userHistory.length} records across {getUserDetailedReport()?.days?.length || 0} days • Last updated {new Date().toLocaleTimeString()}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleExportUserHistory}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/20 rounded-lg font-medium transition-all flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Complete History
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}