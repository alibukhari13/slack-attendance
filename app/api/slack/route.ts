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

const emojiMap: Record<string, string> = {
  // Check marks
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✅',
  
  // Status
  ':x:': '❌',
  ':heavy_multiplication_x:': '✖️',
  
  // Common symbols
  ':warning:': '⚠️',
  ':exclamation:': '❗',
  
  // Faces
  ':smile:': '😄',
  ':smiley:': '😃',
  ':grinning:': '😀',
  ':blush:': '😊',
  
  // Flags
  ':flag-pk:': '🇵🇰',
  
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
  
  // Hands
  ':raised_hands:': '🙌',
  ':clap:': '👏',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  
  // Objects
  ':computer:': '💻',
  ':phone:': '📱',
  ':envelope:': '✉️',
  ':calendar:': '📅',
  ':clock:': '🕰️',
  
  // Leaves/Time off
  ':palm_tree:': '🌴',
  ':beach:': '🏖️',
  ':airplane:': '✈️',
  ':car:': '🚗',
  ':hospital:': '🏥',
  ':house:': '🏠',
  ':office:': '🏢',
};

function convertEmojis(text: string): string {
  if (!text) return '';
  
  let convertedText = text;
  
  Object.keys(emojiMap).forEach(emojiCode => {
    const regex = new RegExp(emojiCode, 'g');
    convertedText = convertedText.replace(regex, emojiMap[emojiCode]);
  });
  
  return convertedText;
}

// Function to parse leave duration from text
function parseLeaveDuration(text: string): {
  startDate: string | null;
  endDate: string | null;
  duration: string;
} {
  if (!text) return { startDate: null, endDate: null, duration: '1 day' };
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Try to extract dates from common patterns
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    /(\d{1,2})-(\d{1,2})-(\d{4})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi,
  ];
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  
  for (const pattern of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 1) {
      try {
        startDate = new Date(matches[0][0]);
        if (matches.length >= 2) {
          endDate = new Date(matches[1][0]);
        } else {
          // If only one date, assume one day leave
          endDate = new Date(startDate);
        }
        break;
      } catch (e) {
        continue;
      }
    }
  }
  
  // If no dates found, assume today
  if (!startDate) {
    startDate = today;
    endDate = today;
  }
  
  // Format dates
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Calculate duration
  const durationDays = Math.ceil((endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const duration = durationDays === 1 ? '1 day' : `${durationDays} days`;
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate!),
    duration
  };
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
      
      // Get user info
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

      // Convert emojis
      const processedText = convertEmojis(text || "");

      // Get image from attachments if available
      const imageUrl = files && files.length > 0 ? files[0].url_private_download : null;

      // Prepare document data
      const docData: any = {
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

      // If it's a leave, parse leave duration
      if (type === 'Leave') {
        const leaveInfo = parseLeaveDuration(processedText);
        docData.leaveStartDate = leaveInfo.startDate;
        docData.leaveEndDate = leaveInfo.endDate;
        docData.leaveDuration = leaveInfo.duration;
        
        // For leave messages, also create daily records for each day of leave
        if (leaveInfo.startDate && leaveInfo.endDate) {
          const start = new Date(leaveInfo.startDate);
          const end = new Date(leaveInfo.endDate);
          
          // Create daily leave records
          const currentDate = new Date(start);
          while (currentDate <= end) {
            const dailyDate = currentDate.toISOString().split('T')[0];
            const dailyTime = currentDate.getTime() === start.getTime() ? pktTime : '00:00 AM';
            
            const dailyDocId = `${ts.replace('.', '-')}-${dailyDate}`;
            const dailyDocData = {
              ...docData,
              date: dailyDate,
              time: dailyTime,
              isDailyLeaveRecord: true,
              originalTs: ts
            };
            
            // Save each daily leave record
            await setDoc(doc(db, "attendance", dailyDocId), dailyDocData);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }

      // Save the main record
      const docId = ts.replace('.', '-');
      await setDoc(doc(db, "attendance", docId), docData);
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Slack webhook:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}