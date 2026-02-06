// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ⚠️ SECURITY WARNING: Hardcoding credentials is risky. Keep this code private.
const SLACK_CLIENT_ID = "YOUR_CLIENT_ID";     // Slack Portal se copy karein (Basic Info section)
const SLACK_CLIENT_SECRET = "YOUR_CLIENT_SECRET"; // Slack Portal se copy karein
const REDIRECT_URI = "http://localhost:3000/api/auth/callback"; // Slack Portal main yehi hona chahiye

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: "No code" });

  try {
    // 1. Code ke badlay User Token mangwana
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
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    // 2. Token mil gaya, ab User ki info le kar Firebase main save karna
    // Taakay baad main hum is token ko use kar sakein
    const userRes = await fetch(`https://slack.com/api/users.info?user=${data.authed_user.id}`, {
        headers: { Authorization: `Bearer ${data.authed_user.access_token}` }
    });
    const userInfo = await userRes.json();
    
    const userData = {
        slackId: data.authed_user.id,
        accessToken: data.authed_user.access_token, // YE HAI MAIN KEY 🔑
        name: userInfo.user?.real_name || "Unknown",
        image: userInfo.user?.profile?.image_192 || "",
        connectedAt: serverTimestamp(),
    };

    // Firebase collection: "slack_tokens"
    await setDoc(doc(db, "slack_tokens", data.authed_user.id), userData);

    // Wapas Dashboard par bhejna
    return NextResponse.redirect(new URL('/dm-manager?status=success', req.url));

  } catch (error) {
    return NextResponse.json({ error: "System Error" }, { status: 500 });
  }
}