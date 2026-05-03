import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pattern Detection in Time Series Data — Dashboard",
  description: "DTW shape matching, velocity-profile analysis, CUSUM anomaly detection, and Prometheus time-series observability for a collaborative drawing platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav">
          <a href="/">Overview</a>
          <a href="/patterns">Pattern Detection</a>
          <a href="/session">Session Analysis</a>
          <a href="/metrics">Time Series (Prometheus)</a>
          <a href="/raw">Raw Metrics</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
