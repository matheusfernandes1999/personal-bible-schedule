// screens/territorios.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

// Importa os componentes reais
import AdicionarTerritorioModal from "@/components/pregacao/AdicionarTerritorioModal";
import TerritoriosList from "@/components/pregacao/TerritoriosList";
import ConfirmationModal from "@/components/common/ConfirmationModal";
import SectionDetailModal from "@/components/pregacao/SectionDetailModal"; 
import {
  TERRITORY_SERVANT_CATEGORY,
  CongregationData,
} from "@/types";

import { showMessage } from "react-native-flash-message";
import {
  db
} from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  getDoc,
} from "firebase/firestore";
import TopBar from "@/components/Components/TopBar";

export default function TerritoriosScreen() {
  const { colors } = useTheme();
  const {
    isAdmin,
    userCategories,
    loading: authLoading,
    userData,
  } = useAuth();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 

  const [isConfirmDeleteSectionVisible, setIsConfirmDeleteSectionVisible] =
    useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<{
    city: string;
    section: string;
  } | null>(null);
  const [isConfirmDeleteCityVisible, setIsConfirmDeleteCityVisible] =
    useState(false); 
  const [cityToDelete, setCityToDelete] = useState<string | null>(null); 
  const [isSectionDetailVisible, setIsSectionDetailVisible] = useState(false);
  const [selectedSectionData, setSelectedSectionData] = useState<{
    city: string;
    section: string;
  } | null>(null);

  const canManageTerritories =
    isAdmin || (userCategories?.includes(TERRITORY_SERVANT_CATEGORY) ?? false);

    const handlePresentAddModal = useCallback(() => {
    if (!canManageTerritories) {
      showMessage({
        message: "Permissão Negada",
        description: "Você não tem permissão para adicionar territórios.",
        type: "warning",
      });
      return;
    }
    setIsAddModalVisible(true);
  }, [canManageTerritories]);

  const handleDismissAddModal = useCallback(
    () => setIsAddModalVisible(false),
    []
  );

  // Callback para fechar o modal de confirmação de exclusão
  const handleCloseConfirmDeleteSection = useCallback(() => {
    setIsConfirmDeleteSectionVisible(false);
    setSectionToDelete(null); // Limpa os dados do item a ser excluído
  }, []);

  // Callback para abrir o modal de detalhes da seção
  const handlePresentSectionDetail = useCallback(
    (city: string, section: string) => {
      setSelectedSectionData({ city, section });
      setIsSectionDetailVisible(true);
    },
    []
  );

  // Callback para fechar o modal de detalhes da seção
  const handleDismissSectionDetail = useCallback(() => {
    setIsSectionDetailVisible(false);
    setSelectedSectionData(null); // Limpa os dados da seção selecionada
  }, []);

  const handleCloseConfirmDeleteCity = useCallback(() => {
    // <<< Callback para fechar modal de excluir cidade
    setIsConfirmDeleteCityVisible(false);
    setCityToDelete(null);
  }, []);

  // --- Lógica de Edição / Exclusão ---

  // Função chamada pela TerritoriosList para qualquer ação
  const handleTerritoryListAction = (
    action: "rename-city" | "delete-city" | "rename-section" | "delete-section",
    city: string,
    section?: string
  ) => {
    if (!canManageTerritories) {
      showMessage({
        message: "Permissão Negada",
        description: "Você não tem permissão para realizar esta ação.",
        type: "warning",
      });
      return;
    }

    switch (action) {
      case "delete-city":
        confirmDeleteCity(city);
        break;
      case "delete-section":
        if (section) confirmDeleteSection(city, section);
        break;
    }
  };


  // --- Excluir Cidade ---
  const confirmDeleteCity = (cityName: string) => {
    // Fecha outros modais se estiverem abertos
    if (isSectionDetailVisible) handleDismissSectionDetail();
    if (isConfirmDeleteSectionVisible) handleCloseConfirmDeleteSection();

    setCityToDelete(cityName); // <<< Define a cidade a excluir
    setIsConfirmDeleteCityVisible(true); // <<< Abre o modal de confirmação
  };

  const deleteCity = async () => {
    if (!cityToDelete || !userData?.congregationId || !canManageTerritories) {
      handleCloseConfirmDeleteCity();
      return;
    }
    const cityName = cityToDelete;
    setIsProcessing(true); // Ativa loading geral
    const congregationId = userData.congregationId;

    try {
      const batch = writeBatch(db);

      // 1. Encontra todos os cartões na cidade a ser excluída
      const cardsRef = collection(
        db,
        "congregations",
        congregationId,
        "territoryCards"
      );
      const q = query(cardsRef, where("city", "==", cityName));
      const cardsSnapshot = await getDocs(q);

      // 2. Adiciona a exclusão de cada cartão ao batch
      cardsSnapshot.forEach((cardDoc) => {
        batch.delete(cardDoc.ref);
      });
      console.log(
        `Batch: Excluindo ${cardsSnapshot.size} cartões da cidade ${cityName}.`
      );

      // 3. Atualiza o documento da congregação para remover a cidade e suas seções
      const congDocRef = doc(db, "congregations", congregationId);
      // Lê os dados atuais FORA do batch para obter arrays/mapas
      const congDocSnap = await getDoc(congDocRef);
      if (congDocSnap.exists()) {
        const congData = congDocSnap.data() as CongregationData;
        const currentCities = congData.cities || [];
        const currentSectionsMap = congData.sectionsByCity || {};

        // Prepara as atualizações
        const updatedCities = currentCities.filter((c) => c !== cityName); // Remove a cidade do array
        delete currentSectionsMap[cityName]; // Remove a entrada do mapa de seções

        // Adiciona as atualizações ao batch
        batch.update(congDocRef, {
          cities: updatedCities,
          sectionsByCity: currentSectionsMap,
          // Alternativa para remover a chave do mapa se `delete` não funcionar como esperado no update:
          // [`sectionsByCity.${cityName}`]: deleteField() // Usa deleteField para remover a chave
        });
        console.log(
          `Batch: Removendo cidade ${cityName} do array cities e mapa sectionsByCity.`
        );
      } else {
        console.warn(
          "Documento da congregação não encontrado ao tentar remover cidade."
        );
      }

      // 4. Commita o batch
      await batch.commit();

      showMessage({
        message: "Sucesso",
        description: `Cidade "${cityName}", suas seções e cartões foram excluídos.`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Erro ao excluir cidade:", error);
      showMessage({
        message: "Erro ao Excluir",
        description: error.message || "Não foi possível excluir a cidade.",
        type: "danger",
      });
    } finally {
      setIsProcessing(false); // Desativa loading geral
      handleCloseConfirmDeleteCity(); // Fecha o modal de confirmação
    }
  };

  // --- Excluir Seção ---
  const confirmDeleteSection = (cityName: string, sectionName: string) => {
    // Fecha o modal de detalhes se estiver aberto
    if (isSectionDetailVisible) handleDismissSectionDetail();

    setSectionToDelete({ city: cityName, section: sectionName });
    setIsConfirmDeleteSectionVisible(true); // Abre modal de confirmação
  };

  const deleteSection = async () => {
    if (
      !sectionToDelete ||
      !userData?.congregationId ||
      !canManageTerritories
    ) {
      handleCloseConfirmDeleteSection();
      return;
    }
    const { city: cityName, section: sectionName } = sectionToDelete;
    setIsProcessing(true);
    const congregationId = userData.congregationId;
    try {
      const batch = writeBatch(db);
      const cardsRef = collection(
        db,
        "congregations",
        congregationId,
        "territoryCards"
      );
      const q = query(
        cardsRef,
        where("city", "==", cityName),
        where("section", "==", sectionName)
      );
      const cardsSnapshot = await getDocs(q); // Busca cartões a excluir

      cardsSnapshot.forEach((cardDoc) => batch.delete(cardDoc.ref)); // Adiciona exclusão ao batch
      console.log(
        `Batch: Excluindo ${cardsSnapshot.size} cartões da seção ${sectionName}.`
      );

      const congDocRef = doc(db, "congregations", congregationId);
      const congDocSnap = await getDoc(congDocRef); // Lê dados atuais da congregação
      if (congDocSnap.exists()) {
        const congData = congDocSnap.data() as CongregationData;
        const sectionsMap = congData.sectionsByCity || {};
        if (sectionsMap[cityName]) {
          // Remove a seção do array da cidade específica
          const updatedSectionsInCity = sectionsMap[cityName].filter(
            (s) => s !== sectionName
          );
          const updatedSectionsMap = {
            ...sectionsMap,
            [cityName]: updatedSectionsInCity,
          };
          // Se a cidade ficar sem seções, remove a chave da cidade? (Opcional)
          // if (updatedSectionsInCity.length === 0) delete updatedSectionsMap[cityName];
          batch.update(congDocRef, { sectionsByCity: updatedSectionsMap }); // Adiciona atualização ao batch
          console.log(
            `Batch: Removendo seção ${sectionName} do mapa sectionsByCity.`
          );
        }
      }
      await batch.commit(); // Executa o batch
      showMessage({
        message: "Sucesso",
        description: `Seção "${sectionName}" e seus cartões foram excluídos.`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Erro ao excluir seção:", error);
      showMessage({
        message: "Erro ao Excluir",
        description: error.message || "Não foi possível excluir a seção.",
        type: "danger",
      });
    } finally {
      setIsProcessing(false);
      handleCloseConfirmDeleteSection(); // Fecha o modal de confirmação
    }
  };

  // --- Renderização ---
  const styles = createStyles(colors);

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!userData?.congregationId && !authLoading) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
          style={styles.errorIcon}
        />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Congregação não identificada
        </Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Volte e tente novamente ou associe-se a uma congregação.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
      <TopBar title="Territórios" showBackButton={true} />

      {/* Botão Flutuante */}
      <TouchableOpacity
        style={[styles.fab, { 
          backgroundColor: colors.primary,
          shadowColor: colors.shadow
        }]}
        onPress={handlePresentAddModal}
        disabled={isProcessing}
      >
        <Ionicons name="add-outline" size={30} color={colors.white} />
      </TouchableOpacity>

      {/* Overlay de Processamento */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.textPrimary }]}>
              Processando...
            </Text>
          </View>
        </View>
      )}

      {/* Lista de Territórios */}
      {userData?.congregationId && (
        <TerritoriosList
          congregationId={userData.congregationId}
          onAction={handleTerritoryListAction}
          onViewSectionDetails={handlePresentSectionDetail}
          disabled={isProcessing}
        />
      )}

      {/* Modals */}
      {userData?.congregationId && (
        <AdicionarTerritorioModal
          isVisible={isAddModalVisible}
          onClose={handleDismissAddModal}
          congregationId={userData.congregationId}
        />
      )}

      <ConfirmationModal
        isVisible={isConfirmDeleteSectionVisible}
        onClose={handleCloseConfirmDeleteSection}
        onConfirm={deleteSection}
        title="Confirmar Exclusão de Seção"
        message={sectionToDelete ? `Tem certeza que deseja excluir a seção "${sectionToDelete.section}" em "${sectionToDelete.city}"?\n\nTodos os cartões desta seção serão removidos permanentemente.` : ""}
        confirmText="Excluir Seção"
        confirmButtonStyle="destructive"
        isConfirming={isProcessing}
      />

      <ConfirmationModal
        isVisible={isConfirmDeleteCityVisible}
        onClose={handleCloseConfirmDeleteCity}
        onConfirm={deleteCity}
        title="Confirmar Exclusão de Cidade"
        message={cityToDelete ? `Tem certeza que deseja excluir a cidade "${cityToDelete}"?\n\nTodas as seções e cartões serão removidos permanentemente.` : ""}
        confirmText="Excluir Cidade"
        confirmButtonStyle="destructive"
        isConfirming={isProcessing}
      />

      {selectedSectionData && userData?.congregationId && (
        <SectionDetailModal
          isVisible={isSectionDetailVisible}
          onClose={handleDismissSectionDetail}
          congregationId={userData.congregationId}
          city={selectedSectionData.city}
          section={selectedSectionData.section}
          onDeleteSection={confirmDeleteSection}
        />
      )}
    </View>
  );
}

// --- Estilos Atualizados ---
const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 10,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundModalScrim,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  processingContent: {
    backgroundColor: colors.backgroundSecondary,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});