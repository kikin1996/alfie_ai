import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmailNotification } from "@/lib/email";

interface NotifySettings {
  notification_channel?: string | null;
  whatsapp_phone?: string | null;
  whatsapp_apikey?: string | null;
  notification_email?: string | null;
}

export async function notify(
  settings: NotifySettings,
  subject: string,
  text: string
): Promise<void> {
  const channel = settings.notification_channel ?? "whatsapp";

  const waOk = !!settings.whatsapp_phone && !!settings.whatsapp_apikey;
  const emailOk = !!settings.notification_email;

  const sendWa = async () => {
    if (waOk) {
      await sendWhatsAppMessage(settings.whatsapp_phone!, settings.whatsapp_apikey!, text).catch(() => {});
    }
  };

  const sendEmail = async () => {
    if (emailOk) {
      await sendEmailNotification(settings.notification_email!, subject, text).catch(() => {});
    }
  };

  if (channel === "whatsapp") await sendWa();
  else if (channel === "email") await sendEmail();
  else if (channel === "both") await Promise.all([sendWa(), sendEmail()]);
}
