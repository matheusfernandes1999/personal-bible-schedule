import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { AchievementDefinition } from '@/types';

interface AchievementUnlockedModalProps {
  isVisible: boolean;
  onClose: () => void;
  achievement: AchievementDefinition | null;
}

export const AchievementUnlockedModal: React.FC<AchievementUnlockedModalProps> = ({
  isVisible,
  onClose,
  achievement,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (!achievement) return null; // Não renderiza se não houver conquista

  return (
    <Modal
      transparent
      animationType="slide" // Ou "fade"
      visible={isVisible}
      onRequestClose={onClose}
    >
      {/* Overlay escuro */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose} // Fecha ao clicar fora do conteúdo
      >
        {/* Container do conteúdo (estilo bottom sheet) */}
        <TouchableOpacity activeOpacity={1} style={styles.contentContainer} onPress={() => {}}>
            {/* Botão de Fechar (Opcional, pois clicar fora já fecha) */}
           {/* <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                 <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
           </TouchableOpacity>*/}

          <View style={styles.iconContainer}>
            <Ionicons
              name={achievement.iconUnlocked as any} // Use o ícone desbloqueado
              size={60}
              color={colors.primary} // Cor de destaque
            />
          </View>

          <Text style={styles.title}>Conquista Desbloqueada!</Text>
          <Text style={styles.achievementName}>{achievement.name}</Text>
          <Text style={styles.achievementDescription}>{achievement.description}</Text>

          {achievement.points && (
            <Text style={styles.pointsText}>+{achievement.points} pontos!</Text> // Mostra pontos se existirem
          )}

          <TouchableOpacity style={[styles.confirmButton, { backgroundColor: colors.primary }]} onPress={onClose}>
             <Text style={styles.confirmButtonText}>Legal!</Text>
           </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end', // Alinha na parte inferior
      alignItems: 'center',
      backgroundColor: colors.backgroundModalScrim, // Fundo semi-transparente
    },
    contentContainer: {
      width: '95%', // Largura do modal
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 15,
      padding: 25,
      paddingBottom: Platform.OS === 'ios' ? 40 : 30,
      alignItems: 'center',
      marginBottom: 20, // Espaço da borda inferior
       shadowColor: '#000',
       shadowOffset: { width: 0, height: -3 },
       shadowOpacity: 0.15,
       shadowRadius: 8,
       elevation: 10,
    },
    iconContainer: {
      marginBottom: 15,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    achievementName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primary, // Destaque no nome
      marginBottom: 8,
      textAlign: 'center',
    },
    achievementDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 15,
    },
    pointsText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.success, // Cor para pontos
        marginBottom: 20,
    },
    confirmButton: {
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 25,
        marginTop: 10,
    },
    confirmButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
     /*closeButton: { // Estilo para botão de fechar opcional
       position: 'absolute',
       top: 10,
       right: 10,
     },*/
  });