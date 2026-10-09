import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07090d"
};

export const metadata: Metadata = {
  title: "MOTM | Football Sessions",
  description:
    "MOTM football sessions: discover matches, register your team, manage your squad and secure your spot.",
  applicationName: "MOTM Football",
  icons: {
    icon: "/motm-logo.jpg",
    apple: "/motm-logo.jpg"
  },
  openGraph: {
    title: "MOTM | Football Sessions",
    description: "Your team. Your game. Your moment.",
    images: ["/motm-logo.jpg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <script
          id="motm-theme-init"
          dangerouslySetInnerHTML={{
            __html: `try {
            document.documentElement.dataset.theme = localStorage.getItem("motm-theme") === "light" ? "light" : "dark";
            document.documentElement.lang = localStorage.getItem("motm-language") === "en" ? "en" : "ms";
          } catch {
            document.documentElement.dataset.theme = "dark";
            document.documentElement.lang = "ms";
          }`
          }}
        />
      </head>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
