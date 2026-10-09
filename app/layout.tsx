import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

/* Archivo is loaded with its width axis so display type can be set WIDE and
   tracked. A plan letters its titles by extending them horizontally, never by
   making them tall — which is why nothing here needs to be big. */
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/* Long Turkish text: a plain, institutional serif that reads like a
   specification rather than an editorial. */
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif",
  display: "swap",
});

/* Annotation face — field labels, times, dates, prices, counts. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kayıt Paneli — Bölge Asamblesi",
  description:
    "UR 2440. Bölge — 2027–28 Dönemi Bölge Asamblesi kayıt paneli. 2–4 Nisan 2027, Kuşadası.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${archivo.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
