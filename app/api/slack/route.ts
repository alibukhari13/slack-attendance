import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";

async function getSlackUserName(userId: string) {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await response.json();
    return data.user?.real_name || data.user?.name || userId;
  } catch (e) { return userId; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });

    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts, text, files } = body.event;
      const userName = await getSlackUserName(user);
      
      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true });
      const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

      const imageUrl = files && files.length > 0 ? files[0].url_private_download : null;
      const type = channel === CHECK_IN_CHANNEL ? 'Check-In' : channel === CHECK_OUT_CHANNEL ? 'Check-Out' : 'Message';

      // 'ts' unique ID hai, taake har message save ho aur history banay
      await setDoc(doc(db, "attendance", ts.replace('.', '-')), {
        userId: user,
        userName: userName,
        date: pktDate,
        time: pktTime,
        text: text || "",
        imageUrl: imageUrl,
        type: type,
        timestamp: serverTimestamp(),
        ts: ts 
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: "Error" }, { status: 500 }); }
}