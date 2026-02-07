import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Hardcoded values
const SIGNING_SECRET = "e303eff75af6a30c4015dbb2716aecf4";

const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt";

// Verify Slack signature
function verifySlackSignature(timestamp: string, signature: string, body: string): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + createHmac('sha256', SIGNING_SECRET)
    .update(baseString)
    .digest('hex');
  return mySignature === signature;
}

export async function POST(req: Request) {
  try {
    // Get request details
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';
    const bodyText = await req.text();
    
    // Verify signature
    if (!verifySlackSignature(timestamp, signature, bodyText)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    
    const body = JSON.parse(bodyText);
    
    // URL verification for Slack
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }
    
    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event;
      
      // Handle message events
      if (event.type === 'message' && !event.subtype) {
        // You can process messages here if needed
        console.log("New message received:", event.text);
      }
      
      // Handle app_home_opened events
      if (event.type === 'app_home_opened') {
        // Handle app home opened
      }
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error("Slack events error:", error);
    return NextResponse.json({ ok: true });
  }
}