/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

const SLACK_BOT_TOKEN = "xoxb-10369585956705-10354644583366-EZlwC8OK1NTuHVU6cAOqTQV1";

// Fetch channel history from Slack
async function getChannelHistory(channelId: string) {
  try {
    const response = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}`, {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error(`Error fetching channel ${channelId}:`, data.error);
      return [];
    }

    // Get user info for each message
    const messagesWithUsers = await Promise.all(
      data.messages.map(async (message: any) => {
        let userName = message.user || 'Unknown';
        
        // Try to get user info
        if (message.user && !message.bot_id) {
          try {
            const userResponse = await fetch(`https://slack.com/api/users.info?user=${message.user}`, {
              headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            
            const userData = await userResponse.json();
            if (userData.ok) {
              userName = userData.user.real_name || userData.user.name || message.user;
            }
          } catch (error) {
            console.error(`Error fetching user ${message.user}:`, error);
          }
        }

        const dateObj = new Date(parseFloat(message.ts) * 1000);
        const pktTime = dateObj.toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Karachi', 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
        const pktDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

        return {
          channelId,
          userId: message.user,
          userName: userName,
          date: pktDate,
          time: pktTime,
          text: message.text || '',
          imageUrl: message.files && message.files.length > 0 ? message.files[0].url_private_download : null,
          type: channelId === 'C0ABB105W3S' ? 'Check-In' : 
                channelId === 'C0AAGM79J6N' ? 'Check-Out' : 'Message',
          timestamp: message.ts,
          rawMessage: message
        };
      })
    );

    return messagesWithUsers;
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { channelIds } = await req.json();

    if (!channelIds || !Array.isArray(channelIds)) {
      return NextResponse.json({ 
        error: "channelIds must be an array" 
      }, { status: 400 });
    }

    // Fetch history for all channels in parallel
    const allPromises = channelIds.map(channelId => getChannelHistory(channelId));
    const allResults = await Promise.all(allPromises);
    
    // Flatten the results
    const allMessages = allResults.flat();
    
    // Sort by timestamp (newest first)
    allMessages.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));

    return NextResponse.json({ 
      success: true,
      messages: allMessages,
      total: allMessages.length,
      channels: channelIds.length
    });

  } catch (error) {
    console.error('Error in channels API:', error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

// GET endpoint to test channel connectivity
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId') || 'C0ABB105W3S';

    const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json({ 
        connected: false,
        error: data.error,
        channelId
      });
    }

    return NextResponse.json({ 
      connected: true,
      channel: data.channel,
      channelId
    });

  } catch (error) {
    return NextResponse.json({ 
      connected: false,
      error: "Connection failed",
      details: error
    }, { status: 500 });
  }
}