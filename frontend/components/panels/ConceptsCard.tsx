import { FOUR_QUESTIONS } from "@/lib/glossary";
import { Card, CardHeader } from "../ui/Card";

export function ConceptsCard() {
  return (
    <Card>
      <CardHeader title="Four different questions" description="These are easy to confuse. A change in one does not automatically mean a change in another." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FOUR_QUESTIONS.map((q) => (
          <div key={q.q} className="rounded-lg bg-canvas p-3"><div className="text-[13px] font-semibold text-navy">{q.q}</div><div className="mt-0.5 text-xs leading-5 text-muted">{q.a}</div></div>
        ))}
      </div>
    </Card>
  );
}
