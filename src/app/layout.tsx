import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crew Mission",
  description: "A multiplayer social-deduction space game",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
