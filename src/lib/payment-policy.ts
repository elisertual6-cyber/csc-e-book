// Shared with the standalone mail worker; no framework or secret dependencies.
export function isTestPaymentProvider(provider: string) {
  return provider === "mock" || provider === "paymongo_test";
}
export function paymentAllowedInRuntime(provider: string) {
  return (
    process.env.NODE_ENV !== "production" || !isTestPaymentProvider(provider)
  );
}
