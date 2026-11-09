
import { timingSafeEqual } from "node:crypto";

const SITE_TAG = "27636ff3a2774d4bac691e638c6bd752";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function validPassword(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const password = process.env.ROSLEN_DASHBOARD_PASSWORD;

  if (!token || !accountId || !password) {
    return json({ error: "Configuration incomplete" }, 503);
  }

  let suppliedPassword = "";
  const auth = request.headers.get("authorization") || "";

  if (auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64")
        .toString("utf8");
      suppliedPassword = decoded.slice(decoded.indexOf(":") + 1);
    } catch {}
  }

  if (!validPassword(suppliedPassword, password)) {
    return new Response("Authentification requise", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="ROSLEN Analytics"',
        "Cache-Control": "no-store"
      }
    });
  }

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);

  const query = `
    query($account: string!, $site: string!, $from: Time!) {
      viewer {
        accounts(filter: { accountTag: $account }) {
          daily: rumPageloadEventsAdaptiveGroups(
            limit: 100,
            filter: { siteTag: $site, datetime_geq: $from },
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { visits }
          }
          countries: rumPageloadEventsAdaptiveGroups(
            limit: 300,
            filter: { siteTag: $site, datetime_geq: $from },
            orderBy: [sum_visits_DESC]
          ) {
            dimensions { countryName }
            sum { visits }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          variables: {
            account: accountId,
            site: SITE_TAG,
            from: start.toISOString()
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok || result.errors?.length) {
      console.error("Cloudflare GraphQL error", result.errors);
      return json({
        error: "Cloudflare API unavailable or query rejected"
      }, 502);
    }

    const account = result.data?.viewer?.accounts?.[0];
    if (!account) {
      return json({ error: "Compte Cloudflare introuvable" }, 502);
    }

    const daily = (account.daily || []).map(row => ({
      date: row.dimensions.date,
      visits: row.sum?.visits || 0
    }));

    const countries = (account.countries || []).map(row => ({
      country: row.dimensions.countryName,
      visits: row.sum?.visits || 0
    }));

    const today = now.toISOString().slice(0, 10);
    const last7 = new Date(now);
    last7.setUTCDate(last7.getUTCDate() - 6);
    const sevenDayStart = last7.toISOString().slice(0, 10);

    return json({
      today: daily
        .filter(row => row.date === today)
        .reduce((n, row) => n + row.visits, 0),
      last7Days: daily
        .filter(row => row.date >= sevenDayStart)
        .reduce((n, row) => n + row.visits, 0),
      last30Days: daily.reduce((n, row) => n + row.visits, 0),
      daily,
      countries
    });
  } catch (error) {
    console.error("Cloudflare request failed", error);
    return json({ error: "Erreur de connexion" }, 502);
  }
}
