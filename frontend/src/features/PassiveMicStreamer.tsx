import { Group, Text, Loader } from '@mantine/core';
import { usePrevious, useThrottledState } from '@mantine/hooks';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function PassiveMicStreamer(props: { onActiveMode: (realtimeToken: Record<string, any>, startingText: string) => void }) {
	const socketRef = useRef<Socket>(null);

	const [jeffState, setJeffState] = useThrottledState<'idle' | 'listening' | 'speaking'>('idle', 800);
	const previousJeffState = usePrevious(jeffState);

	// Detecting when user is speaking
	const firstMissingAudioChunkRef = useRef<Blob | null>(null);
	useEffect(() => {
		async function init() {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					noiseSuppression: true,
					echoCancellation: true,
					autoGainControl: true,
				},
			});
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});

			// --- Sound detection setup ---
			const audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(stream);
			const analyser = audioCtx.createAnalyser();
			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			source.connect(analyser);

			let isSpeaking = false;

			// Start recording in background
			mediaRecorder.start(250);

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0 && firstMissingAudioChunkRef.current === null) {
					firstMissingAudioChunkRef.current = event.data;
				}
			};

			// Loop to detect sound level
			const detect = () => {
				analyser.getByteFrequencyData(dataArray);
				const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

				// tweak threshold depending on mic sensitivity

				isSpeaking = avg > 15;

				if (isSpeaking) {
					setJeffState('listening');
				} else {
					setJeffState('idle');
				}

				requestAnimationFrame(detect);
			};

			detect();
		}

		init();
	}, []);

	// Reading in the user's mic and sending to server
	const captureAudioMediaRecorderRef = useRef<MediaRecorder | null>(null);
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

		async function init() {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					noiseSuppression: true,
					echoCancellation: true,
					autoGainControl: true,
				},
			});
			captureAudioMediaRecorderRef.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			let audioChunks: Blob[] = [];

			// --- Sound detection setup ---
			const audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(stream);
			const analyser = audioCtx.createAnalyser();
			source.connect(analyser);

			captureAudioMediaRecorderRef.current.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunks.push(event.data);
			};

			captureAudioMediaRecorderRef.current.onstop = async () => {
				// TODO: handle firstMissingAudioChunkRef to avoid gaps in audio
				const fullBlob = new Blob(audioChunks, { type: 'audio/webm' });
				const arrayBuffer = await fullBlob.arrayBuffer();
				console.log('Stopping recording, audio chunk:', arrayBuffer.byteLength);

				if (arrayBuffer.byteLength < 6000) {
					console.warn('[Audio chunk too small, ignoring]');
				} else if (arrayBuffer.byteLength > 60000) {
					console.warn('[Audio chunk too large, ignoring]');
				} else {
					socket.emit('passive-listening', arrayBuffer);
				}

				firstMissingAudioChunkRef.current = null;
				audioChunks = [];
			};
		}

		init();

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

	useEffect(() => {
		if (previousJeffState === 'listening' && jeffState === 'idle') {
			captureAudioMediaRecorderRef.current?.stop();
		}
		if (previousJeffState === 'idle' && jeffState === 'listening') {
			console.log('Starting recording');
			console.log('...');
			captureAudioMediaRecorderRef.current?.start();
		}
	}, [jeffState]);

	return (
		<>
			{jeffState === 'idle' && (
				<Group wrap='nowrap' gap={5}>
					<Text fz='xs' c='dimmed' span>
						Idle
					</Text>
				</Group>
			)}
			{jeffState === 'listening' && (
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
