import { z } from "zod";
const price = z.coerce
  .number()
  .positive()
  .max(1_000_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
    "Use at most two decimal places",
  );
export const priceConfig = z.object({
  PRICE_BASIC_PHP: price.default(99),
  PRICE_COMPLETE_PHP: price.default(199),
  PRICE_PREMIUM_PHP: price.default(399),
});
export function getCatalog(
  env: Record<string, string | undefined> = process.env,
) {
  const prices = priceConfig.parse(env);
  return [
    {
      slug: "basic",
      name: "The essentials",
      label: "Basic Reviewer",
      priceMinor: Math.round(prices.PRICE_BASIC_PHP * 100),
      description: "Build your foundation, one topic at a time.",
      features: ["Core reviewer PDF", "Worked examples", "30-day study plan"],
    },
    {
      slug: "complete",
      name: "A complete study companion",
      label: "Complete Reviewer",
      priceMinor: Math.round(prices.PRICE_COMPLETE_PHP * 100),
      description: "Connect the concepts with guided practice.",
      features: [
        "Everything in Basic",
        "Both mock exam tracks",
        "Detailed answer rationales",
      ],
    },
    {
      slug: "premium",
      name: "Learn. Practice. Reflect.",
      label: "Premium Access",
      priceMinor: Math.round(prices.PRICE_PREMIUM_PHP * 100),
      description: "Turn your study routine into a practice habit.",
      features: [
        "Everything in Complete",
        "Online exam simulator",
        "Subject performance reports",
      ],
    },
  ];
}
export function formatPHP(minor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
