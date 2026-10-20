import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

type Props = {
  images: ImageSourcePropType[];
  /** Section label shown on the bottom of the photo. */
  title?: string;
  /** How long each slide stays before auto-advancing. */
  intervalMs?: number;
  height?: number;
};

/**
 * Auto-playing banner carousel: slides to the next photo every few seconds
 * in an endless loop with a soft eased slide. An optional title chip sits
 * on the bottom of the photo.
 */
export default function UpcomingCarousel({
  images,
  title,
  intervalMs = 2600,
  height = 190,
}: Props) {
  const COLORS = useColors();
  const styles = useStyles();

  const anim = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [next, setNext] = useState(0);
  const [width, setWidth] = useState(0);

  const count = images.length;
  const activeDot = index % Math.max(1, count);

  const goTo = (target: number) => {
    if (animating.current || width === 0 || target === indexRef.current) return;
    animating.current = true;
    setNext(target);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        indexRef.current = target;
        setIndex(target);
      } else {
        anim.setValue(0);
      }
      animating.current = false;
    });
  };

  // Reset the slide offset only after the new base slide has committed, so
  // there is never a visible jump between frames.
  useEffect(() => {
    anim.setValue(0);
  }, [index, anim]);

  useEffect(() => {
    if (count < 2 || width === 0) return;
    const id = setInterval(() => {
      goTo((indexRef.current + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, intervalMs, width]);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  if (count === 0 || width === 0) {
    return <View style={[styles.card, { height }]} onLayout={onLayout} />;
  }

  const incoming = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  });

  return (
    <View>
      <View style={[styles.card, { height }]} onLayout={onLayout}>
        <Image
          source={images[index % count]}
          style={[styles.image, { width, height }]}
          resizeMode="cover"
        />
        <Animated.View style={[styles.incoming, { transform: [{ translateX: incoming }] }]}>
          <Image
            source={images[next % count]}
            style={[styles.image, { width, height }]}
            resizeMode="cover"
          />
        </Animated.View>

        <View style={styles.dots} pointerEvents="box-none">
          {images.map((_, i) => {
            const active = i === activeDot;
            return (
              <Pressable
                key={i}
                hitSlop={8}
                onPress={() => goTo(i)}
                accessibilityLabel={`Slide ${i + 1}`}
              >
                <View
                  style={[
                    styles.dot,
                    active && styles.dotActive,
                    active && { backgroundColor: COLORS.primary },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {title ? (
        <View style={styles.titleRow} pointerEvents="none">
          <Text style={styles.titleText}>{title}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      backgroundColor: COLORS.surface,
    },
    image: {
      borderRadius: RADIUS.xl - 1,
    },
    incoming: {
      ...StyleSheet.absoluteFillObject,
    },
    titleRow: {
      marginTop: SPACING.md,
      alignItems: 'flex-start',
    },
    titleText: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    dots: {
      position: 'absolute',
      top: SPACING.md,
      right: SPACING.md,
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.55)',
      borderWidth: 0.5,
      borderColor: 'rgba(4, 8, 22, 0.35)',
    },
    dotActive: {
      width: 20,
      borderRadius: 4,
    },
  })
);
