import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, Vibration, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STUDENTS, boxById, logEvent, studentById, updateOrder } from './db';
import { Button, C, Card, Chip, Label, s } from './ui';

const KEY = 'campusdrop.student';
const MAX_ATTEMPTS = 5;

export default function PickupScreen({ cd, onArrival }) {
  const [studentId, setStudentId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [tick, setTick] = useState(0);
  const seen = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setStudentId(v)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pick = (id) => {
    setStudentId(id);
    setOrderId(null);
    seen.current = null;
    AsyncStorage.setItem(KEY, id).catch(() => {});
  };

  const student = studentById(studentId);
  const mine = cd.orders
    .filter((o) => o.studentId === studentId && o.status === 'awaiting')
    .sort((a, b) => b.createdAt - a.createdAt);

  // Notify when a new parcel for this student shows up after the first load.
  useEffect(() => {
    if (!cd.loaded || !studentId) return;
    const ids = new Set(mine.map((o) => o.id));
    if (seen.current) {
      const fresh = mine.filter((o) => !seen.current.has(o.id));
      if (fresh.length) {
        Vibration.vibrate([0, 200, 100, 200]);
        onArrival?.(fresh[0]);
      }
    }
    seen.current = ids;
  }, [cd.loaded, studentId, mine.map((o) => o.id).join(',')]);

  const order = mine.find((o) => o.id === orderId);
  const box = order && boxById(order.boxId);
  const real = !!box?.real;
  const live = (box && cd.boxLive[box.id]) || {};
  const lockedLeft = order?.lockedUntil ? Math.ceil((order.lockedUntil - cd.now()) / 1000) : 0;
  const locked = lockedLeft > 0;

  const submit = async (value) => {
    try {
      if (value === order.pin) {
        await updateOrder(order, { status: 'collected', collectedAt: Date.now() });
        logEvent(order.boxId, 'pin.accepted', { order: order.id }, 'in');
        setMsg({ text: 'PIN accepted. Box unlocked, collect your parcel.', bad: false });
        setOrderId(null);
      } else {
        const attempts = (order.attempts || 0) + 1;
        const fields = { attempts };
        if (attempts % MAX_ATTEMPTS === 0) fields.lockedUntil = Date.now() + 30000;
        await updateOrder(order, fields);
        logEvent(order.boxId, 'pin.rejected', { attempts }, 'in');
        setMsg({ text: `That PIN doesn't match. ${MAX_ATTEMPTS - (attempts % MAX_ATTEMPTS)} tries left.`, bad: true });
      }
    } catch (e) {
      setMsg({ text: 'Could not reach the server. Try again.', bad: true });
    }
    setPin('');
  };

  const press = (k) => {
    if (locked) return;
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (k === 'clear') return setPin('');
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  if (!student) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Text style={s.h1}>Who are you?</Text>
        <Text style={s.sub}>Pick your student profile to see your parcels.</Text>
        {STUDENTS.map((st) => (
          <Pressable key={st.id} onPress={() => pick(st.id)}>
            <Card style={s.row}>
              <Avatar st={st} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.title}>{st.name}</Text>
                <Text style={s.body}>{st.id} · {st.hostel}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          <Avatar st={student} />
          <View style={{ marginLeft: 12 }}>
            <Text style={s.title}>{student.name}</Text>
            <Text style={s.body}>{student.id}</Text>
          </View>
        </View>
        <Button title="Switch" kind="ghost" onPress={() => { setStudentId(null); setOrderId(null); }} style={{ marginTop: 0, paddingHorizontal: 14, paddingVertical: 8 }} />
      </View>

      {!order && (
        <>
          <Label>Parcels waiting for you</Label>
          {!cd.loaded && <Text style={s.body}>Loading…</Text>}
          {cd.loaded && mine.length === 0 && <Text style={s.body}>Nothing waiting right now. You'll get an alert when a parcel arrives.</Text>}
          {mine.map((o) => {
            const b = boxById(o.boxId);
            return (
              <Pressable key={o.id} onPress={() => { setOrderId(o.id); setPin(''); setMsg({ text: '', bad: false }); }}>
                <Card>
                  <Text style={s.title}>{o.courier} · {o.size}</Text>
                  <Text style={s.body}>Order #{o.id}</Text>
                  <Text style={s.body}>{b ? `${b.name} · ${b.place}` : o.boxId}</Text>
                  <Text style={{ color: C.accent, marginTop: 8, fontSize: 13 }}>Tap to collect →</Text>
                </Card>
              </Pressable>
            );
          })}
          {!!msg.text && <Text style={[s.msg, { color: msg.bad ? C.bad : C.ok }]}>{msg.text}</Text>}
        </>
      )}

      {order && (
        <>
          <Label>{box.name} · {box.place}</Label>
          {real ? (
            <Card>
              <Text style={s.title}>Type your PIN on the box's keypad</Text>
              <Text style={s.body}>The last 4 digits of your Order ID. Digits show here as you type.</Text>
              <PinDots value={String(live.keypad || '')} />
              {locked ? (
                <Text style={[s.msg, { color: C.bad }]}>Too many wrong PINs. Keypad unlocks in {lockedLeft}s.</Text>
              ) : order.attempts ? (
                <Text style={[s.msg, { color: C.bad }]}>Last PIN didn't match. {MAX_ATTEMPTS - (order.attempts % MAX_ATTEMPTS)} tries left.</Text>
              ) : null}
              {!cd.boxOnline(box) && <Text style={[s.msg, { color: C.bad }]}>Box 01 is offline right now.</Text>}
            </Card>
          ) : (
            <Card>
              <Text style={s.title}>Enter your 4-digit PIN</Text>
              <Text style={s.body}>The last 4 digits of Order #{order.id}.</Text>
              <PinDots value={pin} />
              {locked && <Text style={[s.msg, { color: C.bad }]}>Too many wrong PINs. Try again in {lockedLeft}s.</Text>}
              {!!msg.text && !locked && <Text style={[s.msg, { color: msg.bad ? C.bad : C.ok }]}>{msg.text}</Text>}
              <View style={[s.wrap, { marginTop: 14, justifyContent: 'space-between' }]}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'].map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => press(k)}
                    disabled={locked}
                    style={{ width: '31.5%', height: 56, borderColor: C.hair, borderWidth: 1, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.4 : 1 }}
                  >
                    <Text style={{ color: k.length > 1 ? C.dim : C.text, fontSize: k.length > 1 ? 12 : 22, fontWeight: '600' }}>
                      {k === 'del' ? '⌫' : k === 'clear' ? 'CLEAR' : k}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}
          <Button title="Back" kind="ghost" onPress={() => setOrderId(null)} />
        </>
      )}
    </ScrollView>
  );
}

function Avatar({ st }) {
  return (
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: st.color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{st.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</Text>
    </View>
  );
}

function PinDots({ value }) {
  return (
    <View style={[s.row, { marginTop: 14, gap: 10 }]}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 48, height: 56, borderColor: value[i] ? C.ok : C.hair, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.ok, fontSize: 28 }}>{value[i] ? '•' : ''}</Text>
        </View>
      ))}
    </View>
  );
}
