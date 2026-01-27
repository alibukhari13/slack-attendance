"use client";
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { 
  Clock, Users, Activity, CheckCircle, Download, Search, 
  Trash2, ChevronRight, FileSpreadsheet, X, Calendar as CalendarIcon, LogOut, Coffee
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Unique employees list for the main table
  const employees = useMemo(() => {
    const userMap = new Map();
    logs.forEach(log => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, log); // Store latest record for status
      }
    });
    return Array.from(userMap.values()).filter(emp => 
      emp.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.userId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  // Grouping logs for the selected user by Date
  const userHistoryGrouped = useMemo(() => {
    if (!selectedUser) return [];
    const filtered = logs.filter(log => log.userId === selectedUser);
    const groups: Record<string, any[]> = {};
    
    filtered.forEach(log => {
      if (!groups[log.date]) groups[log.date] = [];
      groups[log.date].push(log);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs, selectedUser]);

  const selectedUserDetails = employees.find(e => e.userId === selectedUser);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Attendance Pro Dashboard
          </h1>
          <p className="text-gray-400">Boss Management Portal</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search Employee..." 
              className="bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 focus:ring-1 ring-amber-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
          <Users className="text-amber-500 mb-2" />
          <p className="text-gray-400 text-sm">Total Employees</p>
          <p className="text-2xl font-bold">{employees.length}</p>
        </div>
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
          <Activity className="text-green-500 mb-2" />
          <p className="text-gray-400 text-sm">Today's Logs</p>
          <p className="text-2xl font-bold">{logs.filter(l => l.date === format(new Date(), 'yyyy-MM-dd')).length}</p>
        </div>
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
          <Coffee className="text-blue-500 mb-2" />
          <p className="text-gray-400 text-sm">Leaves Recorded</p>
          <p className="text-2xl font-bold">{logs.filter(l => l.type === 'Leave').length}</p>
        </div>
      </div>

      {/* Employee Table */}
      <div className="max-w-7xl mx-auto bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-900/80 text-gray-400 text-sm uppercase">
            <tr>
              <th className="p-5">Employee</th>
              <th className="p-5">Latest Status</th>
              <th className="p-5">Last Activity</th>
              <th className="p-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {employees.map((emp) => (
              <tr 
                key={emp.userId} 
                onClick={() => setSelectedUser(emp.userId)}
                className="hover:bg-amber-500/5 cursor-pointer transition-colors group"
              >
                <td className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-gray-700">
                    {emp.userProfilePicture ? (
                      <img src={emp.userProfilePicture} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gray-800 flex items-center justify-center">{emp.userName[0]}</div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{emp.userName}</p>
                    <p className="text-xs text-gray-500">{emp.userId}</p>
                  </div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    emp.type === 'Check-In' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    emp.type === 'Check-Out' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {emp.type}
                  </span>
                </td>
                <td className="p-5">
                  <p className="text-sm">{emp.time}</p>
                  <p className="text-xs text-gray-500">{emp.date}</p>
                </td>
                <td className="p-5 text-right">
                  <ChevronRight className="inline h-5 w-5 text-gray-600 group-hover:text-amber-500 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      {selectedUser && selectedUserDetails && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-gray-800 w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/20">
              <div className="flex items-center gap-4">
                <img src={selectedUserDetails.userProfilePicture} className="h-14 w-14 rounded-full border-2 border-amber-500" alt="" />
                <div>
                  <h2 className="text-xl font-bold">{selectedUserDetails.userName}</h2>
                  <p className="text-sm text-amber-500">Employee Full History</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-800 rounded-full">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content - Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {userHistoryGrouped.map(([date, activities]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                    <h3 className="font-bold text-gray-300">{format(new Date(date), 'PPPP')}</h3>
                  </div>
                  <div className="ml-2 border-l-2 border-gray-800 space-y-6">
                    {activities.sort((a,b) => b.ts.localeCompare(a.ts)).map((log, idx) => (
                      <div key={idx} className="relative pl-6">
                        <div className={`absolute left-[-9px] top-1 h-4 w-4 rounded-full border-2 border-[#111] ${
                          log.type === 'Check-In' ? 'bg-green-500' : 
                          log.type === 'Check-Out' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <div className="bg-gray-900/40 border border-gray-800 p-4 rounded-xl">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm uppercase tracking-wider">{log.type}</span>
                            <span className="text-xs font-mono text-gray-500">{log.time}</span>
                          </div>
                          <p className="text-gray-300 text-sm italic">"{log.text || 'No message provided'}"</p>
                          {log.imageUrl && (
                            <a href={log.imageUrl} target="_blank" className="mt-3 inline-block text-xs text-amber-500 hover:underline">
                              View Attached Image
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 text-right">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}