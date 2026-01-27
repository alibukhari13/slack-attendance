import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import emoji from 'node-emoji';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const LEAVE_CHANNEL = "C0AACUQMB9D"; // New leave channel

async function getSlackUserInfo(userId: string) {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await response.json();
    
    return {
      name: data.user?.real_name || data.user?.name || userId,
      profilePicture: data.user?.profile?.image_72 || 
                     data.user?.profile?.image_48 || 
                     data.user?.profile?.image_32 || 
                     null,
      displayName: data.user?.profile?.display_name || null
    };
  } catch (e) { 
    return {
      name: userId,
      profilePicture: null,
      displayName: null
    };
  }
}

// Convert emoji codes to actual emoji characters
function convertEmoji(text: string): string {
  if (!text) return '';
  
  // First convert Slack emoji format (:emoji_name:) to actual emoji
  let convertedText = emoji.emojify(text);
  
  // Handle custom Slack emojis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  convertedText = convertedText.replace(/:[a-zA-Z0-9_+-]+:/g, (match: string | any[]) => {
    const emojiName = match.slice(1, -1);
    // Try to get the emoji from node-emoji first
    const standardEmoji = emoji.get(emojiName);
    if (standardEmoji) return standardEmoji;
    
    // Return the original if not found
    return match;
  });
  
  return convertedText;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Handle URL verification for Slack
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Process message events
    if (body.event && body.event.type === 'message' && !body.event.bot_id) {
      const { user, channel, ts, text, files } = body.event;
      
      // Get user info with profile picture
      const userInfo = await getSlackUserInfo(user);
      
      const dateObj = new Date(parseFloat(ts) * 1000);
      const pktTime = dateObj.toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Karachi', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });
      
      const pktDate = dateObj.toLocaleDateString('en-CA', { 
        timeZone: 'Asia/Karachi' 
      });

      // Determine type based on channel
      let type = 'Message';
      if (channel === CHECK_IN_CHANNEL) {
        type = 'Check-In';
      } else if (channel === CHECK_OUT_CHANNEL) {
        type = 'Check-Out';
      } else if (channel === LEAVE_CHANNEL) {
        type = 'Leave';
      }

      // Convert emoji codes to actual emoji
      const processedText = convertEmoji(text || "");

      // Get image from attachments if available
      const imageUrl = files && files.length > 0 ? files[0].url_private_download : null;

      // Create document data
      const docData = {
        userId: user,
        userName: userInfo.name,
        userProfilePicture: userInfo.profilePicture,
        userDisplayName: userInfo.displayName,
        date: pktDate,
        time: pktTime,
        text: processedText,
        imageUrl: imageUrl,
        type: type,
        channel: channel,
        timestamp: serverTimestamp(),
        ts: ts
      };

      // Save to Firestore
      const docId = ts.replace('.', '-');
      await setDoc(doc(db, "attendance", docId), docData);
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Slack webhook:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}