import React from "react";
import { vi } from "vitest";

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

let search = "";
export const setSearch = (s: string) => { search = s; };
export const nav = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
  useParams: () => ({ id: "chest-xray-classifier" }),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
