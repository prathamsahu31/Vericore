import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import "@/styles/globals.css";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { BackendHealthGate } from "@/components/BackendHealthGate";

// Three roles, chosen for this brief specifically (CLAUDE.md §11).
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-source-serif",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vericore — bid compliance verification",
  description:
    "Verifies bidder-submitted evidence against tender-specific requirements. The officer decides.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
      </head>
      <body className="page-backdrop min-h-screen text-ink antialiased">
        <CustomCursor />
        <BackendHealthGate mode="banner">{children}</BackendHealthGate>
      </body>
    </html>
  );
}
