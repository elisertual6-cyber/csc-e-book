import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { disclaimer } from "@/lib/curriculum";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CSC Study — Philippine Civil Service Exam Reviewer 2027",
    template: "%s | CSC Study",
  },
  description:
    "An independent, unofficial learning platform. Explore a provisional curriculum and original draft lesson preview.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="announcement">
          A fresh start for your next chapter.{" "}
          <span>2027 EDITION · DEVELOPMENT PREVIEW</span>
        </div>
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="brand" aria-label="CSC Study home">
              <span className="brand-icon">
                <BookOpen size={22} />
              </span>{" "}
              CSC<span className="brand-light">study</span>
              <span className="brand-dot">.</span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/curriculum">The curriculum</Link>
              <Link href="/practice">Practice studio</Link>
              <Link href="/shop">Reviewers</Link>
              <Link href="/account">My account</Link>
            </nav>
            <Link href="/preview" className="button button-small">
              Explore a free lesson <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer>
          <div className="shell footer-top">
            <div>
              <Link href="/" className="brand">
                CSC<span className="brand-light">study</span>.
              </Link>
              <p>Small steps. A stronger foundation.</p>
            </div>
            <div className="footer-links">
              <Link href="/policies/privacy">Privacy</Link>
              <Link href="/policies/terms">Terms</Link>
              <Link href="/policies/refunds">Refunds</Link>
              <Link href="/policies/support">Support</Link>
            </div>
          </div>
          <div className="shell footer-bottom">
            <p>{disclaimer}</p>
            <span>© 2026 CSC Study · Preview v0.1</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
