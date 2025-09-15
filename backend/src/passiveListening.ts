import { OpenAI } from 'openai';
import fs from 'fs';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const TRIGGER_WORDS = ['Hey Jeff', `up Jeff`, 'Okay Jeff', 'doing Jeff', 'Yo Jeff', 'man Jeff', 'Hi Jeff', 'brother Jeff'];

export async function handlePassiveListeningAudio(audioChunk: Buffer): Promise<{
	activate: boolean;
	transcription: string;
}> {
	try {
		fs.writeFileSync('temp_audio.wav', Buffer.from(audioChunk));

		const transcription = await openai.audio.transcriptions.create({
			file: fs.createReadStream('temp_audio.wav'),
			model: 'whisper-1',
			language: 'en',
			prompt: `Hey Jeff, What's up Jeff, Okay Jeff, How you doing Jeff, Yo Jeff, My man Jeff, Hi Jeff, My brother Jeff`,
		});

		const containsTriggerWord = TRIGGER_WORDS.some((tWord) => transcription.text.replace(/[^\w\s]+/g, '').includes(tWord));

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
