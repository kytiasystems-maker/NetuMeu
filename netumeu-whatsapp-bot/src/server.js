import 'dotenv/config'
import express from 'express'
import { handleWebhook, verifyWebhook } from './webhook.js'

const app = express()
const PORT = process.env.PORT || 3000

// WhatsApp sends JSON payloads
app.use(express.json())

// Health check
app.get('/', (req, res) => {
  res.json({
    app: 'NetuMeu WhatsApp Bot',
    status: 'running',
    version: '1.0.0',
    message: 'Trimite un mesaj vocal pe WhatsApp pentru a-l procesa.'
  })
})

// ─── WhatsApp Webhook ───
// GET  = verificare subscription (Meta trimite challenge)
// POST = mesaje primite de la utilizatori
app.get('/webhook', verifyWebhook)
app.post('/webhook', handleWebhook)

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║         NetuMeu WhatsApp Bot v1.0         ║
║                                           ║
║  Server pornit pe port ${PORT}               ║
║  Webhook URL: https://YOUR_URL/webhook    ║
║                                           ║
║  Gata să primească mesaje vocale!         ║
╚═══════════════════════════════════════════╝
  `)
})
