import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-027-01", "module-027-02", "module-027-03", "module-027-04", "module-027-05", "module-027-06", "module-027-07", "module-027-08", "module-027-09", "module-027-10", "module-027-11", "module-027-12", "module-027-13", "module-027-14", "module-027-15", "module-027-16", "module-027-17", "module-027-18", "module-027-19", "module-027-20", "module-027-21", "module-027-22", "module-027-23", "module-027-24"];

export function Screen027() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 027</Text>
      <Text style={styles.detail}>Loaded 027: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
