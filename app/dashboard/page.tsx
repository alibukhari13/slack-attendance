"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendance(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-200 font-sans antialiased selection:bg-[#a8783b]/30">
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8 border-b border-[#357a58]/20 pb-12">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
              <div className="h-[1px] w-12 bg-[#a8783b]"></div>
              <span className="text-[#a8783b] uppercase tracking-[0.5em] text-[10px] font-black">Executive Portal</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-serif text-[#a8783b] tracking-tight leading-none">
              Staff <span className="italic font-light">Attendance</span>
            </h1>
            <p className="text-[#357a58] mt-4 font-medium tracking-[0.3em] text-xs uppercase opacity-80">Workspace Intelligence & Logging</p>
          </div>

          {/* STATS */}
          <div className="bg-[#1c271c] border border-[#357a58]/30 p-10 rounded-2xl shadow-2xl min-w-[300px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-[#a8783b]"></div>
            <p className="text-[#a8783b] text-[10px] font-black uppercase tracking-[0.3em] mb-6 opacity-60">Session Records</p>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl font-serif text-white leading-none">{attendance.length}</span>
              <div>
                <p className="text-[#357a58] text-[10px] font-black uppercase tracking-widest">Active Logs</p>
                <div className="flex gap-1.5 mt-2">
                  <div className="h-1 w-1 bg-[#357a58] rounded-full animate-pulse"></div>
                  <div className="h-1 w-1 bg-[#357a58] rounded-full animate-pulse delay-75"></div>
                  <div className="h-1 w-1 bg-[#357a58] rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LUXURY TABLE */}
        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#043a27] border-b border-[#357a58]/20">
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Member</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Date</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Arrival</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Departure</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#357a58]/10">
                {loading ? (
                  <tr><td colSpan={5} className="p-40 text-center text-[#357a58] text-[10px] font-black uppercase tracking-[1em] animate-pulse">Syncing...</td></tr>
                ) : attendance.length === 0 ? (
                  <tr><td colSpan={5} className="p-40 text-center text-slate-600 font-serif italic text-2xl opacity-30 tracking-widest uppercase">No Records Found</td></tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all duration-500 group">
                      <td className="px-10 py-10">
                        <div className="flex items-center gap-6">
                          <div className="h-14 w-14 border border-[#a8783b]/30 rounded-full flex items-center justify-center font-serif text-[#a8783b] text-2xl group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all duration-500">
                            {row.userId?.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-white text-xl tracking-tight uppercase tracking-[0.1em] mb-1">{row.userId}</span>
                            <span className="text-[10px] text-[#357a58] font-black uppercase tracking-[0.2em]">Verified Employee</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-10 text-slate-400 font-medium text-sm tracking-widest">{row.date}</td>
                      <td className="px-10 py-10">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#357a58] shadow-[0_0_10px_#357a58]"></div>
                          <span className="text-3xl font-light text-white tracking-tighter">{row.checkIn}</span>
                        </div>
                      </td>
                      <td className="px-10 py-10">
                        {row.checkOut ? (
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#a8783b] shadow-[0_0_10px_#a8783b]"></div>
                            <span className="text-3xl font-light text-white tracking-tighter">{row.checkOut}</span>
                          </div>
                        ) : (
                          <span className="text-[#357a58]/30 italic font-serif text-sm tracking-[0.3em] uppercase pl-5">On-Duty</span>
                        )}
                      </td>
                      <td className="px-10 py-10 text-center">
                        <span className="px-8 py-3 border border-[#a8783b]/30 text-[#a8783b] rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-[#a8783b]/5 group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all duration-500">
                          {row.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mt-24 border-t border-[#357a58]/10 pt-12 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60">
          <p className="text-[#357a58] text-[10px] font-black uppercase tracking-[0.6em]">Precision Protocol • System v1.0.8</p>
          <div className="flex gap-2">
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full"></div>
            <div className="h-1.5 w-6 bg-[#a8783b] rounded-full opacity-50"></div>
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full opacity-20"></div>
          </div>
        </footer>
      </div>
    </div>
  );
}