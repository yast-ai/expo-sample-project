import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-008-01", "module-008-02", "module-008-03", "module-008-04", "module-008-05", "module-008-06", "module-008-07", "module-008-08", "module-008-09", "module-008-10", "module-008-11", "module-008-12", "module-008-13", "module-008-14", "module-008-15", "module-008-16", "module-008-17", "module-008-18", "module-008-19", "module-008-20", "module-008-21", "module-008-22", "module-008-23", "module-008-24"];

export function Screen008() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 008</Text>
      <Text style={styles.detail}>Loaded 008: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
