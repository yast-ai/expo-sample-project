import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-013-01", "module-013-02", "module-013-03", "module-013-04", "module-013-05", "module-013-06", "module-013-07", "module-013-08", "module-013-09", "module-013-10", "module-013-11", "module-013-12", "module-013-13", "module-013-14", "module-013-15", "module-013-16", "module-013-17", "module-013-18", "module-013-19", "module-013-20", "module-013-21", "module-013-22", "module-013-23", "module-013-24"];

export function Screen013() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 013</Text>
      <Text style={styles.detail}>Loaded 013: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
