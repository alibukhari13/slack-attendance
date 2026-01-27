import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = "C0ABB105W3S";
const CHECK_OUT_CHANNEL = "C0AAGM79J6N";
const LEAVE_CHANNEL = "C0AACUQMB9D";

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

// Simple emoji mapping for common Slack emojis
const emojiMap: Record<string, string> = {
  // Check marks
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✅',
  ':ballot_box_with_check:': '☑️',
  
  // Status
  ':x:': '❌',
  ':heavy_multiplication_x:': '✖️',
  ':heavy_plus_sign:': '➕',
  ':heavy_minus_sign:': '➖',
  
  // Arrows
  ':arrow_right:': '➡️',
  ':arrow_left:': '⬅️',
  ':arrow_up:': '⬆️',
  ':arrow_down:': '⬇️',
  
  // Common symbols
  ':warning:': '⚠️',
  ':exclamation:': '❗',
  ':question:': '❓',
  ':information_source:': 'ℹ️',
  
  // Faces
  ':smile:': '😄',
  ':smiley:': '😃',
  ':grinning:': '😀',
  ':blush:': '😊',
  ':wink:': '😉',
  ':slightly_smiling_face:': '🙂',
  ':neutral_face:': '😐',
  ':confused:': '😕',
  ':frowning:': '😦',
  
  // Flags
  ':flag-pk:': '🇵🇰',
  ':flag-us:': '🇺🇸',
  ':flag-gb:': '🇬🇧',
  
  // Time
  ':clock1:': '🕐',
  ':clock2:': '🕑',
  ':clock3:': '🕒',
  ':clock4:': '🕓',
  ':clock5:': '🕔',
  ':clock6:': '🕕',
  ':clock7:': '🕖',
  ':clock8:': '🕗',
  ':clock9:': '🕘',
  ':clock10:': '🕙',
  ':clock11:': '🕚',
  ':clock12:': '🕛',
  
  // Weather
  ':sunny:': '☀️',
  ':cloud:': '☁️',
  ':rain_cloud:': '🌧️',
  ':snow_cloud:': '🌨️',
  
  // Hands
  ':raised_hands:': '🙌',
  ':clap:': '👏',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':ok_hand:': '👌',
  ':v:': '✌️',
  ':pray:': '🙏',
  
  // Objects
  ':computer:': '💻',
  ':phone:': '📱',
  ':envelope:': '✉️',
  ':incoming_envelope:': '📨',
  ':email:': '📧',
  ':calendar:': '📅',
  ':clock:': '🕰️',
  ':alarm_clock:': '⏰',
  ':hourglass:': '⏳',
  
  // Leaves/Time off
  ':palm_tree:': '🌴',
  ':beach:': '🏖️',
  ':airplane:': '✈️',
  ':car:': '🚗',
  ':hospital:': '🏥',
  ':hotel:': '🏨',
  ':house:': '🏠',
  ':office:': '🏢',
};

// Function to convert emoji codes to actual emojis
function convertEmojis(text: string): string {
  if (!text) return '';
  
  let convertedText = text;
  
  // Replace all known emoji codes
  Object.keys(emojiMap).forEach(emojiCode => {
    const regex = new RegExp(emojiCode, 'g');
    convertedText = convertedText.replace(regex, emojiMap[emojiCode]);
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

      // Convert emoji codes to actual emojis
      const processedText = convertEmojis(text || "");

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