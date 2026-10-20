import Storefront from "@/components/storefront";
export default function Shop() {
  return (
    <section className="shell section page-content">
      <div className="eyebrow">INDEPENDENT STUDY MATERIALS</div>
      <h1>Choose your next chapter.</h1>
      <p className="lead">
        Explore the reviewer editions when they are ready. Every commercial
        edition needs independent editorial review before release.
      </p>
      <Storefront />
    </section>
  );
}
