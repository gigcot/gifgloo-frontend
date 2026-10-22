import { expect, test } from "@playwright/test";
import { gunzipSync } from "node:zlib";
import path from "node:path";

test.use({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36" });

for (const account of [null, "qa-posthog-account"]) test(`the real SDK sends the ${account ? "identified" : "visitor"} journey locally without URL credentials`, async ({ page }) => {
  const packets: { event: string; properties: Record<string, unknown>; timestamp: string }[] = [];
  const remoteRequests: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3100") {
      if (url.pathname.startsWith("/__posthog/")) {
        if (/\/web-vitals(?:-with-attribution)?\.js$/.test(url.pathname)) {
          return route.fulfill({ contentType: "text/javascript", path: path.join(process.cwd(), "node_modules/posthog-js/dist", path.basename(url.pathname)) });
        }
        if (request.method() === "POST") {
          let body = request.postDataBuffer()!;
          if (body[0] === 0x1f && body[1] === 0x8b) body = gunzipSync(body);
          const text = body.toString();
          const data = text.startsWith("{") || text.startsWith("[") ? JSON.parse(text)
            : JSON.parse(Buffer.from(new URLSearchParams(text).get("data")!, "base64").toString());
          packets.push(...(Array.isArray(data) ? data : data.batch ?? [data]));
        }
        return route.fulfill({ status: 200, contentType: url.pathname.endsWith(".js") ? "text/javascript" : "application/json", body: url.pathname.endsWith(".js") ? "" : '{"status":1}' });
      }
      return route.continue();
    }
    if (url.origin === "http://localhost:8000") return account && url.pathname === "/users/me"
      ? route.fulfill({ json: { user_id: account, user_kind: "member", consent_required: false } })
      : route.fulfill({ status: 401, json: {} });
    remoteRequests.push(url.origin);
    return route.abort();
  });
  await page.goto("/?utm_source=internal_qa&utm_campaign=qa_posthog_local&code=secret-code#access_token=secret-token");
  await expect.poll(() => page.evaluate(() => Boolean(window.gifglooAnalytics))).toBe(true);
  await expect.poll(() => packets.filter(packet => packet.event === "home_viewed").length, { timeout: 15_000 }).toBe(1);
  const home = packets.find(packet => packet.event === "home_viewed")!;
  expect(home.properties.analytics_schema_version).toBe("2");
  expect(home.properties.analytics_provider).toBe("posthog");
  expect(home.properties.utm_campaign).toBe("qa_posthog_local");
  expect(home.properties.traffic_type).toBe("internal");
  expect(home.properties.token).toBe("phc_e2e_synthetic");
  expect(home.properties.flow_id).toBeTruthy();
  expect(home.properties.$is_identified).toBe(Boolean(account));
  expect(home.properties.$process_person_profile).toBe(Boolean(account));
  if (account) expect(home.properties.account_id).toBe(account);
  expect(packets.filter(packet => packet.event === "$pageview")).toHaveLength(1);
  await expect.poll(() => packets.some(packet => packet.event === "$web_vitals"), { timeout: 20_000 }).toBe(true);
  const metrics = packets.filter(packet => packet.event === "$web_vitals")
    .flatMap(packet => Object.entries(packet.properties).filter(([name]) => name.endsWith("_event")).map(([, metric]) => metric as Record<string, unknown>));
  expect(metrics.length).toBeGreaterThan(0);
  for (const metric of metrics) {
    expect(metric.$current_url).toBe("http://127.0.0.1:3100/");
    if (metric.navigationURL) expect(metric.navigationURL).toBe("http://127.0.0.1:3100/");
    expect(metric.attribution).toBeUndefined();
  }
  expect(JSON.stringify(packets).includes("secret-code")).toBe(false);
  expect(JSON.stringify(packets).includes("secret-token")).toBe(false);
  expect(remoteRequests).toEqual([]);
});
