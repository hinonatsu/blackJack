import type { Metadata } from "next";
import "./globals.css";
import { OfflineRegistration } from "./offline-registration";

export const metadata: Metadata = {
  title: "Vegas Blackjack Trainer",
  description: "ラスベガス旅行前のブラックジャック実戦トレーニング",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <OfflineRegistration />
        {children}
      </body>
    </html>
  );
}
