import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-077-01", "module-077-02", "module-077-03", "module-077-04", "module-077-05", "module-077-06", "module-077-07", "module-077-08", "module-077-09", "module-077-10", "module-077-11", "module-077-12", "module-077-13", "module-077-14", "module-077-15", "module-077-16", "module-077-17", "module-077-18", "module-077-19", "module-077-20", "module-077-21", "module-077-22", "module-077-23", "module-077-24"];

export function Screen077() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 077</Text>
      <Text style={styles.detail}>Loaded 077: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
