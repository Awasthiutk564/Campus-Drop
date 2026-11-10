import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { BOXES, COURIERS, SIZES, STUDENTS, addOrder, pinFor, sendCommand, logEvent } from './db';
import { Button, C, Card, Chip, Label, s } from './ui';

export default function DeliverScreen({ cd }) {
  const [orderId, setOrderId] = useState('');
  const [boxId, setBoxId] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [courier, setCourier] = useState('Amazon');
  const [size, setSize] = useState('Medium');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [done, setDone] = useState(null);

  const busyBoxes = new Set(cd.orders.filter((o) => o.status === 'awaiting').map((o) => o.boxId));
  const usable = (b) => cd.boxOnline(b) && !busyBoxes.has(b.id);
  const valid = /^\d{6,16}$/.test(orderId) && boxId && studentId;

  const step = (text) => setMsg({ text, bad: false });

  const drop = async () => {
    const st = STUDENTS.find((x) => x.id === studentId);
    const box = BOXES.find((b) => b.id === boxId);
    if (cd.orders.some((o) => o.id === orderId)) return setMsg({ text: 'That Order ID already exists.', bad: true });
    setBusy(true);
    try {
      step(`Unlocking ${box.name}…`);
      const un = await sendCommand(boxId, 'unlock', 'delivery');
      if (!un.ok) throw new Error(un.error);
      step('Box open. Place the parcel inside, then it will lock…');
      await new Promise((r) => setTimeout(r, 4000));
      step('Locking the box…');
      const lk = await sendCommand(boxId, 'lock', 'delivery');
      if (!lk.ok) throw new Error(lk.error);
      const order = {
        id: orderId, boxId, studentId, studentName: st.name, phone: st.phone, courier, size,
        pin: pinFor(orderId), status: 'awaiting', attempts: 0, createdAt: Date.now(),
      };
      await addOrder(order);
      logEvent(boxId, 'parcel.registered', { order: orderId });
      setDone(order);
      setOrderId(''); setBoxId(null); setStudentId(null);
      setMsg({ text: '', bad: false });
    } catch (e) {
      setMsg({ text: e.message || 'Something went wrong. Try again.', bad: true });
    }
    setBusy(false);
  };

  if (done) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Text style={s.h1}>Parcel dropped ✓</Text>
        <Card>
          <Text style={s.title}>{done.studentName} has been notified</Text>
          <Text style={s.body}>Order #{done.id} · {done.courier} · {done.size}</Text>
          <Text style={s.body}>{BOXES.find((b) => b.id === done.boxId)?.name}</Text>
          <Text style={{ color: C.ok, fontSize: 28, fontWeight: '700', marginTop: 12 }}>PIN {done.pin}</Text>
        </Card>
        <Button title="New delivery" onPress={() => setDone(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>New delivery</Text>
      <Text style={s.sub}>Register a parcel and the box will open for the drop.</Text>

      <Label>Order ID (6–16 digits)</Label>
      <TextInput
        style={s.input}
        value={orderId}
        onChangeText={(t) => setOrderId(t.replace(/\D/g, '').slice(0, 16))}
        keyboardType="number-pad"
        placeholder="e.g. 402123456789"
        placeholderTextColor={C.dim}
        editable={!busy}
      />
      {orderId.length >= 4 && <Text style={[s.body, { marginTop: 6 }]}>Pickup PIN will be {pinFor(orderId)}</Text>}

      <Label>Box</Label>
      <TextWrap>
        {BOXES.map((b) => (
          <Chip key={b.id} label={`${b.no} · ${b.place}`} active={boxId === b.id} disabled={busy || !usable(b)} onPress={() => setBoxId(b.id)} />
        ))}
      </TextWrap>
      <Text style={[s.body, { marginTop: 6 }]}>Greyed boxes are offline or already hold a parcel.</Text>

      <Label>Student</Label>
      <TextWrap>
        {STUDENTS.map((st) => (
          <Chip key={st.id} label={st.name} active={studentId === st.id} disabled={busy} onPress={() => setStudentId(st.id)} />
        ))}
      </TextWrap>

      <Label>Courier</Label>
      <TextWrap>
        {COURIERS.map((c) => <Chip key={c} label={c} active={courier === c} disabled={busy} onPress={() => setCourier(c)} />)}
      </TextWrap>

      <Label>Parcel size</Label>
      <TextWrap>
        {SIZES.map((z) => <Chip key={z} label={z} active={size === z} disabled={busy} onPress={() => setSize(z)} />)}
      </TextWrap>

      {!!msg.text && <Text style={[s.msg, { color: msg.bad ? C.bad : C.text }]}>{msg.text}</Text>}
      <Button title={busy ? 'Working…' : 'Unlock box & drop parcel'} onPress={drop} disabled={!valid || busy} />
    </ScrollView>
  );
}

function TextWrap({ children }) {
  return <View style={s.wrap}>{children}</View>;
}
