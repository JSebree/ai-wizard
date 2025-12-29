export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Extract everything after /infcam-proxy/
    // e.g. /infcam-proxy/run -> path = "run"
    // e.g. /infcam-proxy/status/123 -> path = "status/123"
    const path = url.pathname.replace('/infcam-proxy/', '');

    // Placeholder Endpoint ID - User should update this in .env or config if possible, 
    // but here we hardcode the structure as requested or use a default.
    // Since we don't have the ID, I will use a placeholder that matches the format 
    // or look for an environment variable.
    const ENDPOINT_ID = env.INFCAM_ENDPOINT_ID || "v2/placeholder-id";
    // NOTE: The user's previous proxy used 'f9kykzikds5kc0' directly in the URL string.

    // Construct target URL
    // If ENDPOINT_ID contains "v2/", assume it's the full path segment usually found in RunPod docs
    // but the previous proxy had `https://api.runpod.ai/v2/f9kykzikds5kc0/${path}`
    // We'll assume INFCAM_ENDPOINT_ID is just the ID 'xxxxxxxxx'.

    const runpodId = env.INFCAM_ENDPOINT_ID || "qd2x3p5z8axsf2";
    const targetUrl = `https://api.runpod.ai/v2/${runpodId}/${path}${url.search}`;

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
