import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';

export default function AffiliateCard({
  title,
  subtitle,
  items = [],
  buttonLabel,
  url,
  accentColor = '#E8630A',
  testID,
}) {
  const { colors, isDark } = useTheme();
  const [opening, setOpening] = useState(false);

  const handlePress = async () => {
    if (!url || opening) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpening(true);

    try {
      const canOpen = typeof Linking.canOpenURL === 'function'
        ? await Linking.canOpenURL(url)
        : true;

      if (!canOpen) {
        console.warn('Could not open affiliate URL:', url);
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.warn('Could not open affiliate URL:', error);
    } finally {
      setOpening(false);
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#171717' : colors.card,
          borderColor: isDark ? '#2A2A2A' : colors.border,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.charcoal }]}>{subtitle}</Text>

      {items.length > 0 && (
        <View style={styles.itemsWrap}>
          {items.map((item, index) => (
            <View
              key={`${item.label}-${index}`}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isDark ? '#101010' : colors.chalk,
                  borderColor: isDark ? '#222222' : colors.border,
                },
              ]}
            >
              <Text style={[styles.itemLabel, { color: colors.ink }]}>{item.label}</Text>
              {item.meta ? (
                <Text style={[styles.itemMeta, { color: colors.charcoal }]}>{item.meta}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: accentColor }, opening && styles.buttonDisabled]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={opening}
        testID={testID ? `${testID}-button` : undefined}
      >
        <Text style={styles.buttonText}>{opening ? 'Opening...' : buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 12,
  },
  accentBar: {
    width: 34,
    height: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  itemsWrap: {
    gap: 8,
    marginBottom: 16,
  },
  itemRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
