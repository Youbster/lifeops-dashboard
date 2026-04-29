export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, todayStr, dayName, apiKey } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey

  if (!key) return res.status(400).json({ error: 'No API key. Set OPENAI_API_KEY in Vercel env vars.' })
  if (!text) return res.status(400).json({ error: 'Missing text' })

  const systemPrompt = `You are a personal task parser. Extract structured info from natural language, including messy voice input.
Today is ${todayStr} (${dayName}).

Return ONLY valid JSON with these fields:
- title: clean, concise task title (max 60 chars) — imperative verb, no filler words
- category: one of: work, personal, money, car, house, shopping, sidehustle, people, ideas
- dueDate: YYYY-MM-DD using today ${todayStr} as reference, or null
- priority: high | medium | low
- type: todo | idea | purchase | follow-up | project
- notes: 1-2 sentence context note with any extra detail from the input beyond the action (e.g. who to call, what exactly to buy, why it matters). Empty string if nothing extra.
- duration: estimated effort — "quick" (<5 min), "30m", "1h", "2h", "half-day", or null if unclear
- repeat: "daily" | "weekly" | "monthly" | null — set when user says "every day/week/month", "daily", "weekly", "monthly", or "recurring". null for one-time tasks.
- subtasks: for "project" type only, array of 3-5 short action strings (next steps). Empty array for non-projects.

TITLE RULES:
1. Imperative verb form: "Fix", "Buy", "Call", "Pay", "Schedule"
2. Strip ALL filler: ok, so, um, uh, like, well, right, actually, basically, literally
3. Strip ALL preamble: "I need to", "I should", "I want to", "remember to", "don't forget to"
4. Keep names, objects, locations, quantities
5. Max 5 words if the core action is clear

NOTES RULES:
- Extract any context, constraints, or details the user mentioned beyond the action
- "call mom to check how she's doing after surgery" → notes: "Check how she's doing after her surgery"
- "buy milk, we're completely out" → notes: "Completely out of milk"
- If no extra context, leave as empty string ""

DURATION RULES:
- "quick" for single calls, simple purchases, 5-min tasks
- "30m" for appointments, moderate errands
- "1h" for focused work sessions, longer meetings
- "2h" for complex tasks, multiple steps
- "half-day" for big projects requiring sustained work
- null if truly unclear

SUBTASKS (projects only):
- "build a website" → ["Buy domain", "Choose hosting", "Design homepage", "Deploy and test"]
- "plan a trip" → ["Choose destination", "Book flights", "Book hotel", "Plan itinerary"]

Examples:
"ok so I need to call the dentist before Friday to reschedule my appointment" →
  title: "Call dentist", dueDate: [next Thursday], priority: "medium", type: "follow-up",
  notes: "Reschedule existing appointment", duration: "quick", repeat: null, subtasks: []

"pay rent every month" →
  title: "Pay rent", category: "money", priority: "high", type: "todo", repeat: "monthly", subtasks: []

"drink water every day" →
  title: "Drink water", category: "personal", repeat: "daily", subtasks: []

"I think I should start building my portfolio website this week" →
  title: "Build portfolio website", type: "project", priority: "high",
  notes: "Personal brand site for showcasing work", duration: "half-day",
  subtasks: ["Buy domain", "Choose template", "Write bio", "Add projects section", "Deploy"]

Category guide: work=job/office/meetings, personal=health/self/appointments, money=bills/payments/banking, car=vehicle/fuel/mechanic, house=repairs/cleaning/furniture, shopping=buying/groceries, sidehustle=freelance/content/startup, people=calls/social/family, ideas=concepts/brainstorm`

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 200)}` })
    }

    const data = await upstream.json()
    const raw = data.choices[0].message.content.trim()
    return res.status(200).json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
