import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PostHogProvider } from "@/lib/posthog/provider";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = "https://launchyournextchapter.com";
const title = "NextChapter — Welcome to your Next Chapter";
const description =
  "NextChapter is a candidate-first hiring platform. Upload your resume, build a profile that shows how you actually work, and get a free Market Reality Grade and Search Action Grade with a personalized action plan. Free for candidates, always.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | NextChapter",
  },
  description,
  keywords: [
    "job search",
    "hireability grade",
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
