import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("RESEND_API_KEY missing; email notifications will not be sent.");
}

export const resend = apiKey ? new Resend(apiKey) : null;

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? "Revizo <noreply@accountcontrol.no>";

function logSendResult(label: string, result: { data: unknown; error: unknown }) {
  if (result.error) {
    console.error(`[resend] ${label} failed:`, result.error);
  }
}

// ── Design tokens (matching design system, email-safe hex) ──────────────────
const T = {
  bg: "#fafafa",
  card: "#ffffff",
  fg: "#171717",
  muted: "#737373",
  border: "#e5e5e5",
  btnBg: "#171717",
  btnFg: "#ffffff",
  brand: "#38c96c",
  subtle: "#f5f5f5",
  radius: "8px",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
} as const;

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${T.bg};font-family:${T.font};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.bg};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:15px;font-weight:600;color:${T.fg};letter-spacing:-0.3px;">Revizo</span>
          <span style="display:inline-block;width:5px;height:5px;background:${T.brand};border-radius:50%;margin-left:2px;vertical-align:super;"></span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${T.card};border:1px solid ${T.border};border-radius:${T.radius};padding:32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${T.muted};line-height:1.6;">
            Denne e-posten ble sendt fra Revizo.<br>
            Du mottar den fordi du er medlem av et team som bruker plattformen.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:${T.fg};line-height:1.4;letter-spacing:-0.3px;">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;color:${T.fg};line-height:1.6;">${text}</p>`;
}

function mutedText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;color:${T.muted};line-height:1.6;">${text}</p>`;
}

function cta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:10px 20px;background:${T.btnBg};color:${T.btnFg};border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;line-height:1;">${label}</a>`;
}

function statRow(items: { label: string; value: string }[]): string {
  const cells = items
    .map(
      (s) =>
        `<td style="padding:10px 16px;text-align:center;">
          <div style="font-size:20px;font-weight:600;color:${T.fg};line-height:1;">${s.value}</div>
          <div style="font-size:11px;color:${T.muted};margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</div>
        </td>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.subtle};border-radius:6px;margin:0 0 20px;">
    <tr>${cells}</tr>
  </table>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${T.border};margin:20px 0;">`;
}

// ── Email senders ───────────────────────────────────────────────────────────

export async function sendNoteMentionEmail(params: {
  toEmail: string;
  fromUserName: string;
  noteText: string;
  transactionDescription: string;
  link: string;
}) {
  if (!resend) return;

  const { toEmail, fromUserName, noteText, transactionDescription, link } = params;

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `${fromUserName} nevnte deg i et notat`,
    html: emailLayout(`
      ${heading("Du ble nevnt i et notat")}
      ${paragraph(`<strong>${fromUserName}</strong> nevnte deg i et notat på:`)}
      <div style="background:${T.subtle};border-radius:6px;padding:12px 16px;margin:0 0 16px;">
        <span style="font-size:13px;color:${T.muted};">${transactionDescription}</span>
      </div>
      <blockquote style="border-left:3px solid ${T.border};margin:0 0 20px;padding:10px 16px;color:${T.fg};font-size:14px;line-height:1.6;font-style:italic;">
        ${noteText}
      </blockquote>
      ${cta("Se transaksjonen", link)}
    `),
  });
  logSendResult("note-mention", result);
}

