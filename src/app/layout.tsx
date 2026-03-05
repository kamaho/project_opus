import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InputModeTracker } from "@/components/input-mode-tracker";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Revizo — Full kontroll over regnskapet",
    template: "%s — Revizo",
  },
  description:
    "Automatisk avstemming for regnskapsbyråer. Koble til Tripletex eller Visma, og få sanntidsoversikt over alle klienter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="no" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var k="project_opus_ui_preferences";var el=document.documentElement;try{var raw=localStorage.getItem(k);var s="normal",w="normal";if(raw){var p=JSON.parse(raw);var t=p&&p.typography;if(t&&(t.textSize==="large"||t.textSize==="larger"))s=t.textSize;if(t&&(t.textWeight==="medium"||t.textWeight==="bold"))w=t.textWeight;}el.setAttribute("data-text-size",s);el.setAttribute("data-text-weight",w);}catch(e){}})();`,
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <InputModeTracker />
          <Toaster position="top-right" richColors closeButton />
          <SpeedInsights />
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
