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
  CalendarDays,
  FileDown,
  CheckSquare,
  Coffee,
  Umbrella,
  Stethoscope,
  Plane,
  Car,
  Bed,
  GraduationCap,
  Award,
  Briefcase,
  User,
  Users as UsersIcon,
  Building,
  MapPin,
  Mail,
  Phone,
  Globe,
  FileBarChart,
  PieChart,
  LineChart,
  Target,
  Trophy,
  Star,
  Crown,
  ShieldCheck,
  Zap,
  Cloud,
  Sun,
  Moon,
  Wind,
  Thermometer,
  Droplets,
  CloudRain,
  CloudSnow,
  CloudLightning
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, isValid, parseISO, differenceInDays, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval, parse } from 'date-fns';
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

// Helper function to format date for display
const formatDisplayDate = (date: Date): string => {
  return format(date, 'EEE, MMM dd, yyyy');
};

// Helper function to calculate working days between dates
const getWorkingDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Monday to Friday are working days (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

// Get leave type from message
const getLeaveType = (message: string): string => {
  if (!message) return 'General Leave';
  
  const msg = message.toLowerCase();
  
  if (msg.includes('sick') || msg.includes('ill') || msg.includes('health') || msg.includes('fever') || msg.includes('hospital')) {
    return 'Sick Leave';
  } else if (msg.includes('vacation') || msg.includes('holiday') || msg.includes('trip') || msg.includes('travel')) {
    return 'Vacation Leave';
  } else if (msg.includes('casual') || msg.includes('personal')) {
    return 'Casual Leave';
  } else if (msg.includes('emergency') || msg.includes('urgent')) {
    return 'Emergency Leave';
  } else if (msg.includes('maternity') || msg.includes('paternity')) {
    return 'Maternity/Paternity Leave';
  } else if (msg.includes('study') || msg.includes('exam') || msg.includes('education')) {
    return 'Study Leave';
  } else if (msg.includes('bereavement') || msg.includes('death') || msg.includes('family')) {
    return 'Bereavement Leave';
  } else if (msg.includes('wedding') || msg.includes('marriage')) {
    return 'Wedding Leave';
  }
  
  return 'General Leave';
};

// Get leave icon
const getLeaveIcon = (leaveType: string) => {
  switch(leaveType) {
    case 'Sick Leave': return <Stethoscope className="h-4 w-4" />;
    case 'Vacation Leave': return <Umbrella className="h-4 w-4" />;
    case 'Casual Leave': return <Coffee className="h-4 w-4" />;
    case 'Emergency Leave': return <AlertCircle className="h-4 w-4" />;
    case 'Maternity/Paternity Leave': return <Bed className="h-4 w-4" />;
    case 'Study Leave': return <GraduationCap className="h-4 w-4" />;
    case 'Bereavement Leave': return <UsersIcon className="h-4 w-4" />;
    case 'Wedding Leave': return <Award className="h-4 w-4" />;
    default: return <CalendarDays className="h-4 w-4" />;
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
  const [activeTab, setActiveTab] = useState<'daily' | 'summary' | 'analytics'>('daily');

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
  const getDetailedReportData = (logsData: any[]) => {
    const userMap = new Map();
    
    logsData.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          userName: log.userName,
          userId: log.userId,
          userProfilePicture: log.userProfilePicture,
          userDisplayName: log.userDisplayName,
          days: new Map(),
          checkIns: 0,
          checkOuts: 0,
          leaves: 0,
          totalHours: 0,
          averageCheckInTime: null,
          lastActivity: null
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
          dayName: format(new Date(dateKey + 'T00:00:00'), 'EEEE'),
          checkIn: null,
          checkOut: null,
          leave: null,
          workingHours: 0,
          status: 'Absent'
        });
      }
      
      const day = user.days.get(dateKey);
      
      if (log.type?.toLowerCase() === 'check-in') {
        day.checkIn = {
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || 'No image',
          timestamp: log.timestamp
        };
        day.status = 'Present';
        user.checkIns++;
        
        // Calculate working hours if we have check-out
        if (day.checkOut) {
          const checkInTime = parse(day.checkIn.time, 'hh:mm a', new Date(`${dateKey}T00:00:00`));
          const checkOutTime = parse(day.checkOut.time, 'hh:mm a', new Date(`${dateKey}T00:00:00`));
          const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
          day.workingHours = Math.max(0, Math.min(12, hours)); // Cap at 12 hours
          user.totalHours += day.workingHours;
        }
        
      } else if (log.type?.toLowerCase() === 'check-out') {
        day.checkOut = {
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || 'No image',
          timestamp: log.timestamp
        };
        
        // Calculate working hours if we have check-in
        if (day.checkIn) {
          const checkInTime = parse(day.checkIn.time, 'hh:mm a', new Date(`${dateKey}T00:00:00`));
          const checkOutTime = parse(day.checkOut.time, 'hh:mm a', new Date(`${dateKey}T00:00:00`));
          const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
          day.workingHours = Math.max(0, Math.min(12, hours)); // Cap at 12 hours
          user.totalHours += day.workingHours;
        }
        
        user.checkOuts++;
      } else if (log.type?.toLowerCase() === 'leave') {
        day.leave = {
          time: log.time,
          message: log.text || 'No message',
          image: log.imageUrl || 'No image',
          leaveType: getLeaveType(log.text || ''),
          startDate: log.leaveStartDate,
          endDate: log.leaveEndDate,
          duration: log.leaveDuration || '1 day',
          timestamp: log.timestamp
        };
        day.status = 'On Leave';
        user.leaves++;
      }
      
      // Update last activity
      if (log.timestamp && (!user.lastActivity || log.timestamp > user.lastActivity)) {
        user.lastActivity = log.timestamp;
      }
    });
    
    return Array.from(userMap.values()).map(user => {
      // Calculate average check-in time
      const checkInTimes = Array.from(user.days.values())
        .filter(day => day.checkIn)
        .map(day => {
          const timeStr = day.checkIn.time;
          const [time, period] = timeStr.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          return hours * 60 + minutes;
        });
      
      const avgCheckInMinutes = checkInTimes.length > 0 
        ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
        : null;
      
      let averageCheckInTime = 'N/A';
      if (avgCheckInMinutes !== null) {
        const avgHours = Math.floor(avgCheckInMinutes / 60);
        const avgMinutes = avgCheckInMinutes % 60;
        const formattedHours = avgHours > 12 ? avgHours - 12 : avgHours;
        averageCheckInTime = `${formattedHours.toString().padStart(2, '0')}:${avgMinutes.toString().padStart(2, '0')} ${avgHours >= 12 ? 'PM' : 'AM'}`;
      }
      
      // Calculate average working hours
      const daysWithHours = Array.from(user.days.values()).filter(day => day.workingHours > 0);
      const averageWorkingHours = daysWithHours.length > 0 
        ? (daysWithHours.reduce((sum, day) => sum + day.workingHours, 0) / daysWithHours.length).toFixed(1)
        : '0.0';
      
      // Calculate attendance rate
      const totalDays = user.days.size;
      const presentDays = Array.from(user.days.values()).filter(day => day.status === 'Present').length;
      const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0.0';
      
      return {
        employeeName: user.userName,
        employeeId: user.userId,
        profilePicture: user.userProfilePicture,
        displayName: user.userDisplayName,
        totalDays: totalDays,
        presentDays: presentDays,
        leaveDays: user.leaves,
        checkIns: user.checkIns,
        checkOuts: user.checkOuts,
        totalHours: user.totalHours.toFixed(1),
        averageWorkingHours: averageWorkingHours,
        averageCheckInTime: averageCheckInTime,
        attendanceRate: attendanceRate,
        lastActivity: user.lastActivity,
        days: Array.from(user.days.values()).sort((a: any, b: any) => {
          const dateA = safeParseDate(a.date);
          const dateB = safeParseDate(b.date);
          return dateB.getTime() - dateA.getTime();
        })
      };
    });
  };

  // Calculate overall statistics
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(log => log.date === today);
    
    const checkInsToday = todayLogs.filter(log => log.type?.toLowerCase() === 'check-in').length;
    const checkOutsToday = todayLogs.filter(log => log.type?.toLowerCase() === 'check-out').length;
    const leavesToday = todayLogs.filter(log => log.type?.toLowerCase() === 'leave' && log.date === today).length;
    
    // Calculate monthly stats
    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthlyLogs = logs.filter(log => {
      if (!log.date) return false;
      return log.date.startsWith(currentMonth);
    });
    
    const uniqueUsersThisMonth = new Set(monthlyLogs.map(log => log.userId)).size;
    const leavesThisMonth = monthlyLogs.filter(log => log.type?.toLowerCase() === 'leave').length;
    
    // Calculate average check-in time
    const checkInTimes = logs
      .filter(log => log.type?.toLowerCase() === 'check-in' && log.time)
      .map(log => {
        const timeStr = log.time;
        const [time, period] = timeStr?.split(' ') || ['09:00', 'AM'];
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
      checkInsToday,
      checkOutsToday,
      leavesToday,
      uniqueUsersThisMonth,
      leavesThisMonth,
      avgCheckInTime: avgTime,
      systemUptime: '99.9%'
    };
  }, [logs, latestReports]);

  // Get detailed user report for modal
  const getUserDetailedReport = () => {
    if (!selectedUser || userHistory.length === 0) return null;
    const reportData = getDetailedReportData(userHistory);
    return reportData[0] || null;
  };

  // Export to Excel with detailed formatting
  const exportToExcelDetailed = (data: any[], fileName: string, isSingleUser = false) => {
    const wb = XLSX.utils.book_new();
    
    if (isSingleUser && data.length > 0) {
      const user = data[0];
      
      // Summary Sheet
      const summaryData = [
        ['EMPLOYEE ATTENDANCE DETAILED REPORT'],
        [''],
        ['Employee Information'],
        [`Name: ${user.employeeName}`],
        [`Employee ID: ${user.employeeId}`],
        [`Report Period: All Time`],
        [`Report Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`],
        [''],
        ['Attendance Summary'],
        ['Total Days Tracked', user.totalDays],
        ['Present Days', user.presentDays],
        ['Leave Days', user.leaveDays],
        ['Attendance Rate', `${user.attendanceRate}%`],
        ['Total Check-Ins', user.checkIns],
        ['Total Check-Outs', user.checkOuts],
        ['Total Working Hours', user.totalHours],
        ['Average Working Hours/Day', user.averageWorkingHours],
        ['Average Check-In Time', user.averageCheckInTime],
        [''],
        ['Daily Attendance Details'],
        ['Date', 'Day', 'Check-In Time', 'Check-In Message', 'Check-Out Time', 'Check-Out Message', 'Working Hours', 'Status', 'Leave Type', 'Leave Message']
      ];
      
      user.days.forEach((day: any) => {
        summaryData.push([
          day.date,
          day.dayName,
          day.checkIn?.time || '-',
          day.checkIn?.message || '-',
          day.checkOut?.time || '-',
          day.checkOut?.message || '-',
          day.workingHours > 0 ? `${day.workingHours.toFixed(1)} hrs` : '-',
          day.status,
          day.leave?.leaveType || '-',
          day.leave?.message || '-'
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      const colWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, 
        { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, 
        { wch: 15 }, { wch: 40 }
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
      
      // Monthly Summary Sheet
      const monthlyData: any[][] = [['Monthly Summary']];
      const monthlyMap = new Map();
      
      user.days.forEach((day: any) => {
        const month = day.date.substring(0, 7); // yyyy-MM
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, {
            present: 0,
            leave: 0,
            totalHours: 0,
            days: 0
          });
        }
        
        const monthData = monthlyMap.get(month);
        monthData.days++;
        
        if (day.status === 'Present') {
          monthData.present++;
          monthData.totalHours += day.workingHours;
        } else if (day.status === 'On Leave') {
          monthData.leave++;
        }
      });
      
      monthlyData.push([]);
      monthlyData.push(['Month', 'Total Days', 'Present Days', 'Leave Days', 'Attendance Rate', 'Total Hours', 'Avg Hours/Day']);
      
      Array.from(monthlyMap.entries()).sort((a, b) => b[0].localeCompare(a[0])).forEach(([month, data]) => {
        const rate = data.days > 0 ? ((data.present / data.days) * 100).toFixed(1) : '0.0';
        const avgHours = data.present > 0 ? (data.totalHours / data.present).toFixed(1) : '0.0';
        
        monthlyData.push([
          format(new Date(month + '-01'), 'MMMM yyyy'),
          data.days,
          data.present,
          data.leave,
          `${rate}%`,
          `${data.totalHours.toFixed(1)} hrs`,
          `${avgHours} hrs`
        ]);
      });
      
      const monthlyWs = XLSX.utils.aoa_to_sheet(monthlyData);
      monthlyWs['!cols'] = [
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, 
        { wch: 12 }, { wch: 10 }, { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(wb, monthlyWs, 'Monthly Summary');
      
    } else {
      // Multiple users summary report
      const summaryData = [
        ['ATTENDANCE SUMMARY REPORT - ALL EMPLOYEES'],
        [''],
        [`Report Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`],
        [`Total Employees: ${data.length}`],
        [''],
        ['Employee Name', 'Employee ID', 'Total Days', 'Present Days', 'Leave Days', 'Attendance Rate', 'Check-Ins', 'Check-Outs', 'Total Hours', 'Avg Hours/Day', 'Last Activity']
      ];
      
      data.forEach(user => {
        summaryData.push([
          user.employeeName,
          user.employeeId,
          user.totalDays,
          user.presentDays,
          user.leaveDays,
          `${user.attendanceRate}%`,
          user.checkIns,
          user.checkOuts,
          `${user.totalHours} hrs`,
          `${user.averageWorkingHours} hrs`,
          user.lastActivity ? format(new Date(user.lastActivity), 'MMM dd, yyyy') : 'Never'
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
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
      doc.text(`Report Period: All Time`, 14, yPos + 14);
      
      yPos += 25;
      
      // Summary box
      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 182, 25, 'F');
      
      doc.setFontSize(10);
      doc.text(`Total Days: ${user.totalDays}`, 20, yPos + 7);
      doc.text(`Present Days: ${user.presentDays}`, 20, yPos + 14);
      doc.text(`Leave Days: ${user.leaveDays}`, 20, yPos + 21);
      
      doc.text(`Attendance Rate: ${user.attendanceRate}%`, 70, yPos + 7);
      doc.text(`Total Hours: ${user.totalHours} hrs`, 70, yPos + 14);
      doc.text(`Avg Hours/Day: ${user.averageWorkingHours} hrs`, 70, yPos + 21);
      
      doc.text(`Check-Ins: ${user.checkIns}`, 120, yPos + 7);
      doc.text(`Check-Outs: ${user.checkOuts}`, 120, yPos + 14);
      doc.text(`Avg Check-In: ${user.averageCheckInTime}`, 120, yPos + 21);
      
      yPos += 35;
      
      // Table headers
      const headers = [['Date', 'Day', 'Check-In', 'Check-Out', 'Hours', 'Status', 'Leave Type']];
      
      // Table data
      const tableData = user.days.slice(0, 50).map((day: any) => [
        day.date,
        day.dayName.substring(0, 3),
        day.checkIn?.time || '-',
        day.checkOut?.time || '-',
        day.workingHours > 0 ? `${day.workingHours.toFixed(1)}h` : '-',
        day.status,
        day.leave?.leaveType?.substring(0, 15) || '-'
      ]);
      
      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { top: 10 },
        pageBreak: 'auto'
      });
    } else {
      // Summary for all users
      doc.setFontSize(12);
      doc.text(`Total Employees: ${data.length}`, 14, yPos);
      yPos += 10;
      
      const headers = [['Employee Name', 'Employee ID', 'Days', 'Present', 'Leave', 'Rate', 'Hours', 'Last Active']];
      
      const tableData = data.slice(0, 100).map(user => {
        return [
          user.employeeName.substring(0, 20),
          user.employeeId,
          user.totalDays.toString(),
          user.presentDays.toString(),
          user.leaveDays.toString(),
          `${user.attendanceRate}%`,
          user.totalHours,
          user.lastActivity ? format(new Date(user.lastActivity), 'MM/dd') : 'Never'
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
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const checkIns = userLogs.filter(log => log.type?.toLowerCase() === 'check-in').length;
    const checkOuts = userLogs.filter(log => log.type?.toLowerCase() === 'check-out').length;
    const leaves = userLogs.filter(log => log.type?.toLowerCase() === 'leave').length;
    const daysPresent = new Set(userLogs.filter(log => log.type?.toLowerCase() === 'check-in').map(log => log.date)).size;
    const leavesToday = userLogs.filter(log => log.type?.toLowerCase() === 'leave' && log.date === today).length;
    
    return { checkIns, checkOuts, leaves, daysPresent, leavesToday };
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
      case 'leave': return <CalendarDays className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  // Get user report data for modal
  const userReport = getUserDetailedReport();

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
              <span className="text-green-400">+{Math.round((stats.checkInsToday / 100) * 12)} today</span>
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
                <p className="text-gray-400 text-sm font-medium mb-2">Check-Ins Today</p>
                <p className="text-3xl font-bold text-green-400">{stats.checkInsToday}</p>
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
                <p className="text-amber-200 text-sm font-medium mb-2">Leaves Today</p>
                <p className="text-3xl font-bold text-amber-300">{stats.leavesToday}</p>
              </div>
              <div className="p-3 bg-amber-900/30 rounded-xl">
                <CalendarDays className="h-6 w-6 text-amber-300" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span className="text-sm text-amber-200">{stats.leavesThisMonth} this month</span>
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
                      <LogOut className="h-4 w-4" />
                      Check-Out Only
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'leave' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800'}`}
                      onClick={() => setFilterType('leave')}
                    >
                      <CalendarDays className="h-4 w-4" />
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
                            {userStats.leavesToday > 0 && (
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                            )}
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
                              {userStats.leavesToday > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                                  On Leave Today
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

        {/* Bottom Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Average Check-in Time</p>
                <p className="text-xl font-bold text-white">{stats.avgCheckInTime}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Check-Ins Today</p>
                <p className="text-xl font-bold text-white">{stats.checkInsToday} Employees</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <CalendarDays className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Leaves Today</p>
                <p className="text-xl font-bold text-white">{stats.leavesToday} Employees</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User History Modal */}
      {selectedUser && selectedUserDetails && userReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-800 shadow-2xl">
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
                        <Shield className="h-3 w-3" />
                        {selectedUserDetails.userId}
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm">
                        <FileText className="h-3 w-3" />
                        {userHistory.length} Records
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
                        <CheckCircle className="h-3 w-3" />
                        {userReport.checkIns} Check-ins
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm">
                        <LogOut className="h-3 w-3" />
                        {userReport.checkOuts} Check-outs
                      </span>
                      {userReport.leaveDays > 0 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm">
                          <CalendarDays className="h-3 w-3" />
                          {userReport.leaveDays} Leave Days
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
                {/* Tabs */}
                <div className="flex border-b border-gray-800 mb-6">
                  <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${activeTab === 'daily' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                  >
                    <Calendar className="inline-block mr-2 h-4 w-4" />
                    Daily Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${activeTab === 'summary' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                  >
                    <FileBarChart className="inline-block mr-2 h-4 w-4" />
                    Summary Report
                  </button>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${activeTab === 'analytics' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                  >
                    <PieChart className="inline-block mr-2 h-4 w-4" />
                    Analytics
                  </button>
                </div>

                {/* Daily Attendance Tab */}
                {activeTab === 'daily' && (
                  <div className="mb-8 bg-gray-900/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-amber-400" />
                      Daily Attendance History
                    </h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-800">
                            <th className="pb-3 text-left">Date</th>
                            <th className="pb-3 text-left">Day</th>
                            <th className="pb-3 text-left">Check-In Time</th>
                            <th className="pb-3 text-left">Check-In Message</th>
                            <th className="pb-3 text-left">Check-Out Time</th>
                            <th className="pb-3 text-left">Check-Out Message</th>
                            <th className="pb-3 text-left">Hours</th>
                            <th className="pb-3 text-left">Status</th>
                            <th className="pb-3 text-left">Leave Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userReport.days.map((day: any, index: number) => (
                            <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                              <td className="py-4">{day.date}</td>
                              <td className="py-4 text-gray-400">{day.dayName.substring(0, 3)}</td>
                              <td className="py-4">
                                {day.checkIn ? (
                                  <div className="text-green-400">
                                    <div className="font-medium">{day.checkIn.time}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-4 max-w-xs">
                                {day.checkIn?.message ? (
                                  <div className="text-gray-300 text-xs">{day.checkIn.message}</div>
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
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-4 max-w-xs">
                                {day.checkOut?.message ? (
                                  <div className="text-gray-300 text-xs">{day.checkOut.message}</div>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-4">
                                {day.workingHours > 0 ? (
                                  <span className="text-amber-400 font-medium">{day.workingHours.toFixed(1)}h</span>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                              <td className="py-4">
                                {day.status === 'Present' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
                                    <CheckCircle className="h-3 w-3" />
                                    Present
                                  </span>
                                ) : day.status === 'On Leave' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">
                                    <CalendarDays className="h-3 w-3" />
                                    On Leave
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">
                                    <XCircle className="h-3 w-3" />
                                    Absent
                                  </span>
                                )}
                              </td>
                              <td className="py-4 max-w-xs">
                                {day.leave ? (
                                  <div className="text-blue-400">
                                    <div className="flex items-center gap-1 text-xs">
                                      {getLeaveIcon(day.leave.leaveType)}
                                      {day.leave.leaveType}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{day.leave.message}</div>
                                    {day.leave.duration && (
                                      <div className="text-xs text-gray-500 mt-1">Duration: {day.leave.duration}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Summary Report Tab */}
                {activeTab === 'summary' && userReport && (
                  <div className="mb-8 bg-gray-900/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FileBarChart className="h-5 w-5 text-amber-400" />
                      Attendance Summary
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Total Days</p>
                        <p className="text-2xl font-bold text-white">{userReport.totalDays}</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Present Days</p>
                        <p className="text-2xl font-bold text-green-400">{userReport.presentDays}</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Leave Days</p>
                        <p className="text-2xl font-bold text-blue-400">{userReport.leaveDays}</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Attendance Rate</p>
                        <p className="text-2xl font-bold text-amber-400">{userReport.attendanceRate}%</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Total Check-Ins</p>
                        <p className="text-2xl font-bold text-white">{userReport.checkIns}</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Total Check-Outs</p>
                        <p className="text-2xl font-bold text-white">{userReport.checkOuts}</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Total Working Hours</p>
                        <p className="text-2xl font-bold text-amber-400">{userReport.totalHours} hrs</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Average Working Hours/Day</p>
                        <p className="text-2xl font-bold text-white">{userReport.averageWorkingHours} hrs</p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                        <p className="text-sm text-gray-400 mb-1">Average Check-In Time</p>
                        <p className="text-2xl font-bold text-white">{userReport.averageCheckInTime}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && userReport && (
                  <div className="mb-8 bg-gray-900/30 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-amber-400" />
                      Attendance Analytics
                    </h4>
                    
                    {/* Monthly Breakdown */}
                    <div className="mb-6">
                      <h5 className="text-md font-semibold text-white mb-3">Monthly Breakdown</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-800">
                              <th className="pb-2 text-left">Month</th>
                              <th className="pb-2 text-left">Total Days</th>
                              <th className="pb-2 text-left">Present</th>
                              <th className="pb-2 text-left">Leave</th>
                              <th className="pb-2 text-left">Attendance Rate</th>
                              <th className="pb-2 text-left">Total Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const monthlyMap = new Map();
                              
                              userReport.days.forEach((day: any) => {
                                const month = day.date.substring(0, 7); // yyyy-MM
                                if (!monthlyMap.has(month)) {
                                  monthlyMap.set(month, {
                                    present: 0,
                                    leave: 0,
                                    totalHours: 0,
                                    days: 0
                                  });
                                }
                                
                                const monthData = monthlyMap.get(month);
                                monthData.days++;
                                
                                if (day.status === 'Present') {
                                  monthData.present++;
                                  monthData.totalHours += day.workingHours;
                                } else if (day.status === 'On Leave') {
                                  monthData.leave++;
                                }
                              });
                              
                              return Array.from(monthlyMap.entries())
                                .sort((a, b) => b[0].localeCompare(a[0]))
                                .slice(0, 6)
                                .map(([month, data]) => {
                                  const rate = data.days > 0 ? ((data.present / data.days) * 100).toFixed(1) : '0.0';
                                  return (
                                    <tr key={month} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                                      <td className="py-3">{format(new Date(month + '-01'), 'MMM yyyy')}</td>
                                      <td className="py-3">{data.days}</td>
                                      <td className="py-3 text-green-400">{data.present}</td>
                                      <td className="py-3 text-blue-400">{data.leave}</td>
                                      <td className="py-3">
                                        <span className={`font-medium ${parseFloat(rate) >= 80 ? 'text-green-400' : parseFloat(rate) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                          {rate}%
                                        </span>
                                      </td>
                                      <td className="py-3 text-amber-400">{data.totalHours.toFixed(1)} hrs</td>
                                    </tr>
                                  );
                                });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Leave Analysis */}
                    {userReport.leaveDays > 0 && (
                      <div className="mb-6">
                        <h5 className="text-md font-semibold text-white mb-3">Leave Analysis</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                            <p className="text-sm text-gray-400 mb-2">Total Leave Days</p>
                            <p className="text-2xl font-bold text-blue-400">{userReport.leaveDays}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {((userReport.leaveDays / userReport.totalDays) * 100).toFixed(1)}% of total days
                            </p>
                          </div>
                          <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-800/50">
                            <p className="text-sm text-gray-400 mb-2">Leave Frequency</p>
                            <p className="text-2xl font-bold text-blue-400">
                              {(userReport.totalDays / Math.max(userReport.leaveDays, 1)).toFixed(1)} days between leaves
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Performance Indicators */}
                    <div>
                      <h5 className="text-md font-semibold text-white mb-3">Performance Indicators</h5>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Attendance Rate</span>
                            <span className={`font-medium ${parseFloat(userReport.attendanceRate) >= 80 ? 'text-green-400' : parseFloat(userReport.attendanceRate) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                              {userReport.attendanceRate}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, parseFloat(userReport.attendanceRate))}%`,
                                backgroundColor: parseFloat(userReport.attendanceRate) >= 80 ? '#10b981' : parseFloat(userReport.attendanceRate) >= 60 ? '#f59e0b' : '#ef4444'
                              }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Punctuality (Avg Check-in Time)</span>
                            <span className="font-medium text-amber-400">{userReport.averageCheckInTime}</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Average Working Hours/Day</span>
                            <span className="font-medium text-amber-400">{userReport.averageWorkingHours} hrs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                          <p className="text-sm text-gray-400">Complete history with analytics</p>
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
                          <p className="text-sm text-gray-400">Professional summary document</p>
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
                      Reports include: Daily check-in/out times, messages, working hours, leave details, and comprehensive analytics
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 bg-black/20">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  Showing {userReport.days.length} days • Last updated {new Date().toLocaleTimeString()}
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