import "./globals.css";

export const metadata = {
  title: "Slack Attendance | Dark Dashboard",
  description: "Employee Attendance Tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0f172a]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}