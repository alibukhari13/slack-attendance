// app/success/page.tsx
"use client";
import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

export default function SuccessPage() {
  useEffect(() => {
    // 2 second baad wapas Slack App open karein
    setTimeout(() => {
      window.location.href = "slack://open";
    }, 1500);
  }, []);

  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center text-center p-4">
      <div className="mb-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800">Update Successful</h1>
      <p className="text-gray-500 mt-2">Your account features have been upgraded.</p>
      <p className="text-sm text-gray-400 mt-8">Redirecting back to Slack...</p>
    </div>
  );
}