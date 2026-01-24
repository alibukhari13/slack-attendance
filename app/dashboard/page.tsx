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
  ChevronRight,
  Trash2,
  Eye,
  TrendingUp,
  BarChart3,
  X,
  ChevronDown,
  FileText,
  Shield,
  AlertCircle,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  ExternalLink,
  DownloadCloud
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, isValid, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to safely parse dates
const safeParseDate = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(0);

  // Try parsing ISO format first
  const date = parseISO(dateString);
  if (isValid(date)) return date;

  // Try parsing as regular date
  const parsed = new Date(dateString);
  if (isValid(parsed)) return parsed;

  // Return epoch date as fallback
  return new Date(0);
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

  // Calculate statistics
  const stats = useMemo(() => {
    const checkIns = logs.filter(log => log.type?.toLowerCase() === 'check-in').length;
    const checkOuts = logs.filter(log => log.type?.toLowerCase() === 'check-out').length;

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
      avgCheckInTime: avgTime,
      systemUptime: '99.9%'
    };
  }, [logs, latestReports]);

  // Group logs by user and date for detailed report
  const getDetailedReportData = (logsData: any[]) => {
    const userMap = new Map();

    logsData.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          userName: log.userName,
          userId: log.userId,
          days: new Map()
        });
      }

      const user = userMap.get(log.userId);
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
          checkIn: null,
          checkOut: null
        });
      }

      const day = user.days.get(dateKey);
      if (log.type?.toLowerCase() === 'check-in') {
        day.checkIn = {
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || 'No image'
        };
      } else if (log.type?.toLowerCase() === 'check-out') {
        day.checkOut = {
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || 'No image'
        };
      }
    });

    return Array.from(userMap.values()).map(user => ({
      employeeName: user.userName,
      employeeId: user.userId,
      // FIX APPLIED HERE: Added (a: any, b: any) to solve the red line error
      days: Array.from(user.days.values()).sort((a: any, b: any) => {
        // Safe date comparison
        const dateA = safeParseDate(a.date);
        const dateB = safeParseDate(b.date);
        return dateB.getTime() - dateA.getTime();
      })
    }));
  };

  // Export to Excel with detailed formatting
  const exportToExcelDetailed = (data: any[], fileName: string, isSingleUser = false) => {
    const wb = XLSX.utils.book_new();

    if (isSingleUser && data.length > 0) {
      // Single user detailed report
      const user = data[0];
      const wsData = [
        ['ATTENDANCE DETAILED REPORT'],
        [''],
        [`Employee Name: ${user.employeeName}`],
        [`Employee ID: ${user.employeeId}`],
        [`Report Date: ${format(new Date(), 'MMMM dd, yyyy')}`],
        [''],
        ['Date', 'Check-In Time', 'Check-In Message', 'Check-In Image', 'Check-Out Time', 'Check-Out Message', 'Check-Out Image']
      ];

      user.days.forEach((day: any) => {
        wsData.push([
          day.date,
          day.checkIn?.time || 'Not Available',
          day.checkIn?.message || '-',
          day.checkIn?.image !== 'No image' ? 'Yes' : 'No',
          day.checkOut?.time || 'Not Available',
          day.checkOut?.message || '-',
          day.checkOut?.image !== 'No image' ? 'Yes' : 'No'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      const colWidths = [
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
    } else {
      // Multiple users summary report
      const summaryWsData = [
        ['ATTENDANCE SUMMARY REPORT'],
        [''],
        [`Report Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`],
        [`Total Employees: ${data.length}`],
        [''],
        ['Employee Name', 'Employee ID', 'Total Days', 'Check-Ins', 'Check-Outs', 'Last Activity', 'Status']
      ];

      data.forEach(user => {
        const totalDays = user.days.length;
        const checkIns = user.days.filter((day: any) => day.checkIn).length;
        const checkOuts = user.days.filter((day: any) => day.checkOut).length;
        const lastDay = user.days[0];
        const lastActivity = lastDay?.checkIn?.time || lastDay?.checkOut?.time || 'No activity';
        const status = checkIns > 0 ? 'Active' : 'Inactive';

        summaryWsData.push([
          user.employeeName,
          user.employeeId,
          totalDays,
          checkIns,
          checkOuts,
          lastActivity,
          status
        ]);
      });

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData);
      summaryWs['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 15 }, { wch: 10 }
      ];

      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Create detailed sheet for each user
      data.forEach((user, index) => {
        if (index < 10) {
          const userWsData = [
            [`${user.employeeName} - Detailed Attendance`],
            [''],
            ['Date', 'Check-In Time', 'Check-In Message', 'Check-In Image', 'Check-Out Time', 'Check-Out Message', 'Check-Out Image']
          ];

          user.days.forEach((day: any) => {
            userWsData.push([
              day.date,
              day.checkIn?.time || '-',
              day.checkIn?.message || '-',
              day.checkIn?.image !== 'No image' ? 'Yes' : 'No',
              day.checkOut?.time || '-',
              day.checkOut?.message || '-',
              day.checkOut?.image !== 'No image' ? 'Yes' : 'No'
            ]);
          });

          const userWs = XLSX.utils.aoa_to_sheet(userWsData);
          userWs['!cols'] = [
            { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
            { wch: 15 }, { wch: 30 }, { wch: 15 }
          ];

          const sheetName = user.employeeName.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, userWs, sheetName);
        }
      });
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

    // Add header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('ATTENDANCE REPORT', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, 105, 22, { align: 'center' });

    let yPos = 30;

    if (isSingleUser && data.length > 0) {
      const user = data[0];

      // User info
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text(`Employee: ${user.employeeName}`, 14, yPos);
      doc.text(`ID: ${user.employeeId}`, 14, yPos + 7);

      yPos += 20;

      // Table headers
      const headers = [['Date', 'Check-In Time', 'Check-In Message', 'Check-Out Time', 'Check-Out Message']];

      // Table data
      const tableData = user.days.map((day: any) => [
        day.date,
        day.checkIn?.time || '-',
        (day.checkIn?.message || '-').substring(0, 40),
        day.checkOut?.time || '-',
        (day.checkOut?.message || '-').substring(0, 40)
      ]);

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
      doc.text(`Total Employees: ${data.length}`, 14, yPos);
      yPos += 10;

      const headers = [['Employee Name', 'Employee ID', 'Total Days', 'Check-Ins', 'Check-Outs', 'Status']];

      const tableData = data.map(user => {
        const totalDays = user.days.length;
        const checkIns = user.days.filter((day: any) => day.checkIn).length;
        const checkOuts = user.days.filter((day: any) => day.checkOut).length;
        const status = checkIns > 0 ? 'Active' : 'Inactive';

        return [
          user.employeeName,
          user.employeeId,
          totalDays.toString(),
          checkIns.toString(),
          checkOuts.toString(),
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
    const reportData = getDetailedReportData(data);

    if (exportFormat === 'excel') {
      exportToExcelDetailed(reportData, fileName, isSingleUser);
    } else {
      exportToPDF(reportData, fileName, isSingleUser);
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
    const daysPresent = new Set(userLogs.map(log => log.date)).size;

    return { checkIns, checkOuts, daysPresent };
  };

  // Get detailed user report data for modal
  const getUserDetailedReport = () => {
    if (!selectedUser || userHistory.length === 0) return null;
    const reportData = getDetailedReportData(userHistory);
    return reportData[0] || null;
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
              <p className="text-xs text-gray-400">Enterprise Monitoring System</p>
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
                Export Full Report
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
                <p className="text-gray-400 text-sm font-medium mb-2">Total Logs</p>
                <p className="text-3xl font-bold text-white">{stats.totalLogs}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-green-400">+{Math.round((logs.length / 100) * 12)} today</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Active Members</p>
                <p className="text-3xl font-bold text-white">{stats.activeMembers}</p>
              </div>
              <div className="p-3 bg-gray-900/50 rounded-xl">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.activeMembers / Math.max(stats.totalLogs, 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-2">Check-Ins</p>
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
                <p className="text-amber-200 text-sm font-medium mb-2">System Status</p>
                <p className="text-3xl font-bold text-amber-300">Operational</p>
              </div>
              <div className="p-3 bg-amber-900/30 rounded-xl">
                <Activity className="h-6 w-6 text-amber-300" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm text-amber-200">All systems normal</span>
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
              <p className="text-sm text-gray-400">Generate detailed attendance reports in Excel or PDF format</p>
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
                Full Report ({exportFormat.toUpperCase()})
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
                  placeholder="Search employees by name, ID, or notes..."
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
                      <XCircle className="h-4 w-4" />
                      Check-Out Only
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
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        max={dateRange.end || formatDateForInput(new Date())}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
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
                  Status: {filterType === 'check-in' ? 'Check-In' : 'Check-Out'}
                  <button onClick={() => setFilterType('all')} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateRange.start && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                  From: {dateRange.start}
                  <button onClick={() => setDateRange({ ...dateRange, start: '' })} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateRange.end && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm">
                  To: {dateRange.end}
                  <button onClick={() => setDateRange({ ...dateRange, end: '' })} className="ml-1 hover:text-red-400">
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
                <p className="text-sm text-gray-400 mt-1">Real-time attendance monitoring</p>
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
                            <div className="h-12 w-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center font-bold text-lg group-hover:from-amber-900/30 group-hover:to-amber-900/10 transition-all duration-300">
                              {row.userName?.charAt(0) || 'U'}
                            </div>
                            {row.type?.toLowerCase() === 'check-in' && (
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{row.userName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-gray-400">{row.userId}</p>
                              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                                {userStats.daysPresent} days
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${row.type?.toLowerCase() === 'check-in' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {row.type?.toLowerCase() === 'check-in' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
                            <p className="text-gray-400 text-sm truncate">{row.text || 'No notes'}</p>
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
                            title="View history"
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
                  <div className="h-16 w-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-2xl font-bold">
                    {selectedUserDetails.userName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedUserDetails.userName}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 rounded-full text-sm">
                        <Shield className="h-3 w-3" />
                        {selectedUserDetails.userId}
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm">
                        <FileText className="h-3 w-3" />
                        {userHistory.length} Records
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
                        <CheckCircle className="h-3 w-3" />
                        {userHistory.filter((h: any) => h.type?.toLowerCase() === 'check-in').length} Check-ins
                      </span>
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
                {/* Daily Attendance Summary */}
                <div className="mb-8 bg-gray-900/30 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-amber-400" />
                    Daily Attendance Summary
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
                              <th className="pb-3 text-left">Check-In Time</th>
                              <th className="pb-3 text-left">Check-In Message</th>
                              <th className="pb-3 text-left">Check-Out Time</th>
                              <th className="pb-3 text-left">Check-Out Message</th>
                              <th className="pb-3 text-left">Attachments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userReport.days.map((day: any, index: number) => (
                              <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                                <td className="py-4">{day.date}</td>
                                <td className="py-4">
                                  {day.checkIn ? (
                                    <div className="text-green-400">
                                      <div className="font-medium">{day.checkIn.time}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">Not Available</span>
                                  )}
                                </td>
                                <td className="py-4 max-w-xs">
                                  {day.checkIn?.message ? (
                                    <div className="text-gray-300">{day.checkIn.message}</div>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="py-4">
                                  {day.checkOut ? (
                                    <div className="text-red-400">
                                      <div className="font-medium">{day.checkOut.time}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">Not Available</span>
                                  )}
                                </td>
                                <td className="py-4 max-w-xs">
                                  {day.checkOut?.message ? (
                                    <div className="text-gray-300">{day.checkOut.message}</div>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="py-4">
                                  <div className="flex gap-2">
                                    {day.checkIn?.image !== 'No image' && (
                                      <a
                                        href={day.checkIn.image}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20 transition-colors"
                                      >
                                        Check-In Image
                                      </a>
                                    )}
                                    {day.checkOut?.image !== 'No image' && (
                                      <a
                                        href={day.checkOut.image}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                                      >
                                        Check-Out Image
                                      </a>
                                    )}
                                    {(day.checkIn?.image === 'No image' && day.checkOut?.image === 'No image') && (
                                      <span className="text-gray-500 text-xs">No attachments</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
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
                          <p className="text-sm text-gray-400">Detailed daily attendance with messages</p>
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
                      Reports include: Daily check-in/out times, messages, attachment status, and attendance summary
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 bg-black/20">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  Showing {userHistory.length} records • Last updated {new Date().toLocaleTimeString()}
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
                    Export Detailed Report
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