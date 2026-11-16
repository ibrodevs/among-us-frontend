import type { Metadata } from "next";
import { GameScreen } from "@/features/game/components/GameScreen";

export const metadata: Metadata = {
  title: "Орбитальная станция · Crew Mission",
  icons: { icon: "/game/station.svg" },
};

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GameScreen key={code} code={code} />;
}
