import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Purchases from "@/components/purchases";
export default async function PurchasePage() {
  if (!(await currentUser())) redirect("/login?from=library");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">YOUR LIBRARY</div>
      <h1>Orders & downloads.</h1>
      <Purchases />
    </section>
  );
}
