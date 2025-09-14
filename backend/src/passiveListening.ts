import { OpenAI } from 'openai';
import fs from 'fs';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const TRIGGER_WORDS = ['Jeff', 'Geoff'];

export async function handlePassiveListeningAudio(audioChunk: Buffer): Promise<{
	activate: boolean;
	transcription: string;
}> {
	try {
		fs.writeFileSync('temp_audio.wav', Buffer.from(audioChunk));

		const transcription = await openai.audio.transcriptions.create({
			file: fs.createReadStream('temp_audio.wav'),
			model: 'whisper-1',
		});

		const containsTriggerWord = TRIGGER_WORDS.some((word) => transcription.text.includes(word));

		return {
			activate: containsTriggerWord,
			transcription: transcription.text,
		};
	} catch (err) {
		console.error('Error transcribing audio:', err);

		return {
			activate: false,
			transcription: '',
		};
	}
}
