"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Real-time data fetching from Firebase
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setAttendance(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Hydration fix for Next.js
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-200 font-sans antialiased selection:bg-[#a8783b]/30 pb-20">
      
      {/* Background Subtle Gradient Glow */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#357a58]/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16">
        
        {/* TOP HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-20 gap-10 border-b border-[#357a58]/20 pb-12">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
              <div className="h-[1px] w-16 bg-[#a8783b]"></div>
              <span className="text-[#a8783b] uppercase tracking-[0.6em] text-[10px] font-black italic">Workspace Intelligence</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-serif text-[#a8783b] tracking-tighter leading-none mb-4">
              Staff <span className="italic font-light opacity-90">Logs</span>
            </h1>
            <p className="text-[#357a58] font-medium tracking-[0.4em] text-[11px] uppercase ml-1">Real-time Attendance Monitoring • PKT Zone</p>
          </div>

          {/* STATS PREVIEW */}
          <div className="bg-[#1c271c] border border-[#357a58]/30 p-10 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] min-w-[320px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-[#a8783b]"></div>
            <p className="text-[#a8783b] text-[10px] font-black uppercase tracking-[0.4em] mb-6 opacity-70">Current Session</p>
            <div className="flex items-baseline gap-5">
              <span className="text-8xl font-serif text-white leading-none tracking-tighter">{attendance.length}</span>
              <div>
                <p className="text-[#357a58] text-[10px] font-black uppercase tracking-widest mb-2">Total Check-ins</p>
                <div className="flex gap-2">
                  <div className="h-1.5 w-1.5 bg-[#357a58] rounded-full animate-pulse"></div>
                  <div className="h-1.5 w-1.5 bg-[#357a58] rounded-full animate-pulse delay-75"></div>
                  <div className="h-1.5 w-4 bg-[#a8783b]/40 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* DATA TABLE CONTAINER */}
        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-[2rem] shadow-[0_60px_100px_-25px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#043a27] border-b border-[#357a58]/20">
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Team Member</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Log Date</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Check In</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em]">Check Out</th>
                  <th className="px-10 py-8 text-[11px] font-black text-[#a8783b] uppercase tracking-[0.4em] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#357a58]/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-48 text-center">
                      <div className="text-[#357a58] text-[10px] font-black uppercase tracking-[1.5em] animate-pulse">Establishing Connection...</div>
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-48 text-center text-slate-700 font-serif italic text-2xl opacity-40 uppercase tracking-[0.3em]">No Activity Records Found</td>
                  </tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all duration-700 group">
                      <td className="px-10 py-12">
                        <div className="flex items-center gap-7">
                          {/* User Avatar Circle */}
                          <div className="h-16 w-16 border border-[#a8783b]/30 rounded-full flex items-center justify-center font-serif text-[#a8783b] text-3xl group-hover:bg-[#a8783b] group-hover:text-[#0b1014] transition-all duration-700 shadow-2xl">
                            {row.userName?.charAt(0) || row.userId?.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-white text-2xl tracking-tight uppercase tracking-[0.05em] mb-1 group-hover:text-[#a8783b] transition-colors">
                                {row.userName || row.userId}
                            </span>
                            <span className="text-[10px] text-[#357a58] font-black uppercase tracking-[0.3em]">Slack Authorized</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-12 text-slate-500 font-mono text-xs tracking-[0.2em]">{row.date}</td>
                      <td className="px-10 py-12">
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 rounded-full bg-[#357a58] shadow-[0_0_12px_#357a58]"></div>
                          <span className="text-4xl font-light text-white tracking-tighter">{row.checkIn}</span>
                        </div>
                      </td>
                      <td className="px-10 py-12">
                        {row.checkOut ? (
                          <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-[#a8783b] shadow-[0_0_12px_#a8783b]"></div>
                            <span className="text-4xl font-light text-white tracking-tighter">{row.checkOut}</span>
                          </div>
                        ) : (
                          <span className="text-[#357a58]/40 italic font-serif text-xs tracking-[0.4em] uppercase pl-6 border-l border-[#357a58]/10 ml-1">On-Duty</span>
                        )}
                      </td>
                      <td className="px-10 py-12 text-center">
                        <span className="px-10 py-3.5 border border-[#a8783b]/30 text-[#a8783b] rounded-full text-[10px] font-black uppercase tracking-[0.4em] bg-[#a8783b]/5 group-hover:bg-[#a8783b] group-hover:text-[#0b1014] shadow-2xl transition-all duration-700">
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

        {/* PREMIUM FOOTER */}
        <footer className="mt-24 border-t border-[#357a58]/10 pt-16 flex flex-col md:flex-row justify-between items-center gap-8 opacity-50 mb-10">
          <div className="flex items-center gap-6">
            <p className="text-[#357a58] text-[10px] font-black uppercase tracking-[0.6em]">System Protocol 1.1.0</p>
            <div className="h-px w-20 bg-[#357a58]/20"></div>
            <p className="text-[#a8783b] text-[10px] font-black uppercase tracking-[0.6em]">Encrypted Session</p>
          </div>
          <div className="flex gap-3">
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full"></div>
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full opacity-60"></div>
            <div className="h-1.5 w-1.5 bg-[#a8783b] rounded-full opacity-30"></div>
            <div className="h-1.5 w-10 bg-[#a8783b]/20 rounded-full"></div>
          </div>
        </footer>
      </div>
    </div>
  );
}