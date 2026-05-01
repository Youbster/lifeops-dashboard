export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const allowed = ['https://lifeops-dashboard-pearl.vercel.app', 'http://localhost:5173', 'http://localhost:4173']
  if (!allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, apiKey } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey
  if (!key) return res.status(400).json({ error: 'No API key.' })
  if (!text) return res.status(400).json({ error: 'No text provided.' })

  const system = `You are a financial data extractor. Given text from a French fiche de paie (payslip) or bank statement, extract structured financial data.

Output a JSON object with these fields (omit any that are not present in the text):
{
  "salary": {
    "net": <number, net monthly salary in EUR>,
    "brut": <number, gross monthly salary in EUR>
  },
  "subscriptions": [
    { "name": <string>, "amount": <number>, "period": <"monthly"|"yearly"|"weekly"|"quarterly">, "category": <string> }
  ],
  "expenses": [
    { "name": <string>, "amount": <number>, "category": <"Housing"|"Food"|"Transport"|"Health"|"Education"|"Clothing"|"Leisure"|"Other"> }
  ]
}

Rules:
- For payslips: extract "Salaire net" or "Net à payer" as salary.net, and "Salaire brut" as salary.brut
- For bank statements: identify recurring charges as subscriptions or expenses
- Amounts should be positive numbers in EUR
- If period is unclear for subscriptions, assume "monthly"
- Only include items you're reasonably confident about
- Return only valid JSON, no explanation`

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text.slice(0, 4000) },
        ],
      }),
    })
    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 200)}` })
    }
    const data = await upstream.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
