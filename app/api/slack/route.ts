import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Hardcoded values
const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const LEAVE_CHANNEL = "C0AACUQMB9D";

// Emoji mapping
const emojiMap: Record<string, string> = {
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✅',
  ':ballot_box_with_check:': '☑️',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':exclamation:': '❗',
  ':question:': '❓',
  ':smile:': '😊',
  ':simple_smile:': '🙂',
  ':joy:': '😂',
  ':sob:': '😭',
  ':sweat_smile:': '😅',
  ':thumbsup:': '👍',
  ':+1:': '👍',
  ':thumbsdown:': '👎',
  ':-1:': '👎',
  ':ok_hand:': '👌',
  ':wave:': '👋',
  ':clap:': '👏',
  // Add more emojis as needed
};

// Convert emojis
function convertEmojis(text: string): string {
  if (!text) return '';
  let result = text;
  
  Object.entries(emojiMap).forEach(([shortcode, emoji]) => {
    const escapedShortcode = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedShortcode, 'g');
    result = result.replace(regex, emoji);
  });
  
  return result;
}

// Get Slack user info
async function getSlackUserInfo(userId: string) {
  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { 
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
    });
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return {
        name: `User-${userId.substring(0, 8)}`,
        profilePicture: null,
        displayName: null
      };
    }
    
    const profile = data.user?.profile;

    return {
      name: data.user?.real_name || data.user?.name || `User-${userId.substring(0, 8)}`,
      profilePicture: profile?.image_original || 
                     profile?.image_1024 || 
                     profile?.image_512 || 
                     profile?.image_192 || 
                     profile?.image_72 || 
                     null,
      displayName: profile?.display_name || data.user?.name || null
    };
  } catch (e) { 
    console.error('Error fetching Slack user info:', e);
    return {
      name: `User-${userId.substring(0, 8)}`,
      profilePicture: null,
      displayName: null
    };
  }
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

      // Get image from attachments if available
      const imageUrl = files && files.length > 0 ? files[0].url_private_download : null;

      // Create document data with Converted Emojis
      const docData = {
        userId: user,
        userName: userInfo.name,
        userProfilePicture: userInfo.profilePicture,
        userDisplayName: userInfo.displayName,
        date: pktDate,
        time: pktTime,
        text: convertEmojis(text || ""),
        imageUrl: imageUrl,
        type: type,
        channel: channel,
        timestamp: serverTimestamp(),
        ts: ts
      };

      // Save to Firestore with unique ID
      const docId = `${user}_${ts.replace('.', '_')}`;
      await setDoc(doc(db, "attendance", docId), docData);
      
      console.log(`Saved ${type} record for ${userInfo.name} at ${pktTime} on ${pktDate}`);
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Slack webhook:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}