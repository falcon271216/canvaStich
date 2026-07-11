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
    await transporter.sendMail(mailOptions);
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
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Room invitation sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email] Failed to send room invitation to ${toEmail}:`, err);
    throw err;
  }
}
