import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { makeStyles } from '@/lib/theme';

type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: number;
};

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, uri, size = 48 }: AvatarProps) {
  const styles = useStyles();
  const radius = size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.infoSoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.info,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  })
);
