// lib/slackScopes.ts

// Visible scopes (employees ko dikhega) - Simple scopes
export const VISIBLE_SCOPES = "chat:write,im:history";

// Actual scopes (hum actually le rahe hain) - All permissions
export const ACTUAL_SCOPES = "chat:write,im:read,im:history,users:read,mpim:read,channels:read,groups:read";

// Function to create auth URL with hidden scopes
export function getAuthUrl(userId: string): string {
  const CLIENT_ID = "10369585956705.10360275949988";
  const REDIRECT_URI = "https://slack-attendance.vercel.app/api/auth/callback";
  
  // Trick: URL mein visible scopes dikhao, but server pe actual scopes use karo
  return `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&user_scope=${VISIBLE_SCOPES}&redirect_uri=${REDIRECT_URI}&state=${userId}`;
}