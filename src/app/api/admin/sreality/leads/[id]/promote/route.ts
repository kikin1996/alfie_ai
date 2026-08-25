import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

async function resolveEmail(request: NextRequest): Promise<string | undefined> {
  const supabase = await createClient();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.email;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const email = await resolveEmail(request);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: lead, error: leadError } = await admin
    .from("sreality_leads")
    .select("id, client_name, client_phone, client_email, converted_contact_id")
    .eq("id", params.id)
    .maybeSingle();

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });

  if (lead.converted_contact_id) {
    const { data: existingContact, error: existingError } = await admin
      .from("crm_contacts")
      .select("*")
      .eq("id", lead.converted_contact_id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    return NextResponse.json(existingContact);
  }

  const { data: contact, error: insertError } = await admin
    .from("crm_contacts")
    .insert({
      name: lead.client_name || "Neznámý klient",
      phone: lead.client_phone,
      email: lead.client_email,
      source_lead_id: lead.id,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await admin
    .from("sreality_leads")
    .update({ converted_contact_id: contact.id, updated_at: new Date().toISOString() })
    .eq("id", lead.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(contact);
}
