"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useModel } from "@/components/layout/ModelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ModelBanner } from "@/components/ui/ModelBanner";
import { DatasetSelect, DaysSelect, SiteSelect, daysToNumber, type DaysValue } from "@/components/ui/Filters";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { SubgroupPanel } from "@/components/panels/SubgroupPanel";

export default function PatientSafetyPage() {
  const { selected } = useModel();
  const [days, setDays] = useState<DaysValue>("all");
  const [site, setSite] = useState("all");
  const [baseline, setBaseline] = useState("baseline");
  const [current, setCurrent] = useState("current");
  useEffect(() => { setBaseline("baseline"); setCurrent("current"); }, [selected.id]);
  const ds = useApi(() => api.datasets(selected.id), [selected.id]);
  const { data, error, loading, reload } = useApi(() => api.subgroups(selected.id, { days: daysToNumber(days), site, baseline, current }), [selected.id, days, site, baseline, current]);

  return (
    <>
      <PageHeader title="Patient Safety Explorer" subtitle="Compare synthetic model performance across age groups and clinical settings. Try ‘Last 30 days’ to see how small samples become unreliable." />
      <ModelBanner />
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DatasetSelect label="Baseline dataset" value={baseline} options={ds.data?.filter((d) => d.kind !== "current") ?? []} onChange={setBaseline} />
          <DatasetSelect label="Current dataset" value={current} options={ds.data ?? []} onChange={setCurrent} />
          <DaysSelect value={days} onChange={setDays} label="Date range (current)" />
          <SiteSelect value={site} onChange={setSite} />
        </div>
      </Card>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : !data ? <PageSkeleton /> : (
        <div className={loading ? "opacity-70 transition-opacity" : ""}><SubgroupPanel data={data} /></div>
      )}
    </>
  );
}
