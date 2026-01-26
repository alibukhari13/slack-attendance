/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { 
  Settings, Hash, UserPlus, MessageSquare, Save, RefreshCcw, 
  Trash2, Plus, ShieldCheck, Activity, Users, Globe 
} from 'lucide-react';

export default function AdminPage() {
  const [config, setConfig] = useState({ botToken: '', checkInId: '', checkOutId: '' });
  const [newChannelId, setNewChannelId] = useState('');
  const [monitoredChannels, setMonitoredChannels] = useState<any[]>([]);
  const [activeChatChannel, setActiveChatChannel] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load Config & Channels
  useEffect(() => {
    getDoc(doc(db, "settings", "slack")).then(s => s.exists() && setConfig(s.data() as any));
    return onSnapshot(collection(db, "monitored_channels"), (s) => {
      setMonitoredChannels(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Real-time Chats for selected channel
  useEffect(() => {
    if (!activeChatChannel) return;
    const q = query(collection(db, "channel_chats"), where("channelId", "==", activeChatChannel), orderBy("timestamp", "desc"));
    return onSnapshot(q, (s) => setChats(s.docs.map(d => d.data())));
  }, [activeChatChannel]);

  const saveConfig = async () => {
    setLoading(true);
    await setDoc(doc(db, "settings", "slack"), config);
    alert("System Configuration Updated!");
    setLoading(false);
  };

  const addChannel = async () => {
    if (!newChannelId) return;
    setLoading(true);
    try {
      // Fetch Channel Info from Slack
      const res = await fetch(`https://slack.com/api/conversations.info?channel=${newChannelId}`, {
        headers: { Authorization: `Bearer ${config.botToken}` }
      });
      const data = await res.json();
      
      if (data.ok) {
        await setDoc(doc(db, "monitored_channels", newChannelId), {
          name: data.channel.name,
          members: data.channel.num_members || 0,
          addedAt: new Date().toISOString()
        });
        setNewChannelId('');
      } else { alert("Error: " + data.error); }
    } catch (e) { alert("Failed to add channel"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20">
      {/* Admin Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-8 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-amber-500 h-8 w-8" />
            <h1 className="text-2xl font-black uppercase tracking-tighter">System <span className="text-amber-500">Admin</span></h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <Globe className="h-4 w-4" /> Global Control Center
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LEFT COLUMN: CONFIGURATION */}
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-[#a8783b] text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <Settings className="h-4 w-4" /> Slack Authentication
            </h3>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Bot User OAuth Token</label>
                <input 
                  type="password" value={config.botToken}
                  onChange={e => setConfig({...config, botToken: e.target.value})}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-amber-500/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Check-In Channel ID</label>
                  <input type="text" value={config.checkInId} onChange={e => setConfig({...config, checkInId: e.target.value})} className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Check-Out Channel ID</label>
                  <input type="text" value={config.checkOutId} onChange={e => setConfig({...config, checkOutId: e.target.value})} className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm" />
                </div>
              </div>
              <button 
                onClick={saveConfig} disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" /> {loading ? 'Saving...' : 'Update System Config'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-[#357a58] text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Monitor New Channel
            </h3>
            <div className="flex gap-2">
              <input 
                type="text" placeholder="Enter Channel ID (e.g. C0A123)" value={newChannelId}
                onChange={e => setNewChannelId(e.target.value)}
                className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm"
              />
              <button onClick={addChannel} className="bg-slate-800 p-4 rounded-xl hover:bg-slate-700 transition-colors">
                <Plus className="text-white h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: MONITORED CHANNELS */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
              <h3 className="text-white font-bold text-xl flex items-center gap-3">
                <Hash className="text-amber-500" /> Monitored Channels History
              </h3>
              <RefreshCcw className="text-slate-500 h-5 w-5 animate-spin-slow cursor-pointer" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              {monitoredChannels.map(ch => (
                <div 
                  key={ch.id} onClick={() => setActiveChatChannel(ch.id)}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer ${activeChatChannel === ch.id ? 'bg-amber-500/10 border-amber-500' : 'bg-black/20 border-slate-800 hover:border-slate-600'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <Hash className={activeChatChannel === ch.id ? 'text-amber-500' : 'text-slate-500'} />
                    <button onClick={async (e) => { e.stopPropagation(); await deleteDoc(doc(db, "monitored_channels", ch.id)) }} className="text-slate-600 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <h4 className="text-white font-black text-lg uppercase tracking-tight">#{ch.name}</h4>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Users className="h-3 w-3" /> {ch.members} Members</span>
                    <span className="text-[10px] font-bold text-[#357a58] uppercase flex items-center gap-1"><Activity className="h-3 w-3" /> Real-time</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* REAL-TIME CHAT VIEWER */}
          {activeChatChannel && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[600px]">
              <div className="p-6 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="text-amber-500 h-5 w-5" />
                  <span className="font-bold uppercase tracking-widest text-sm">Live Feed: {monitoredChannels.find(c => c.id === activeChatChannel)?.name}</span>
                </div>
                <button onClick={() => setActiveChatChannel(null)} className="text-slate-500 hover:text-white">&times;</button>
              </div>
              <div className="overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
                {chats.map((chat, i) => (
                  <div key={i} className="bg-black/30 border border-slate-800/50 p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-amber-500 font-bold text-xs">@{chat.userName}</span>
                      <span className="text-slate-600 text-[10px] font-mono">{chat.time} • {chat.date}</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{chat.text}</p>
                  </div>
                ))}
                {chats.length === 0 && <p className="text-center text-slate-600 py-10 italic">No history found for this channel. Waiting for new messages...</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}