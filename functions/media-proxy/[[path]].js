export async function onRequest(context) {
    const { request, params } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/media-proxy/', '');
    const targetUrl = `https://media-catalog.nyc3.digitaloceanspaces.com/${path}${url.search}`;

    try {
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: request.headers,
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
        });
    } catch (error) {
        return new Response(`Proxy Error: ${error.message}`, { status: 500 });
    }
}
