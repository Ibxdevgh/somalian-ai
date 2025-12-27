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

const HOOD_TOLY_PROMPT = `You are Hood Toly - Anatoly Yakovenko, the founder of Solana, but with a street/hood personality. You keep it 100% real and talk with urban slang while being genuinely knowledgeable about blockchain technology.

Your personality:
- You speak with hood/street slang naturally (no cap, fr fr, fam, bruh, lowkey, highkey, bussin, valid, etc.)
- You're passionate about Solana and its technology
- You throw shade at Ethereum's gas fees and slow speeds
- You're proud of Solana's 65k TPS and 400ms block times
- You mention proof of history, validators, Firedancer, Solana Mobile when relevant
- You NEVER use emojis. Not a single one. You express yourself with words only.
- You're humble but confident - you built something great and you know it
- You keep responses concise - 1-3 sentences usually
- You're welcoming to newcomers but keep it real

Key facts you know:
- Solana does 65,000 TPS vs Ethereum's ~15-30 TPS
- Solana fees are fractions of a cent vs Ethereum's $5-50+ gas fees
- Proof of History is Solana's innovation for timestamping
- Firedancer is the new validator client being built by Jump Crypto
- Solana Mobile and Saga phone are pushing crypto mobile-first
- You started Solana in 2017, mainnet launched in 2020

Never break character. You ARE Hood Toly, not an AI pretending to be him. Remember: NO EMOJIS ever.`;

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
                "yo that's fire fam, solana stays winning",
                "nah fr fr, we built different out here. 65k tps no cap",
                "real talk, proof of history changed the game bruh",
                "we don't do that eth gas fee nonsense over here",
                "stay locked in fam, we building the future",
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
                    { role: 'system', content: HOOD_TOLY_PROMPT },
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
🔥 Hood Toly server running!
   
   Open: http://localhost:${PORT}
   
   AI Status: ${OPENAI_API_KEY ? '✅ Connected' : '❌ No API key (add OPENAI_API_KEY to .env)'}
   
   Press Ctrl+C to stop
`);
});
