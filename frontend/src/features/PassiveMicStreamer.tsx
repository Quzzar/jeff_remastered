import { Group, Text, Loader } from '@mantine/core';
import { useMicVAD } from '@ricky0123/vad-react';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function PassiveMicStreamer(props: { onActiveMode: (realtimeToken: Record<string, any>, startingText: string) => void }) {
	const socketRef = useRef<Socket>(null);

	// Establish socket connection
	useEffect(() => {
		socketRef.current = io(import.meta.env.VITE_API_URL, {
			reconnection: true,
			reconnectionAttempts: Infinity,
		});
		const socket = socketRef.current;

		// Push active mode event to parent
		socket.on('active-mode', (data) => {
			if (data.enabled) {
				props.onActiveMode(data.realtimeToken, data.startingText);
			}
		});

		// Attempt to keep connection alive
		socket.on('connect', () => console.log('Connected'));
		socket.on('disconnect', () => console.log('Disconnected'));

		// Reconnect when tab becomes active
		const handleVisibility = () => {
			if (document.visibilityState === 'visible' && !socket.connected) {
				console.log('Tab active — reconnecting...');
				socket.connect();
			}
		};

		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
			socket.disconnect();
		};
	}, []);

	// Start speech detection
	const vad = useMicVAD({
		onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
		baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.27/dist/',
		model: 'v5',
		onSpeechStart: () => {
			console.log('[Speech start ...');
		},
		onSpeechEnd: async (audio) => {
			const wavBlob = float32ToWavBlob(audio, 16000);
			const arrayBuffer = await wavBlob.arrayBuffer();

			console.log(`— ${arrayBuffer.byteLength.toLocaleString()} bytes —`);

			if (arrayBuffer.byteLength > 200000) {
				console.log('⚠️ Audio too long, skipping]');
			} else {
				console.log('... Sending audio]');
				socketRef.current?.emit('passive-listening', arrayBuffer);
			}
		},
	});

	return (
		<>
			{!vad.userSpeaking && (
				<Group wrap='nowrap' gap={5}>
					<Text fz='xs' c='dimmed' span>
						Idle
					</Text>
				</Group>
			)}
			{vad.userSpeaking && (
				<Group wrap='nowrap' gap={5}>
					<Text fz='xs' c='dimmed' span>
						Listening
					</Text>
					<Loader color='gray.6' size='xs' type='dots' />
				</Group>
			)}
		</>
	);
}

function float32ToWavBlob(float32Array: Float32Array, sampleRate = 16000): Blob {
	const bufferLength = float32Array.length * 2; // 16-bit PCM
	const buffer = new ArrayBuffer(44 + bufferLength);
	const view = new DataView(buffer);

	function writeString(view: DataView, offset: number, str: string) {
		for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
	}

	// WAV header
	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + bufferLength, true);
	writeString(view, 8, 'WAVE');
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // PCM chunk size
	view.setUint16(20, 1, true); // PCM format
	view.setUint16(22, 1, true); // channels
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byte rate
	view.setUint16(32, 2, true); // block align
	view.setUint16(34, 16, true); // bits per sample
	writeString(view, 36, 'data');
	view.setUint32(40, bufferLength, true);

	// PCM samples
	let offset = 44;
	for (let i = 0; i < float32Array.length; i++, offset += 2) {
		let s = Math.max(-1, Math.min(1, float32Array[i]));
		view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}

	return new Blob([view], { type: 'audio/wav' });
}
