import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const LEAVE_CHANNEL = "C0AACUQMB9D"; // <--- Is ID ko dobara check kar lein Slack se

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
    
    // Slack verification
    if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });

    // Debugging: Log the incoming channel ID
    console.log("Incoming Message from Channel:", body.event?.channel);

    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts, text, files } = body.event;
      const userInfo = await getSlackUserInfo(user);
      
      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true });
      const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

      // Identify Type - Case insensitive and trimmed check
      let type = 'Message';
      const incomingChannel = channel.trim();

      if (incomingChannel === CHECK_IN_CHANNEL) {
        type = 'Check-In';
      } else if (incomingChannel === CHECK_OUT_CHANNEL) {
        type = 'Check-Out';
      } else if (incomingChannel === LEAVE_CHANNEL) {
        type = 'Leave'; // <--- Ye Leave set karega
      }

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
        channelId: channel,
        timestamp: serverTimestamp(),
        ts: ts
      };

      // Firestore mein save karein
      const docId = ts.replace('.', '-');
      await setDoc(doc(db, "attendance", docId), docData);
      console.log(`Saved ${type} for ${userInfo.name}`);
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}