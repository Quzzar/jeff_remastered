import { Server as Engine } from '@socket.io/bun-engine';
import { Server } from 'socket.io';
import { handlePassiveListeningAudio } from './src/passiveListening';
import { createRealtimeToken, handleFunctionCalls } from './src/activeListening';

const io = new Server({
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

const engine = new Engine({
	path: '/socket.io/',
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

io.bind(engine);

io.on('connection', (socket) => {
	console.log('Client connected');

	socket.on('passive-listening', async (audioChunk: Buffer) => {
		console.log('Received passive audio', audioChunk.byteLength);

		const result = await handlePassiveListeningAudio(audioChunk);

		console.log('> Transcription:', result.transcription);
		if (result.activate) {
			console.log('>> Trigger word detected, entering active mode');
		}

		if (result.activate) {
			const realtimeToken = await createRealtimeToken();

			// Notify client that active mode is enabled
			socket.emit('active-mode', {
				enabled: true,
				startingText: result.transcription,
				realtimeToken,
			});
		}
	});

	socket.on('active-function-call', async (data: { name: string; args: Record<string, any> }) => {
		const success = await handleFunctionCalls(socket, data.name, data.args);
		console.log(`Function call "${data.name}":`, success ? 'succeeded ✅' : 'failed ❌');
	});

	socket.on('disconnect', () => {
		console.log('Client disconnected');
	});
});

export default {
	port: 3000,
	...engine.handler(),
	idleTimeout: 30,
};
