import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { staffRoles } from "@/lib/security";
import EditorialStudio from "@/components/editorial-studio";
import PdfStudio from "@/components/pdf-studio";
export default async function Admin() {
  const actor = await currentUser();
  if (!actor) redirect("/login");
  if (!staffRoles.includes(actor.role)) redirect("/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">EDITORIAL STUDIO · {actor.role}</div>
      <h1>Make every explanation count.</h1>
      <p className="lead">
        Write, check and release original educational content with an
        independent review at each version.
      </p>
      <Link className="text-link" href="/account">
        ← Your account
      </Link>
      <div className="notice">
        Seed samples remain DRAFT and have no human approval. Never mark
        automated test fixtures or AI-generated material as reviewed without
        actual independent checking.
      </div>
      <EditorialStudio actor={actor} />
      <PdfStudio admin={actor.role === "ADMIN"} />
    </section>
  );
}
