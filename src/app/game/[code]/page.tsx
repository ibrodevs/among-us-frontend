import type { Metadata } from "next";
import { LiveGameScreen } from "@/features/game/components/LiveGameScreen";

export const metadata: Metadata = {
  title: "Орбитальная станция · Crew Mission",
  icons: { icon: "/game/station.svg" },
};

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LiveGameScreen key={code} code={code} />;
}
