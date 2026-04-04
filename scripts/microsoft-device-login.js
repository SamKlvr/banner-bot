import dotenv from "dotenv";

dotenv.config();

const clientId = process.env.MICROSOFT_CLIENT_ID || "";
const tenant = process.env.MICROSOFT_TENANT_ID || "consumers";
const scopes = process.env.MICROSOFT_SCOPES || "offline_access Files.Read User.Read";

if (!clientId) {
  console.error("Missing MICROSOFT_CLIENT_ID in .env");
  process.exit(1);
}

const deviceCodeUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/devicecode`;
const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

const deviceCodeBody = new URLSearchParams({
  client_id: clientId,
  scope: scopes
});

const deviceCodeResponse = await fetch(deviceCodeUrl, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded"
  },
  body: deviceCodeBody
});

if (!deviceCodeResponse.ok) {
  console.error("Failed to start Microsoft device login:", await deviceCodeResponse.text());
  process.exit(1);
}

const deviceCode = await deviceCodeResponse.json();

console.log("");
console.log("Open this URL:");
console.log(deviceCode.verification_uri || deviceCode.verification_uri_complete || "https://microsoft.com/devicelogin");
console.log("");
console.log("Enter this code:");
console.log(deviceCode.user_code);
console.log("");
console.log("Waiting for Microsoft authorization...");
console.log("");

const intervalMs = Math.max(5, Number(deviceCode.interval || 5)) * 1000;
const deadline = Date.now() + Math.max(300, Number(deviceCode.expires_in || 900)) * 1000;

while (Date.now() < deadline) {
  await sleep(intervalMs);

  const tokenBody = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: clientId,
    device_code: deviceCode.device_code
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: tokenBody
  });

  const tokenJson = await tokenResponse.json();

  if (tokenJson.error === "authorization_pending") {
    continue;
  }

  if (tokenJson.error === "slow_down") {
    await sleep(intervalMs);
    continue;
  }

  if (!tokenResponse.ok) {
    console.error("Microsoft token error:", JSON.stringify(tokenJson, null, 2));
    process.exit(1);
  }

  console.log("Success. Put these into .env:");
  console.log("");
  console.log(`MICROSOFT_CLIENT_ID=${clientId}`);
  console.log(`MICROSOFT_TENANT_ID=${tenant}`);
  console.log(`MICROSOFT_SCOPES=${scopes}`);
  console.log(`MICROSOFT_GRAPH_ACCESS_TOKEN=${tokenJson.access_token || ""}`);
  console.log(`MICROSOFT_REFRESH_TOKEN=${tokenJson.refresh_token || ""}`);
  console.log("");
  process.exit(0);
}

console.error("Device login timed out.");
process.exit(1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