export async function sendSmartMatchEmail(params: {
  toEmail: string;
  userName: string;
  clientName: string;
  transactionCount: number;
  periodFrom?: string;
  periodTo?: string;
  remainingOpen: number;
  totalItems: number;
  link: string;
}) {
  if (!resend) return;

  const {
    toEmail, userName, clientName, transactionCount,
    periodFrom, periodTo, remainingOpen, totalItems, link,
  } = params;

  const totalMatched = totalItems - remainingOpen;
  const pct = totalItems > 0 ? Math.round((totalMatched / totalItems) * 100) : 100;
  const allDone = remainingOpen === 0;

  const fmtDate = (iso?: string) => {
    if (!iso) return "–";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };

  const periodStr = periodFrom && periodTo
    ? periodFrom === periodTo
      ? fmtDate(periodFrom)
      : `${fmtDate(periodFrom)} – ${fmtDate(periodTo)}`
    : null;

  const firstName = userName.split(" ")[0] || userName;

  const intro = periodStr
    ? allDone
      ? `Hei på deg, ${firstName}! Nå er jeg ferdig med å avstemme <strong>${clientName}</strong> for perioden ${periodStr}. Alt er i boks — <strong>${pct}%</strong> avstemt.`
      : `Hei på deg, ${firstName}! Nå er jeg ferdig med å avstemme <strong>${clientName}</strong> for perioden ${periodStr}. Jeg fikk til <strong>${pct}%</strong>, men det gjenstår <strong>${remainingOpen}</strong> poster som jeg trenger din hjelp med.`
    : allDone
      ? `Hei på deg, ${firstName}! Nå er jeg ferdig med å avstemme <strong>${clientName}</strong>. Alt er i boks — <strong>${pct}%</strong> avstemt.`
      : `Hei på deg, ${firstName}! Nå er jeg ferdig med å avstemme <strong>${clientName}</strong>. Jeg fikk til <strong>${pct}%</strong>, men det gjenstår <strong>${remainingOpen}</strong> poster som jeg trenger din hjelp med.`;

  const signoff = allDone
    ? "Ta deg en velfortjent kaffe — dette var en ren jobb."
    : "Ta en titt når du får tid, så fikser vi resten sammen.";

  const progressBarWidth = `${Math.max(pct, 4)}%`;
  const progressBar = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
      <tr>
        <td style="background:${T.subtle};border-radius:4px;height:8px;padding:0;">
          <div style="width:${progressBarWidth};max-width:100%;height:8px;border-radius:4px;background:${allDone ? T.brand : T.btnBg};"></div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="font-size:12px;color:${T.muted};">${pct}% avstemt${!allDone ? ` — ${remainingOpen} poster gjenstår` : ""}</td>
      </tr>
    </table>`;

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: allDone
      ? `${clientName} — ferdig avstemt ✓`
      : `${clientName} — ${pct}% avstemt, ${remainingOpen} poster gjenstår`,
    html: emailLayout(`
      ${heading(allDone ? "Avstemmingen er klar" : "Avstemming utført")}
      ${paragraph(intro)}
      ${progressBar}
      ${statRow([
        { label: "Poster matchet", value: String(transactionCount) },
        ...(periodStr ? [{ label: "Periode", value: periodStr }] : []),
      ])}
      ${divider()}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding:14px 16px;background:${T.subtle};border-radius:6px;border-left:3px solid ${T.brand};">
            <div style="font-size:14px;color:${T.fg};line-height:1.6;">${signoff}</div>
            <div style="font-size:13px;color:${T.muted};margin-top:8px;">— Revizo</div>
          </td>
        </tr>
      </table>
      ${cta(allDone ? "Se resultatet" : "Se åpne poster", link)}
    `),
  });
  logSendResult("smart-match", result);
}

export async function sendImportCompletedEmail(params: {
  toEmail: string;
  userName: string;
  clientName: string;
  filename: string;
  recordCount: number;
  setNumber: number;
  link: string;
}) {
  if (!resend) return;

  const { toEmail, userName, clientName, filename, recordCount, setNumber, link } = params;
  const setLabel = setNumber === 1 ? "Mengde 1" : "Mengde 2";

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `Import fullført — ${recordCount} poster importert for ${clientName}`,
    html: emailLayout(`
      ${heading("Import fullført")}
      ${paragraph(`Hei ${userName}, filimport er fullført for <strong>${clientName}</strong>.`)}
      ${statRow([
        { label: "Poster", value: String(recordCount) },
        { label: "Mengde", value: setLabel },
      ])}
      <div style="background:${T.subtle};border-radius:6px;padding:10px 16px;margin:0 0 20px;">
        <span style="font-size:12px;color:${T.muted};text-transform:uppercase;letter-spacing:0.5px;">Fil</span>
        <div style="font-size:14px;color:${T.fg};font-weight:500;margin-top:2px;word-break:break-all;">${filename}</div>
      </div>
      ${cta("Gå til avstemming", link)}
    `),
  });
  logSendResult("import-completed", result);
}

export async function sendAgentReportEmail(params: {
  toEmail: string;
  userName: string;
  clientName: string;
  matchCount: number;
  transactionCount: number;
  openItemsSet1: number;
  openItemsSet2: number;
  totalSet1: number;
  totalSet2: number;
  link: string;
  pdfBuffer?: Buffer;
  reportDate: string;
}) {
  if (!resend) return;

  const {
    toEmail,
    userName,
    clientName,
    matchCount,
    transactionCount,
    openItemsSet1,
    openItemsSet2,
    totalSet1,
    totalSet2,
    link,
    pdfBuffer,
    reportDate,
  } = params;

  const fmtNok = (n: number) =>
    n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const diff = totalSet1 - totalSet2;

  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `Revizo Rapport — ${clientName} — ${reportDate}`,
    html: emailLayout(`
      ${heading("Revizo Agent Rapport")}
      ${paragraph(`Hei ${userName}, her er den automatiske rapporten for <strong>${clientName}</strong>.`)}
      ${matchCount > 0
        ? `${statRow([
            { label: "Nye matcher", value: String(matchCount) },
            { label: "Transaksjoner", value: String(transactionCount) },
          ])}
          ${mutedText("Smart Match kjørte automatisk og avstemte poster basert på konfigurerte regler.")}`
        : mutedText("Ingen nye matcher ble funnet i denne kjøringen.")}
      ${divider()}
      ${heading("Åpne poster")}
      ${statRow([
        { label: "Mengde 1", value: String(openItemsSet1) },
        { label: "Mengde 2", value: String(openItemsSet2) },
      ])}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.subtle};border-radius:6px;margin:0 0 20px;">
        <tr>
          <td style="padding:10px 16px;">
            <div style="font-size:12px;color:${T.muted};text-transform:uppercase;letter-spacing:0.5px;">Saldo mengde 1</div>
            <div style="font-size:16px;font-weight:600;color:${T.fg};font-family:monospace;">${fmtNok(totalSet1)}</div>
          </td>
          <td style="padding:10px 16px;">
            <div style="font-size:12px;color:${T.muted};text-transform:uppercase;letter-spacing:0.5px;">Saldo mengde 2</div>
            <div style="font-size:16px;font-weight:600;color:${T.fg};font-family:monospace;">${fmtNok(totalSet2)}</div>
          </td>
          <td style="padding:10px 16px;">
            <div style="font-size:12px;color:${T.muted};text-transform:uppercase;letter-spacing:0.5px;">Differanse</div>
            <div style="font-size:16px;font-weight:600;color:${Math.abs(diff) < 0.01 ? T.brand : "#dc2626"};font-family:monospace;">${fmtNok(diff)}</div>
          </td>
        </tr>
      </table>
      ${pdfBuffer ? mutedText("Fullstendig rapport er vedlagt som PDF.") : ""}
      ${cta("Åpne i Revizo", link)}
    `),
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename: `revizo-rapport-${clientName.replace(/\s+/g, "-").toLowerCase()}-${reportDate}.pdf`,
              content: pdfBuffer,
            },
          ],
        }
      : {}),
  });
  logSendResult("agent-report", result);
}
