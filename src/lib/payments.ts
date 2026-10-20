import "server-only";
import { HttpError } from "@/lib/http";
export function mockCheckoutEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_PROVIDER === "mock"
  );
}
export function requireMockCheckout() {
  if (!mockCheckoutEnabled())
    throw new HttpError(
      503,
      "Checkout is unavailable. No payment will be collected.",
    );
}
export type VerifiedPayment = {
  provider: "mock";
  eventId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
};
// A development simulation creates this event from a locked server-owned order.
// Real adapters must verify provider signatures and fetch canonical payment state.
export function simulatePayment(order: {
  id: string;
  totalMinor: number;
  currency: string;
}): VerifiedPayment {
  requireMockCheckout();
  return {
    provider: "mock",
    eventId: `mock-paid-${order.id}`,
    orderId: order.id,
    amountMinor: order.totalMinor,
    currency: order.currency,
  };
}
