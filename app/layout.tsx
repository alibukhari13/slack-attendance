import "./globals.css";

export const metadata = {
  title: "Slack Luxury Dashboard",
  description: "Attendance tracking made premium",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0b1014]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}