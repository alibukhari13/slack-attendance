"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendance(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-200 font-sans antialiased">
      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* TOP HEADER AREA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8 border-b border-[#357a58]/20 pb-10">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
              <div className="h-[2px] w-10 bg-[#a8783b]"></div>
              <span className="text-[#a8783b] uppercase tracking-[0.5em] text-[10px] font-bold">Executive Portal</span>
            </div>
            <h1 className="text-6xl font-serif text-[#a8783b] tracking-tight">
              Staff <span className="italic font-light">Attendance</span>
            </h1>
            <p className="text-[#357a58] mt-3 font-medium tracking-widest text-sm uppercase">Secure Workspace Monitoring</p>
          </div>

          {/* STATS CARD */}
          <div className="bg-[#1c271c] border border-[#357a58]/30 p-8 rounded-xl shadow-2xl min-w-[280px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-2 h-full bg-[#a8783b]/20"></div>
            <p className="text-[#a8783b] text-xs font-black uppercase tracking-[0.3em] mb-4">Live Indicators</p>
            <div className="flex items-end gap-4">
              <span className="text-6xl font-serif text-white leading-none">{attendance.length}</span>
              <div>
                <p className="text-[#357a58] text-xs font-bold uppercase tracking-widest">Active Logs</p>
                <div className="flex gap-1 mt-1">
                  <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse delay-75"></div>
                  <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="bg-[#1c271c]/30 border border-[#357a58]/20 rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#043a27] border-b border-[#357a58]/30">
                  <th className="px-8 py-6 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.3em]">Employee Detail</th>
                  <th className="px-8 py-6 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.3em]">Recording Date</th>
                  <th className="px-8 py-6 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.3em]">Arrival</th>
                  <th className="px-8 py-6 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.3em]">Departure</th>
                  <th className="px-8 py-6 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.3em] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#357a58]/10 text-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-40 text-center">
                       <div className="text-[#357a58] text-xs font-bold uppercase tracking-[0.6em] animate-pulse">Synchronizing Data Node...</div>
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-40 text-center">
                       <p className="text-slate-500 font-serif italic text-2xl opacity-40 uppercase tracking-widest">No active session found</p>
                    </td>
                  </tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all duration-300 group">
                      <td className="px-8 py-7">
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 border border-[#a8783b]/30 rounded-full flex items-center justify-center font-serif text-[#a8783b] text-xl group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all">
                            {row.userId?.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-white text-lg tracking-tight uppercase tracking-[0.1em]">{row.userId}</span>
                            <span className="text-[10px] text-[#357a58] font-bold uppercase tracking-widest">Verified Member</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-7">
                        <span className="text-slate-400 font-medium text-sm border-l border-[#357a58]/30 pl-4">{row.date}</span>
                      </td>
                      <td className="px-8 py-7">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#357a58] shadow-[0_0_8px_#357a58]"></div>
                          <span className="text-2xl font-light text-white tracking-tighter">{row.checkIn}</span>
                        </div>
                      </td>
                      <td className="px-8 py-7">
                        {row.checkOut ? (
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#a8783b] shadow-[0_0_8px_#a8783b]"></div>
                            <span className="text-2xl font-light text-white tracking-tighter">{row.checkOut}</span>
                          </div>
                        ) : (
                          <span className="text-[#357a58]/30 italic font-serif text-sm tracking-[0.2em] uppercase pl-4">Active Session</span>
                        )}
                      </td>
                      <td className="px-8 py-7 text-center">
                        <span className="px-6 py-2 border border-[#a8783b]/30 text-[#a8783b] rounded-full text-[9px] font-black uppercase tracking-[0.3em] bg-[#a8783b]/5 shadow-xl">
                          {row.status || 'Success'}
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
        <div className="mt-20 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-[#357a58]/10 pt-10">
          <p className="text-[#357a58] text-[10px] font-black uppercase tracking-[0.5em]">
            Precision Logging • System v1.0.4
          </p>
          <div className="flex gap-1">
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full"></div>
            <div className="h-1.5 w-4 bg-[#a8783b] rounded-full opacity-50"></div>
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full opacity-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}