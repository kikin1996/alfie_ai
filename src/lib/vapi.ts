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
}): Promise<string> {
  const res = await fetch("https://api.vapi.ai/v1/phone-calls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      type: "outbound-phone-call",
      assistantId: opts.assistantId,
      phoneNumberId: opts.phoneNumberId,
      customer: {
        number: opts.number,
        name: opts.name,
      },
      metadata: {
        event_id: opts.eventId,
        address: opts.address,
        startISO: opts.startISO,
      },
      answeringMachineDetection: true,
      recordingEnabled: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`VAPI call failed: ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}
