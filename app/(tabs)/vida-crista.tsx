// app/(tabs)/vida-crista.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import { doc, onSnapshot, Unsubscribe, Timestamp, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"; // <<< Importa setDoc
import { db } from '@/lib/firebase';
import { VidaCristaSchedule, VidaCristaAssignment } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import EditAssignmentModal from '@/components/vidacrista/EditAssignmentModal'; // <<< Importa o modal de edição
import ImportScheduleModal from '@/components/vidacrista/ImportScheduleModal'; // <<< Importa o modal de importação
import { router } from 'expo-router';
import IconeIcon from '@/assets/icons/icone';

// Função para obter a data da segunda-feira da semana de uma data qualquer
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda, ...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  return new Date(date.setDate(diff));
};

// Função para formatar a data de início da semana para ID do documento (YYYY-MM-DD)
const formatDateForDocId = (d: Date): string => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Função para formatar a exibição da semana
const formatWeekDisplay = (startDate: Date): string => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Adiciona 6 dias para ter o domingo
    const startDay = startDate.getDate().toString().padStart(2, '0');
    const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const endDay = endDate.getDate().toString().padStart(2, '0');
    const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const year = startDate.getFullYear();
    return `${startDay}/${startMonth} - ${endDay}/${endMonth}/${year}`;
};


