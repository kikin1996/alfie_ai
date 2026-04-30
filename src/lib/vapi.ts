/** Normalizuje telefonní číslo do E.164 formátu (výchozí předvolba +420) */
function toE164(phone: string, defaultCountry = "+420"): string {
  let n = phone.replace(/[\s\-().]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  else if (n.startsWith("0")) n = defaultCountry + n.slice(1);
  else if (!n.startsWith("+")) n = defaultCountry + n;
  return n;
}

/**
 * VAPI.ai – spuštění odchozího telefonního hovoru
 */
export async function initiateVapiCall(opts: {
  apiKey: string;
  assistantId: string;
  phoneNumberId: string;
  number: string;
  name: string;
  eventId: string;
  address: string;
  startISO: string;
  brokerName?: string;
  brokerPhone?: string;
  agencyName?: string;
  minutesBefore?: number;
}): Promise<string> {
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      type: "outboundPhoneCall",
      assistantId: opts.assistantId,
      phoneNumberId: opts.phoneNumberId,
      customer: {
        number: toE164(opts.number),
        name: opts.name,
      },
      metadata: {
        event_id: opts.eventId,
        address: opts.address,
        startISO: opts.startISO,
        startTime: new Date(opts.startISO).toLocaleTimeString("cs-CZ", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Prague",
        }),
      },
      assistantOverrides: {
        variableValues: {
          brokerName: opts.brokerName ?? "",
          brokerPhone: opts.brokerPhone ?? "",
          agencyName: opts.agencyName ?? "",
          clientName: opts.name,
          address: opts.address,
          minutesBefore: String(opts.minutesBefore ?? 30),
          startTime: new Date(opts.startISO).toLocaleTimeString("cs-CZ", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Prague",
          }),
          startDate: new Date(opts.startISO).toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Prague",
          }),
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`VAPI call failed: ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}
