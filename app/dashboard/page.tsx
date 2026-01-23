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
    <div className="min-h-screen bg-[#0b1014] text-slate-200 font-sans antialiased selection:bg-[#a8783b]/30 pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-16">
        
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-20 gap-10 border-b border-[#357a58]/20 pb-12 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
              <div className="h-[1px] w-16 bg-[#a8783b]"></div>
              <span className="text-[#a8783b] uppercase tracking-[0.6em] text-[10px] font-black italic">Internal Intelligence</span>
            </div>
            <h1 className="text-7xl md:text-8xl font-serif text-[#a8783b] tracking-tighter leading-none mb-4">
              Staff <span className="italic font-light opacity-90">Logs</span>
            </h1>
            <p className="text-[#357a58] font-medium tracking-[0.4em] text-[11px] uppercase">Attendance Management • PKT Zone</p>
          </div>

          <div className="bg-[#1c271c] border border-[#357a58]/30 p-10 rounded-2xl shadow-2xl min-w-[320px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-[#a8783b]"></div>
            <p className="text-[#a8783b] text-[10px] font-black uppercase tracking-[0.4em] mb-6 opacity-70">Active Session</p>
            <div className="flex items-baseline gap-5">
              <span className="text-8xl font-serif text-white leading-none tracking-tighter">{attendance.length}</span>
              <div>
                <p className="text-[#357a58] text-[10px] font-black uppercase tracking-widest mb-2">Total Logs</p>
                <div className="flex gap-2">
                  <div className="h-1.5 w-1.5 bg-[#357a58] rounded-full animate-pulse"></div>
                  <div className="h-1.5 w-1.5 bg-[#357a58] rounded-full animate-pulse delay-75"></div>
                  <div className="h-1.5 w-4 bg-[#a8783b]/40 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* DATA TABLE */}
        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-[2rem] shadow-[0_60px_100px_-25px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto text-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#043a27] border-b border-[#357a58]/20">
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Member</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Log Date</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Arrival</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Departure</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#357a58]/10">
                {loading ? (
                  <tr><td colSpan={5} className="p-48 text-center text-[#357a58] text-[10px] font-black uppercase tracking-[1em] animate-pulse">Establishing Connection...</td></tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all duration-700 group">
                      <td className="px-10 py-12">
                        <div className="flex items-center gap-7">
                          <div className="h-16 w-16 border border-[#a8783b]/30 rounded-full flex items-center justify-center font-serif text-[#a8783b] text-3xl group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all duration-700 shadow-2xl">
                            {(row.userName || row.userId).charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-white text-2xl tracking-tight uppercase tracking-[0.05em] mb-1 group-hover:text-[#a8783b] transition-colors">{row.userName || row.userId}</span>
                            <span className="text-[10px] text-[#357a58] font-black uppercase tracking-[0.3em]">Verified Employee</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-12 text-slate-500 font-mono text-xs tracking-[0.2em]">{row.date}</td>
                      <td className="px-10 py-12 text-4xl font-light text-white tracking-tighter">{row.checkIn}</td>
                      <td className="px-10 py-12">
                        {row.checkOut ? <span className="text-4xl font-light text-white tracking-tighter">{row.checkOut}</span> : <span className="text-[#357a58]/40 italic font-serif text-sm tracking-[0.4em] uppercase">On-Duty</span>}
                      </td>
                      <td className="px-10 py-12 text-center">
                        <span className="px-10 py-3.5 border border-[#a8783b]/30 text-[#a8783b] rounded-full text-[10px] font-black uppercase tracking-[0.4em] bg-[#a8783b]/5 group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all duration-700">
                          {row.status || 'Verified'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}