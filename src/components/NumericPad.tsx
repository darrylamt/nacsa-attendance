import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useColors, radius, font, spacing } from '../theme/colors';

interface NumericPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export function NumericPad({ value, onChange, maxLength = 6 }: NumericPadProps) {
  const colors = useColors();

  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === '') {
      return;
    } else if (value.length < maxLength) {
      onChange(value + key);
    }
  };

  return (
    <View style={styles.container}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <TouchableOpacity
              key={ki}
              style={[
                styles.key,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                key === '' && styles.keyEmpty,
              ]}
              onPress={() => handleKey(key)}
              activeOpacity={key === '' ? 1 : 0.6}
              disabled={key === ''}
            >
              <Text
                style={[
                  styles.keyText,
                  { color: colors.text },
                  key === '⌫' && { color: colors.textSecondary, fontSize: font.lg },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const KEY_SIZE = 80;

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontSize: font.xl,
    fontWeight: '300',
  },
});
