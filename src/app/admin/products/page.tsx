import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ProductStudio from "@/components/product-studio";
export default async function Products() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">ADMINISTRATION</div>
      <h1>Products & releases.</h1>
      <ProductStudio />
    </section>
  );
}
