/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';

export default function Dashboard() {
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this record permanently?")) {
      await deleteDoc(doc(db, "attendance", id));
    }
  };

  // Grouping logic: Har user ki latest entry dikhane ke liye
  const latestReports = Array.from(new Map(logs.map(log => [log.userId, log])).values());
  const userHistory = logs.filter(log => log.userId === selectedUser);

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-300 font-sans p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 border-b border-[#357a58]/20 pb-12 gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-6xl font-serif text-[#a8783b] tracking-tighter">Staff <span className="italic font-light">Intelligence</span></h1>
            <p className="text-[#357a58] tracking-[0.4em] text-[10px] font-bold uppercase mt-3">Personnel Management Portal</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-[#1c271c] p-8 rounded-2xl border border-[#357a58]/30 text-center shadow-2xl min-w-[200px]">
              <p className="text-[#a8783b] text-[10px] uppercase font-black tracking-widest mb-1">Active Now</p>
              <p className="text-5xl font-serif text-white">{latestReports.length}</p>
            </div>
          </div>
        </header>

        {/* Latest Report Table */}
        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#043a27] text-[#a8783b] text-[11px] uppercase tracking-widest font-black border-b border-[#357a58]/20">
              <tr>
                <th className="px-8 py-6">Member</th>
                <th className="px-8 py-6">Latest Status</th>
                <th className="px-8 py-6">Time (PKT)</th>
                <th className="px-8 py-6">Recent Message</th>
                <th className="px-8 py-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#357a58]/10">
              {loading ? (
                <tr><td colSpan={5} className="p-32 text-center text-[#357a58] animate-pulse">Establishing Connection...</td></tr>
              ) : (
                latestReports.map((row: any) => (
                  <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all cursor-pointer group" onClick={() => setSelectedUser(row.userId)}>
                    <td className="px-8 py-10">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-full border border-[#a8783b]/30 flex items-center justify-center font-serif text-[#a8783b] text-2xl group-hover:bg-[#a8783b] group-hover:text-black transition-all">
                          {row.userName?.charAt(0)}
                        </div>
                        <div>
                           <span className="block font-bold text-white text-xl tracking-tight">{row.userName}</span>
                           <span className="text-[10px] text-[#357a58] font-bold uppercase tracking-widest">Employee</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-10">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${row.type === 'Check-In' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-[#a8783b] border-[#a8783b]/30 bg-[#a8783b]/5'}`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-8 py-10 text-3xl font-light text-white tracking-tighter">{row.time}</td>
                    <td className="px-8 py-10 max-w-[200px] truncate text-slate-500 italic font-serif">
                      {row.imageUrl ? "📷 Image Attached" : (row.text || "No Data")}
                    </td>
                    <td className="px-8 py-10 text-center">
                      <button onClick={(e) => handleDelete(row.id, e)} className="text-rose-500 hover:scale-125 transition-transform p-3 rounded-full hover:bg-rose-500/10">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- History Modal --- */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-6">
            <div className="bg-[#1c271c] border border-[#a8783b]/30 w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-[2.5rem] flex flex-col shadow-2xl">
              <div className="p-10 border-b border-[#357a58]/20 flex justify-between items-center bg-[#043a27]">
                <div>
                  <h2 className="text-4xl font-serif text-[#a8783b]">{userHistory[0]?.userName} History</h2>
                  <p className="text-[#357a58] text-[10px] font-black uppercase tracking-widest mt-1">Full Performance Archive</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-[#a8783b] text-6xl font-light hover:rotate-90 transition-all duration-300 outline-none">&times;</button>
              </div>
              <div className="overflow-y-auto p-10">
                <table className="w-full text-left">
                  <thead className="text-[#357a58] text-[10px] font-black uppercase tracking-widest border-b border-[#357a58]/10 pb-4">
                    <tr><th className="pb-4">Date</th><th className="pb-4">Time</th><th className="pb-4">Activity</th><th className="pb-4">Message</th><th className="pb-4 text-center">Manage</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userHistory.map((log: any) => (
                      <tr key={log.id}>
                        <td className="py-6 text-slate-500 font-mono text-xs">{log.date}</td>
                        <td className="py-6 text-white text-2xl font-light tracking-tighter">{log.time}</td>
                        <td className="py-6 text-[#a8783b] font-bold text-[10px] tracking-widest uppercase">{log.type}</td>
                        <td className="py-6 text-slate-300 max-w-xs break-words">
                           {log.imageUrl && <a href={log.imageUrl} target="_blank" className="block mb-2 text-indigo-400 underline">View Photo</a>}
                           {log.text || "-"}
                        </td>
                        <td className="py-6 text-center">
                           <button onClick={(e) => handleDelete(log.id, e)} className="text-rose-900 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-colors">Delete</button>
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