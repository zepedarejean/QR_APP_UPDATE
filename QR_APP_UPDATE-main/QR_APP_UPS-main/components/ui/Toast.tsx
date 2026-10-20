import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
  key: number;
};

type ToastContextValue = {
  show: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const config: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: 'checkmark-circle', color: COLORS.success },
  error: { icon: 'alert-circle', color: COLORS.danger },
  info: { icon: 'information-circle', color: COLORS.info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type, key: Date.now() });
      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(hide, 3200);
    },
    [hide, opacity, translateY]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const c = toast ? config[toast.type] : config.info;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { top: insets.top + 8, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable style={styles.toast} onPress={hide}>
            <Ionicons name={c.icon} size={20} color={c.color} />
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 460,
    width: '100%',
    ...SHADOW.floating,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
