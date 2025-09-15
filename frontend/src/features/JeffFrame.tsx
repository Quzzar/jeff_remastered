import '@mantine/core/styles.css';
import { Badge, Box, Card, Group, Image, Text } from '@mantine/core';
import classes from '../css/FeaturesCard.module.css';
import Jeff from '../assets/jeff.png';
import { useState } from 'react';
import PassiveMicStreamer from './PassiveMicStreamer';
import ActiveMicStreamer from './ActiveMicStreamer';
import { sleep } from '../common/utils/general';

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
					<Group justify='space-between' wrap='nowrap'>
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
									onPassiveMode={async () => {
										// Let him finish speaking
										await sleep(2000);

										setMode({ state: 'passive' });
										// Reload the webpage to reset everything
										// (fixes issues with RTC convo staying open)
										window.location.reload();
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
