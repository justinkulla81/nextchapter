import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { PostHogProvider } from "@/lib/posthog/provider";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { HomepageVisitTracker } from "@/components/marketing/HomepageVisitTracker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Partners Master Build Script §B3.3 — candidate-side section headings
// only (scoped via the `.theme-candidate` CSS class in globals.css, not
// applied here). Partner side stays Inter-only by intent.
const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  // Only the candidate dashboard's headings use it, so don't make every
  // public page download it up front (it competed with the hero text for
  // bandwidth and pushed out LCP on mobile).
  preload: false,
});

const siteUrl = "https://launchyournextchapter.com";
const title = "NextChapter — Welcome to your Next Chapter";
const description =
  "NextChapter is a candidate-first hiring platform. Upload your resume, build a profile that shows how you actually work, and get a free Current Market Reality with a personalized action plan. Free for candidates, always.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | NextChapter",
  },
  description,
  keywords: [
    "job search",
    "market reality grade",
    "candidate profile",
    "resume review",
    "job search platform",
    "career change",
    "employment references",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  // No root canonical: Next.js copies it into every page without its own,
  // which made /pricing and others declare the homepage as their canonical.
  // Each public page sets its own via canonical() in src/lib/seo/canonical.ts.
  openGraph: {
    type: "website",
    siteName: "NextChapter",
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif4.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <HomepageVisitTracker />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
