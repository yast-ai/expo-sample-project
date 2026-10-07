import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-096-01", "module-096-02", "module-096-03", "module-096-04", "module-096-05", "module-096-06", "module-096-07", "module-096-08", "module-096-09", "module-096-10", "module-096-11", "module-096-12", "module-096-13", "module-096-14", "module-096-15", "module-096-16", "module-096-17", "module-096-18", "module-096-19", "module-096-20", "module-096-21", "module-096-22", "module-096-23", "module-096-24"];

export function Screen096() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 096</Text>
      <Text style={styles.detail}>Loaded 096: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
