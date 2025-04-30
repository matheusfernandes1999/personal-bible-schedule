// src/screens/AchievementsScreen.tsx
import React from 'react';
import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAchievements } from '@/hooks/useAchievements';
import { AchievementItem } from '@/components/achievements/AchievementItem';
import { SafeAreaView } from 'react-native-safe-area-context';

const AchievementsScreen = () => {
  const { colors } = useTheme();
  const { achievements, loading, error } = useAchievements();
  const styles = createStyles(colors);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>Erro ao carregar conquistas: {error.message}</Text></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <Text style={styles.title}>Minhas Conquistas</Text>
      <FlatList
        data={achievements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AchievementItem definition={item} userStatus={item.userStatus} />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma conquista encontrada.</Text>}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
   safeArea: {
     flex: 1,
     backgroundColor: colors.backgroundPrimary,
     paddingVertical: 14,
     paddingTop: 22
   },
  listContainer: {
    padding: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundPrimary,
  },
   title: {
     fontSize: 24,
     fontWeight: 'bold',
     color: colors.textPrimary,
     marginHorizontal: 15,
     marginTop: 10, // Ajuste conforme necessário com seu header
     marginBottom: 15,
   },
  errorText: {
    color: colors.error,
  },
   emptyText: {
     color: colors.textSecondary,
     textAlign: 'center',
     marginTop: 30,
   },
});

export default AchievementsScreen;