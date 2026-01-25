import { NextResponse } from 'next/server';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, {
      headers: { 
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    // Har message ke user ka naam fetch karne ke liye hume user info chahiye hogi
    // Filhal hum messages return kar rahe hain
    return NextResponse.json({ messages: data.messages });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}