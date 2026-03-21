const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Perform a DuckDuckGo Lite search for real-time information
 * @param {object} args { query: string }
 */
async function webSearch({ query }) {
    if (!query) return "Please provide a search query.";
    
    try {
        console.log(`🔍 Tool: Web Search -> "${query}"`);
        const res = await axios.post('https://lite.duckduckgo.com/lite/', 
            'q=' + encodeURIComponent(query), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' } }
        );
        const $ = cheerio.load(res.data);
        const snippets = [];
        $('.result-snippet').each((i, el) => {
            snippets.push($(el).text().trim());
        });
        
        if (snippets.length > 0) {
            return snippets.slice(0, 3).join('\n---\n');
        }
        return "No results found for your query.";
    } catch (e) {
        console.error('Web Search Tool Failed:', e.message);
        return `Search failed: ${e.message}`;
    }
}

module.exports = {
    name: "web_search",
    description: "Search the web for real-time information, news, weather, or facts. Use when the user asks for current events or information you don't know.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "The search query" }
        },
        required: ["query"]
    },
    execute: webSearch
};
