import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Slack Challenge (Sirf ek baar verify karne ke liye hota hai)
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Handle Event
    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts } = body.event;
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const docId = `${user}-${today}`;
      const docRef = doc(db, "attendance", docId);
      const timeNow = new Date(parseFloat(ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Check-in Channel Logic
      if (channel === process.env.CHECK_IN_CHANNEL) {
        await setDoc(docRef, {
          userId: user,
          date: today,
          checkIn: timeNow,
          status: 'Present',
          timestamp: serverTimestamp()
        }, { merge: true });
      }

      // Check-out Channel Logic
      if (channel === process.env.CHECK_OUT_CHANNEL) {
        await updateDoc(docRef, {
          checkOut: timeNow,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}