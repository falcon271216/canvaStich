import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excalidraw – Real-time Drawing with Pattern Detection",
  description: "Collaborative whiteboard with DTW-based shape recognition and time-series analysis",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
