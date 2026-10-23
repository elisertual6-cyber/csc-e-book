// Server-owned app tables must not be accessible through Supabase's Data API.
export const applicationTables = [
  "User", "Chapter", "Lesson", "Question", "Choice", "Explanation",
  "SourceReference", "Review", "Session", "RateLimitBucket", "PdfEdition",
  "ExamTemplate", "Attempt", "Response", "Product", "Price", "Order",
  "OrderItem", "Payment", "Entitlement", "Artifact", "Download", "DeliveryNotice",
  "AuditEvent", "AccountToken", "MailMessage", "PaymentSession", "PaymentWebhookReceipt",
] as const;
