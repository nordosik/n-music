import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Player from './components/Player'
import LyricsOverlay from './components/LyricsOverlay'
import TopPanel from './components/TopPanel' 
import ArtistModal from './components/ArtistModal' // МОЙ НОВЫЙ ИМПОРТ ДЛЯ МОДАЛКИ СВЯЗЕЙ

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "N.Musics",
  description: "Слушай треки от NORDOSIK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#050505]`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <TopPanel /> 
        <LyricsOverlay />
        <Player />
        <ArtistModal /> {/* МОЯ ГЛОБАЛЬНАЯ МОДАЛКА ДЛЯ СОЦСЕТЕЙ ПАЦАНОВ */}
      </body>
    </html>
  );
}