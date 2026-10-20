import Link from "next/link";
export default function NotFound() {
  return (
    <section className="shell section page-content">
      <h1>A page yet to be written.</h1>
      <p>We could not find that page.</p>
      <Link className="button" href="/">
        Return home →
      </Link>
    </section>
  );
}
