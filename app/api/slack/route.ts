import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const LEAVE_CHANNEL = "C0AACUQMB9D";

async function getSlackUserInfo(userId: string) {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await response.json();
    return {
      name: data.user?.real_name || data.user?.name || userId,
      profilePicture: data.user?.profile?.image_192 || data.user?.profile?.image_72 || null,
      displayName: data.user?.profile?.display_name || null
    };
  } catch (e) { 
    return { name: userId, profilePicture: null, displayName: null };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });

    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts, text, files } = body.event;
      const userInfo = await getSlackUserInfo(user);
      
      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true });
      const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

      let type = 'Message';
      if (channel === CHECK_IN_CHANNEL) type = 'Check-In';
      else if (channel === CHECK_OUT_CHANNEL) type = 'Check-Out';
      else if (channel === LEAVE_CHANNEL) type = 'Leave';

      const docData = {
        userId: user,
        userName: userInfo.name,
        userProfilePicture: userInfo.profilePicture,
        userDisplayName: userInfo.displayName,
        date: pktDate,
        time: pktTime,
        text: text || "",
        imageUrl: files && files.length > 0 ? files[0].url_private_download : null,
        type: type,
        timestamp: serverTimestamp(),
        ts: ts
      };

      await setDoc(doc(db, "attendance", ts.replace('.', '-')), docData);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}