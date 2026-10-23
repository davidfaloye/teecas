import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, themed } from '../theme';
import { T } from './ui';

// A labelled text field. password: hides what's typed, with a Show / Hide switch.
export const Input = forwardRef(function Input({ label, error, hint, multiline, password, ...props }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontFamily: fonts.semibold }}>
        {label}
      </T>
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          selectionColor={colors.gold}
          keyboardAppearance={colors.keyboard}
          style={[s.input, multiline && { minHeight: 76, textAlignVertical: 'top' }, password && { paddingRight: 70 }, error ? { borderColor: colors.bad } : null]}
          accessibilityLabel={label}
          multiline={multiline}
          secureTextEntry={password && !shown}
          autoCapitalize={password ? 'none' : props.autoCapitalize}
          autoCorrect={password ? false : props.autoCorrect}
          {...props}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown((v) => !v)}
            hitSlop={8}
            style={s.toggle}
          >
            <T variant="small" style={{ color: colors.gold, fontFamily: fonts.semibold }}>
              {shown ? 'Hide' : 'Show'}
            </T>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <T variant="small" style={{ color: colors.bad }}>
          {error}
        </T>
      ) : hint ? (
        <T variant="muted">{hint}</T>
      ) : null}
    </View>
  );
});

const s = themed(() => StyleSheet.create({
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.cream, fontFamily: fonts.body, fontSize: 16 },
  toggle: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 10 },
}));
