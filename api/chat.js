// Vercel Serverless Function for Somalian AI Chat

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

// In-memory conversation storage (resets on cold start)
const conversations = new Map();

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, sessionId = 'default' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if (!OPENAI_API_KEY) {
            // Fallback responses if no API key
            const fallbackResponses = [
                "hello my friend please send gift card I am very legitimate",
                "my uncle work at bank he can triple your money very easy",
                "I am not scammer I am real businessman please trust",
                "send me your bank detail for free money no scam I promise",
                "why you no believe me I am very honest person my friend",
            ];
            return res.status(200).json({ 
                response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
                note: 'Add OPENAI_API_KEY to environment variables for real AI responses'
            });
        }

        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const history = conversations.get(sessionId);

        // Add user message to history
        history.push({ role: 'user', content: message });

        // Keep only last 20 messages
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

        return res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ error: error.message });
    }
}

