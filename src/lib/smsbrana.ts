/**
 * SMSbrána.cz – odeslání SMS přes HTTP API
 * Dokumentace: https://www.smsbrana.cz/dokumentace/http-api/
 */
export async function sendSms(
  login: string,
  password: string,
  number: string,
  message: string
): Promise<boolean> {
  const params = new URLSearchParams({
    login,
    password,
    number: number.replace(/\s/g, ""),
    message,
    action: "send_sms",
    delivery_report: "1",
  });

  const res = await fetch(
    `https://api.smsbrana.cz/smsconnect/http.php?${params.toString()}`
  );

  if (!res.ok) return false;

  const text = await res.text();
  const trimmed = text.trim();
  console.log("[smsbrana] response:", trimmed);
  // SMSbrána vrací "err=0" nebo prázdný string při úspěchu
  return trimmed === "" || trimmed === "OK" || trimmed.startsWith("err=0");
}
