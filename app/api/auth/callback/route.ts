import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Keys (Make sure ye sahi hain)
const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 

export async function GET(req: Request) {
  // 1. Jaldi se Code grab karo
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  // Agar code nahi hai, to error mat dikhao, bas window band kar do
  if (!code) {
    return new Response("<script>window.close();</script>", { headers: { 'Content-Type': 'text/html' } });
  }

  try {
    // 2. Token Exchange (Ye wait karna zaroori hai)
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
    
    // Agar error aye tab bhi user ko pareshan na karo, bas Slack khol do
    if (!data.ok) {
       console.error("Slack OAuth Error:", data.error);
       return redirectToSlack();
    }

    const userId = data.authed_user.id;
    const accessToken = data.authed_user.access_token;

    // ============================================================
    // 🚀 SUPER FAST MODE: Saare kaam parallel (ek sath) karo
    // ============================================================
    
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
        } catch (e) { console.error("Save User Error:", e); }
    };

    const task2_DeleteTrapMessage = async () => {
        try {
            // Check karo pending invites main
            const inviteDoc = await getDoc(doc(db, "pending_invites", userId));
            
            if (inviteDoc.exists()) {
                const inviteData = inviteDoc.data();
                
                // Slack se Message Delete karo
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

                // Firebase se safaya
                await deleteDoc(doc(db, "pending_invites", userId));
            }
        } catch (e) { console.error("Delete Trap Error:", e); }
    };

    // ✨ DONO KAAM EK SATH START KARO (Wait time half ho jayega)
    await Promise.all([task1_SaveUser(), task2_DeleteTrapMessage()]);

    // ============================================================
    
    // 3. User ko foran wapas bhejo
    return redirectToSlack();

  } catch (error) {
    console.error("Callback System Error:", error);
    return redirectToSlack();
  }
}

// Helper function to generate Fast Redirect HTML
function redirectToSlack() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting...</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { background: #000; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .loader { border: 3px solid #333; border-top: 3px solid #22c55e; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin-bottom: 20px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            a { color: #22c55e; text-decoration: none; border: 1px solid #22c55e; padding: 10px 20px; border-radius: 5px; margin-top: 20px; }
          </style>
          
          <script>
            // 1. Try Deep Link immediately
            window.location.href = "slack://open";
            
            // 2. Also try Replace (Browser History clean rakhne ke liye)
            setTimeout(function() {
                window.location.replace("slack://open");
            }, 100);

            // 3. Close window after a short delay (Agar desktop app khul gayi)
            setTimeout(function() {
               // window.close(); // Browser block kar sakta hai, par try karte hain
            }, 2000);
          </script>
        </head>
        <body>
          <div class="loader"></div>
          <p>Update Complete.</p>
          <p style="font-size: 12px; color: #666;">Opening Slack...</p>
          
          <!-- Fallback Button -->
          <a href="slack://open">Open App Manually</a>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
}