"use client";
export default function ReviewerPrint() {
  return <button className="button button-light" onClick={() => window.print()}>Print / Save as PDF</button>;
}
