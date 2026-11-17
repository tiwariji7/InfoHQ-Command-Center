/**
 * Team Invitation Email Service via Resend
 * Sends official invitation emails from Super Admin <superadmin@infohq.in>
 * with one-click password setup link.
 */

export interface TeamInviteEmailParams {
  name: string;
  email: string;
  role: string;
  invitedBy: string;
  inviteLink: string;
  expiresAt: number;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  superadmin: 'Superadmin (Full Access)',
  project_manager: 'Project Manager',
  sales: 'Sales & Business Development',
  developer: 'Developer / Engineer',
  viewer: 'Viewer (Read Only)',
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendTeamInvitationEmailViaResend(
  params: TeamInviteEmailParams,
  apiKey: string
): Promise<boolean> {
  const { name, email, role, invitedBy, inviteLink, expiresAt } = params;

  const roleTitle = ROLE_DISPLAY_NAMES[role] || role;
  const expiryDateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(expiresAt)) + ' IST';

  const subject = `Invitation: Join InfoHQ Command Center as ${roleTitle}`;

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F8FF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1A085C;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    .email-container {
      max-width: 600px;
      margin: 32px auto;
      background-color: #FFFFFF;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #EAE6F7;
      box-shadow: 0 10px 30px rgba(26, 8, 92, 0.06);
    }
    .inner-padding {
      padding: 36px 36px 28px;
    }
    @media only screen and (max-width: 600px) {
      .inner-padding { padding: 24px 20px; }
      .email-container { margin: 12px; border-radius: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Brand Header -->
    <div style="padding: 28px 36px 20px; border-bottom: 1px solid #F0EDF9; background: linear-gradient(180deg, #FAF9FE 0%, #FFFFFF 100%);">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.02em;">
          <span style="color: #E8604E;">Info</span><span style="color: #5B4CF5;">HQ</span>
          <span style="font-size: 14px; font-weight: 700; color: #1A085C; margin-left: 6px;">Command Center</span>
        </div>
      </div>
      <div style="height: 3px; border-radius: 9999px; margin-top: 16px; background: linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%);"></div>
    </div>

    <!-- Main Content -->
    <div class="inner-padding">
      <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: #F0EDFF; border: 1px solid #D8D0F8; font-size: 11px; font-weight: 800; color: #5B4CF5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
        Official Team Invitation
      </div>

      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 900; color: #1A085C; line-height: 1.3;">
        Welcome to the Team, ${escapeHtml(name)}!
      </h1>

      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
        You have been officially invited by <strong>Super Admin (${escapeHtml(invitedBy)})</strong> to join the <strong>InfoHQ Command Center</strong> engineering workspace.
      </p>

      <!-- Role Assignment Card -->
      <div style="margin: 20px 0 28px 0; padding: 18px 20px; background-color: #FBFBFE; border: 1px solid #EAE6F7; border-radius: 14px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 12px; color: #6B7280; font-weight: 600; padding-bottom: 6px;">Authorized Email:</td>
            <td align="right" style="font-size: 13px; font-family: monospace; font-weight: 700; color: #1A085C; padding-bottom: 6px;">
              ${escapeHtml(email)}
            </td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #6B7280; font-weight: 600; padding-top: 6px; border-top: 1px solid #F0EDF9;">Assigned Role:</td>
            <td align="right" style="font-size: 13px; font-weight: 800; color: #5B4CF5; padding-top: 6px; border-top: 1px solid #F0EDF9;">
              ${escapeHtml(roleTitle)}
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
        <tr>
          <td align="center">
            <a href="${inviteLink}" target="_blank" style="background-color: #5B4CF5; background: linear-gradient(90deg, #5B4CF5 0%, #7C5CE8 100%); color: #FFFFFF !important; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 36px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 14px rgba(91, 76, 245, 0.35); text-align: center;">
              Accept Invitation &amp; Set Password &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- 3-Step Setup Instructions -->
      <div style="margin: 24px 0; padding: 18px 20px; background-color: #F8F7FF; border: 1px solid #E4E0F8; border-radius: 14px;">
        <div style="font-size: 13px; font-weight: 800; color: #1A085C; margin-bottom: 10px;">
          Quick 3-Step Setup:
        </div>
        <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; line-height: 1.7; color: #4B5563;">
          <li>Click the <strong>Accept Invitation</strong> button above to open the secure portal.</li>
          <li>Enter your work email address (<strong>${escapeHtml(email)}</strong>).</li>
          <li>Create your initial secure password. Once saved, you can log in directly with your email and password.</li>
        </ol>
      </div>

      <!-- Security Notice -->
      <div style="margin-top: 24px; padding: 12px 16px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; font-size: 12px; color: #92400E; line-height: 1.5;">
        🔒 <strong>Super Admin Security Policy:</strong> This invitation link is unique to your email address and will expire on <strong>${escapeHtml(expiryDateFormatted)}</strong>. Only authorized emails can access the workspace.
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #EAE6F7; padding: 22px 36px; text-align: center; background-color: #FAFAFD;">
      <div style="font-size: 13px; font-weight: 800; color: #1A085C;">
        Info<span style="color: #7C5CE8;">HQ</span> Pvt Ltd
      </div>
      <div style="font-size: 11.5px; color: #6B7280; margin-top: 2px;">
        Super Admin Security Operations &bull; Prayagraj &amp; Pune, India
      </div>
      <div style="font-size: 10.5px; color: #9CA3AF; margin-top: 8px;">
        Official invitation delivered from <a href="mailto:superadmin@infohq.in" style="color: #5B4CF5; text-decoration: none;">superadmin@infohq.in</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.replace(/^['"]|['"]$/g, '').trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Super Admin <superadmin@infohq.in>',
        to: [email],
        reply_to: 'superadmin@infohq.in',
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Resend Team Invite Email Failed]:', errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Resend Team Invite Email Exception]:', err);
    return false;
  }
}
