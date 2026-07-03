import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeight } from '@/theme';

export default function SleepScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>수면</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.heavy,
    color: colors.surface,
  },
});
