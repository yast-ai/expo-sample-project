import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-098-01", "module-098-02", "module-098-03", "module-098-04", "module-098-05", "module-098-06", "module-098-07", "module-098-08", "module-098-09", "module-098-10", "module-098-11", "module-098-12", "module-098-13", "module-098-14", "module-098-15", "module-098-16", "module-098-17", "module-098-18", "module-098-19", "module-098-20", "module-098-21", "module-098-22", "module-098-23", "module-098-24"];

export function Screen098() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 098</Text>
      <Text style={styles.detail}>Loaded 098: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
