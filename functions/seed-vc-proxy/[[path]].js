export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Extract everything after /seed-vc-proxy/
    // e.g. /seed-vc-proxy/run -> path = "run"
    // e.g. /seed-vc-proxy/status/123 -> path = "status/123"
    const path = url.pathname.replace('/seed-vc-proxy/', '');

    // Construct target URL
    const targetUrl = `https://api.runpod.ai/v2/f9kykzikds5kc0/${path}${url.search}`;

    // Handle OPTIONS (CORS Preflight)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        // Clone headers to modify them
        const newHeaders = new Headers(request.headers);

        // Inject Authorization Key from Environment Variable
        if (env.RUNPOD_API_KEY) {
            newHeaders.set("Authorization", `Bearer ${env.RUNPOD_API_KEY}`);
        } else {
            return new Response(JSON.stringify({ error: "Server Configuration Error: Missing API Key" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        const response = await fetch(targetUrl, {
            method: request.method,
            headers: newHeaders,
            body: request.body,
        });

        // Response Headers (CORS)
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: `Proxy Error: ${error.message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}
