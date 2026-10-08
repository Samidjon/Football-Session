import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export const metadata: Metadata = {
  title: "Football Session",
  description: "Football session and team registration platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
