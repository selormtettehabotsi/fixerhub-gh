import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { cloudinaryThumb } from '../utils/imageUrl';

interface AvatarProps {
  /** Cloudinary / remote URL — renders as Image */
  uri?: string | null;
  /** Display name — used to generate initials fallback */
  name: string;
  /** Diameter in pixels (default 44) */
  size?: number;
}

function getInitials(name: string): string {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((n) => (n[0] ?? '').toUpperCase())
    .join('');
}

/**
 * Displays a profile picture if `uri` is a valid https URL,
 * otherwise shows the first two initials of `name` on a primary-coloured circle.
 */
export default function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const radius = size / 2;
  const fontSize = Math.round(size * 0.36);

  if (uri && uri.startsWith('http')) {
    return (
      <Image
        source={{ uri: cloudinaryThumb(uri, size) }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.text, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
});
