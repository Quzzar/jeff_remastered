import type { Socket } from 'socket.io';
import { spawn } from 'bun';

//
export async function createRealtimeToken() {
	const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
		method: 'POST',
		headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			session: {
				type: 'realtime',
				model: 'gpt-realtime-2025-08-28',
				prompt: { id: 'pmpt_68c57cfaa4e08196abcfbf5b714c7266030eb471be900ed6' },
			},
		}),
	});
	return await response.json();
}

//

interface ChangeLightsArgs {
	action: 'turn_on' | 'turn_off' | 'dim_light' | 'brighten_light' | 'color_light';
	type: 'bedroom' | 'living_room' | 'vine' | 'fox';
	metadata?: {
		amount?: string; // for dim_light and brighten_light
		color?: string; // for color_light
	};
}

interface FireplaceArgs {
	action: 'turn_on' | 'turn_off';
	type: 'fireplace';
}

export async function handleFunctionCalls(socket: Socket, name: string, unknownArgs: Record<string, any>): Promise<boolean> {
	console.log(`Handling function call: "${name}" with args:`, unknownArgs);

	if (name === 'turn_off_self') {
		socket.emit('active-mode', {
			enabled: false,
		});

		return true;
	}

	if (name === 'change_lights') {
		const args = unknownArgs as ChangeLightsArgs;
		if (args.action === 'turn_on' || args.action === 'turn_off') {
			const lightIds = getLightIds(args.type);
			for (const lightId of lightIds) {
				activateLight(args.action === 'turn_on', lightId);
			}
			return true;
		}

		if ((args.action === 'dim_light' || args.action === 'brighten_light') && args.metadata?.amount) {
			const lightIds = getLightIds(args.type);
			for (const lightId of lightIds) {
				adjustLight(args.metadata.amount, lightId);
			}
			return true;
		}

		if (args.action === 'color_light' && args.metadata?.color) {
			const lightIds = getLightIds(args.type);
			const gamut = await convertColorToGamut(args.metadata.color);
			for (const lightId of lightIds) {
				colorLight(gamut, lightId);
			}
			return true;
		}
	}

	if (name === 'control_fireplace') {
		const args = unknownArgs as FireplaceArgs;
		if (args.action === 'turn_on' || args.action === 'turn_off') {
			activateLight(args.action === 'turn_on', process.env.HUE_FIREPLACE_LIGHT_ID!);
			return true;
		}
	}

	console.warn(`Unknown function call or invalid arguments: ${name}`, unknownArgs);

	return false;
}

function getLightIds(name: string): string[] {
	if (name.includes('bedroom')) {
		return [process.env.HUE_BEDROOM_LIGHT_1_ID!, process.env.HUE_BEDROOM_LIGHT_2_ID!];
	}
	if (name.includes('fire')) {
		return [process.env.HUE_FIREPLACE_LIGHT_ID!];
	}
	if (name.includes('vine')) {
		return [process.env.HUE_VINE_LIGHT_ID!];
	}
	if (name.includes('fox')) {
		return [process.env.HUE_FOX_LIGHT_ID!];
	}
	if (name.includes('living')) {
		return [process.env.HUE_LIVING_ROOM_LIGHT_ID!];
	}

	return [];
}

async function colorLight(
	gamut: {
		x: number;
		y: number;
	},
	lightId: string
) {
	return fetchHue(`resource/light/${lightId}`, 'PUT', {
		color: {
			xy: gamut,
		},
	});
}

async function adjustLight(dimness: string, lightId: string) {
	return fetchHue(`resource/light/${lightId}`, 'PUT', {
		dimming: {
			brightness: parseInt(dimness),
		},
	});
}

async function activateLight(enabled: boolean, lightId: string) {
	return fetchHue(`resource/light/${lightId}`, 'PUT', {
		on: {
			on: enabled,
		},
	});
}

async function fetchHue(endpoint: string, method: string, body: Record<string, any>) {
	try {
		await fetch(`https://${process.env.HUE_BRIDGE_IP}/clip/v2/${endpoint}`, {
			method: method,
			headers: {
				'Content-Type': 'application/json',
				'hue-application-key': process.env.HUE_APP_KEY ?? '',
			},
			body: JSON.stringify(body),
		});
	} catch (e) {
		// Fallback to curl for now because Bun's fetch has issues with no certs
		spawn([
			'curl',
			'-k',
			'-X',
			'PUT',
			`https://${process.env.HUE_BRIDGE_IP}/clip/v2/${endpoint}`,
			'-H',
			`hue-application-key: ${process.env.HUE_APP_KEY}`,
			'-H',
			'Content-Type: application/json',
			'-d',
			JSON.stringify(body),
		]);
	}

	return true;
}

async function convertColorToGamut(color: string) {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			model: 'gpt-4.1',
			messages: [
				{
					role: 'user',
					content: `
I'm going to give you a description of a color and you need to respond only with roughly that color in gamut C coords in JSON format.

## Examples:
Input: bluish green
Output: {"x": "0.245", "y": "0.401"}

Input: red
Output: {"x": "0.640", "y": "0.330"}

Input: warm room light
Output: {"x": "0.4994", "y": "0.4153"}


Input: ${color}
      `.trim(),
				},
			],
		}),
	});
	const response = (await res.json()) as Record<string, any>;

	if (!response.error) {
		try {
			const result = JSON.parse(response.choices[0].message.content);
			if (Array.isArray(result)) {
				// Average the colors
				const x = result.reduce((acc, c) => acc + c.x, 0) / result.length;
				const y = result.reduce((acc, c) => acc + c.y, 0) / result.length;
				return { x, y };
			} else {
				return { x: parseFloat(result.x), y: parseFloat(result.y) };
			}
		} catch (e) {
			console.error('Failed to parse color response:', color, e);
		}
	}
	return { x: 0.4994, y: 0.4153 };
}
