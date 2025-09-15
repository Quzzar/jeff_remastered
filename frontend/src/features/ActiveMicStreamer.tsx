import { Group, Text, Loader } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import yaml from 'js-yaml';

export default function ActiveMicStreamer(props: { realtimeToken: Record<string, any>; startingText: string; onPassiveMode: () => void }) {
	const isFirstRender = useRef(true);
	const socketRef = useRef<Socket>(null);

	// Establish socket connection
	useEffect(() => {
		socketRef.current = io(import.meta.env.VITE_API_URL, {
			reconnection: true,
			reconnectionAttempts: Infinity,
		});
		const socket = socketRef.current;

		// Push passive mode event to parent
		socket.on('active-mode', (data) => {
			if (!data.enabled) {
				props.onPassiveMode();
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

	// Start RTC convo
	useEffect(() => {
		// Only run once
		if (!isFirstRender.current) {
			return;
		} else {
			isFirstRender.current = false;
		}

		initPeerConnection(props.realtimeToken.value).then(async ({ audioEl, dc }) => {
			// Add audio element to DOM to hear responses
			document.body.appendChild(audioEl);

			dc.addEventListener('message', (e) => {
				const event = JSON.parse(e.data);
				console.log(event.type);

				if (event.type === 'response.function_call_arguments.done') {
					try {
						socketRef.current?.emit('active-function-call', {
							name: event.name,
							args: yaml.load(event.arguments),
						});
					} catch (err) {
						console.error('Error handling function call arguments done:', (err as any)?.message);

						// Tell Jeff we failed to handle the function call
						sendMessage(dc, `Bro, we failed to handle the function call: ${(err as any)?.message ?? 'Unknown error'}`);
					}
				}
			});

			console.log('Data channel created, waiting to open');
			dc.addEventListener('open', () => {
				console.log('Data channel opened, sending starting text');
				sendMessage(dc, props.startingText);
			});
		});
	}, [props.realtimeToken.value]);

	// After 20 minutes, end the session
	useEffect(() => {
		const timer = setTimeout(() => {
			props.onPassiveMode();
		}, 20 * 60 * 1000); // 20 minutes in ms
		return () => clearTimeout(timer);
	}, []);

	return (
		<Group wrap='nowrap' gap={5}>
			<Text fz='xs' c='dimmed' span>
				Conversing
			</Text>
			<Loader color='gray.6' size='xs' type='dots' />
		</Group>
	);
}

async function initPeerConnection(clientSecret: string) {
	// Create a peer connection
	const pc = new RTCPeerConnection();

	// Set up to play remote audio from the model
	const audioEl = document.createElement('audio');
	audioEl.autoplay = true;
	pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

	// Add local audio track for microphone input in the browser
	const ms = await navigator.mediaDevices.getUserMedia({
		audio: true,
	});
	pc.addTrack(ms.getTracks()[0]);

	// Set up data channel for sending and receiving events
	const dc = pc.createDataChannel('oai-events');

	// Start the session using the Session Description Protocol (SDP)
	const offer = await pc.createOffer();
	await pc.setLocalDescription(offer);

	const baseUrl = 'https://api.openai.com/v1/realtime/calls';
	const model = 'gpt-realtime';
	const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
		method: 'POST',
		body: offer.sdp,
		headers: {
			Authorization: `Bearer ${clientSecret}`,
			'Content-Type': 'application/sdp',
		},
	});

	const location = sdpResponse.headers.get('Location');

	const callId = location?.split('/').pop();

	const answer = {
		type: 'answer',
		sdp: await sdpResponse.text(),
	};
	await pc.setRemoteDescription(answer as RTCSessionDescriptionInit);

	return {
		audioEl,
		dc,
		callId,
	};
}

function sendMessage(dc: RTCDataChannel, text: string) {
	// Setup message
	dc.send(
		JSON.stringify({
			type: 'conversation.item.create',
			item: {
				type: 'message',
				role: 'user',
				content: [
					{
						type: 'input_text',
						text,
					},
				],
			},
		})
	);
	// Ask for audio response
	dc.send(
		JSON.stringify({
			type: 'response.create',
			response: {
				output_modalities: ['audio'],
			},
		})
	);
}
