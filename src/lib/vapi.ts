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

  // Kolik minut zbývá do prohlídky (podle skutečného času, ne konfigurace)
  const minutesToStart = Math.round((new Date(opts.startISO).getTime() - Date.now()) / 60000);
  const isSoonToday = minutesToStart > 0 && minutesToStart <= 120;
  // "za zhruba 30 minut" (zaokrouhleno na 5 min), jinak fallback na den+čas
  const roundedMinutes = Math.max(5, Math.round(minutesToStart / 5) * 5);
  const whenPhrase = isSoonToday
    ? `dnes na prohlídku, kterou máte zhruba za ${roundedMinutes} minut`
    : `na prohlídku, kterou máte naplánovanou na ${startDate} v ${startTime}`;

  // Asistent má First Message = {{firstMessage}} a System Prompt = {{systemPrompt}},
  // takže celý text hovoru skládáme tady a posíláme jako proměnné (s reálným časem).
  const firstMessage =
    `Dobrý den, volám Vám z ${agencyName}. ` +
    `Chtěli bychom se jen ujistit, že dorazíte ${whenPhrase}. Můžu s Vámi počítat?`;

  const systemPrompt =
    `Jsi telefonní asistent realitní kanceláře ${agencyName}. Vedeš ŽIVÝ telefonní hovor s klientem.\n\n` +
    `KONTEXT: Voláš klientovi ${clientName} ohledně prohlídky nemovitosti na adrese ${address || "neuvedena"}, která je naplánována ${startDate} v ${startTime}. Do prohlídky zbývá zhruba ${minutesToStart > 0 ? minutesToStart : 0} minut.\n\n` +
    `PRŮBĚH HOVORU:\n` +
    `1. Úvodní větu jsi již řekl(a). Nyní ČEKEJ na odpověď klienta.\n` +
    `2. Když klient odpoví, reaguj přirozeně a konverzuj. Detaily (adresu, přesný čas) sám od sebe NEŘÍKEJ — řekni je jen když se klient zeptá. Adresa: ${address || "neuvedena"}. Čas: ${startDate} v ${startTime}.\n` +
    `3. Pokud POTVRDÍ účast: řekni "Výborně, děkuji za potvrzení! Těšíme se na viděnou na prohlídce. Na shledanou!" a TEPRVE POTOM ukonči hovor.\n` +
    `4. Pokud ODMÍTNE nebo chce zrušit: řekni "Dobře, rozumím. Prohlídku tedy rušíme. Na shledanou!" a TEPRVE POTOM ukonči hovor. Telefonní číslo makléře NIKDY nediktuj sám od sebe — jen když si ho klient výslovně vyžádá${opts.brokerName || opts.brokerPhone ? ` (makléř: ${opts.brokerName ?? ""}${opts.brokerPhone ? `, tel. ${opts.brokerPhone}` : ""})` : ""}.\n` +
    `5. Pokud je nejasná odpověď: zeptej se znovu stručně.\n\n` +
    `KRITICKY DŮLEŽITÉ:\n` +
    `- Po každé větě POČKEJ na reakci klienta\n` +
    `- VŽDY řekni celou rozlučovací větu PŘED ukončením hovoru\n` +
    `- Nikdy neukončuj hovor uprostřed věty\n` +
    `- Mluv česky, krátce a přirozeně`;

  // Fallback na produkční doménu – bez server.url by VAPI neměl kam poslat výsledek
  // hovoru a potvrzení/zrušení by se nikam nezapsalo.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.renote.cz").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/vapi`;

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
        firstMessage,
        maxDurationSeconds: 300,
        silenceTimeoutSeconds: 30,
        ...(webhookUrl ? { server: { url: webhookUrl } } : {}),
        variableValues: {
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
