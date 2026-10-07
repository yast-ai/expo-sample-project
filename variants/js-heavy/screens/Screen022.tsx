import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-022-01", "module-022-02", "module-022-03", "module-022-04", "module-022-05", "module-022-06", "module-022-07", "module-022-08", "module-022-09", "module-022-10", "module-022-11", "module-022-12", "module-022-13", "module-022-14", "module-022-15", "module-022-16", "module-022-17", "module-022-18", "module-022-19", "module-022-20", "module-022-21", "module-022-22", "module-022-23", "module-022-24"];

export function Screen022() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 022</Text>
      <Text style={styles.detail}>Loaded 022: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
