import axios from 'axios'

// ═══════════════════════════════════════════════
// Transcriere audio — Google Speech-to-Text
// Trimite OGG_OPUS direct (formatul nativ WhatsApp)
// NU mai necesită ffmpeg!
// Free tier: 60 minute/lună gratuit
// ═══════════════════════════════════════════════

export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  const audioBase64 = audioBuffer.toString('base64')

  // Google Speech-to-Text (gratuit 60 min/lună)
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY
  if (!apiKey) {
    console.warn('⚠️ GOOGLE_SPEECH_API_KEY nu e setat')
    return '[Transcriere indisponibilă — lipsește API key]'
  }

  try {
    const res = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        config: {
          encoding: 'OGG_OPUS',
          sampleRateHertz: 16000,
          languageCode: 'ro-RO',
          enableAutomaticPunctuation: true,
          model: 'default',
        },
        audio: {
          content: audioBase64
        }
      },
      { timeout: 30000 }
    )

    const results = res.data.results
    if (!results || results.length === 0) {
      console.warn('⚠️ Google STT: niciun rezultat returnat')
      return '[Nu s-a putut transcrie — audio prea scurt sau neclar]'
    }

    const transcript = results.map(r => r.alternatives[0].transcript).join(' ')
    console.log(`✅ Transcris: "${transcript}"`)
    return transcript

  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message
    console.error('❌ Google STT eroare:', errMsg)
    return `[Eroare transcriere: ${errMsg}]`
  }
}

// ═══════════════════════════════════════════════
// UPGRADE: Whisper API (calitate superioară)
// Decomentează și setează OPENAI_API_KEY
// Cost: ~$0.006/min
// ═══════════════════════════════════════════════
//
// export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
//   const FormData = (await import('form-data')).default
//   const form = new FormData()
//   form.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' })
//   form.append('model', 'whisper-1')
//   form.append('language', 'ro')
//
//   const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
//     headers: {
//       ...form.getHeaders(),
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//     timeout: 60000,
//   })
//   return res.data.text
// }
