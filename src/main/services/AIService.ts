import { GoogleGenerativeAI } from '@google/generative-ai';
import { databaseService } from './DatabaseService';

const TOOLS_INSTRUCTION = `
Você tem acesso a ferramentas para interagir com a internet. Quando precisar usar uma, responda SOMENTE com um bloco JSON assim:

\`\`\`tool
{"name": "nome_da_ferramenta", "args": {"param": "valor"}}
\`\`\`

Ferramentas disponíveis:

1. **search_web** - Pesquisa informações atualizadas na internet
   Args: { "query": "termo de busca" }

2. **http_request** - Faz requisições HTTP para qualquer API ou serviço (GET, POST, PUT, DELETE)
   Args: { "method": "GET", "url": "https://api.exemplo.com/data", "headers": "{\\"Authorization\\": \\"Bearer token\\"}", "body": "{\\"key\\": \\"value\\"}" }
   (headers e body são opcionais)

3. **read_url** - Lê e extrai o conteúdo textual de uma página web
   Args: { "url": "https://exemplo.com/pagina" }

REGRAS IMPORTANTES:
- Se precisar de uma ferramenta, responda APENAS com o bloco JSON, sem texto antes ou depois.
- Após receber o resultado, você pode usar outra ferramenta ou dar a resposta final em texto normal.
- Quando tiver toda informação necessária, responda normalmente.
- NUNCA invente dados. Se precisar de informação real, USE as ferramentas.
`;

export class AIService {
    private getInstance() {
        const apiKey = databaseService.getSetting('gemini_api_key');
        if (!apiKey) return null;
        return new GoogleGenerativeAI(apiKey);
    }

    async generateResponse(messageContent: string, systemPrompt: string, imageData?: { data: string, mimeType: string }) {
        const genAI = this.getInstance();
        if (!genAI) return 'Erro: API Key do Gemini não configurada.';

        const rawModel = databaseService.getSetting('gemini_model') || 'gemini-2.0-flash';
        const modelName = rawModel.trim();

        const fullSystemPrompt = `${systemPrompt}\n\n${TOOLS_INSTRUCTION}`;

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: fullSystemPrompt
        });

        const chat = model.startChat();

        try {
            const parts: any[] = [];
            if (imageData) {
                parts.push({ inlineData: { data: imageData.data, mimeType: imageData.mimeType } });
            }
            parts.push({ text: messageContent });

            let result = await chat.sendMessage(parts);
            let responseText = result.response.text();

            // Tool execution loop (max 5 rounds)
            let iterations = 0;
            while (iterations < 5) {
                const toolCall = this.parseToolCall(responseText);
                if (!toolCall) break;

                iterations++;
                console.log(`[AI Tool] ${toolCall.name}:`, JSON.stringify(toolCall.args));

                const toolResult = await this.executeFunction(toolCall.name, toolCall.args);
                console.log(`[AI Tool] Result preview:`, toolResult.content.slice(0, 200));

                result = await chat.sendMessage(
                    `Resultado da ferramenta "${toolCall.name}":\n\n${toolResult.content}`
                );
                responseText = result.response.text();
            }

            return responseText;

        } catch (error: any) {
            console.error('[AIService] Error:', error.message);
            return `Erro ao processar: ${error.message}`;
        }
    }

    private parseToolCall(text: string): { name: string; args: any } | null {
        const toolMatch = text.match(/```tool\s*\n?([\s\S]*?)\n?```/);
        if (toolMatch) {
            try { return JSON.parse(toolMatch[1].trim()); } catch { return null; }
        }

        const trimmed = text.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return (parsed.name && parsed.args) ? parsed : null;
            } catch { return null; }
        }

        return null;
    }

    private async executeFunction(name: string, args: any): Promise<{ content: string }> {
        try {
            switch (name) {
                case 'search_web': return await this.execSearchWeb(args);
                case 'http_request': return await this.execHttpRequest(args);
                case 'read_url': return await this.execReadUrl(args);
                default: return { content: `Função "${name}" não encontrada.` };
            }
        } catch (e: any) {
            console.error(`[AI Tool Error] ${name}:`, e.message);
            return { content: `Erro na execução: ${e.message}` };
        }
    }

    private async execSearchWeb(args: any): Promise<{ content: string }> {
        const query = args.query;
        console.log('[AI Tool] Searching DuckDuckGo HTML:', query);

        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();

        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);

        const results: string[] = [];
        $('.result').each((i: number, el: any) => {
            if (i >= 5) return false;
            const title = $(el).find('.result__title').text().trim();
            const snippet = $(el).find('.result__snippet').text().trim();
            const link = $(el).find('.result__url').text().trim();
            if (title) results.push(`Title: ${title}\nLink: ${link}\nSnippet: ${snippet}`);
            return true;
        });

        return { content: results.length > 0 ? results.join('\n\n') : 'Nenhum resultado encontrado.' };
    }

    private async execHttpRequest(args: any): Promise<{ content: string }> {
        const method = (args.method || 'GET').toUpperCase();
        const url = args.url;
        const headers = args.headers ? JSON.parse(args.headers) : {};
        const body = args.body || undefined;

        console.log(`[AI Tool] HTTP ${method} -> ${url}`);

        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
            options.body = body;
        }

        const res = await fetch(url, options);
        const text = await res.text();

        return {
            content: `Status: ${res.status} ${res.statusText}\n\nBody:\n${text.slice(0, 8000)}`
        };
    }

    private async execReadUrl(args: any): Promise<{ content: string }> {
        const url = args.url;
        console.log('[AI Tool] Reading URL:', url);

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();

        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header, iframe, noscript, svg').remove();

        const { htmlToText } = await import('html-to-text');
        const text = htmlToText($.html(), {
            wordwrap: 130,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
            ]
        });

        return { content: text.slice(0, 8000) || 'Conteúdo vazio.' };
    }
}

export const aiService = new AIService();
