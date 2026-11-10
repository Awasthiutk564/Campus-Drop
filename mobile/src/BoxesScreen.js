import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BOXES, boxById, sendCommand } from './db';
import { Button, C, Card, Dot, s } from './ui';

export default function BoxesScreen({ cd }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  const remote = async (b, action) => {
    setBusy(b.id); setMsg('');
    try {
      const r = await sendCommand(b.id, action, 'remote');
      setMsg(r.ok ? `${b.name}: ${action} confirmed` : `${b.name}: ${r.error}`);
    } catch (e) {
      setMsg('Could not reach the server.');
    }
    setBusy(null);
  };

  const recent = cd.orders.filter((o) => o.status === 'collected').length;
  const waiting = cd.orders.filter((o) => o.status === 'awaiting').length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>Campus boxes</Text>
      <Text style={s.sub}>
        {cd.connected ? 'Live · Firebase' : 'Reconnecting…'} · {waiting} waiting · {recent} collected
      </Text>

      {BOXES.map((b) => {
        const online = cd.boxOnline(b);
        const occupied = cd.orders.find((o) => o.boxId === b.id && o.status === 'awaiting');
        const live = cd.boxLive[b.id] || {};
        return (
          <Card key={b.id}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <View style={s.row}>
                <Dot on={online} />
                <Text style={s.title}>{b.name}</Text>
              </View>
              <Text style={{ color: occupied ? C.accent : C.ok, fontSize: 13 }}>{occupied ? 'Occupied' : 'Free'}</Text>
            </View>
            <Text style={s.body}>{b.place}</Text>
            {b.real && (
              <Text style={s.body}>
                {online ? `Online · ${live.locked === false ? 'Unlocked' : 'Locked'}${live.parcelPresent ? ' · Parcel detected' : ''}` : 'Offline · no heartbeat'}
                {typeof live.distanceCm === 'number' ? ` · ${live.distanceCm.toFixed(1)} cm` : ''}
              </Text>
            )}
            {occupied && <Text style={s.body}>For {occupied.studentName} · #{occupied.id}</Text>}
            {b.real && online && (
              <View style={[s.row, { gap: 10 }]}>
                <Button title="Unlock" kind="ghost" disabled={busy === b.id} onPress={() => remote(b, 'unlock')} style={{ flex: 1 }} />
                <Button title="Lock" kind="ghost" disabled={busy === b.id} onPress={() => remote(b, 'lock')} style={{ flex: 1 }} />
              </View>
            )}
          </Card>
        );
      })}
      {!!msg && <Text style={[s.msg, { color: C.text }]}>{msg}</Text>}
    </ScrollView>
  );
}
