import { AudioProvider } from "@/features/audio/AudioProvider";
import type { Metadata } from "next";
import "@fontsource/nunito/cyrillic-600.css";
import "@fontsource/nunito/cyrillic-900.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-900.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crew Mission",
  description: "A multiplayer social-deduction space game",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AudioProvider>
          <div className="app-shell">{children}</div>
        </AudioProvider>
      </body>
    </html>
  );
}
