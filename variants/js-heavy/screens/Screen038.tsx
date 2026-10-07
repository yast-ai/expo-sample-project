import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-038-01", "module-038-02", "module-038-03", "module-038-04", "module-038-05", "module-038-06", "module-038-07", "module-038-08", "module-038-09", "module-038-10", "module-038-11", "module-038-12", "module-038-13", "module-038-14", "module-038-15", "module-038-16", "module-038-17", "module-038-18", "module-038-19", "module-038-20", "module-038-21", "module-038-22", "module-038-23", "module-038-24"];

export function Screen038() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 038</Text>
      <Text style={styles.detail}>Loaded 038: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
