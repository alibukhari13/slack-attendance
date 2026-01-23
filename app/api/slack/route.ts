import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Hardcoded Channel IDs
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Slack URL Verification (Challenge)
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Handle Message Event
    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts } = body.event;
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
      const docId = `${user}-${today}`;
      const docRef = doc(db, "attendance", docId);

      // Convert Slack timestamp (ts) to readable time
      const timeString = new Date(parseFloat(ts) * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Logic for Check-in Channel
      if (channel === CHECK_IN_CHANNEL) {
        await setDoc(docRef, {
          userId: user,
          date: today,
          checkIn: timeString,
          status: 'Present',
          timestamp: serverTimestamp()
        }, { merge: true });
      }

      // Logic for Check-out Channel
      if (channel === CHECK_OUT_CHANNEL) {
        await updateDoc(docRef, {
          checkOut: timeString,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}