import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";
import { MusicHost } from "@/components/game/MusicHost";
import { SfxHost } from "@/components/game/SfxHost";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Canetada — Simulador de Prefeitura Brasileira 2026" },
      {
        name: "description",
        content:
          "Canetada: administre uma cidade brasileira em 2026. Orçamento, tributos, Câmara, mídia e desastres climáticos — cada canetada tem consequência.",
      },
      { property: "og:title", content: "Canetada — Simulador de Prefeitura Brasileira 2026" },
      {
        property: "og:description",
        content:
          "Uma canetada muda tudo. Gerencie finanças, políticas, Câmara e crises como prefeito(a) de uma cidade brasileira em 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <GameShell />
      <MusicHost />
      <SfxHost />

    </>
  );
}
