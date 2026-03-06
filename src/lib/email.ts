import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailNotification(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  await resend.emails.send({
    from: "Alfie AI <notifikace@notifications.alfie-ai.com>",
    to,
    subject,
    text,
  });
}
