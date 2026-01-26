import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });

    // 1. Fetch Dynamic Config from Firebase
    const settingsSnap = await getDoc(doc(db, "settings", "slack"));
    if (!settingsSnap.exists()) return NextResponse.json({ error: "Config not found" }, { status: 404 });
    
    const { botToken, checkInId, checkOutId } = settingsSnap.data();

    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts, text, files } = body.event;

      // 2. Fetch User Name using Dynamic Token
      const userRes = await fetch(`https://slack.com/api/users.info?user=${user}`, {
        headers: { Authorization: `Bearer ${botToken}` },
      });
      const userData = await userRes.json();
      const userName = userData.user?.real_name || user;

      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true });
      const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      const imageUrl = files && files.length > 0 ? files[0].url_private_download : null;

      // ATTENDANCE LOGIC (Exactly as you requested)
      if (channel === checkInId || channel === checkOutId) {
        const type = channel === checkInId ? 'Check-In' : 'Check-Out';
        await setDoc(doc(db, "attendance", ts.replace('.', '-')), {
          userId: user, userName, date: pktDate, time: pktTime, text: text || "", imageUrl, type, timestamp: serverTimestamp(), ts
        });
      }

      // ADMIN CHAT MONITORING LOGIC
      // Check if this channel is being monitored by admin
      const channelSnap = await getDoc(doc(db, "monitored_channels", channel));
      if (channelSnap.exists()) {
        await setDoc(doc(db, "channel_chats", ts.replace('.', '-')), {
          channelId: channel,
          userName,
          text: text || "Media/Attachment",
          time: pktTime,
          date: pktDate,
          timestamp: serverTimestamp()
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: "Error" }, { status: 500 }); }
}