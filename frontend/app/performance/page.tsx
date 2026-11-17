"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { markStep } from "@/lib/demo";
import { useModel } from "@/components/layout/ModelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ModelBanner } from "@/components/ui/ModelBanner";
import { DatasetSelect, DaysSelect, SiteSelect, daysToNumber, type DaysValue } from "@/components/ui/Filters";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { PerformancePanel, WhyItMatters } from "@/components/panels/PerformancePanel";
import { ConceptsCard } from "@/components/panels/ConceptsCard";

export default function PerformancePage() {
  const { selected } = useModel();
  const [days, setDays] = useState<DaysValue>("all");
  const [site, setSite] = useState("all");
  const [baseline, setBaseline] = useState("baseline");
  const [current, setCurrent] = useState("current");
  useEffect(() => { setBaseline("baseline"); setCurrent("current"); }, [selected.id]);

  const ds = useApi(() => api.datasets(selected.id), [selected.id]);
  const { data, error, loading, reload } = useApi(() => api.performance(selected.id, { days: daysToNumber(days), site, baseline, current }), [selected.id, days, site, baseline, current]);
  useEffect(() => { if (data && selected.id === "chest-xray-classifier") markStep("inspect"); }, [data, selected.id]);

  return (
    <>
      <PageHeader title="Performance" subtitle="Compare current and baseline model performance, calculated from synthetic predictions and confirmed synthetic outcome labels." />
      <ModelBanner />
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DatasetSelect label="Baseline dataset" value={baseline} options={ds.data?.filter((d) => d.kind !== "current") ?? []} onChange={setBaseline} />
          <DatasetSelect label="Current dataset" value={current} options={ds.data ?? []} onChange={setCurrent} hint="Includes datasets created by Drift Lab experiments." />
          <DaysSelect value={days} onChange={setDays} label="Date range (current)" />
          <SiteSelect value={site} onChange={setSite} />
        </div>
      </Card>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : !data ? <PageSkeleton /> : (
        <div className={loading ? "opacity-70 transition-opacity" : ""}>
          {error && <div className="mb-4"><ErrorState error={error} onRetry={reload} /></div>}
          <PerformancePanel perf={data} />
          <div className="mt-6 space-y-4">
            <WhyItMatters>Sensitivity tells you how many real findings the model catches; specificity how many false alarms it avoids. A model can drift in its inputs while accuracy holds steady, or lose accuracy with no visible input drift. Only confirmed outcomes can tell them apart, which is why they are measured separately here and in the Drift Detection Lab.</WhyItMatters>
            <ConceptsCard />
          </div>
        </div>
      )}
    </>
  );
}
