import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "SliceIt — AI Personal Tennis Coach",
  description:
    "SliceIt analyzes your tennis practice videos and gives you exactly one actionable focus point per session. Powered by pose estimation and adaptive coaching AI.",
  keywords: ["tennis coach", "AI tennis", "pose estimation", "tennis training", "sports AI"],
  openGraph: {
    title: "SliceIt — AI Personal Tennis Coach",
    description: "One focus point per session. Real technique improvement.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="court-bg">
        <Navigation />
        <main style={{ paddingTop: "72px" }}>{children}</main>
      </body>
    </html>
  );
}
