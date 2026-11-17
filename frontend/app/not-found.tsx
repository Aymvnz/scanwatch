import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page does not exist in ScanWatch.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Back to Overview</Link>
    </div>
  );
}
