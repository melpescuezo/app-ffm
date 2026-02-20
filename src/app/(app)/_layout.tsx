import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { useLocaleContext } from 'fbtee';
import { Fragment } from 'react/jsx-runtime';

export default function TabLayout() {
  const { locale } = useLocaleContext();

  return (
    <Fragment key={locale}>
      <BottomSheetModalProvider>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              contentStyle: {
                backgroundColor: 'transparent',
              },
              headerShown: false,
            }}
          />
        </Stack>
      </BottomSheetModalProvider>
    </Fragment>
  );
}
