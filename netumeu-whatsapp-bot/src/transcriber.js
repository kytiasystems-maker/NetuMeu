import axios from 'axios'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

// ─── Transcriere audio ───
// Strategie: 
//   1. Convertim OGG (format WhatsApp) în WAV cu ffmpeg
//   2. Trimitem la Google Speech-to-Text (gratuit 60 min/lună)
//   3. Dacă Google nu merge, facem fallback pe Whisper (când vrei upgrade)

export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  const id = randomUUID()
  const inputPath = `/tmp/netumeu_${id}.ogg`
  const wavPath = `/tmp/netumeu_${id}.wav`

  try {
    // Salvează audio-ul brut
    writeFileSync(inputPath, audioBuffer)

    // Convertim în WAV 16kHz mono (necesar pentru Speech-to-Text)
    await convertToWav(inputPath, wavPath)

    // Citim WAV-ul convertit
    const wavBuffer = readFileSync(wavPath)
    const audioBase64 = wavBuffer.toString('base64')

    // Încercare 1: Google Speech-to-Text (gratuit, 60 min/lună)
    try {
      const transcript = await googleSpeechToText(audioBase64)
      if (transcript && transcript.length > 2) return transcript
    } catch (err) {
      console.warn('⚠️ Google STT eșuat:', err.message)
    }

    // Fallback: returnează mesaj de eroare
    console.warn('⚠️ Transcriere eșuată — returnez fallback')
    return '[Transcriere audio eșuată — contabilul va primi fișierul audio original]'

  } finally {
    // Cleanup
    try { if (existsSync(inputPath)) unlinkSync(inputPath) } catch {}
    try { if (existsSync(wavPath)) unlinkSync(wavPath) } catch {}
  }
}

// ─── Conversie OGG → WAV cu ffmpeg ───
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i ${inputPath} -ar 16000 -ac 1 -f wav ${outputPath} -y 2>/dev/null`
    exec(cmd, (err) => {
      if (err) reject(new Error('ffmpeg conversie eșuată: ' + err.message))
      else resolve()
    })
  })
}

// ─── Google Speech-to-Text (free tier: 60 min/lună) ───
// Folosește REST API fără API key (limitat dar gratuit)
// Pentru producție: activează Cloud Speech API + API key
async function googleSpeechToText(audioBase64) {
  // Notă: Varianta gratuită fără API key nu există oficial.
  // Trebuie un API key de la Google Cloud (free tier = 60 min/lună).
  // Dacă nu ai setat GOOGLE_SPEECH_API_KEY, folosim fallback.

  const apiKey = process.env.GOOGLE_SPEECH_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_SPEECH_API_KEY nu e setat — folosește fallback')
  }

  const res = await axios.post(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'ro-RO',
        model: 'default',
        enableAutomaticPunctuation: true,
      },
      audio: {
        content: audioBase64
      }
    },
    { timeout: 30000 }
  )

  const results = res.data.results
  if (!results || results.length === 0) return ''

  return results.map(r => r.alternatives[0].transcript).join(' ')
}

// ═══════════════════════════════════════════════
// UPGRADE PATH: Whisper API (când vrei calitate maximă)
// Decomentează funcția de mai jos și setează OPENAI_API_KEY
// Cost: ~$0.006/minut = ~3 lei/oră
// ═══════════════════════════════════════════════
//
// async function whisperTranscribe(audioBuffer) {
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
