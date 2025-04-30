// screens/territorios-register.tsx
import React, { useState, useCallback, useEffect } from 'react'; // <<< Importa useEffect
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    TouchableOpacity, // <<< Importa TouchableOpacity
    FlatList, // Mantido para a lista de registros ativos
    Alert, // Mantido para handleReturnCard
    Platform // Para estilo do FAB
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons'; // <<< Importa Ionicons
import AdicionarRegistroModal from '@/components/pregacao/AdicionarRegistroModal';
import TopBar from '@/components/Components/TopBar'; 
import ActiveTerritoryRecords from '@/components/pregacao/ActiveTerritoryRecords';
import TerritoryProgress from '@/components/pregacao/TerritoryProgress';

export default function TerritoriosRegisterScreen() {
  const { colors } = useTheme();
  const { user, userData, loading: authLoading, isAdmin, userCategories } = useAuth();
  const [isAddRecordModalVisible, setIsAddRecordModalVisible] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false); // Loading para devolver


  // Abre o modal de adicionar registro
  const handlePresentAddRecordModal = useCallback(() => {
      setIsAddRecordModalVisible(true);
  }, []);

  // Fecha o modal de adicionar registro
  const handleDismissAddRecordModal = useCallback(() => {
      setIsAddRecordModalVisible(false);
  }, []);

  // Callback quando um registro é salvo com sucesso no modal
  const handleRecordSaved = () => {
      console.log("Registro salvo, lista de ativos deve atualizar.");
  };

  const styles = createStyles(colors);

  if (authLoading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!userData?.congregationId) {
    return (
        <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
            {/* <TopBar title="Registrar Trabalho" showBackButton={true} /> */} {/* Pode adicionar TopBar aqui também se não usar o header do Stack */}
            <Ionicons name="warning-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 15 }]}> Associe-se a uma congregação primeiro. </Text>
        </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
       <TopBar title='Registrar Trabalho' showBackButton={true} />

       <ScrollView contentContainerStyle={styles.scrollContent}>
           
            {userData?.congregationId && (
                <ActiveTerritoryRecords/>
            )}

       </ScrollView>

       {/* <<< Botão Flutuante Adicionado >>> */}
       <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handlePresentAddRecordModal} // <<< Abre o modal
            disabled={isProcessingAction}
        >
            <Ionicons name="add-outline" size={30} color={colors.white} />
        </TouchableOpacity>

       {/* <<< Renderiza o Modal de Adicionar Registro >>> */}
       {userData?.congregationId && (
            <AdicionarRegistroModal
                isVisible={isAddRecordModalVisible}
                onClose={handleDismissAddRecordModal}
                onSaveSuccess={handleRecordSaved}
                congregationId={userData.congregationId}
            />
       )}

       {/* Indicador de Processamento (para ação de devolver) */}
       {isProcessingAction && (
            <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
       )}
    </View>
  );
}

// --- Estilos ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, },
  scrollContent: { padding: 15, paddingBottom: 80, }, // <<< Aumenta padding inferior para FAB
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  infoText: { fontSize: 16, textAlign: 'center', },
  sectionContainer: { marginBottom: 25, backgroundColor: colors.backgroundSecondary, borderRadius: 8, padding: 15, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, },
  loadingIndicator: { marginTop: 20, marginBottom: 20 },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 15, color: colors.textSecondary, paddingBottom: 10, },
  recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, },
  recordInfo: { flex: 1, marginRight: 10, },
  recordCardNumber: { fontSize: 15, fontWeight: 'bold', },
  recordDate: { fontSize: 12, marginTop: 3, },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100, },
  // --- Estilos do FAB ---
  fab: {
      position: 'absolute', // <<< Posicionamento absoluto
      bottom: 25, // <<< Distância do fundo
      right: 25, // <<< Distância da direita
      width: 60,
      height: 60,
      borderRadius: 30, // <<< Metade da largura/altura para ser círculo
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6, // Sombra Android
      shadowColor: '#000', // Sombra iOS
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      zIndex: 10, // Garante que fique acima do ScrollView
  },
});
