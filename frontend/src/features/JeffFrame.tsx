import '@mantine/core/styles.css';
import { Badge, Box, Card, Group, Image, Text } from '@mantine/core';
import classes from '../css/FeaturesCard.module.css';
import Jeff from '../assets/jeff.png';
import { useState } from 'react';
import PassiveMicStreamer from './PassiveMicStreamer';
import ActiveMicStreamer from './ActiveMicStreamer';

export default function JeffFrame() {
	const [mode, setMode] = useState<
		| {
				state: 'passive';
		  }
		| {
				state: 'active';
				realtimeToken: Record<string, any>;
				startingText: string;
		  }
	>({
		state: 'passive',
	});

	return (
		<Box>
			<Card withBorder radius='md' className={classes.card}>
				<Card.Section className={classes.imageSection}>
					<Image src={Jeff} alt='Jeff' />
				</Card.Section>

				<Card.Section className={classes.section}>
					<Group justify='space-between'>
						<div>
							<Text fw={500} fz='h4'>
								Jeff{' '}
								<Text fw={300} fz='h5' fs='italic' span>
									— the man, the legend
								</Text>
							</Text>
							{mode.state === 'passive' && (
								<PassiveMicStreamer
									onActiveMode={(realtimeToken, startingText) => {
										setMode({
											state: 'active',
											realtimeToken,
											startingText,
										});
									}}
								/>
							)}
							{mode.state === 'active' && (
								<ActiveMicStreamer
									realtimeToken={mode.realtimeToken}
									startingText={mode.startingText}
									onPassiveMode={() => {
										setMode({ state: 'passive' });
									}}
								/>
							)}
						</div>
						<Badge variant='outline'>{mode.state}</Badge>
					</Group>
				</Card.Section>
			</Card>
		</Box>
	);
}
