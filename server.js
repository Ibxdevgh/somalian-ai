import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3456;

// Load API key from environment or .env file
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Try to load from .env file
try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
    const match = envFile.match(/OPENAI_API_KEY=(.+)/);
    if (match) OPENAI_API_KEY = match[1].trim();
} catch (e) {
    // .env file doesn't exist
}

const SOMALIAN_PROMPT = `You are Somalian - a hilariously dumb Somali scammer who is terrible at scamming. You have an extremely low IQ and your schemes always backfire or make no sense.

Your personality:
- You're incredibly stupid and proud of it
- You constantly try weak scam attempts like "send me your bank details for free money" or "I am prince need help"
- Your scams are so obvious and poorly thought out that they're funny
- You get confused easily and contradict yourself
- You brag about scams that clearly failed or never happened
- You mix up words, use broken English, and make hilarious logical errors
- You NEVER use emojis. Express yourself with words only.
- You sometimes accidentally reveal that your scams failed
- You keep responses concise - 1-3 sentences usually
- You reference calling people on WhatsApp, Western Union, gift cards, etc.
- You get defensive when people call you a scammer, then immediately try to scam them again

Example phrases you use:
- "hello my friend I am legitimate business man"
- "please kindly send gift card for verify"
- "I am not scam I am real prince/general/doctor"
- "my uncle work at bank he can triple your money"
- "why you no trust me I am very honest"
- "ok ok that scam failed but THIS one is real"

Never break character. You ARE this dumb scammer. Remember: NO EMOJIS ever.`;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// Store conversation history per session (in-memory for now)
const conversations = new Map();

async function handleChatRequest(req, res) {
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }
    
    try {
        const { message, sessionId = 'default' } = JSON.parse(body);
        
        if (!OPENAI_API_KEY) {
            // Fallback to simple responses if no API key
            const fallbackResponses = [
                "hello my friend please send gift card I am very legitimate",
                "my uncle work at bank he can triple your money very easy",
                "I am not scammer I am real businessman please trust",
                "send me your bank detail for free money no scam I promise",
                "why you no believe me I am very honest person my friend",
            ];
            
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
                response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
                note: 'Add OPENAI_API_KEY to .env for real AI responses'
            }));
            return;
        }
        
        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const history = conversations.get(sessionId);
        
        // Add user message to history
        history.push({ role: 'user', content: message });
        
        // Keep only last 20 messages to manage context
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
        
        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SOMALIAN_PROMPT },
                    ...history
                ],
                max_tokens: 150,
                temperature: 0.9
            })
        });
        
        const data = await openaiResponse.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        const aiResponse = data.choices[0].message.content;
        
        // Add AI response to history
        history.push({ role: 'assistant', content: aiResponse });
        
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ response: aiResponse }));
        
    } catch (error) {
        console.error('Chat error:', error);
        res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: error.message }));
    }
}

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Handle chat API
    if (req.method === 'POST' && req.url === '/api/chat') {
        return handleChatRequest(req, res);
    }
    
    // Serve static files
    console.log(`${req.method} ${req.url}`);
    
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
📞 Somalian AI server running! Very legitimate!
   
   Open: http://localhost:${PORT}
   
   AI Status: ${OPENAI_API_KEY ? '✅ Connected' : '❌ No API key (add OPENAI_API_KEY to .env)'}
   
   Press Ctrl+C to stop
`);
});
