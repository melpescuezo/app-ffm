import { type IconProps } from '@expo/vector-icons/build/createIconSet.js';
import _MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons.js';
import * as Linking from 'expo-linking';
import { Stack as ExpoStack } from 'expo-router';
import { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COMPANY_NAME = 'TODO FM S.L.';
const COMPANY_EMAIL = 'Info@todofm.com';

const MaterialCommunityIcons = _MaterialCommunityIcons as unknown as FC<IconProps<string>>;

const openUrl = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
};

export default function ContactoScreen() {
  return (
    <>
      <ExpoStack.Screen options={{ headerShown: false, title: 'Contacto' }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Frecuencia FM</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void openUrl('https://www.instagram.com/frecuenciafm95.5murcia')}
              style={styles.actionButton}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons color="#ff1616" name="instagram" size={28} />
              </View>
              <Text style={styles.actionLabel}>Siguenos en Instagram</Text>
            </Pressable>

            <Pressable
              onPress={() => void openUrl('https://wa.me/34673718593')}
              style={styles.actionButton}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons color="#ff1616" name="whatsapp" size={28} />
              </View>
              <Text style={styles.actionLabel}>Envíanos un whatsapp</Text>
            </Pressable>
          </View>

          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Desarrollado por:</Text>
            <Text style={styles.contactLine}>{COMPANY_NAME}</Text>
            <Pressable onPress={() => void openUrl(`mailto:${COMPANY_EMAIL}`)}>
              <Text style={styles.contactLine}>{COMPANY_EMAIL}</Text>
            </Pressable>
            <Text style={styles.contactLine}>Apasionados de la radio 📻</Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 22,
  },
  title: {
    color: '#e8e8e8',
    fontSize: 44,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    marginTop: 54,
    gap: 20,
  },
  actionButton: {
    backgroundColor: '#0000fe',
    borderRadius: 999,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '600',
    flexShrink: 1,
  },
  contactCard: {
    marginTop: 'auto',
    marginBottom: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
    alignSelf: 'center',
    width: '88%',
  },
  contactTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  contactLine: {
    color: '#d8d8d8',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});
