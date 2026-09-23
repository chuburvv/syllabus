import * as vits from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web/+esm';

const VOICE_ID = 'ru_RU-irina-medium';

async function isReady() {
  try {
    const stored = await vits.stored();
    return stored.includes(VOICE_ID);
  } catch (e) {
    return false;
  }
}

async function download(onProgress) {
  await vits.download(VOICE_ID, onProgress);
}

async function synthesize(text) {
  const wav = await vits.predict({ text, voiceId: VOICE_ID });
  return URL.createObjectURL(wav);
}

window.aiVoice = { isReady, download, synthesize, VOICE_ID };
window.dispatchEvent(new CustomEvent('ai-voice-ready'));
