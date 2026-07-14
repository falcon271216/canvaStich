import nodemailer from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_aGHHaEGp_KtGn1unTayNthxFhsVeQk813";
const SENDER_DOMAIN = process.env.SENDER_DOMAIN || "doptonin.online";

export const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: RESEND_API_KEY,
  },
});

/** Prefer Resend HTTP API on serverless — SMTP often never finishes before the invoke ends. */
async function sendViaResendApi(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API ${response.status}: ${body}`);
  }
}

async function sendMail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    await sendViaResendApi(options);
  } catch (apiErr) {
    console.warn("[Email] Resend API failed, falling back to SMTP:", apiErr);
    await transporter.sendMail(options);
  }
}

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  const mailOptions = {
    from: `SketchUI <welcome@${SENDER_DOMAIN}>`,
    to: toEmail,
    subject: "Welcome to SketchUI! ✨",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #0c0c0f; color: #fafafa; border-color: rgba(255,255,255,0.06);">
        <h2 style="color: #6366f1;">Welcome to SketchUI!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for signing up to SketchUI! We're excited to have you on board.</p>
        <p>SketchUI is a collaborative whiteboard with AI-powered sketch recognition. You can draw rough wireframes on our canvas and instantly generate production-ready React or HTML code.</p>
        <p>Get started by creating your first project here: <a href="https://canvastich.${SENDER_DOMAIN}" style="color: #818cf8; text-decoration: none;">Go to Dashboard</a></p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0;" />
        <p style="font-size: 0.85rem; color: #a1a1aa;">If you have any questions, feel free to reply to this email.</p>
        <p style="font-size: 0.85rem; color: #a1a1aa;">Best regards,<br/>The SketchUI Team</p>
      </div>
    `,
  };

  try {
    await sendMail(mailOptions);
    console.log(`[Email] Welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email] Failed to send welcome email to ${toEmail}:`, err);
  }
}

export async function sendRoomInvitation({
  toEmail,
  roomName,
  roomUrl,
  inviterName,
}: {
  toEmail: string;
  roomName: string;
  roomUrl: string;
  inviterName: string;
}): Promise<void> {
  const mailOptions = {
    from: `SketchUI Collaboration <invite@${SENDER_DOMAIN}>`,
    to: toEmail,
    subject: `${inviterName} invited you to draw in SketchUI 🎨`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #0c0c0f; color: #fafafa; border-color: rgba(255,255,255,0.06);">
        <h2 style="color: #6366f1;">You're Invited to Collaborate!</h2>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to collaborate on the drawing board <strong>"${roomName}"</strong>.</p>
        <div style="margin: 25px 0; text-align: center;">
          <a href="${roomUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Join Drawing Board</a>
        </div>
        <p style="font-size: 0.9rem; color: #a1a1aa;">Or copy and paste this URL into your browser:</p>
        <p style="font-size: 0.85rem; word-break: break-all; color: #818cf8;">${roomUrl}</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0;" />
        <p style="font-size: 0.85rem; color: #a1a1aa;">You must be logged in to access the collaboration room.</p>
        <p style="font-size: 0.85rem; color: #a1a1aa;">Best regards,<br/>The SketchUI Team</p>
      </div>
    `,
  };

  try {
    await sendMail(mailOptions);
    console.log(`[Email] Room invitation sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email] Failed to send room invitation to ${toEmail}:`, err);
    throw err;
  }
}

export async function sendOtpEmail(toEmail: string, name: string, otp: string): Promise<void> {
  const mailOptions = {
    from: `SketchUI Security <security@${SENDER_DOMAIN}>`,
    to: toEmail,
    subject: `Your SketchUI Verification Code: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; background: #0c0c0f; color: #fafafa;">
        <h2 style="color: #6366f1; margin-bottom: 1.5rem;">Confirm Your Email</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for signing up for SketchUI! To complete your registration, please enter the following verification code on the registration page:</p>
        <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); padding: 1.5rem; text-align: center; border-radius: 8px; margin: 2rem 0;">
          <span style="font-family: monospace; font-size: 2.2rem; font-weight: bold; letter-spacing: 0.25em; color: #818cf8;">${otp}</span>
        </div>
        <p style="font-size: 0.85rem; color: #a1a1aa;">This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.06); margin: 2rem 0;" />
        <p style="font-size: 0.85rem; color: #a1a1aa;">Best regards,<br/>The SketchUI Security Team</p>
      </div>
    `,
  };

  await sendMail(mailOptions);
  console.log(`[Email] OTP email sent to ${toEmail}`);
}