export default function VidaCristaScreen() {
  const { colors } = useTheme();
  const { user, userData, isAdmin, userCategories, loading: authLoading } = useAuth(); // Pega permissões se necessário
  const styles = createStyles(colors);

  // Estado para a data de início da semana atual (começa com a segunda-feira desta semana)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [schedule, setSchedule] = useState<VidaCristaSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState<VidaCristaAssignment | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false); // <<< Estado para modal de importação

  // Verifica permissão para editar (Exemplo: Admin ou categoria específica)
  const canEditSchedule = isAdmin; // Ajuste conforme necessário

  // Busca a programação da semana atual
  useEffect(() => {
    if (authLoading || !userData?.congregationId) {
      setScheduleLoading(false);
      setSchedule(null);
      return;
    }

    setScheduleLoading(true);
    const congregationId = userData.congregationId;
    const weekId = formatDateForDocId(currentWeekStart); // Formata a data para o ID
    console.log(`VidaCristaScreen: Buscando programação para semana ${weekId}`);

    const scheduleDocRef = doc(db, "congregations", congregationId, "nossaVidaCristaSchedule", weekId);

    const unsubscribe = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data() as VidaCristaSchedule);
        console.log(`VidaCristaScreen: Programação encontrada para ${weekId}`);
      } else {
        // Se não existe, define como null (ou um objeto vazio padrão)
        setSchedule(null);
        console.log(`VidaCristaScreen: Nenhuma programação encontrada para ${weekId}`);
      }
      setScheduleLoading(false);
    }, (error) => {
      console.error("Erro ao buscar programação da semana:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar a programação.", type: "danger" });
      setSchedule(null);
      setScheduleLoading(false);
    });

    return () => {
        console.log("VidaCristaScreen: Limpando listener da programação.");
        unsubscribe();
    };

  }, [currentWeekStart, userData?.congregationId, authLoading]); // Rebusca ao mudar a semana ou congregationId

  // --- Navegação entre Semanas ---
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // --- Edição de Designação ---
  const handlePresentEditModal = (assignment: VidaCristaAssignment) => {
      if (!canEditSchedule) {
           showMessage({ message: "Permissão Negada", description: "Você não tem permissão para editar.", type: "warning"});
           return;
      }
      setAssignmentToEdit(assignment);
      setIsEditModalVisible(true);
  };

  const handleDismissEditModal = () => {
      setIsEditModalVisible(false);
      setAssignmentToEdit(null);
  };

  const handleSaveAssignment = async (updatedAssignment: VidaCristaAssignment) => {
      if (!userData?.congregationId || !schedule || !user) return; // Verifica se temos schedule e usuário
      setIsSavingEdit(true);
      const congregationId = userData.congregationId;
      const weekId = formatDateForDocId(currentWeekStart);
      const scheduleDocRef = doc(db, "congregations", congregationId, "nossaVidaCristaSchedule", weekId);

      try {
          // Atualiza o array de designações no documento da semana
          const updatedAssignments = schedule.assignments.map(assign =>
              assign.id === updatedAssignment.id ? updatedAssignment : assign
          );

          await updateDoc(scheduleDocRef, {
              assignments: updatedAssignments,
              lastUpdatedAt: serverTimestamp(),
              updatedBy: user.uid,
          });

          showMessage({ message: "Sucesso", description: "Designação atualizada.", type: "success" });
          handleDismissEditModal(); // Fecha o modal

      } catch (error: any) {
          console.error("Erro ao salvar designação:", error);
          showMessage({ message: "Erro ao Salvar", description: error.message || "Não foi possível salvar as alterações.", type: "danger" });
      } finally {
          setIsSavingEdit(false);
      }
  };

  const handlePresentImportModal = useCallback(() => {
    if (!canEditSchedule) {
         showMessage({ message: "Permissão Negada", description: "Você não tem permissão para importar.", type: "warning"});
         return;
    }
    setIsImportModalVisible(true);
  }, [canEditSchedule]);
  const handleDismissImportModal = useCallback(() => setIsImportModalVisible(false), []);
  const handleImportSuccess = () => {
      console.log("Importação concluída com sucesso.");
      // A lista deve atualizar automaticamente se o listener estiver ativo para a semana importada
  };

  const renderAssignmentItem = ({ item }: { item: VidaCristaAssignment }) => {

    return (
      <TouchableOpacity
        style={[
          styles.assignmentCard,
          { 
            backgroundColor: colors.backgroundSecondary,
            borderLeftWidth: 4,
            borderLeftColor: isAdmin ? colors.primary : userCategories?.includes("Ajudante — Nossa Vida Cristã") ? colors.secondary : colors.success
          }
        ]}
        onPress={() => handlePresentEditModal(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.partInfo}>
            <Text style={[styles.partNumber, { color: colors.primary }]}>
              {item.numero_parte}
            </Text>
            {item.tempo && (
              <Text style={[styles.partTime, { color: colors.textMuted }]}>
                {item.tempo}
              </Text>
            )}
          </View>
          
          {canEditSchedule && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => handlePresentEditModal(item)}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {item.tema && (
          <Text style={[styles.partTheme, { color: colors.textPrimary }]}>
            {item.tema}
          </Text>
        )}

        <View style={styles.participantContainer}>
          <Ionicons name="person" size={16} color={colors.textSecondary} />
          <Text style={[styles.participantName, { color: colors.textPrimary }]}>
            {item.participantName}
          </Text>
        </View>

        {item.assistantName && (
          <View style={styles.assistantContainer}>
            <Ionicons name="people" size={16} color={colors.textSecondary} />
            <Text style={[styles.assistantName, { color: colors.textSecondary }]}>
              {item.assistantName}
            </Text>
          </View>
        )}

        {item.language && (
          <View style={styles.languageBadge}>
            <Text style={[styles.languageText, { color: colors.white }]}>
              {item.language.toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!userData?.congregationId) {
      return (
          <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
              <IconeIcon
                size={80}
                color={colors.textSecondary}
              />              
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Associe-se a uma congregação.
              </Text>
              <Text style={[styles.infoTextSmall, { color: colors.textMuted, marginTop: 5 }]}>
                  Use a aba 'Congregação' para encontrar ou criar uma.
              </Text>
          </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
      {/* Header da Semana */}
      <View style={styles.weekHeader}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={goToPreviousWeek}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.weekInfo}>
          <Text style={[styles.weekMonth, { color: colors.textSecondary }]}>
            {currentWeekStart.toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}
          </Text>
          <Text style={[styles.weekRange, { color: colors.textPrimary }]}>
            {formatWeekDisplay(currentWeekStart)}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.navButton} 
          onPress={goToNextWeek}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Botões de Ação Flutuantes */}
      {canEditSchedule && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handlePresentImportModal}
          >
            <Ionicons name="cloud-upload" size={24} color={colors.white} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/screens/insightsNossaVidaCrista')}
          >
            <Ionicons name="flash" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de Designações */}
      {scheduleLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando programação...
          </Text>
        </View>
      ) : !schedule || schedule.assignments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhuma programação encontrada
          </Text>
          {canEditSchedule && (
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Toque no botão para importar
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={schedule.assignments.sort((a, b) => 
            parseInt(String(a.numero_parte)) - parseInt(String(b.numero_parte)) || 
            String(a.numero_parte).localeCompare(String(b.numero_parte))
          )}
          renderItem={renderAssignmentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modais (mantidos com melhorias de estilo) */}
      <EditAssignmentModal
        isVisible={isEditModalVisible}
        onClose={handleDismissEditModal}
        assignment={assignmentToEdit}
        onSave={handleSaveAssignment}
        isSaving={isSavingEdit}
      />

      <ImportScheduleModal
        isVisible={isImportModalVisible}
        onClose={handleDismissImportModal}
        onImportSuccess={handleImportSuccess}
        congregationId={userData?.congregationId || ''}
      />
    </View>
  );
}

// --- Estilos Atualizados ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
  }, 
  navButton: {
    padding: 5,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  infoText: {
    fontSize: 17,
    textAlign: "center",
    fontWeight: "500",
  },
  infoTextSmall: {
    fontSize: 14,
    textAlign: "center",
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.backgroundSecondary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  weekInfo: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  weekMonth: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 24,
    right: 12,
    gap: 12,
    zIndex: 10,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  assignmentCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  partNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  partTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  partTheme: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
  },
  participantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  assistantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  assistantName: {
    fontSize: 14,
  },
  languageBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 16,
  },
  editButton: {
    padding: 8,
  },
});