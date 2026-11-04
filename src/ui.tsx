// Component kit moved from storybook/ui.tsx. The reference screens and the live app share it.
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  calories: '#6297ff', protein: '#ff997d', fat: '#f4cb72', carbs: '#77c7a3',
  expenditure: '#ff7959', weight: '#9174ff',
};
export const palettes = {
  light: { background: '#f5f5f5', surface: '#ffffff', text: '#101010', muted: '#666666',
    field: '#eaeaea', border: '#dedede', inverse: '#ffffff', danger: '#c4231c', warning: '#8a5a00' },
  dark: { background: '#121212', surface: '#202020', text: '#f8f8f8', muted: '#b1b1b1',
    field: '#363636', border: '#3c3c3c', inverse: '#111111', danger: '#ff8178', warning: '#f4cb72' },
};
const Palette = createContext(palettes.light);

/** Storybook's reference studies set this to draw a phone outline and simulated system chrome. */
export const DeviceFrame = createContext(false);

/** Returns the current screen's sampled light or dark palette. */
export function usePalette() { return useContext(Palette); }

/** Native text using the reference palette and system font, not a bundled proprietary font. */
export function Label({ children, size = 14, muted = false, weight = '400', style, ...text }: TextProps & {
  children: ReactNode; size?: number; muted?: boolean; weight?: TextStyle['fontWeight'];
}) {
  const p = usePalette();
  return <Text style={[{ color: muted ? p.muted : p.text, fontSize: size,
    fontWeight: weight, lineHeight: size * 1.35 }, style]} {...text}>{children}</Text>;
}

/** Horizontal layout shared by the observed screen compositions. */
export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Rounded inset surface; callers own its content and spacing. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface }, style]}>{children}</View>;
}

/** Buttons without a callback are explicitly disabled reference-only controls. */
export function Button({ children, onPress, primary = false, danger = false, label, hint, disabled = false, style }: {
  children: ReactNode; onPress?: () => void; primary?: boolean; danger?: boolean; label?: string; hint?: string;
  disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    aria-disabled={disabled || !onPress} disabled={disabled || !onPress} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [styles.button, { backgroundColor: primary ? p.text : p.field },
      (pressed || disabled) && { opacity: 0.5 }, style]}>
    <Label style={{ color: primary ? p.inverse : danger ? p.danger : p.text }}>{children}</Label>
  </Pressable>;
}

/** Segmented choices, exposed as a radio group. Space selects, as it does for native radios. */
export function Segments({ values, selected, onChange, label, names }: {
  values: readonly string[]; selected: string; onChange?: (value: string) => void;
  label?: string; names?: Readonly<Record<string, string>>;
}) {
  const p = usePalette();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}
    style={[styles.row, styles.segments, { backgroundColor: p.field }]}>
    {values.map(value => <Pressable key={value} role="radio" aria-checked={value === selected}
      accessibilityLabel={names?.[value] ?? value} disabled={!onChange} onPress={() => onChange?.(value)}
      // react-native-web presses on Space only for button roles.
      onKeyDown={e => { if (onChange && e.nativeEvent.key === ' ') { e.preventDefault(); onChange(value); } }}
      hitSlop={4} style={[styles.segment, value === selected && { backgroundColor: p.text }]}>
      <Label size={12} style={{ color: value === selected ? p.inverse : p.text }}>{value}</Label>
    </Pressable>)}
  </View>;
}

/** Labelled native input; read-only unless the screen owns a change callback. */
export function Field({ label, a11y, value, onChangeText, suffix, placeholder, error, style, ...input }:
  Omit<TextInputProps, 'style'> & {
    label: string; a11y?: string; value: string; suffix?: string; error?: string; style?: StyleProp<ViewStyle>;
  }) {
  const p = usePalette();
  // The whole row shows focus, so the ring also encloses the unit suffix.
  const [focused, setFocused] = useState(false);
  return <View style={[{ gap: 8 }, style]}>
    <Label size={13}>{label}</Label>
    <Row style={[{ backgroundColor: p.field, borderRadius: 6, paddingHorizontal: 12, borderWidth: 1,
      borderColor: error === undefined ? 'transparent' : p.danger }, focused && styles.focused]}>
      <TextInput accessibilityLabel={a11y ?? label} value={value} onChangeText={onChangeText}
        readOnly={!onChangeText} placeholder={placeholder} placeholderTextColor={p.muted}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[styles.input, { color: p.text }]} {...input} />
      {suffix ? <Label size={13}>{suffix}</Label> : null}
    </Row>
    {error !== undefined ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
  </View>;
}

