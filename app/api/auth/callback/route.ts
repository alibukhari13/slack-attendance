//app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_CLIENT_ID = "10369585956705.10360275949988";
const SLACK_CLIENT_SECRET = "cb16231375056216a32d72d14f6b95fd";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: "No code provided" });

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
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    // 2. Save Data
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

    // 3. DIRECT REDIRECT TO SLACK APP 🚀
    // No success page, directly open Slack app
    const slackDeepLink = "slack://open";
    
    // Create HTML that immediately redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${slackDeepLink}">
          <script>
            window.location.href = '${slackDeepLink}';
            // Fallback after 1 second
            setTimeout(function() {
              window.close();
            }, 1000);
          </script>
        </head>
        <body>
          <p>Redirecting back to Slack...</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    return NextResponse.json({ error: "System Error" }, { status: 500 });
  }
}