import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const C = {
  bg: '#000000',
  card: '#0D0D0D',
  hair: '#2A2A2A',
  text: '#E6E6E6',
  dim: '#8A8A8A',
  accent: '#FF4D00',
  ok: '#00FF9B',
  bad: '#FF4D4D',
};

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, kind = 'primary', style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        kind === 'ghost' && s.btnGhost,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[s.btnText, kind === 'ghost' && { color: C.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.chip, active && s.chipOn, disabled && { opacity: 0.35 }]}>
      <Text style={[s.chipText, active && { color: '#000' }]}>{label}</Text>
    </Pressable>
  );
}

export function Dot({ on }) {
  return <View style={[s.dot, { backgroundColor: on ? C.ok : C.bad }]} />;
}

export function Label({ children }) {
  return <Text style={s.label}>{children}</Text>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16, paddingBottom: 32 },
  h1: { color: C.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
  sub: { color: C.dim, fontSize: 14, marginBottom: 16 },
  label: { color: C.dim, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  card: { backgroundColor: C.card, borderColor: C.hair, borderWidth: 1, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: C.text, fontSize: 16, fontWeight: '600' },
  body: { color: C.dim, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: C.accent, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnGhost: { backgroundColor: 'transparent', borderColor: C.hair, borderWidth: 1 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  chip: { borderColor: C.hair, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: C.text, borderColor: C.text },
  chipText: { color: C.text, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  input: { borderColor: C.hair, borderWidth: 1, color: C.text, padding: 12, fontSize: 16, backgroundColor: C.card },
  msg: { fontSize: 13, marginTop: 10 },
});
