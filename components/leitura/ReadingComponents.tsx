import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext'; 
import { Ionicons } from '@expo/vector-icons';
import { formatReference, getBookNameFromAbbrev } from '@/utils/bibleUtils';
import { ActivePlanCardProps } from '@/types';
import { showMessage } from 'react-native-flash-message';
import ConfirmationModal from '../common/ConfirmationModal';

export const ActivePlanCard: React.FC<ActivePlanCardProps> = ({
  schedule,
  currentAssignment,
  onMarkRead,
  onPausePlan,
  onDeletePlan,
  onRevertLastReading,
  onResumePlan,
  canRevert,
  canResume,
  isUpdatingProgress,
  isProcessingAction,
  isReverting,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  let planTitle = 'Plano de Leitura';
  try {
    const config = schedule.styleConfig;
    if (schedule.styleType === 'chaptersPerDay' && 'chapters' in config) {
      planTitle = `${config.chapters} Capítulo(s) por dia`;
    } else if (schedule.styleType === 'totalDuration' && 'durationMonths' in config) {
      planTitle = `Ler em ${config.durationMonths} meses`;
    } else if (schedule.styleType === 'chronological' && 'durationYears' in config) {
      const yearsText = config.durationYears === 1 ? '1 Ano' : `${config.durationYears} Anos`;
      planTitle = `Cronológico - ${yearsText}`;
    } else if (schedule.styleType === 'custom' && 'chapters' in config && 'startBookAbbrev' in config) {
      const bookName = getBookNameFromAbbrev(config.startBookAbbrev) || config.startBookAbbrev;
      planTitle = `Personalizado: ${config.chapters} capítulos por dia, iniciando em ${bookName}`;
    }
  } catch (error) {
    console.error("Error determining plan title:", error);
  }
  
  const progressPercent = schedule.progressPercent || 0;
  const isPaused = schedule.status === 'paused';
  const isCompleted = schedule.status === 'completed' || (progressPercent >= 100 && currentAssignment.length === 0);

  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const busy = isProcessingAction || isUpdatingProgress || isReverting;
  const disableMarkRead = busy || !currentAssignment.length || isCompleted || isPaused;
  const disableRevert = busy || !canRevert || isCompleted || isPaused;
  const disablePause = busy || isCompleted || isPaused;
  const disableResume = busy || !canResume || !isPaused;
  const disableDelete = busy;

  const assignmentText = currentAssignment.length
    ? currentAssignment.map(formatReference).join(', ')
    : 'Nenhuma leitura pendente.';

  const handlePause = () => {
    if (!disablePause) {
      onPausePlan(schedule.id);
    }
  };

  const handleDelete = () => {
    if (!disableDelete) {
        setIsDeleteConfirmVisible(true); // Apenas abre o modal
    }
  };

  // 4. Criar handleConfirmDelete
  const handleConfirmDelete = () => {
    // A verificação 'disableDelete' já foi feita antes de abrir o modal
    onDeletePlan(schedule.id);
    // Fecha o modal imediatamente. O estado 'isProcessingAction' controlará o loading.
    setIsDeleteConfirmVisible(false);
  };

  const handleCloseDeleteConfirm = () => {
    setIsDeleteConfirmVisible(false);
  }

  const handleResume = (e?: GestureResponderEvent) => {
    e?.stopPropagation();
     if (!disableResume) {
         if (canResume) {
             onResumePlan(schedule.id);
         } else {
            showMessage({ 
              message: "Não é Possível Retomar", 
              description: "Só pode haver um plano ativo por vez. Pause ou conclua o plano ativo atual para poder retomar este.", 
              type: "warning", 
              icon: "warning" 
            });
             
         }
     }
  };

  const handleMarkRead = () => {
    if (!disableMarkRead) {
      onMarkRead(currentAssignment);
    }
  };

  const handleRevert = () => {
    if (!disableRevert) {
      onRevertLastReading();
    }
  };

  // --- Render Logic ---
  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{planTitle}</Text>
        <Text style={styles.progressTextTop}>{Math.round(progressPercent)}% Concluído</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarForeground, { width: `${progressPercent}%` }]} />
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {/* Status: Paused */}
        {isPaused && (
          <View style={styles.statusContainer}>
            <Ionicons name="pause-circle-outline" size={18} color={colors.warning} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Este plano está pausado.
            </Text>
          </View>
        )}

        {/* Status: Completed */}
        {isCompleted && (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              Plano Concluído!
            </Text>
          </View>
        )}

        {/* Assignment (Only if Active and Not Completed) */}
        {!isPaused && !isCompleted && (
          <>
            <Text style={styles.label}>Próxima Leitura:</Text>
            <Text style={styles.assignmentText}>
              {assignmentText}
            </Text>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: disableMarkRead ? colors.buttonDisabledBackground : colors.primary }
              ]}
              onPress={handleMarkRead}
              disabled={disableMarkRead}
              activeOpacity={0.7}
            >
              {isUpdatingProgress ? (
                <ActivityIndicator size="small" color={disableMarkRead ? colors.buttonDisabledText : colors.textOnPrimary} />
              ) : (
                <Text style={[
                  styles.primaryButtonText,
                  { color: disableMarkRead ? colors.buttonDisabledText : colors.textOnPrimary }
                ]}>
                  Marcar como Lido
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        {/* Resume Button (Shown when Paused) */}
        {isPaused && (
          <TouchableOpacity
            style={[styles.actionButton, styles.resumeButton, { backgroundColor: disableResume ? colors.buttonDisabledBackground : colors.success }]}
            onPress={handleResume}
            disabled={disableResume}
            activeOpacity={0.7}
          >
            {isProcessingAction && schedule.status === 'paused' ? ( // Check if this specific action is processing
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="play-outline" size={20} color={colors.white} />
                <Text style={[styles.actionButtonText, { color: colors.white }]}>Retomar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Pause Button (Shown when Active and Not Completed) */}
        {!isPaused && !isCompleted && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pauseButton, { borderColor: disablePause ? colors.buttonDisabledBackground : colors.warning }]}
            onPress={handlePause}
            disabled={disablePause}
            activeOpacity={0.7}
          >
           {isProcessingAction && schedule.status === 'active' ? ( // Check if this specific action is processing
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
               <>
                  <Ionicons name="pause-outline" size={20} color={disablePause ? colors.buttonDisabledText : colors.warning} />
                  <Text style={[styles.actionButtonText, { color: disablePause ? colors.buttonDisabledText : colors.warning }]}>Pausar</Text>
               </>
            )}
          </TouchableOpacity>
        )}

        {/* Revert Button (Shown when Active, Not Completed, and Can Revert) */}
        {!isPaused && !isCompleted && canRevert && (
          <TouchableOpacity
            style={[styles.actionButton, styles.revertButton, { borderColor: disableRevert ? colors.buttonDisabledBackground : colors.primary }]}
            onPress={handleRevert}
            disabled={disableRevert}
            activeOpacity={0.7}
          >
            {isReverting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="arrow-undo-outline" size={20} color={disableRevert ? colors.buttonDisabledText : colors.primary} />
                 <Text style={[styles.actionButtonText, { color: disableRevert ? colors.buttonDisabledText : colors.primary }]}>Desfazer</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Delete Button (Always shown unless Completed?) - Decide based on requirements */}
        {/* Let's show it always for now, except maybe completed */}
        {!isCompleted && (
           <TouchableOpacity
             style={[styles.actionButton, styles.deleteButton, { borderColor: disableDelete ? colors.buttonDisabledBackground : colors.error }]}
             onPress={handleDelete}
             disabled={disableDelete}
             activeOpacity={0.7}
           >
             {isProcessingAction ? ( // Might need a specific isDeleting flag if delete is slow
               <ActivityIndicator size="small" color={colors.error} />
             ) : (
               <>
                 <Ionicons name="trash-outline" size={20} color={disableDelete ? colors.buttonDisabledText : colors.error} />
                 <Text style={[styles.actionButtonText, { color: disableDelete ? colors.buttonDisabledText : colors.error }]}>Excluir</Text>
               </>
             )}
           </TouchableOpacity>
        )}
      </View>

      <ConfirmationModal
        isVisible={isDeleteConfirmVisible}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title="Excluir Plano"
        message="Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        isConfirming={isProcessingAction} // Reutiliza o estado de processamento geral
        confirmButtonStyle="destructive" // Define o botão de confirmação como destrutivo
      />
      
    </View>
  );
};

// --- Styles ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12, // Slightly larger radius
      padding: 18, // 
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 }, // Softer shadow
      shadowOpacity: 0.08, // Softer shadow
      shadowRadius: 6,
      elevation: 3,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start', // Align items top
      marginBottom: 8, // Space below header
    },
    title: {
      fontSize: 18, // Slightly larger title
      fontWeight: '600', // Semibold
      color: colors.textPrimary,
      flexShrink: 1, // Allow title to shrink if needed
      marginRight: 8, // Add space between title and percentage
    },
    progressTextTop: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2, // Align baseline better with title
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 8,
      marginBottom: 16, // Space below progress bar
    },
    progressBarForeground: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    contentArea: {
      marginBottom: 16, // Space before action buttons
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundPrimary, // Subtle background
      borderRadius: 8,
    },
    statusIcon: {
      marginRight: 8,
    },
    statusText: {
      fontSize: 15,
      fontWeight: '500',
      flexShrink: 1, // Allow text to wrap
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 6, // More space
      fontWeight: '500',
    },
    assignmentText: {
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16, // Space before Mark Read button
      lineHeight: 23, // Improved line height
    },
    primaryButton: {
      paddingVertical: 12, // Slightly more padding
      paddingHorizontal: 20,
      borderRadius: 8, // Keep rounded
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      minHeight: 46, // Ensure good touch target
      width: '100%', // Make button full width
    },
    primaryButtonText: {
      fontSize: 16, // Slightly larger
      fontWeight: '600', // Semibold
    },
    actionsRow: {
      flexDirection: 'row',
      // justifyContent: 'space-between', // Use gap for spacing
      flexWrap: 'wrap', // Allow buttons to wrap on smaller screens
      gap: 10, // Space between buttons
      borderTopColor: colors.border, // Add a separator line
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 10, // Space above action buttons
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12, // Adjust padding as needed
        borderRadius: 8, // Rounded corners for actions
        borderWidth: 1.5, // Slightly thicker border for outline buttons
        minHeight: 40, // Touch target size
        flexGrow: 1, // Allow buttons to grow and share space
        flexBasis: 'auto', // Let content determine initial size before growing
    },
    actionButtonText: {
        marginLeft: 6, // Space between icon and text
        fontSize: 14,
        fontWeight: '600',
    },
    // Specific button styles (borders/backgrounds handled inline via props/state)
    resumeButton: {
      // Background color set dynamically
    },
    pauseButton: {
      // Border color set dynamically
      backgroundColor: 'transparent', // Ensure background is clear for border styles
    },
     revertButton: {
       // Border color set dynamically
       backgroundColor: 'transparent',
     },
    deleteButton: {
       // Border color set dynamically
       backgroundColor: 'transparent',
    }
  });