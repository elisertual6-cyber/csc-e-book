import { notFound } from "next/navigation";
const policies: Record<string, { title: string; text: string[] }> = {
  privacy: {
    title: "Privacy notice — draft",
    text: [
      "This foundation demo does not offer accounts, purchases, tracking analytics or saved exam progress. Exercise answers stay in your current browser state; hosting infrastructure may record technical access logs.",
      "Before collecting customer information, the operator must publish its legal identity and contact details, purposes and legal bases, processors, retention periods, safeguards, and procedures for access, correction, objection and deletion under applicable Philippine privacy law. Do not submit personal information to this demo.",
    ],
  },
  terms: {
    title: "Terms — draft",
    text: [
      "This is a development preview of independent, unofficial learning material. It is not endorsed by the CSC. It provides no passing guarantee or verified 2027 examination specifications.",
      "No products are currently sold. Content is draft and may change. Complete commercial license terms, operator identity and customer rights require legal review before launch.",
    ],
  },
  refunds: {
    title: "Refund policy — draft",
    text: [
      "Checkout is unavailable and no payments are accepted in this foundation demo.",
      "Before sales begin, publish the operator's refund eligibility, request process, delivery-failure handling, timelines and applicable statutory rights. This draft does not waive consumer rights.",
    ],
  },
  support: {
    title: "Support — not yet open",
    text: [
      "A customer support channel has not been configured. For development issues, open an issue in the project repository without posting passwords, payment details or personal information.",
      "The operator must provide a monitored support contact before enabling customer accounts or checkout.",
    ],
  },
};
export default async function Policy({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!Object.hasOwn(policies, slug)) notFound();
  const policy = policies[slug];
  return (
    <section className="shell section page-content">
      <div className="eyebrow">
        DEVELOPMENT PREVIEW · REQUIRES OPERATOR REVIEW
      </div>
      <article className="prose">
        <h1>{policy.title}</h1>
        {policy.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </article>
    </section>
  );
}
