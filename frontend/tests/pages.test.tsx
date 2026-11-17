import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { ModelProvider } from "@/components/layout/ModelContext";
import OverviewPage from "@/app/page";
import ModelsPage from "@/app/models/page";
import ModelDetailPage from "@/app/models/[id]/page";
import PerformancePage from "@/app/performance/page";
import PatientSafetyPage from "@/app/patient-safety/page";
import DriftLabPage from "@/app/drift-lab/page";
import AlertsPage from "@/app/alerts/page";
import ReportsPage from "@/app/reports/page";
import SettingsPage from "@/app/settings/page";
import { TourHost } from "@/components/onboarding/Tour";
import { setSearch } from "./setup";

const wrap = (ui: React.ReactElement) => render(<ModelProvider>{ui}</ModelProvider>);
const find = (t: string | RegExp) => screen.findAllByText(t, {}, { timeout: 30000 });

beforeEach(async () => {
  cleanup(); setSearch(""); window.localStorage.clear();
  await fetch("http://localhost:8000/demo/reset", { method: "POST" });
});

describe("pages render against the live API", () => {
  it("overview", async () => {
    wrap(<OverviewPage />);
    await find("Medical AI Monitoring Overview");
    await find("Imaging Triage Model");
    expect(await screen.findByText("Guided demo · 0 of 7 done".replace("0 of", "1 of"), {}, { timeout: 30000 })).toBeTruthy();
    expect(screen.getAllByText(/Missing: image feature 2|Data drift detected|Missing data increased/).length).toBeGreaterThan(0);
  });
  it("models list and detail tabs", async () => {
    wrap(<ModelsPage />); await find("Chest X-ray Classifier"); cleanup();
    wrap(<ModelDetailPage />);
    await find("Model details");
    for (const tab of [/^Performance$/, /^Drift results$/, /^Subgroups$/, /^Experiments/, /^Alerts/]) fireEvent.click(screen.getByRole("tab", { name: tab }));
    await find("Alert history");
  });
  it("performance, patient safety", async () => {
    wrap(<PerformancePage />); await find("Dataset sample sizes"); await find("Baseline confusion matrix"); cleanup();
    wrap(<PatientSafetyPage />); await find("Comparison table"); await find(/Why can overall performance hide/);
  });
  it("settings", async () => { wrap(<SettingsPage />); await find("Alert thresholds"); await find("PSI: moderate shift"); });
  it("alerts list and deep-linked detail", async () => {
    setSearch("id=ALT-0001");
    wrap(<AlertsPage />);
    await find("Suggested investigation");
    await find("Human review required");
    await find("Alert history");
  });
});

describe("demo workflow in the UI", () => {
  it("runs an imaging-equipment experiment, then investigates the alert and generates a report", async () => {
    wrap(<DriftLabPage />);
    await find("No experiment yet");
    await screen.findByText("Imaging Equipment Change", {}, { timeout: 30000 });
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    await find(/Input drift detected/);
    await find("Feature-level results");
    expect(screen.getAllByText(/Data drift detected/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Performance decline detected/)).toBeNull();
    cleanup();

    const alerts = await (await fetch("http://localhost:8000/alerts?model_id=chest-xray-classifier")).json();
    setSearch(`id=${alerts[0].id}`);
    wrap(<AlertsPage />);
    await find("Investigation notes");
    fireEvent.click(await screen.findByRole("button", { name: /Mark investigating/ }));
    await waitFor(() => expect(screen.getAllByText("Investigating").length).toBeGreaterThan(0), { timeout: 30000 });
    fireEvent.change(screen.getByPlaceholderText(/Checked the scanner/), { target: { value: "Scanner firmware updated on 3 Oct." } });
    fireEvent.click(screen.getByRole("button", { name: /Add note/ }));
    await find("Scanner firmware updated on 3 Oct.");
    cleanup();

    wrap(<ReportsPage />);
    await screen.findByText("Generate report", {}, { timeout: 30000 });
    fireEvent.click(screen.getByRole("button", { name: /Generate report/ }));
    await find(/Disclaimer/);
    expect(screen.getAllByText(/RPT-0001/).length).toBeGreaterThan(0);
    const progress = JSON.parse(window.localStorage.getItem("scanwatch.demoProgress") ?? "[]");
    expect(progress).toEqual(expect.arrayContaining(["lab", "simulate", "alert", "investigate", "report"]));
  });
});

describe("onboarding", () => {
  it("opens on first visit, walks through steps, and does not reappear once finished", async () => {
    const { unmount } = wrap(<TourHost />);
    await screen.findByText("Welcome to ScanWatch");
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("button", { name: /Start the guided demo/ });
    fireEvent.click(screen.getByRole("button", { name: "Explore on my own" }));
    expect(window.localStorage.getItem("scanwatch.tourDone")).toBe("1");
    unmount();
    wrap(<TourHost />);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText("Welcome to ScanWatch")).toBeNull();
  });
});
