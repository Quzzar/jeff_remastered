import '@mantine/core/styles.css';
import { Box, MantineProvider, Center } from '@mantine/core';
import { theme } from './theme';
import JeffFrame from './features/JeffFrame';

export default function App() {
	return (
		<MantineProvider theme={theme} defaultColorScheme='dark'>
			<Center>
				<Box
					style={{
						maxWidth: 'min(95dvw, 500px)',
						maxHeight: '95dvh',
						paddingTop: '5dvh',
					}}
				>
					<JeffFrame />
				</Box>
			</Center>
		</MantineProvider>
	);
}
