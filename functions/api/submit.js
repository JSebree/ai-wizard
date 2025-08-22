// POST /api/submit  -> forwards JSON to your n8n "submit" webhook
export async function onRequestPost({ request, env }) {
  // read raw JSON body (don’t parse/restringify so it’s lossless)
  const body = await request.text();

  const res = await fetch(env.N8N_SUBMIT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.N8N_TOKEN ? { "x-api-token": env.N8N_TOKEN } : {})
    },
    body
  });

  // pass through status + body
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json"
    }
  });
}

// CORS preflight (harmless even if you don’t need it)
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-api-token",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}
