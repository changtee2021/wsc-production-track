import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppVersion } from "@/components/AppVersion";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FeedbackFab } from "@/components/FeedbackFab";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WSC ProductionTrack" },
      {
        name: "description",
        content:
          "ระบบติดตามการผลิตในโรงงาน บันทึกขั้นตอนงานและการตรวจ QC แบบเรียลไทม์ ใช้งานง่ายบนมือถือ",
      },
      { name: "author", content: "WSC ProductionTrack" },
      { property: "og:site_name", content: "WSC ProductionTrack" },
      { property: "og:title", content: "WSC ProductionTrack" },
      {
        property: "og:description",
        content:
          "ระบบติดตามการผลิตในโรงงาน บันทึกขั้นตอนงานและการตรวจ QC แบบเรียลไทม์ ใช้งานง่ายบนมือถือ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WSC ProductionTrack" },
      {
        name: "twitter:description",
        content:
          "ระบบติดตามการผลิตในโรงงาน บันทึกขั้นตอนงานและการตรวจ QC แบบเรียลไทม์ ใช้งานง่ายบนมือถือ",
      },
      { name: "description", content: "- WSC ProductionTrack is a mobile-optimized web app for tracking manufacturing production steps, employee activity, and quality control checks, featuring a dyna" },
      { property: "og:description", content: "- WSC ProductionTrack is a mobile-optimized web app for tracking manufacturing production steps, employee activity, and quality control checks, featuring a dyna" },
      { name: "twitter:description", content: "- WSC ProductionTrack is a mobile-optimized web app for tracking manufacturing production steps, employee activity, and quality control checks, featuring a dyna" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/SB11sYmcAcWg6RHXTfd1y5NFKnt2/social-images/social-1779163664268-1003807_0.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/SB11sYmcAcWg6RHXTfd1y5NFKnt2/social-images/social-1779163664268-1003807_0.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const isAdmin = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId.includes("_protected")),
  });
  return (
    <ThemeProvider>
      <Outlet />
      <FeedbackFab />
      {!isAdmin && (
        <footer className="flex items-center justify-center py-2">
          <AppVersion />
        </footer>
      )}
    </ThemeProvider>
  );
}
