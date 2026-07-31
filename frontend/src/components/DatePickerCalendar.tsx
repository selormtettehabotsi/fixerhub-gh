import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemedStyles } from '../context/ThemeContext';

/**
 * Month calendar for choosing a booking date.
 *
 * Written by hand rather than pulling in react-native-calendars or
 * @react-native-community/datetimepicker: it's ~120 lines, needs no install
 * step or Expo Go rebuild, and it picks up the app's light/dark palette
 * through useThemedStyles like every other screen. A native date dialog would
 * also look nothing like the rest of the booking flow.
 *
 * Past dates are rendered but disabled — showing them keeps the grid stable
 * and makes it obvious why they can't be tapped.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local-midnight Date — avoids the UTC shift that `new Date('YYYY-MM-DD')` causes. */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

interface Props {
  /** Currently chosen date, or null when the booking is ASAP. */
  value: Date | null;
  onChange: (date: Date) => void;
  /** How far ahead a booking may be made. Default 90 days. */
  maxDaysAhead?: number;
}

export default function DatePickerCalendar({ value, onChange, maxDaysAhead = 90 }: Props) {
  const styles = useThemedStyles(makeStyles);

  const today = useMemo(() => atMidnight(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxDaysAhead);
    return d;
  }, [today, maxDaysAhead]);

  // Which month the grid is showing — starts on the selected date's month.
  const [cursor, setCursor] = useState<Date>(
    () => new Date((value ?? today).getFullYear(), (value ?? today).getMonth(), 1),
  );

  const canGoBack = cursor > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoForward = cursor < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    // Leading nulls pad the first row so the 1st lands under the right weekday.
    const out: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    return out;
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => canGoBack && shiftMonth(-1)}
          disabled={!canGoBack}
          hitSlop={10}
          style={styles.navBtn}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoBack ? Colors.onSurface : Colors.outlineVariant}
          />
        </TouchableOpacity>

        <Text style={styles.monthLabel}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </Text>

        <TouchableOpacity
          onPress={() => canGoForward && shiftMonth(1)}
          disabled={!canGoForward}
          hitSlop={10}
          style={styles.navBtn}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={canGoForward ? Colors.onSurface : Colors.outlineVariant}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`pad-${i}`} style={styles.cell} />;

          const disabled = date < today || date > maxDate;
          const selected = sameDay(date, value);
          const isToday = sameDay(date, today);

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={styles.cell}
              onPress={() => !disabled && onChange(date)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
            >
              <View style={[styles.day, selected && styles.daySelected]}>
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayTextDisabled,
                    isToday && !selected && styles.dayTextToday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_600SemiBold' },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: Colors.outline,
    fontFamily: 'Inter_600SemiBold',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 7 columns; aspectRatio keeps cells square without measuring the container.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_400Regular' },
  dayTextDisabled: { color: Colors.outlineVariant },
  dayTextToday: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  dayTextSelected: { color: Colors.onPrimary, fontFamily: 'Inter_600SemiBold' },
});
