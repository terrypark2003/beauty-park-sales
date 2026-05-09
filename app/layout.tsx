import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "뷰티파크의원 매출 보고",
  description: "뷰티파크의원 일일 매출 보고 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
