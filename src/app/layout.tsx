import type { Metadata, Viewport } from "next";

import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Notes MPH1865",
  description: "Créez des rapports photo avec commentaires vocaux, générés par IA.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // App-like feel
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${inter.className} antialiased`}
      >
        <AuthProvider>
          <main className="min-h-screen pb-20">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

