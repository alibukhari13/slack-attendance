/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from 'react';
import { 
  MessageSquare, 
  ArrowLeft, 
  Hash, 
  Send, 
  Clock, 
  User, 
  RefreshCw,
  Search,
  LayoutDashboard
} from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const [channelIds, setChannelIds] = useState('');
  const [histories, setHistories] = useState<any>({});
  const [loading, setLoading] = useState<any>({});

  const fetchHistory = async (id: string) => {
    const cid = id.trim();
    if (!cid) return;

    setLoading((prev: any) => ({ ...prev, [cid]: true }));
    try {
      const res = await fetch(`/api/slack/history?channelId=${cid}`);
      const data = await res.json();
      if (data.messages) {
        setHistories((prev: any) => ({ ...prev, [cid]: data.messages }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading((prev: any) => ({ ...prev, [cid]: false }));
    }
  };

  const handleLoadAll = () => {
    const ids = channelIds.split(',').map(id => id.trim());
    ids.forEach(id => fetchHistory(id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white font-sans p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-black/40 p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-3 bg-gray-800 rounded-xl hover:bg-amber-500 transition-all group">
              <ArrowLeft className="h-5 w-5 text-amber-500 group-hover:text-white" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                Slack Chat Archives
              </h1>
              <p className="text-gray-400">Multi-channel communication monitoring</p>
            </div>
          </div>
          
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
             <input 
               type="text" 
               placeholder="Paste Channel IDs (comma separated)..."
               className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 min-w-[300px] focus:ring-2 focus:ring-amber-500/30 outline-none"
               value={channelIds}
               onChange={(e) => setChannelIds(e.target.value)}
             />
             <button 
               onClick={handleLoadAll}
               className="bg-amber-500 hover:bg-amber-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
             >
               <RefreshCw className="h-4 w-4" />
               Load Histories
             </button>
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 gap-8">
          {Object.keys(histories).length === 0 && (
            <div className="text-center py-20 bg-gray-900/20 border border-gray-800 rounded-[3rem] border-dashed">
              <MessageSquare className="h-16 w-16 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-500">No Channels Loaded</h3>
              <p className="text-gray-600">Enter Slack Channel IDs above to start monitoring</p>
            </div>
          )}

          {Object.entries(histories).map(([cid, messages]: [string, any]) => (
            <div key={cid} className="bg-gray-900/40 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-800 bg-gray-900/60 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                    <Hash className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white">Channel ID: {cid}</h2>
                    <p className="text-xs text-amber-500 font-bold uppercase tracking-widest">Live History</p>
                  </div>
                </div>
                <button 
                  onClick={() => fetchHistory(cid)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <RefreshCw className={`h-5 w-5 ${loading[cid] ? 'animate-spin text-amber-500' : ''}`} />
                </button>
              </div>

              <div className="p-6 max-h-[500px] overflow-y-auto space-y-4 custom-scrollbar">
                {messages.map((msg: any, idx: number) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-gray-800/20 border border-gray-800/50 hover:border-amber-500/20 transition-all">
                    <div className="h-10 w-10 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-400 text-sm">{msg.user}</span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                          <Clock className="h-3 w-3" />
                          {new Date(parseFloat(msg.ts) * 1000).toLocaleString()}
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}