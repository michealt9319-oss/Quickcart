import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "QuickCart",
  description: "Essentials delivered in under two hours",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="topbar">
          <Link href="/" className="brand">
            QuickCart
          </Link>
          <Link href="/cart" aria-label="Cart">
            Cart
          </Link>
        </div>
        {children}
      </body>
    </html>
  );
}
