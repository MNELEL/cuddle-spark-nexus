import { useEffect, useState } from "react";
import { Printer, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REWARD_CHARTS,
  applyRewardChartCustomization,
  DEFAULT_REWARD_CHART_CUSTOMIZATION,
  type RewardChart,
  type RewardChartCustomization,
} from "@/lib/reward-charts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateRewardChartPdf, generateAllRewardChartsPdf } from "@/lib/pdf/reward-chart-pdf";
import { toast } from "sonner";

/** Blank printable grid for one chart — rendered on screen and on paper. */
function ChartTable({ chart }: { chart: RewardChart }) {
  return (
    <div className="reward-chart-sheet break-after-page">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-base font-bold">{chart.name}</h3>
        <span className="text-xs text-muted-foreground print:text-black">הכיתה שלי</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground print:text-black">
        יעד: {chart.goal} · סולם פרסים: {chart.reward}
      </p>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-border px-1 py-1 text-right font-semibold print:border-black">
                {chart.rowLabel}
              </th>
              {chart.columns.map((c) => (
                <th key={c} className="border border-border px-1 py-1 font-semibold print:border-black">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: chart.rows }).map((_, r) => (
              <tr key={r}>
                <td className="h-6 border border-border px-1 print:border-black" />
                {chart.columns.map((c) => (
                  <td key={c} className="h-6 border border-border print:border-black" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground print:text-black">
        חתימת המלמד: ______________ · תאריך סיום המבצע: ______________
      </p>
    </div>
  );
}

/**
 * Print-friendly view of the reward charts: choose a single chart (or all of
 * them), print straight from the browser, or download a branded PDF.
 */
export function RewardChartPrintView() {
  const [selected, setSelected] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState<RewardChartCustomization>(DEFAULT_REWARD_CHART_CUSTOMIZATION);
  const base = selected === "all" ? REWARD_CHARTS : REWARD_CHARTS.filter((c) => c.id === selected);
  const charts = base.map((c) => applyRewardChartCustomization(c, custom));
  const landscape = charts.some((c) => c.orientation === "landscape");

  // Match the paper orientation to the widest chart being printed.
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-reward-chart-page", "");
    style.textContent = `@media print { @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; } }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [landscape]);

  const downloadOne = async (chart: RewardChart) => {
    setBusy(chart.id);
    try {
      await generateRewardChartPdf(chart, undefined, custom.teacherName);
    } catch {
      toast.error("יצירת ה-PDF נכשלה, נסה שוב");
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy("all");
    try {
      await generateAllRewardChartsPdf(undefined, charts, custom.teacherName);
    } catch {
      toast.error("יצירת ה-PDF נכשלה, נסה שוב");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl">
      <div className="reward-chart-controls flex flex-wrap items-center gap-2 print:hidden">
        <label htmlFor="reward-chart-select" className="text-sm text-muted-foreground">
          בחר לוח:
        </label>
        <select
          id="reward-chart-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">כל הלוחות (5)</option>
          {REWARD_CHARTS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="ml-2 h-4 w-4" aria-hidden="true" />
          הדפסה
        </Button>
        <Button
          size="sm"
          onClick={() => (selected === "all" ? downloadAll() : downloadOne(charts[0]))}
          disabled={busy !== null}
        >
          {busy ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="ml-2 h-4 w-4" aria-hidden="true" />
          )}
          הורדת PDF
        </Button>
      </div>

      <div className="reward-chart-print-area mt-6 space-y-8">
        {charts.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
            <ChartTable chart={c} />
            <div className="mt-3 print:hidden">
              <Button size="sm" variant="outline" onClick={() => downloadOne(c)} disabled={busy !== null}>
                {busy === c.id ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="ml-2 h-4 w-4" aria-hidden="true" />
                )}
                הורד PDF ללוח זה
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}