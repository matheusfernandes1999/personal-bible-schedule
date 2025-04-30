
// src/components/achievements/AchievementItem.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { AchievementDefinition, UserAchievement } from '@/types';
import { formatDistanceToNowStrict } from 'date-fns'; // Para formatar data
import { ptBR } from 'date-fns/locale'; // Para Português

interface AchievementItemProps {
  definition: AchievementDefinition;
  userStatus: UserAchievement | null;
}

export const AchievementItem: React.FC<AchievementItemProps> = ({ definition, userStatus }) => {
  const { colors } = useTheme();
  const isUnlocked = userStatus?.unlocked === true;
  const styles = createStyles(colors, isUnlocked);

  const iconName = isUnlocked ? definition.iconUnlocked : definition.iconLocked;
  const iconColor = isUnlocked ? colors.primary : colors.textSecondary; // Ou uma cor específica para conquistas

  const unlockedDate = userStatus?.unlockedAt?.toDate();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={iconName as any} size={36} color={iconColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{definition.name}</Text>
        <Text style={styles.description}>{definition.description}</Text>
        {isUnlocked && unlockedDate && (
           <Text style={styles.unlockedDate}>
             Desbloqueado {formatDistanceToNowStrict(unlockedDate, { addSuffix: true, locale: ptBR })}
           </Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], isUnlocked: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      padding: 15,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      marginBottom: 10,
      opacity: isUnlocked ? 1 : 0.6, // Exemplo de diferenciação visual
      alignItems: 'center',
       shadowColor: colors.shadow,
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.05,
       shadowRadius: 4,
       elevation: 2,
    },
    iconContainer: {
      marginRight: 15,
      width: 40, // Para alinhar
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 3,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
     unlockedDate: {
       fontSize: 11,
       color: colors.warning,
       marginTop: 5,
       display: 'none'
     },
  });