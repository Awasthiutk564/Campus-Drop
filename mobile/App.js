import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useCampusDrop } from './src/db';
import PickupScreen from './src/PickupScreen';
import DeliverScreen from './src/DeliverScreen';
import BoxesScreen from './src/BoxesScreen';
import { C } from './src/ui';

const TABS = [
  { key: 'pickup', label: 'Pickup', icon: '🎓' },
  { key: 'deliver', label: 'Deliver', icon: '🚚' },
  { key: 'boxes', label: 'Boxes', icon: '📦' },
];

export default function App() {
  const cd = useCampusDrop();
  const [tab, setTab] = useState('pickup');
  const [banner, setBanner] = useState(null);

  const arrival = (o) => {
    setBanner(o);
    setTimeout(() => setBanner(null), 8000);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 }}>
            campusdrop<Text style={{ color: C.accent }}>.</Text>
          </Text>
          <Text style={{ color: cd.connected ? C.ok : C.bad, fontSize: 12 }}>{cd.connected ? '● Live' : '● Offline'}</Text>
        </View>

        {banner && (
          <Pressable
            onPress={() => { setTab('pickup'); setBanner(null); }}
            style={{ backgroundColor: C.accent, marginHorizontal: 16, padding: 12 }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Parcel Arrived! 📦</Text>
            <Text style={{ color: '#000' }}>Your {banner.courier} order #{banner.id} is in the box. PIN: {banner.pin}</Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }}>
          {/* Pickup stays mounted so new-parcel alerts fire while another tab is open. */}
          <View style={{ flex: 1, display: tab === 'pickup' ? 'flex' : 'none' }}><PickupScreen cd={cd} onArrival={arrival} /></View>
          {tab === 'deliver' && <DeliverScreen cd={cd} />}
          {tab === 'boxes' && <BoxesScreen cd={cd} />}
        </View>

        <View style={{ flexDirection: 'row', borderTopColor: C.hair, borderTopWidth: 1 }}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 20 }}>{t.icon}</Text>
              <Text style={{ color: tab === t.key ? C.accent : C.dim, fontSize: 12, marginTop: 2 }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
