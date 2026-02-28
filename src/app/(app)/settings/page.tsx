"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const schema = z.object({
  triggerKeyword: z.string().min(1, "Zadejte klíčové slovo"),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
  smsTemplate: z.string().min(1, "Zadejte šablonu SMS"),
  smsHoursBefore: z.coerce.number().min(0).max(48),
});

type FormValues = z.infer<typeof schema>;

const defaultTemplate =
  "Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte YES pro potvrzení.";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      triggerKeyword: "#prohlidka",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioPhoneNumber: "",
      smsTemplate: defaultTemplate,
      smsHoursBefore: 2,
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        form.reset({
          triggerKeyword: data.trigger_keyword ?? "#prohlidka",
          twilioAccountSid: data.twilio_account_sid ?? "",
          twilioAuthToken: data.twilio_auth_token ?? "",
          twilioPhoneNumber: data.twilio_phone_number ?? "",
          smsTemplate: data.sms_template ?? defaultTemplate,
          smsHoursBefore: data.sms_hours_before ?? 2,
        });
      }
      setLoaded(true);
    };
    load();
  }, [user?.id]);

  const onSubmit = async (values: FormValues) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          trigger_keyword: values.triggerKeyword,
          twilio_account_sid: values.twilioAccountSid || null,
          twilio_auth_token: values.twilioAuthToken || null,
          twilio_phone_number: values.twilioPhoneNumber || null,
          sms_template: values.smsTemplate,
          sms_hours_before: values.smsHoursBefore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      form.reset(values);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-display font-semibold text-navy mb-2">
        Nastavení
      </h1>
      <p className="text-muted-foreground mb-6">
        Klíčové slovo v událostech kalendáře, SMS brána (Twilio) a šablona
        zprávy.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Kalendář</CardTitle>
            <CardDescription>
              Události obsahující toto slovo budou považovány za prohlídky.
              Formát v popisu: Tel: +420… Adresa: …
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="triggerKeyword">
                Klíčové slovo (např. #prohlidka)
              </Label>
              <Input
                id="triggerKeyword"
                {...form.register("triggerKeyword")}
                placeholder="#prohlidka"
                className="mt-1"
              />
              {form.formState.errors.triggerKeyword && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.triggerKeyword.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Twilio (SMS)</CardTitle>
            <CardDescription>
              Pro odesílání SMS potřebujete účet Twilio a číslo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="twilioAccountSid">Account SID</Label>
              <Input
                id="twilioAccountSid"
                type="password"
                {...form.register("twilioAccountSid")}
                placeholder="AC…"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="twilioAuthToken">Auth Token</Label>
              <Input
                id="twilioAuthToken"
                type="password"
                {...form.register("twilioAuthToken")}
                placeholder="…"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="twilioPhoneNumber">Twilio číslo (odkud SMS)</Label>
              <Input
                id="twilioPhoneNumber"
                {...form.register("twilioPhoneNumber")}
                placeholder="+420…"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Šablona SMS</CardTitle>
            <CardDescription>
              Placeholdery: {"{address}"}, {"{time}"}, {"{clientName}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="smsTemplate">Text zprávy</Label>
              <textarea
                id="smsTemplate"
                {...form.register("smsTemplate")}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
              />
              {form.formState.errors.smsTemplate && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.smsTemplate.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="smsHoursBefore">
                Odeslat SMS X hodin před prohlídkou
              </Label>
              <Input
                id="smsHoursBefore"
                type="number"
                {...form.register("smsHoursBefore")}
                min={0}
                max={48}
                className="mt-1 w-24"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" variant="navy" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Ukládám…
            </>
          ) : (
            "Uložit nastavení"
          )}
        </Button>
      </form>
    </div>
  );
}
