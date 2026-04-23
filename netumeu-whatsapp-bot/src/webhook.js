import crypto from 'crypto'
import { downloadMedia } from './whatsapp-api.js'
import { transcribeAudio } from './transcriber.js'
import { extractData } from './extractor.js'
import { sendToAccountant } from './mailer.js'
import { sendWhatsAppMessage, sendWhatsAppReaction } from './whatsapp-api.js'

// ─── Verify webhook subscription (GET) ───
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('✅ Webhook verificat cu succes')
    return res.status(200).send(challenge)
  }
  console.log('❌ Verificare webhook eșuată')
  return res.sendStatus(403)
}

// ─── Handle incoming messages (POST) ───
export async function handleWebhook(req, res) {
  // Răspunde imediat cu 200 — WhatsApp re-trimite dacă nu primește rapid
  res.sendStatus(200)

  try {
    const body = req.body

    // Verifică dacă e un mesaj valid
    if (body.object !== 'whatsapp_business_account') return

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) return

    const message = messages[0]
    const from = message.from // Numărul clientului (format: 40741234567)
    const contactName = value.contacts?.[0]?.profile?.name || 'Client necunoscut'
    const timestamp = new Date(parseInt(message.timestamp) * 1000)

    console.log(`\n📩 Mesaj de la ${contactName} (${from}) la ${timestamp.toLocaleString('ro-RO')}`)

    // React cu ⏳ ca să știe clientul că procesăm
    await sendWhatsAppReaction(from, message.id, '⏳')

    let transcript = ''
    let messageType = message.type
    let mediaUrl = null

    // ─── Procesare în funcție de tip ───
    if (message.type === 'audio') {
      // Mesaj vocal
      console.log('🎙️  Mesaj vocal detectat, descarc audio...')
      const audioBuffer = await downloadMedia(message.audio.id)
      console.log(`📥 Audio descărcat: ${audioBuffer.length} bytes`)

      // Transcriere
      console.log('📝 Transcriere în curs...')
      transcript = await transcribeAudio(audioBuffer, message.audio.mime_type)
      console.log(`✅ Transcris: "${transcript}"`)

    } else if (message.type === 'text') {
      // Mesaj text simplu
      transcript = message.text.body
      console.log(`💬 Text: "${transcript}"`)

    } else if (message.type === 'image') {
      // Poză (bon, factură) — deocamdată doar notificăm
      console.log('📷 Imagine primită (OCR nu e implementat încă)')
      transcript = '[Imagine primită — necesită procesare manuală]'
      if (message.image.caption) {
        transcript += ' Context vocal: ' + message.image.caption
      }

    } else {
      console.log(`⚠️  Tip mesaj nesuportat: ${message.type}`)
      await sendWhatsAppMessage(from,
        'Momentan pot procesa mesaje vocale și text. Trimite-mi un mesaj vocal cu ce ai nevoie! 🎙️')
      return
    }

    if (!transcript || transcript.trim().length < 3) {
      await sendWhatsAppMessage(from,
        'Nu am reușit să înțeleg mesajul. Poți repeta mai clar? 🎙️')
      return
    }

    // ─── Extragere date structurate ───
    console.log('🔍 Extrag date structurate...')
    const extracted = extractData(transcript)
    console.log(`📊 Extras: ${extracted.type} (confidence: ${extracted.confidence}%)`)

    // ─── Confirmare pe WhatsApp ───
    const confirmMsg = formatConfirmation(extracted, contactName)
    await sendWhatsAppReaction(from, message.id, '✅')
    await sendWhatsAppMessage(from, confirmMsg)

    // ─── Trimite email la contabil ───
    console.log('📧 Trimit email la contabil...')
    await sendToAccountant({
      clientName: contactName,
      clientPhone: from,
      timestamp,
      messageType,
      originalText: transcript,
      extracted,
    })
    console.log('✅ Email trimis cu succes!')

  } catch (err) {
    console.error('❌ Eroare procesare webhook:', err.message)
  }
}

// ─── Formatare mesaj confirmare WhatsApp ───
function formatConfirmation(extracted, clientName) {
  let msg = `Salut ${clientName.split(' ')[0]}! Am primit și procesat mesajul tău.\n\n`

  if (extracted.type === 'invoice') {
    msg += `📄 *Factură detectată*\n`
    msg += `├ Client: ${extracted.data.client || 'nespecificat'}\n`
    msg += `├ Sumă: ${extracted.data.amount}\n`
    msg += `├ TVA: ${extracted.data.vat}\n`
    msg += `├ Descriere: ${extracted.data.description || '-'}\n`
    msg += `└ Termen: ${extracted.data.paymentTerm || '15 zile'}\n`
  } else if (extracted.type === 'expense') {
    msg += `🧾 *Cheltuială detectată*\n`
    msg += `├ Furnizor: ${extracted.data.supplier || 'nespecificat'}\n`
    msg += `├ Sumă: ${extracted.data.amount}\n`
    msg += `├ Categorie: ${extracted.data.category}\n`
    msg += `└ Cont: ${extracted.data.account || '401'}\n`
  } else if (extracted.type === 'question') {
    msg += `❓ *Întrebare înregistrată*\n`
    msg += `Contabilul tău va primi mesajul și va răspunde.\n`
  } else {
    msg += `📋 *Mesaj înregistrat*\n`
    msg += `Contabilul tău va primi mesajul pentru procesare.\n`
  }

  msg += `\n🤖 Confidence AI: ${extracted.confidence}%`
  msg += `\n📧 Trimis la contabil automat.`

  return msg
}
