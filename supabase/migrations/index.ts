import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

serve(async (req) => {
  try {
    const { task_title, client, actual_weather } = await req.json();

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        // Ciblage des administrateurs via les tags OneSignal
        filters: [
          { field: "tag", key: "role", relation: "=", value: "admin" }
        ],
        headings: { en: "⚠️ Alerte Météo Verdura", fr: "⚠️ Alerte Météo Verdura" },
        contents: { 
          fr: `Non-conformité sur le chantier "${task_title}" (${client}). Météo constatée : ${actual_weather}.`,
          en: `Weather mismatch on task "${task_title}" (${client}). Reported: ${actual_weather}.` 
        },
        // URL pour rediriger l'admin vers le chantier concerné
        data: { task_title, client },
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
      }),
    });

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});