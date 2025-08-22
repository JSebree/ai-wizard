// GET /api/status?id=123  -> forwards to your n8n "status" webhook
export async function onRequestGet({ request, env }) {
  const src = new URL(request.url);
  const jobId = src.searchParams.get("id") || src.searchParams.get("jobId");

  const target = new URL(env.N8N_STATUS_URL);
  if (jobId) target.searchParams.set("id", jobId);

  const res = await fetch(target.toString(), {
    headers: {
      "accept": "application/json",
      ...(env.N8N_TOKEN ? { "x-api-token": env.N8N_TOKEN } : {})
    }
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-api-token",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }
  });
}
