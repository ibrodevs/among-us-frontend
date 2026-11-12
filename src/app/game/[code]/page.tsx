import Link from "next/link";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <main className="panel">
    <p className="muted">GAME MODULE · BAYEL</p>
    <h1 className="brand">Станция {code}</h1>
    <p className="subtitle">Основа маршрута готова. Canvas-карта, персонажи, WebSocket и игровые экраны будут реализованы в ветке Байэла.</p>
    <Link className="action secondary" style={{ display: "block", textAlign: "center" }} href={"/room/" + code}>Вернуться в лобби</Link>
  </main>;
}
