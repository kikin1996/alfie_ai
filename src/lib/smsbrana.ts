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
  console.log("[smsbrana] response:", JSON.stringify(trimmed));
  // SMSbrána vrací "err=0" (nebo err=0 s ID zprávy), prázdný string nebo "OK" při úspěchu
  // Chyba = err=<nenulové číslo>
  if (trimmed === "" || trimmed === "OK") return true;
  const errMatch = trimmed.match(/err=(\d+)/);
  if (errMatch) return errMatch[1] === "0";
  return true; // neznámý formát ale HTTP 200 – považujeme za úspěch
}
