import { notFound } from "next/navigation";
const policies: Record<string, { title: string; text: string[] }> = {
  privacy: {
    title: "Privacy notice — draft",
    text: [
      "Development accounts store a name, email address, salted password hash, role and timestamps in PostgreSQL. A necessary HttpOnly session cookie keeps you signed in for up to 24 hours; the database stores only a hash of its random token. Editorial changes and reviews create audit records. Reviewed practice sessions store responses, review flags, timing and practice scores in your account. The public ungraded example keeps answers only in browser memory. No analytics, purchases or emails are enabled. Hosting infrastructure may retain technical access logs.",
      "Use synthetic account details while testing. Account and editorial records remain until the operator removes them; expired sessions and rate-limit counters are removed by scheduled maintenance. Before accepting real customer information, the operator must publish its legal identity and monitored contact, legal bases, processors, precise retention periods and data subject request procedures, and obtain Philippine privacy/legal review. This draft is not a claim of compliance.",
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
      "Synthetic development accounts are available for testing. The operator must provide a monitored support contact, verification and account-recovery procedures before launching real customer registration or checkout.",
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
