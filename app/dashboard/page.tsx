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
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0b1014] text-slate-200 font-sans p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 border-b border-[#357a58]/20 pb-12">
          <div>
            <h1 className="text-7xl font-serif text-[#a8783b] tracking-tighter">Staff <span className="italic font-light opacity-80">Logs</span></h1>
            <p className="text-[#357a58] tracking-[0.4em] text-[10px] uppercase mt-4">Precision Attendance Monitoring • PKT</p>
          </div>
          <div className="bg-[#1c271c] border border-[#357a58]/30 p-8 rounded-2xl min-w-[300px]">
            <p className="text-[#a8783b] text-[10px] font-black uppercase tracking-[0.4em] mb-4">Live Session</p>
            <span className="text-7xl font-serif text-white leading-none">{attendance.length}</span>
          </div>
        </header>

        <div className="bg-[#1c271c]/20 border border-[#357a58]/20 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-[#043a27]">
              <tr className="text-[#a8783b] text-[10px] uppercase tracking-[0.4em]">
                <th className="p-8">Member</th><th className="p-8">Date</th><th className="p-8">Check In</th><th className="p-8">Check Out</th><th className="p-8 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#357a58]/10">
              {loading ? (
                <tr><td colSpan={5} className="p-32 text-center animate-pulse tracking-[1em]">Syncing...</td></tr>
              ) : (
                attendance.map((row) => (
                  <tr key={row.id} className="hover:bg-[#043a27]/20 transition-all duration-500 group">
                    <td className="p-8 flex items-center gap-6">
                      <div className="h-14 w-14 border border-[#a8783b]/30 rounded-full flex items-center justify-center font-serif text-[#a8783b] text-2xl group-hover:bg-[#a8783b] group-hover:text-[#0b1014]">{ (row.userName || row.userId).charAt(0) }</div>
                      <span className="text-xl font-bold text-white tracking-tight uppercase tracking-[0.05em]">{row.userName || row.userId}</span>
                    </td>
                    <td className="p-8 text-slate-500 font-mono text-xs">{row.date}</td>
                    <td className="p-8 text-4xl font-light text-white tracking-tighter">{row.checkIn}</td>
                    <td className="p-8">
                      {row.checkOut ? <span className="text-4xl font-light text-white tracking-tighter">{row.checkOut}</span> : <span className="text-[#357a58]/30 italic font-serif text-sm tracking-[0.3em] uppercase">On-Duty</span>}
                    </td>
                    <td className="p-8 text-center">
                      <span className="px-8 py-3 border border-[#a8783b]/30 text-[#a8783b] rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-[#a8783b]/5">{row.status || 'Verified'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}