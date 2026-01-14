import { CONFIG } from './config';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export async function chatCompletion(messages: ChatMessage[], model = "qwen/qwen-2.5-72b-instruct") {
    if (!CONFIG.OPENROUTER_API_KEY) {
        throw new Error("Missing OPENROUTER_API_KEY");
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            // Optional: Site URL/Title for OpenRouter rankings
            "HTTP-Referer": "https://sceneme.ai",
            "X-Title": "SceneMe Express",
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API Error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    const responseBody = (data as any);
    return responseBody.choices[0]?.message?.content || "";
}
