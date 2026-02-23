import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("RESEND_API_KEY missing; email notifications will not be sent.");
}

export const resend = apiKey ? new Resend(apiKey) : null;

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Account Control <noreply@accountcontrol.no>";

export async function sendNoteMentionEmail(params: {
  toEmail: string;
  fromUserName: string;
  noteText: string;
  transactionDescription: string;
  link: string;
}) {
  if (!resend) return;

  const { toEmail, fromUserName, noteText, transactionDescription, link } = params;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `${fromUserName} nevnte deg i et notat`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p><strong>${fromUserName}</strong> nevnte deg i et notat på transaksjonen:</p>
        <p style="color: #666; font-size: 14px;">${transactionDescription}</p>
        <blockquote style="border-left: 3px solid #e5e5e5; margin: 16px 0; padding: 8px 16px; color: #444;">
          ${noteText}
        </blockquote>
        <a href="${link}" style="display: inline-block; padding: 8px 16px; background: #171717; color: #fff; border-radius: 6px; text-decoration: none; font-size: 14px;">
          Se transaksjonen
        </a>
      </div>
    `,
  });
}
