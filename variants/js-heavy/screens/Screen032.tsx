import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-032-01", "module-032-02", "module-032-03", "module-032-04", "module-032-05", "module-032-06", "module-032-07", "module-032-08", "module-032-09", "module-032-10", "module-032-11", "module-032-12", "module-032-13", "module-032-14", "module-032-15", "module-032-16", "module-032-17", "module-032-18", "module-032-19", "module-032-20", "module-032-21", "module-032-22", "module-032-23", "module-032-24"];

export function Screen032() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 032</Text>
      <Text style={styles.detail}>Loaded 032: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
