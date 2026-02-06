import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// 👇 YAHAN APNI ASAL KEYS DALAIN (Basic Information page se)
const SLACK_CLIENT_ID = "10369585956705.10360275949988";         // Example: 525608...
const SLACK_CLIENT_SECRET = "cb16231375056216a32d72d14f6b95fd"; // Example: 8f4a2b...

// 👇 Ye URL ab aapke Vercel wala hai
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback"; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: "No code provided" });

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
      console.error("Slack OAuth Error:", data.error);
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    // 2. Token Save karna Firebase main
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
    };

    await setDoc(doc(db, "slack_tokens", data.authed_user.id), userData);

    // Wapas Dashboard par bhejna
    return NextResponse.redirect("https://slack-attendance.vercel.app/dm-manager?status=success");

  } catch (error) {
    console.error("Callback Error:", error);
    return NextResponse.json({ error: "System Error" }, { status: 500 });
  }
}