
import { CONFIG } from '../config';
import { chatCompletion } from '../llm';

interface TavilyResult {
    url: string;
    title: string;
    content: string;
}

// 1. Tavily Search
async function tavilySearch(query: string): Promise<TavilyResult[]> {
    if (!CONFIG.TAVILY_API_KEY) {
        console.warn("Missing TAVILY_API_KEY, skipping research.");
        return [];
    }

    try {
        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: CONFIG.TAVILY_API_KEY,
                query: query,
                search_depth: "advanced",
                include_answer: false,
                include_images: false,
                include_raw_content: false,
                max_results: 5
            })
        });

        if (!res.ok) throw new Error(`Tavily Error: ${res.statusText}`);

        const data: any = await res.json();
        return (data.results || []).map((r: any) => ({
            url: r.url,
            title: r.title,
            content: r.content
        }));

    } catch (e) {
        console.error("Research failed:", e);
        return [];
    }
}

// 2. Grounded Synthesis (LLM)
async function synthesizeResearch(query: string, sources: TavilyResult[]): Promise<string> {
    if (sources.length === 0) return query; // Fallback to original query

    const sourcesText = JSON.stringify(sources.map(s => ({
        url: s.url,
        title: s.title,
        content: s.content.substring(0, 500) // Truncate for token limits
    })));

    const systemPrompt = `You are a grounded synthesis engine.
HARD RULES
- Use ONLY the SOURCES provided. Do not invent facts.
- Return a summary of the key points that answer the user query.
- Format as a clear, concise paragraph or list suitable for feeding into a script generator.
- Focus on facts, style, and narrative elements if requested.`;

    const userPrompt = `USER QUERY: ${query}

SOURCES:
${sourcesText}

Synthesize the answer based strictly on the sources.`;

    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        // @ts-ignore
        const synthesis = await chatCompletion(messages);
        return synthesis || query;
    } catch (e) {
        console.error("Synthesis failed", e);
        return query;
    }
}

// 3. Main Export
export async function runAgenticResearch(topic: string): Promise<string> {
    console.log(`[Researcher] researching: "${topic}"...`);

    // Step 1: Search
    const sources = await tavilySearch(topic);
    console.log(`[Researcher] Found ${sources.length} sources.`);

    // Step 2: Synthesize
    const result = await synthesizeResearch(topic, sources);
    console.log(`[Researcher] Synthesis complete.`);

    return result;
}
