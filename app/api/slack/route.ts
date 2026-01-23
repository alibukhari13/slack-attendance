import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";

// Function to fetch User Name from Slack
async function getSlackUserName(userId: string) {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await response.json();
    return data.user?.real_name || data.user?.name || userId;
  } catch (e) {
    return userId;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts } = body.event;
      
      // Get Real Name and Proper PKT Time
      const userName = await getSlackUserName(user);
      
      // Convert to Pakistan Time (UTC+5)
      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

      const docId = `${user}-${pktDate}`;
      const docRef = doc(db, "attendance", docId);

      if (channel === CHECK_IN_CHANNEL) {
        await setDoc(docRef, {
          userId: user,
          userName: userName, // Saving Real Name
          date: pktDate,
          checkIn: pktTime,
          status: 'Present',
          timestamp: serverTimestamp()
        }, { merge: true });
      }

      if (channel === CHECK_OUT_CHANNEL) {
        await updateDoc(docRef, {
          checkOut: pktTime,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}