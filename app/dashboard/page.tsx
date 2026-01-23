"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("ts", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const deleteRecord = async (id: string) => {
    if(confirm("Delete this record?")) await deleteDoc(doc(db, "attendance", id));
  };

  // Logic: Har user ki sirf Latest entry nikalna
  const latestReports = Array.from(new Map(logs.map(log => [log.userId, log])).values());

  // User History Filter
  const userHistory = logs.filter(log => log.userId === selectedUser);

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-200 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-16 border-b border-[#357a58]/20 pb-10">
          <div>
            <h1 className="text-6xl font-serif text-[#a8783b]">Team <span className="italic">Activity</span></h1>
            <p className="text-[#357a58] tracking-[0.3em] text-[10px] font-black uppercase mt-2">Latest Status Overview</p>
          </div>
          <div className="bg-[#1c271c] p-6 rounded-xl border border-[#357a58]/30">
            <p className="text-[#a8783b] text-[10px] uppercase font-black tracking-widest">Live Members</p>
            <p className="text-5xl font-serif text-white">{latestReports.length}</p>
          </div>
        </header>

        {/* Main Latest View Table */}
        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-[#043a27] text-[#a8783b] text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="p-6">Employee</th>
                <th className="p-6">Latest Type</th>
                <th className="p-6">Time (PKT)</th>
                <th className="p-6">Message / Proof</th>
                <th className="p-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#357a58]/10">
              {latestReports.map((row) => (
                <tr key={row.id} className="hover:bg-[#043a27]/10 transition-all cursor-pointer group">
                  <td className="p-6" onClick={() => setSelectedUser(row.userId)}>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full border border-[#a8783b]/40 flex items-center justify-center font-serif text-[#a8783b] group-hover:bg-[#a8783b] group-hover:text-black transition-all">
                        {row.userName?.charAt(0)}
                      </div>
                      <span className="font-bold text-white text-lg">{row.userName}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${row.type === 'Check-In' ? 'text-[#357a58] border-[#357a58]' : 'text-[#a8783b] border-[#a8783b]'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="p-6 font-mono text-xl">{row.time}</td>
                  <td className="p-6 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-slate-400">
                    {row.imageUrl ? <span className="text-indigo-400 underline">View Attachment</span> : row.text}
                  </td>
                  <td className="p-6 text-center">
                    <button onClick={() => deleteRecord(row.id)} className="text-red-500 hover:scale-125 transition-transform">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- USER HISTORY MODAL --- */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#1c271c] border border-[#a8783b]/30 w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-3xl flex flex-col shadow-2xl">
              <div className="p-8 border-b border-[#357a58]/20 flex justify-between items-center bg-[#043a27]">
                <h2 className="text-3xl font-serif text-[#a8783b] capitalize">{userHistory[0]?.userName} - Full History</h2>
                <button onClick={() => setSelectedUser(null)} className="text-[#a8783b] text-4xl font-light">&times;</button>
              </div>
              <div className="overflow-y-auto p-4">
                <table className="w-full text-left">
                  <thead className="text-[#357a58] text-[10px] font-black uppercase tracking-widest border-b border-[#357a58]/20">
                    <tr><th className="p-4">Date</th><th className="p-4">Time</th><th className="p-4">Type</th><th className="p-4">Message</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userHistory.map(log => (
                      <tr key={log.id}>
                        <td className="p-4 text-slate-400 font-mono text-xs">{log.date}</td>
                        <td className="p-4 text-white font-bold">{log.time}</td>
                        <td className="p-4 text-[#a8783b]">{log.type}</td>
                        <td className="p-4 text-slate-300">
                          {log.imageUrl && <img src={log.imageUrl} className="w-20 rounded-md mb-2 border border-white/10" />}
                          {log.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}