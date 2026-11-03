import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const colors = { text: '#1c1c1e', muted: '#5f5f66', line: '#d1d1d6', tint: '#0a63c9', danger: '#c4231c' };
// Macro tints from the MacroFactor reference screens. Always pair them with a text label.
export const macroColors = { protein: '#ff997d', carbs: '#77c7a3', fat: '#f4cb72' };

/** A labelled 44-pt input with an optional unit suffix and an inline validation alert. */
export function Field({
  label,
  a11y,
  error,
  suffix,
  ...input
}: TextInputProps & { label: string; a11y?: string; error?: string; suffix?: string }) {
  // The whole row shows focus, so the ring also encloses the unit suffix.
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <View style={[ui.inputRow, error !== undefined && ui.inputError, focused && ui.focused]}>
        <TextInput
          accessibilityLabel={a11y ?? label}
          placeholderTextColor={colors.muted}
          style={ui.inputText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...input}
        />
        {suffix !== undefined && <Text style={ui.muted}>{suffix}</Text>}
      </View>
      {error !== undefined && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

/** A 44-pt text button. `selected` makes it a radio option; put those in a radiogroup. */
export function Button(props: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
  a11y?: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
}) {
  const color = props.selected ? '#fff' : props.tone === 'danger' ? colors.danger : colors.tint;
  return (
    <Pressable
      // aria-* props: React Native maps them natively, and react-native-web ignores accessibilityState.
      role={props.selected === undefined ? 'button' : 'radio'}
      aria-checked={props.selected}
      aria-disabled={!!props.disabled}
      accessibilityLabel={props.a11y ?? props.label}
      accessibilityHint={props.hint}
      disabled={props.disabled}
      onPress={props.onPress}
      // react-native-web presses on Space only for button roles; radios also check on Space.
      onKeyDown={(e) => {
        if (props.selected !== undefined && !props.disabled && e.nativeEvent.key === ' ') {
          e.preventDefault();
          props.onPress();
        }
      }}
      hitSlop={4}
      style={({ pressed }) => [
        ui.button,
        props.selected !== undefined && ui.toggle,
        props.selected && ui.selected,
        (pressed || props.disabled) && ui.pressed,
      ]}
    >
      <Text style={[ui.buttonText, { color }, props.tone === 'primary' && ui.bold]}>{props.label}</Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  text: { fontSize: 17, color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  bold: { fontWeight: '600' },
  label: { fontSize: 15, color: colors.muted, marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 17,
    color: colors.text,
  },
  inputRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputText: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 8, fontSize: 17, color: colors.text, outlineWidth: 0, outlineStyle: 'solid' },
  focused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.tint, outlineOffset: 1 },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 15, color: colors.danger },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  toggle: { borderWidth: 1, borderColor: colors.tint, borderRadius: 8, paddingHorizontal: 14 },
  selected: { backgroundColor: colors.tint },
  buttonText: { fontSize: 17 },
  pressed: { opacity: 0.5 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
