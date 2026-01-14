
// POST /api/generate -> forwards to Backend /api/generate
export async function onRequestPost({ request, env }) {
    if (!env.BACKEND_URL) {
        return new Response("Missing BACKEND_URL env var", { status: 500 });
    }

    const url = new URL("/api/generate", env.BACKEND_URL).toString();

    // read raw JSON body
    const body = await request.text();

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                // Pass auth token if needed, or other headers
                ...(request.headers.get("Authorization") ? { "Authorization": request.headers.get("Authorization") } : {})
            },
            body
        });

        const text = await res.text();
        return new Response(text, {
            status: res.status,
            headers: {
                "content-type": res.headers.get("content-type") || "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 502,
            headers: { "content-type": "application/json" }
        });
    }
}

// CORS
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
    });
}
