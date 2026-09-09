import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Лабвита — Статистика",
  description: "Дашборд колл-центра",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground font-[var(--font-montserrat)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}