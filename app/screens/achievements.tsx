// src/screens/AchievementsScreen.tsx
import React from 'react';
import { View, FlatList, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'; // <<< Added TouchableOpacity
import { Ionicons } from '@expo/vector-icons'; // <<< Added Ionicons
import { useTheme } from '@/context/ThemeContext';
import { useAchievements } from '@/hooks/useAchievements';
import { AchievementItem } from '@/components/achievements/AchievementItem';
import { SafeAreaView } from 'react-native-safe-area-context';

const AchievementsScreen = () => {
  const { colors } = useTheme();
  const { achievements, loading, error, refreshAchievements } = useAchievements(); // <<< Destructured refreshAchievements
  const styles = createStyles(colors);

  // Loading state for initial load (no achievements yet)
  if (loading && achievements.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  // Error state for initial load (no achievements yet)
  if (error && achievements.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.errorText}>Erro ao carregar conquistas.</Text>
        <Text style={styles.errorDetailText}>{error.message}</Text>
        <TouchableOpacity style={styles.refreshButtonError} onPress={refreshAchievements}>
          <Ionicons name="refresh-outline" size={24} color={colors.primary} />
          <Text style={styles.refreshButtonErrorText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Minhas Conquistas</Text>
        {loading && achievements.length > 0 ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.headerLoadingIndicator} />
        ) : (
          <TouchableOpacity onPress={refreshAchievements} disabled={loading} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={26} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {error && achievements.length > 0 && (
        <View style={styles.inlineErrorContainer}>
          <Ionicons name="warning-outline" size={20} color={colors.error} />
          <Text style={styles.inlineErrorText}>Erro ao atualizar: {error.message}</Text>
        </View>
      )}

      <FlatList
        data={achievements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AchievementItem definition={item} userStatus={item.userStatus} />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>Nenhuma conquista encontrada.</Text> : null
        }
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    // paddingTop removed, header will manage its own top padding via SafeAreaView edges if needed or specific styling
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? 25 : 10, // Adjust for status bar
    paddingBottom: 10, // Space below header
    backgroundColor: colors.backgroundPrimary, // Match screen background
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1, // Allow title to take space
  },
  refreshButton: {
    padding: 8,
  },
  headerLoadingIndicator: {
    padding: 8, // Match refresh button padding for alignment
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15, // Padding at the bottom of the list
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetailText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButtonError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20', // Light primary background
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  refreshButtonErrorText: {
    color: colors.primary,
    marginLeft: 10,
    fontWeight: '600',
  },
  inlineErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15', // Light error background
    padding: 10,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  inlineErrorText: {
    color: colors.error,
    marginLeft: 10,
    fontSize: 14,
    flexShrink: 1, // Allow text to wrap
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 50, // More margin if list is truly empty
    fontSize: 16,
  },
});

export default AchievementsScreen;