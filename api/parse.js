export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, todayStr, dayName, apiKey } = req.body
  const key = process.env.ANTHROPIC_API_KEY || apiKey

  if (!key) return res.status(400).json({ error: 'No API key. Set ANTHROPIC_API_KEY in Vercel env vars or enter a key in app settings.' })
  if (!text) return res.status(400).json({ error: 'Missing text' })

  const system = `You are a personal task parser. Extract structured info from natural language, including messy voice input.
Today is ${todayStr} (${dayName}).

Return ONLY valid JSON with these fields:
- title: clean, concise task title (max 60 chars)
- category: one of: work, personal, money, car, house, shopping, sidehustle, people, ideas
- dueDate: YYYY-MM-DD using today ${todayStr} as reference, or null
- priority: high | medium | low
- type: todo | idea | purchase | follow-up | project

TITLE RULES — most important:
1. Always use imperative verb form (action-first): "Fix", "Buy", "Call", "Pay", "Schedule"
2. Strip ALL filler/thinking words: ok, so, um, uh, like, well, right, actually, basically, literally, you know, I mean, anyway
3. Strip ALL preamble phrases: "I need to", "I should", "I want to", "I have to", "I was thinking", "remember to", "don't forget to", "make sure to", "I think I should", "so basically"
4. Keep specific useful details: names, objects, locations, quantities
5. Be concise — if the core action is clear, use 2–5 words

Examples:
"ok so ok so my house actually needs to be fixed" → "Fix house"
"ok I need to make new tyres for my car" → "Buy new car tyres"
"um so I was thinking I should call mom sometime this week" → "Call mom"
"so basically I need to remember to pay my rent" → "Pay rent"
"I have to like go to the gym you know" → "Go to gym"

Category guide: work=job/office/meetings, personal=health/self-care/appointments, money=bills/payments/banking, car=vehicle/fuel/mechanic, house=repairs/cleaning/furniture, shopping=buying things/groceries, sidehustle=freelance/content/startup, people=calls/social/family/friends, ideas=concepts/brainstorm/explore
Type guide: todo=action item, idea=concept to think about, purchase=something to buy, follow-up=check in with someone, project=multi-step initiative`

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `Anthropic ${upstream.status}: ${body.slice(0, 200)}` })
    }

    const data = await upstream.json()
    const raw = data.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
