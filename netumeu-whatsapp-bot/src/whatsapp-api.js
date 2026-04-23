import axios from 'axios'

const API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

// ─── Trimite mesaj text pe WhatsApp ───
export async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `${BASE_URL}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (err) {
    console.error('❌ Eroare trimitere mesaj WA:', err.response?.data || err.message)
  }
}

// ─── Trimite reacție emoji pe un mesaj ───
export async function sendWhatsAppReaction(to, messageId, emoji) {
  try {
    await axios.post(
      `${BASE_URL}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'reaction',
        reaction: { message_id: messageId, emoji }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (err) {
    // Reactions pot eșua silențios — nu e critic
    console.warn('⚠️ Reacție WA eșuată:', err.response?.data?.error?.message || err.message)
  }
}

// ─── Descarcă media (audio/imagine) de pe serverele WhatsApp ───
export async function downloadMedia(mediaId) {
  try {
    // Pas 1: Obține URL-ul real al fișierului
    const metaRes = await axios.get(
      `${BASE_URL}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` }
      }
    )
    const mediaUrl = metaRes.data.url

    // Pas 2: Descarcă fișierul binar
    const fileRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` },
      responseType: 'arraybuffer'
    })

    return Buffer.from(fileRes.data)
  } catch (err) {
    console.error('❌ Eroare download media:', err.response?.data || err.message)
    throw new Error('Nu am putut descărca fișierul audio')
  }
}
