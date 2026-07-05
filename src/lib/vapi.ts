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
  const startTime = new Date(opts.startISO).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
  const startDate = new Date(opts.startISO).toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Prague",
  });
  const clientName = opts.name || "klient";
  const agencyName = opts.agencyName || "realitní kancelář";
  const address = opts.address || "";

  // Asistent má First Message = {{firstMessage}} a System Prompt = {{systemPrompt}},
  // takže celý text hovoru skládáme tady a posíláme jako proměnné (s reálným časem).
  const firstMessage =
    `Dobrý den, tady ${agencyName}. Volám kvůli připomenutí prohlídky nemovitosti` +
    `${address ? ` na adrese ${address}` : ""}, kterou máte naplánovanou na ${startDate} v ${startTime}. ` +
    `Chtěl bych ověřit, jestli termín platí a dorazíte. Můžete mi to prosím potvrdit?`;

  const systemPrompt =
    `Jsi zdvořilý telefonní asistent realitní kanceláře ${agencyName}. ` +
    `Voláš klientovi jménem ${clientName} kvůli připomenutí a potvrzení prohlídky nemovitosti. ` +
    `Detaily prohlídky – adresa: ${address || "neuvedena"}; termín: ${startDate} v ${startTime}. ` +
    `Tvým úkolem je ověřit, zda klient na prohlídku dorazí. ` +
    `Když potvrdí, poděkuj a rozluč se. Když nemůže nebo chce zrušit, zdvořile to potvrď` +
    `${opts.brokerName || opts.brokerPhone ? ` a případně předej kontakt na makléře ${opts.brokerName ?? ""} ${opts.brokerPhone ?? ""}`.trimEnd() : ""}. ` +
    `Mluv česky, stručně, přátelsky a přirozeně. Nevymýšlej si žádné informace nad rámec zadání.`;

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
        startTime,
      },
      assistantOverrides: {
        // Přímý override první věty – přebije pole asistenta úplně, nezávisí na
        // dosazení {{firstMessage}}. Tím se vyřeší "start time" místo reálného času.
        firstMessage,
        variableValues: {
          // Systémový prompt necháváme přes proměnnou (přímý model override VAPI
          // odmítal). Plus záloha pro první větu.
          firstMessage,
          systemPrompt,
          brokerName: opts.brokerName ?? "",
          brokerPhone: opts.brokerPhone ?? "",
          agencyName: opts.agencyName ?? "",
          clientName: opts.name,
          address: opts.address,
          minutesBefore: String(opts.minutesBefore ?? 30),
          startTime,
          time: startTime,
          cas: startTime,
          startDate,
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
