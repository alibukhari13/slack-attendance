// app/api/slack/file-proxy/route.ts

import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase'; // Path check kar lein
import { doc, getDoc } from 'firebase/firestore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fileUrl = searchParams.get('url');
  const userId = searchParams.get('userId'); 

  if (!fileUrl || !userId) {
    return new NextResponse("Missing URL or UserID", { status: 400 });
  }

  try {
    // 1. Firebase se User ka Token lo
    const tokenDoc = await getDoc(doc(db, "slack_tokens", userId));
    
    if (!tokenDoc.exists()) {
      return new NextResponse("User token not found", { status: 403 });
    }

    const USER_TOKEN = tokenDoc.data().accessToken;

    // 2. Slack se Image Download karo
    const slackResponse = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${USER_TOKEN}` },
    });

    if (!slackResponse.ok) {
      return new NextResponse("Failed to fetch image", { status: slackResponse.status });
    }

    // 3. Browser ko file wapas bhejo (Download force karne ke liye)
    const blob = await slackResponse.blob();
    const headers = new Headers();
    headers.set("Content-Type", slackResponse.headers.get("Content-Type") || "application/octet-stream");
    // Ye line file ko download karwati hai:
    headers.set("Content-Disposition", `attachment; filename="slack-image-${Date.now()}.jpg"`);

    return new NextResponse(blob, { status: 200, statusText: "OK", headers });

  } catch (error) {
    console.error("Proxy Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
