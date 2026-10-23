-- The app uses server-side Prisma authentication/authorization, not Supabase's
-- browser Data API. Owners retain access; no public API policies are created.
DO $$
DECLARE
  app_table text;
  api_role text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'User', 'Chapter', 'Lesson', 'Question', 'Choice', 'Explanation',
    'SourceReference', 'Review', 'Session', 'RateLimitBucket', 'PdfEdition',
    'ExamTemplate', 'Attempt', 'Response', 'Product', 'Price', 'Order',
    'OrderItem', 'Payment', 'Entitlement', 'Artifact', 'Download', 'DeliveryNotice',
    'AuditEvent', 'AccountToken', 'MailMessage', 'PaymentSession', 'PaymentWebhookReceipt',
    '_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', app_table);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', app_table, api_role);
    END LOOP;
  END LOOP;
END $$;
