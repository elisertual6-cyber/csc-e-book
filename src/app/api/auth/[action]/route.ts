import { z } from "zod";
import { getDb } from "@/lib/db";
import { api, assertMutation, readJson, json, HttpError } from "@/lib/http";
import {
  createSession,
  destroySession,
  rateLimit,
  registrationEnabled,
  requireUser,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security";
import {
  emailInput,
  requestAccountToken,
  verifyEmail,
  resetPassword,
} from "@/lib/account-security";
const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const registration = credentials
  .extend({ name: z.string().trim().min(2).max(80) })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return api("auth", async () => {
    assertMutation(request);
    const { action } = await params;
    if (
      [
        "request-verification",
        "request-reset",
        "verify-email",
        "reset-password",
      ].includes(action)
    ) {
      await rateLimit("account-security-global", "all", 100);
      if (action === "request-verification") {
        const user = await requireUser();
        z.object({})
          .strict()
          .parse(await readJson(request));
        await rateLimit("email-verification", user.id, 3);
        await requestAccountToken("VERIFY_EMAIL", { userId: user.id });
        return json(
          {
            message:
              "If verification is needed, a message has been queued. Check your email or ask the development operator.",
          },
          202,
        );
      }
      if (action === "request-reset") {
        const { email } = emailInput.parse(await readJson(request));
        await rateLimit("password-reset-request", email, 3);
        await requestAccountToken("RESET_PASSWORD", { email });
        return json(
          {
            message:
              "If an eligible account exists, a reset message has been queued. Check your email or ask the development operator.",
          },
          202,
        );
      }
      if (action === "verify-email") {
        await verifyEmail(await readJson(request));
        return json({
          message:
            "Your email address is verified. You can return to your account.",
        });
      }
      await resetPassword(await readJson(request));
      await destroySession();
      return json({
        message:
          "Your password was changed and all sessions signed out. Sign in with your new password.",
      });
    }
    if (action === "logout") {
      await destroySession();
      return json({ ok: true });
    }
    if (action !== "login" && action !== "register")
      throw new HttpError(404, "Unknown action.");
    if (action === "register" && !registrationEnabled())
      throw new HttpError(403, "Registration is not open on this deployment.");
    const input =
      action === "register"
        ? registration.parse(await readJson(request))
        : credentials.parse(await readJson(request));
    await rateLimit("auth-global", "all", 100);
    await rateLimit("auth-email", input.email, 8);
    if (action === "register") {
      if (
        await getDb().user.findUnique({
          where: { email: input.email },
          select: { id: true },
        })
      )
        throw new HttpError(
          400,
          "Unable to register. Try signing in or use another email address.",
        );
      const user = await getDb().user.create({
        data: {
          email: input.email,
          name: "name" in input ? (input.name as string) : "Learner",
          passwordHash: await hashPassword(input.password),
          role: "CUSTOMER",
        },
      });
      await createSession(user.id, user.authVersion);
      return json({ ok: true }, 201);
    }
    const user = await getDb().user.findUnique({
      where: { email: input.email },
    });
    if (
      !(await verifyPassword(input.password, user?.passwordHash ?? null)) ||
      !user
    )
      throw new HttpError(401, "Email or password is incorrect.");
    await createSession(user.id, user.authVersion);
    return json({ ok: true });
  });
}
