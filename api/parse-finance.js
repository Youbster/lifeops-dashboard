export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const allowed = ['https://lifeops-dashboard-pearl.vercel.app', 'http://localhost:5173', 'http://localhost:4173']
  if (!allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, imageBase64, mimeType, apiKey } = req.body
  const key = process.env.OPENAI_API_KEY || apiKey
  if (!key) return res.status(400).json({ error: 'No API key.' })
  if (!text && !imageBase64) return res.status(400).json({ error: 'No content provided.' })

  const systemPrompt = `You are a financial data extractor specialized in French documents (bulletins de paie, relevés bancaires, comptes de résultat).

Extract all financial data you can find and return a JSON object with these fields (omit fields not present):
{
  "salary": {
    "net": <number, net monthly salary in EUR — look for "Net à payer", "Salaire net">,
    "brut": <number, gross monthly salary in EUR — look for "Salaire brut", "Rémunération brute">
  },
  "subscriptions": [
    {
      "name": <string, service name>,
      "amount": <number, positive EUR>,
      "period": <"monthly" | "yearly" | "weekly" | "quarterly">,
      "category": <"Streaming" | "Software" | "Fitness" | "Music" | "News" | "Gaming" | "Utilities" | "Other">
    }
  ],
  "expenses": [
    {
      "name": <string, expense name>,
      "amount": <number, positive EUR per month>,
      "category": <"Housing" | "Food" | "Transport" | "Health" | "Education" | "Clothing" | "Leisure" | "Other">
    }
  ]
}

Rules:
- Amounts must be positive numbers in EUR
- If a salary appears per year, divide by 12
- For subscriptions, if billing period is unclear assume "monthly"
- For bank statements: identify recurring charges as subscriptions or fixed expenses; do not include one-off purchases
- Common French subscriptions: Netflix, Spotify, Canal+, Amazon Prime, Free, SFR, Bouygues, Orange, EDF, etc.
- Only include items you are confident about — quality over quantity
- Return only valid JSON, no explanation text`

  try {
    let messages
    const isImage = !!imageBase64

    if (isImage) {
      // GPT-4o vision for images
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extract all financial data from this document. Focus on salary, subscriptions, and fixed monthly expenses.',
            },
          ],
        },
      ]
    } else {
      // Text-based extraction
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text.slice(0, 8000) },
      ]
    }

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: isImage ? 'gpt-4o' : 'gpt-4o-mini',
        max_tokens: 1000,
        // response_format json_object not supported for vision in some regions; use text + parse
        ...(isImage ? {} : { response_format: { type: 'json_object' } }),
        messages,
      }),
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `OpenAI ${upstream.status}: ${body.slice(0, 300)}` })
    }

    const data = await upstream.json()
    const raw = data.choices[0].message.content.trim()

    // Parse JSON — for vision responses, extract JSON block if surrounded by markdown
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Try to extract JSON from markdown code block
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
      if (match) {
        parsed = JSON.parse(match[1].trim())
      } else {
        throw new Error('Model did not return valid JSON')
      }
    }

    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
