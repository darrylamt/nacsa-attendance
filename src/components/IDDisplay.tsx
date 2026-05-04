import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useColors, radius, font, spacing } from '../theme/colors';

interface IDDisplayProps {
  value: string;
  length?: number;
}

function CursorCell({ colors }: { colors: ReturnType<typeof useColors> }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.cursor, { backgroundColor: colors.accent, opacity }]} />
  );
}

export function IDDisplay({ value, length = 7 }: IDDisplayProps) {
  const colors = useColors();
  const digits = value.split('');

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const filled  = i < digits.length;
        const active  = i === digits.length; // next cell to fill

        return (
          <View
            key={i}
            style={[
              styles.cell,
              {
                backgroundColor: filled ? colors.accentDim : colors.surface,
                borderColor:     filled ? colors.accent : active ? colors.accent : colors.border,
                borderWidth:     active ? 2 : 1.5,
                shadowColor:     filled ? colors.accent : 'transparent',
              },
            ]}
          >
            {filled ? (
              <Text style={[styles.digit, { color: colors.text }]}>{digits[i]}</Text>
            ) : active ? (
              <CursorCell colors={colors} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm - 2,
  },
  cell: {
    width: CELL,
    height: CELL + 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  digit: {
    fontSize: font.xl,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  cursor: {
    width: 2,
    height: 22,
    borderRadius: 2,
  },
});
