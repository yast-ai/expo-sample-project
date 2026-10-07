import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-037-01", "module-037-02", "module-037-03", "module-037-04", "module-037-05", "module-037-06", "module-037-07", "module-037-08", "module-037-09", "module-037-10", "module-037-11", "module-037-12", "module-037-13", "module-037-14", "module-037-15", "module-037-16", "module-037-17", "module-037-18", "module-037-19", "module-037-20", "module-037-21", "module-037-22", "module-037-23", "module-037-24"];

export function Screen037() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 037</Text>
      <Text style={styles.detail}>Loaded 037: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
