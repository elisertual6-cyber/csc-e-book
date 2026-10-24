import { notFound } from "next/navigation";
const policies: Record<string, { title: string; text: string[] }> = {
  privacy: {
    title: "Privacy notice — draft",
    text: [
      "The public study planner works without an account. Browser saving is optional and off by default. If you enable it, this browser stores the selected track, study minutes, optional start date, current day and completed-day numbers. These settings are not synced to your account or sent to a planner API. Turn saving off to remove this planner's saved entry, or remove it through your browser's site-data settings. Leave saving off on shared devices. Browser saving contains no account credentials, exam questions or answers.",
      "Development accounts store a name, email address, salted password hash, role and timestamps in PostgreSQL. A necessary HttpOnly session cookie keeps you signed in for up to 24 hours; the database stores only a hash of its random token. Editorial changes and reviews create audit records. Reviewed practice sessions store responses, review flags, timing and practice scores in your account. The public ungraded example keeps answers only in browser memory. Development mock orders store item prices, payment simulation status, access entitlements, delivery notices and download activity. GCash sandbox checkout is implemented through PayMongo but no real payment service or analytics is enabled. An authorized future PayMongo sandbox test receives server-owned item prices and order references, while payment credentials remain on its hosted page. No live wallet/card credentials are collected by this app. Account verification and password recovery use hashed, expiring single-use tokens. Transactional messages are queued with encrypted payloads; a separately configured SMTP worker may submit them to the operator’s mail provider. In file development mode messages stay in a private inbox, not a real mailbox. Hosting infrastructure may retain technical access logs.",
      "Use synthetic account details while testing. Account and editorial records remain until the operator removes them; expired sessions, rate-limit counters and account tokens are removed by operator-scheduled maintenance. Expired queued-mail payloads are erased, as are sent payloads; local development inbox files are removed after 24 hours by maintenance. Delivery metadata remains pending an operator-approved retention policy. Before accepting real customer information, the operator must publish its legal identity and monitored contact, legal bases, processors, precise retention periods and data subject request procedures, and obtain Philippine privacy/legal review. This draft is not a claim of compliance.",
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
      "Checkout is unavailable and no real payments are accepted. Development mode supports simulated orders and test downloads.",
      "Before sales begin, publish the operator's refund eligibility, request process, delivery-failure handling, timelines and applicable statutory rights. This draft does not waive consumer rights.",
    ],
  },
  support: {
    title: "Support — not yet open",
    text: [
      "A customer support channel has not been configured. For development issues, open an issue in the project repository without posting passwords, payment details or personal information.",
      "Synthetic development accounts are available for testing. The operator must provide a monitored support contact, mail sender verification, a monitored recovery/escalation process and deployment testing before launching real customer registration or checkout.",
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
