import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-010-01", "module-010-02", "module-010-03", "module-010-04", "module-010-05", "module-010-06", "module-010-07", "module-010-08", "module-010-09", "module-010-10", "module-010-11", "module-010-12", "module-010-13", "module-010-14", "module-010-15", "module-010-16", "module-010-17", "module-010-18", "module-010-19", "module-010-20", "module-010-21", "module-010-22", "module-010-23", "module-010-24"];

export function Screen010() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 010</Text>
      <Text style={styles.detail}>Loaded 010: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