/** Source-shaped nutrient summary with text labels independent of color. Bars need real targets. */
export function Macros({ values, targets, label }: {
  values: readonly string[]; targets?: readonly string[]; label?: string;
}) {
  const p = usePalette();
  const names = ['Calories', 'Protein', 'Fat', 'Carbs'];
  const tint = [colors.calories, colors.protein, colors.fat, colors.carbs];
  return <View accessible={label !== undefined} accessibilityLabel={label}
    style={[styles.row, { justifyContent: 'space-between', gap: 12 }]}>
    {names.map((name, i) => <View key={name} style={{ flex: 1, gap: 4 }}>
      <Label size={11} muted>{name}</Label>
      <Label size={i === 0 ? 24 : 20} weight="500">{values[i]}</Label>
      {targets ? <><Label size={10} muted>of {targets[i]}</Label>
        <View style={{ height: 3, backgroundColor: p.field, marginTop: 5 }}>
          <View style={{ height: 3, width: '74%', backgroundColor: tint[i] }} />
        </View></> : <View style={{ height: 3, width: 16, backgroundColor: tint[i], marginTop: 5 }} />}
    </View>)}
  </View>;
}

/** Synthetic chart values for visual study only, with no health estimates or live data. */
export function Sparkline({ values, color, height = 64, width = 145, dots = true }: {
  values: readonly number[]; color: string; height?: number; width?: number; dots?: boolean;
}) {
  const p = usePalette();
  const points = values.map((value, i) => ({
    x: 5 + i * (width - 10) / Math.max(1, values.length - 1), y: height - 5 - value * (height - 10),
  }));
  return <View accessibilityRole="image" accessibilityLabel="Illustrative chart, not live health data"
    style={{ width, height }}>
    {points.slice(1).map((point, i) => {
      const before = points[i];
      const length = Math.hypot(point.x - before.x, point.y - before.y);
      const angle = Math.atan2(point.y - before.y, point.x - before.x);
      return <View key={i} style={{ position: 'absolute',
        left: (before.x + point.x - length) / 2, top: (before.y + point.y) / 2,
        width: length, height: 1.5, backgroundColor: color, transform: [{ rotate: `${angle}rad` }] }} />;
    })}
    {dots ? points.map((point, i) => <View key={i} style={{ position: 'absolute',
      left: point.x - 3, top: point.y - 3, width: 6, height: 6, borderRadius: 3,
      borderWidth: 1.5, borderColor: color, backgroundColor: p.surface }} />) : null}
  </View>;
}

