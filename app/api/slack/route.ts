//app/api/slack/route.ts

import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";
const CHECK_IN_CHANNEL = process.env.CHECK_IN_CHANNEL || "C0ABB105W3S";
const CHECK_OUT_CHANNEL = process.env.CHECK_OUT_CHANNEL || "C0AAGM79J6N";
const LEAVE_CHANNEL = process.env.LEAVE_CHANNEL || "C0AACUQMB9D";

// Enhanced emoji mapping
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
  ':house:': '🏠',
  ':house_with_garden:': '🏡',
  ':office:': '🏢',
  ':briefcase:': '💼',
  ':computer:': '💻',
  ':airplane:': '✈️',
  ':car:': '🚗',
  ':oncoming_automobile:': '🚘',
  ':train:': '🚆',
  ':bus:': '🚌',
  ':palm_tree:': '🌴',
  ':beach_with_umbrella:': '🏖️',
  ':sun_with_face:': '🌞',
  ':hospital:': '🏥',
  ':pill:': '💊',
  ':thermometer:': '🌡️',
  ':mask:': '😷',
  ':face_with_thermometer:': '🤒',
  ':tada:': '🎉',
  ':fire:': '🔥',
  ':100:': '💯',
  ':heart:': '❤️',
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
  ':bell:': '🔔',
  ':alarm_clock:': '⏰',
  ':stopwatch:': '⏱️',
  ':hourglass:': '⏳',
  ':calendar:': '📅',
  ':date:': '📅',
  ':spiral_calendar_pad:': '📅',
  ':memo:': '📝',
  ':pencil:': '✏️',
  ':paperclip:': '📎',
  ':link:': '🔗',
  ':pushpin:': '📌',
  ':round_pushpin:': '📍',
  ':scissors:': '✂️',
  ':lock:': '🔒',
  ':unlock:': '🔓',
  ':key:': '🔑',
  ':mag:': '🔍',
  ':mag_right:': '🔎',
  ':bulb:': '💡',
  ':flashlight:': '🔦',
  ':battery:': '🔋',
  ':electric_plug:': '🔌',
  ':moneybag:': '💰',
  ':dollar:': '💵',
  ':yen:': '💴',
  ':euro:': '💶',
  ':pound:': '💷',
  ':email:': '📧',
  ':incoming_envelope:': '📨',
  ':envelope_with_arrow:': '📩',
  ':outbox_tray:': '📤',
  ':inbox_tray:': '📥',
  ':package:': '📦',
  ':mailbox:': '📫',
  ':mailbox_closed:': '📪',
  ':mailbox_with_mail:': '📬',
  ':mailbox_with_no_mail:': '📭',
  ':postbox:': '📮',
  ':postal_horn:': '📯',
  ':newspaper:': '📰',
  ':iphone:': '📱',
  ':calling:': '📲',
  ':vibration_mode:': '📳',
  ':mobile_phone_off:': '📴',
  ':no_mobile_phones:': '📵',
  ':signal_strength:': '📶',
  ':camera:': '📷',
  ':video_camera:': '📹',
  ':tv:': '📺',
  ':radio:': '📻',
  ':vhs:': '📼',
  ':film_projector:': '📽️',
  ':prayer_beads:': '📿',
  ':twisted_rightwards_arrows:': '🔀',
  ':repeat:': '🔁',
  ':repeat_one:': '🔂',
  ':arrow_forward:': '▶️',
  ':fast_forward:': '⏩',
  ':next_track_button:': '⏭️',
  ':play_or_pause_button:': '⏯️',
  ':arrow_backward:': '◀️',
  ':rewind:': '⏪',
  ':previous_track_button:': '⏮️',
  ':arrow_up_small:': '🔼',
  ':arrow_double_up:': '⏫',
  ':arrow_down_small:': '🔽',
  ':arrow_double_down:': '⏬',
  ':pause_button:': '⏸️',
  ':stop_button:': '⏹️',
  ':record_button:': '⏺️',
  ':eject_button:': '⏏️',
  ':cinema:': '🎦',
  ':low_brightness:': '🔅',
  ':high_brightness:': '🔆',

};

// Function to convert emoji shortcodes to actual emojis
function convertEmojis(text: string): string {
  if (!text) return '';
  let result = text;
  
  // Replace all emoji shortcodes
  Object.entries(emojiMap).forEach(([shortcode, emoji]) => {
    // Escape special regex characters in shortcode
    const escapedShortcode = shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedShortcode, 'g');
    result = result.replace(regex, emoji);
  });
  
  return result;
}

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
