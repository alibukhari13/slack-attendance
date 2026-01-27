"use client";
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Clock, Users, Activity, CheckCircle, Search, 
  X, Calendar as CalendarIcon, LogOut, Coffee, ChevronRight, Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter Unique Employees
  const employees = useMemo(() => {
    const userMap = new Map();
    // Sort logs to get the latest activity first
    const sortedLogs = [...logs].sort((a, b) => b.ts.localeCompare(a.ts));
    
    sortedLogs.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, log);
      }
    });

    return Array.from(userMap.values()).filter(emp => 
      emp.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.userId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  // Group History by Date for Selected User
  const userHistoryGrouped = useMemo(() => {
    if (!selectedUser) return [];
    const userLogs = logs.filter(log => log.userId === selectedUser);
    const groups: Record<string, any[]> = {};
    
    userLogs.forEach(log => {
      if (!groups[log.date]) groups[log.date] = [];
      groups[log.date].push(log);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs, selectedUser]);

  const selectedUserDetails = employees.find(e => e.userId === selectedUser);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center text-amber-500 font-bold animate-pulse">
      Loading Workforce Data...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-400 to-amber-700 bg-clip-text text-transparent">
            ATTENDANCE PRO
          </h1>
          <p className="text-gray-500 text-sm tracking-widest">REAL-TIME MONITORING SYSTEM</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search Employee ID or Name..." 
            className="w-full bg-gray-900/50 border border-gray-800 rounded-xl pl-10 pr-4 py-3 focus:border-amber-500/50 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Members', val: employees.length, icon: Users, color: 'text-amber-500' },
          { label: 'Active Today', val: logs.filter(l => l.date === format(new Date(), 'yyyy-MM-dd')).length, icon: Activity, color: 'text-green-500' },
          { label: 'Leaves Today', val: logs.filter(l => l.type === 'Leave' && l.date === format(new Date(), 'yyyy-MM-dd')).length, icon: Coffee, color: 'text-blue-500' },
          { label: 'Total Logs', val: logs.length, icon: Clock, color: 'text-purple-500' }
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900/20 border border-gray-800 p-6 rounded-2xl">
            <stat.icon className={`${stat.color} mb-3`} size={24} />
            <p className="text-gray-500 text-xs font-bold uppercase">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.val}</p>
          </div>
        ))}
      </div>

      {/* Main Employee Table */}
      <div className="max-w-7xl mx-auto bg-gray-900/10 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-900/50 text-gray-500 text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-5">Employee Info</th>
              <th className="p-5">Current Status</th>
              <th className="p-5">Last Log Time</th>
              <th className="p-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {employees.map((emp) => (
              <tr 
                key={emp.userId} 
                onClick={() => setSelectedUser(emp.userId)}
                className="hover:bg-amber-500/[0.03] cursor-pointer group transition-all"
              >
                <td className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                    {emp.userProfilePicture ? <img src={emp.userProfilePicture} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold">{emp.userName[0]}</div>}
                  </div>
                  <div>
                    <p className="font-bold text-gray-200">{emp.userName}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{emp.userId}</p>
                  </div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-tighter uppercase border ${
                    emp.type === 'Check-In' ? 'border-green-500/20 text-green-400 bg-green-500/5' :
                    emp.type === 'Check-Out' ? 'border-red-500/20 text-red-400 bg-red-500/5' :
                    'border-blue-500/20 text-blue-400 bg-blue-500/5'
                  }`}>
                    {emp.type}
                  </span>
                </td>
                <td className="p-5">
                  <p className="text-xs text-gray-300">{emp.time}</p>
                  <p className="text-[10px] text-gray-600">{emp.date}</p>
                </td>
                <td className="p-5 text-right">
                  <button className="p-2 rounded-full group-hover:bg-amber-500/20 transition-all">
                    <ChevronRight size={18} className="text-gray-700 group-hover:text-amber-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAILED HISTORY MODAL */}
      {selectedUser && selectedUserDetails && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/10">
              <div className="flex items-center gap-6">
                <img src={selectedUserDetails.userProfilePicture} className="h-16 w-16 rounded-2xl border border-amber-500/50 shadow-lg shadow-amber-500/10" />
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedUserDetails.userName}</h2>
                  <p className="text-xs text-amber-500 font-bold tracking-widest uppercase">Comprehensive History Logs</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body: Timeline View */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {userHistoryGrouped.length === 0 ? (
                <div className="text-center py-20 text-gray-600 font-bold">NO RECORDS FOUND</div>
              ) : (
                userHistoryGrouped.map(([date, entries]) => (
                  <div key={date} className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <CalendarIcon size={16} className="text-amber-500" />
                      <h3 className="text-sm font-black text-gray-400 uppercase tracking-tighter">
                        {format(new Date(date), 'EEEE, MMMM do, yyyy')}
                      </h3>
                    </div>
                    
                    <div className="ml-2 border-l-2 border-gray-800 space-y-8">
                      {entries.sort((a,b) => b.ts.localeCompare(a.ts)).map((log, idx) => (
                        <div key={idx} className="relative pl-8 group">
                          {/* Timeline Dot */}
                          <div className={`absolute left-[-9px] top-0 h-4 w-4 rounded-full border-4 border-[#0a0a0a] transition-all ${
                            log.type === 'Check-In' ? 'bg-green-500' : 
                            log.type === 'Check-Out' ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                          }`} />
                          
                          <div className="bg-gray-900/30 border border-gray-800/50 p-5 rounded-2xl group-hover:border-gray-700 transition-all">
                            <div className="flex justify-between items-center mb-3">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                log.type === 'Check-In' ? 'bg-green-500/10 text-green-400' : 
                                log.type === 'Check-Out' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {log.type}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500">{log.time}</span>
                            </div>
                            
                            <p className="text-gray-300 text-sm leading-relaxed">
                              {log.text || <span className="text-gray-600 italic">No notes added</span>}
                            </p>

                            {log.imageUrl && (
                              <div className="mt-4 pt-4 border-t border-gray-800/50">
                                <a href={log.imageUrl} target="_blank" className="flex items-center gap-2 text-[10px] text-amber-500 font-bold hover:text-amber-400">
                                  <ImageIcon size={12} /> VIEW ATTACHED PROOF
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/10 flex justify-between items-center">
              <p className="text-[10px] text-gray-600 font-bold">TOTAL ENTRIES: {logs.filter(l => l.userId === selectedUser).length}</p>
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-8 py-3 bg-white text-black text-xs font-black rounded-xl hover:bg-amber-500 transition-all"
              >
                CLOSE REPORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}