/** The search pill and food-tools button above the tab bar. Live when given callbacks. */
export function SearchBar({ onSearch, onTools, toolsLabel = 'Food tools' }: {
  onSearch?: () => void; onTools?: () => void; toolsLabel?: string;
}) {
  const p = usePalette();
  return <Row style={{ gap: 8, marginBottom: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Search for a food" disabled={!onSearch}
      onPress={onSearch} style={{ flex: 1, backgroundColor: p.field, padding: 12, borderRadius: 24, minHeight: 44 }}>
      <Row style={{ gap: 10 }}><Label muted>⌕</Label>
        <Label muted style={{ flex: 1 }}>Search for a food</Label><Label muted>▥</Label></Row>
    </Pressable>
    <Button label={toolsLabel} onPress={onTools}>✧</Button>
  </Row>;
}

/** Bottom app navigation copied as static chrome, not a working application router. */
export function BottomNav({ active, search = true }: { active: string; search?: boolean }) {
  const p = usePalette();
  return <View style={{ backgroundColor: p.surface, paddingHorizontal: 16, paddingTop: 8 }}>
    {search ? <SearchBar /> : null}
    <Row style={{ justifyContent: 'space-between', paddingBottom: 8 }}>
      {[['▦', 'Dashboard'], ['♧', 'Food Log'], ['+', 'Add'], ['∴', 'Strategy'], ['⊙', 'More']].map(([icon, name]) =>
        <View key={name} style={{ alignItems: 'center', gap: 3, minWidth: 44 }}>
          {name === 'Add' ? <View style={{ width: 38, height: 38, borderRadius: 19,
            backgroundColor: p.text, alignItems: 'center', justifyContent: 'center' }}>
            <Label size={26} style={{ color: p.inverse }}>+</Label>
          </View> : <><Label size={24} muted={name !== active}>{icon}</Label>
            <Label size={9} muted={name !== active}>{name}</Label></>}
        </View>)}
    </Row>
  </View>;
}

/**
 * A full screen with optional title bar, header, footer, and reference-only tab bar.
 * Inside a DeviceFrame it also draws the phone outline, status bar, and home indicator.
 */
export function Phone({ children, dark = false, title, onBack, backLabel = 'Back', tab, footer, header, search = true }: {
  children: ReactNode; dark?: boolean; title?: string; onBack?: () => void; backLabel?: string; tab?: string;
  footer?: ReactNode; header?: ReactNode; search?: boolean;
}) {
  const p = palettes[dark ? 'dark' : 'light'];
  const framed = useContext(DeviceFrame);
  // Live screens paint their own safe-area insets and status bar to match their palette.
  const Shell = framed ? View : SafeAreaView;
  return <Palette.Provider value={p}><Shell testID="reference-screen"
    style={[framed ? styles.phone : styles.live, { backgroundColor: framed ? p.background : p.surface,
      borderColor: dark ? '#303030' : '#e1e1e1' }]}>
    {framed ? null : <StatusBar style={dark ? 'light' : 'dark'} />}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: p.background }}>
    {framed ? <Row style={{ height: 54, paddingHorizontal: 26, backgroundColor: p.surface,
      justifyContent: 'space-between' }}>
      <Label size={14} weight="600">9:41</Label>
      <View style={{ width: 104, height: 27, borderRadius: 18, backgroundColor: '#000' }} />
      <Label size={12}>▴ ◔ ▰</Label>
    </Row> : null}
    {title ? <Row style={{ minHeight: 48, paddingHorizontal: 6, backgroundColor: p.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} disabled={!onBack} onPress={onBack}
        // Reference screens draw their back arrow as static chrome; live screens dim a disabled one.
        style={[styles.icon, !onBack && !framed && { opacity: 0.4 }]}><Label size={28}>‹</Label></Pressable>
      <Label accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }} weight="500">{title}</Label>
      <View style={{ width: 44 }} />
    </Row> : null}
    {header}
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: framed ? 18 : 0 }} style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      {children}
    </ScrollView>
    {footer}
    {tab ? <BottomNav active={tab} search={search} /> : null}
    </KeyboardAvoidingView>
    {framed ? <View style={{ backgroundColor: p.surface, paddingVertical: 9, alignItems: 'center' }}>
      <View style={{ width: 128, height: 5, borderRadius: 3, backgroundColor: p.text }} />
    </View> : null}
  </Shell></Palette.Provider>;
}

const styles = StyleSheet.create({
  phone: { width: 390, maxWidth: '100%', height: 844, borderRadius: 34, overflow: 'hidden',
    borderWidth: 1 },
  live: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderRadius: 12, padding: 16, gap: 12 },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
    borderRadius: 24 },
  segments: { borderRadius: 24, padding: 3, alignSelf: 'center' },
  segment: { minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 20,
    paddingHorizontal: 14 },
  input: { fontSize: 14, minHeight: 44, flex: 1, minWidth: 0, outlineWidth: 0, outlineStyle: 'solid' },
  focused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.calories, outlineOffset: 1 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
