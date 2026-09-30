import { memo, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Lang = "pt" | "en";

function DashboardDrawerImpl({
  open,
  title,
  hint,
  lang,
  onClose,
  children,
  width = 460,
}: {
  open: boolean;
  title: string;
  hint?: string;
  lang: Lang;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        // Mobile portrait: ocupa a tela inteira; ≥sm respeita a largura configurada.
        // Mobile landscape (mland): entra pela ESQUERDA como painel de 62vw,
        // deixando o rail do hub (à direita) e uma faixa do cockpit visíveis
        // para operação com uma mão.
        "pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-full flex-col border-l border-border/60 bg-background/95 shadow-2xl backdrop-blur transition-transform duration-200 ease-out sm:w-auto",
        "mland:right-auto mland:left-0 mland:w-[62vw] mland:max-w-[62vw] mland:border-l-0 mland:border-r",
        open
          ? "translate-x-0"
          : "translate-x-full mland:-translate-x-full",
      )}
      style={{ ["--dash-w" as string]: `${width}px`, maxWidth: "100vw" }}
    >
      <div className="flex h-full w-full flex-col sm:w-[min(var(--dash-w),100vw)] mland:w-full">
        <header className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {lang === "pt" ? "Painel" : "Panel"}
            </div>
            <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
            {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === "pt" ? "Fechar" : "Close"}
            className="shrink-0 rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="canetada-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <div className="space-y-3">{children}</div>
        </div>
      </div>
    </aside>
  );
}

export const DashboardDrawer = /*#__PURE__*/ memo(DashboardDrawerImpl);
