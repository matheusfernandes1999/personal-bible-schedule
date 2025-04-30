// components/pregacao/TerritoryProgress.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // <<< Adiciona useCallback
import { View, Text, StyleSheet, ActivityIndicator, SectionList, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, onSnapshot, Unsubscribe, orderBy, Timestamp, where } from "firebase/firestore"; // <<< Importa where
import { db } from '@/lib/firebase';
import { TerritoryCardData, TerritoryRecordData } from '@/types'; // <<< Importa TerritoryRecordData
import { showMessage } from 'react-native-flash-message';
import { Ionicons } from '@expo/vector-icons';
import SectionCardViewerModal from './SectionCardViewerModal'; // <<< Importa o modal de visualização
import { useAuth } from '@/context/AuthContext';

// Interface para os dados formatados para SectionList
interface SectionProgress {
  section: string;
  totalCards: number;
  completedCards: number;
  percentage: number;
}

interface CityProgress {
  title: string; // Nome da Cidade
  data: SectionProgress[]; // Seções dentro da cidade
  cityTotalCards: number;
  cityCompletedCards: number;
  cityPercentage: number;
}

// Props do componente (simplificado, onSelectLocation removido pois a ação é interna)
interface TerritoryProgressProps {
}

const TerritoryProgress: React.FC<TerritoryProgressProps> = () => {
  const { colors } = useTheme();
    const { user, userData, loading: authLoading, isAdmin, userCategories } = useAuth();
  const [allCards, setAllCards] = useState<TerritoryCardData[]>([]);
  const [allRecords, setAllRecords] = useState<TerritoryRecordData[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Estados para o modal de visualização de cartões
  const [isCardViewerVisible, setIsCardViewerVisible] = useState(false);
  const [selectedLocationData, setSelectedLocationData] = useState<{ city: string; section: string } | null>(null);
  const congregationId = userData?.congregationId;
  const userId = user?.uid;
  // Busca todos os cartões da congregação
  useEffect(() => {


    if (!congregationId) { setLoadingCards(false); setAllCards([]); return; }
    setLoadingCards(true);
    const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
    const q = query(cardsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cardsData: TerritoryCardData[] = [];
      snapshot.forEach((doc) => cardsData.push({ id: doc.id, ...doc.data() } as TerritoryCardData));
      setAllCards(cardsData);
      setLoadingCards(false);
    }, (error) => { /* ... handle error ... */ setLoadingCards(false); });
    return () => unsubscribe();
  }, [congregationId]);

  // Busca todos os registros de trabalho
  useEffect(() => {
    if (!congregationId) { setLoadingRecords(false); setAllRecords([]); return; }
    setLoadingRecords(true);
    const recordsRef = collection(db, "congregations", congregationId, "territoryRecords");
    const q = query(recordsRef, orderBy("startDate", "desc")); // Ordena para pegar o mais recente
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: TerritoryRecordData[] = [];
      snapshot.forEach((doc) => recordsData.push({ id: doc.id, ...doc.data() } as TerritoryRecordData));
      setAllRecords(recordsData);
      setLoadingRecords(false);
    }, (error) => { /* ... handle error ... */ setLoadingRecords(false); });
    return () => unsubscribe();
  }, [congregationId]);

  // Processa os dados para calcular o progresso
  const progressData = useMemo<CityProgress[]>(() => {
    if (loadingCards || loadingRecords || allCards.length === 0) return [];

    // 1. Mapeia o último status de cada cartão
    const cardLastStatusMap = new Map<string, 'Completo' | 'Ativo'>();
    const recordsByCardId: { [cardId: string]: TerritoryRecordData[] } = {};
    allRecords.forEach(record => {
        if (!recordsByCardId[record.cardId]) recordsByCardId[record.cardId] = [];
        recordsByCardId[record.cardId].push(record);
    });
    Object.keys(recordsByCardId).forEach(cardId => {
        const sortedRecords = recordsByCardId[cardId].sort((a, b) => {
            const dateA = a.startDate instanceof Timestamp ? a.startDate.toMillis() : (a.startDate as Date).getTime();
            const dateB = b.startDate instanceof Timestamp ? b.startDate.toMillis() : (b.startDate as Date).getTime();
            return dateB - dateA; // Mais recente primeiro
        });
        if (sortedRecords.length > 0) cardLastStatusMap.set(cardId, sortedRecords[0].status);
    });

    // 2. Agrupa cartões e calcula progresso
    const grouped: { [city: string]: { [section: string]: { total: number; completed: number } } } = {};
    allCards.forEach(card => {
      const city = card.city || 'Sem Cidade';
      const section = card.section || 'Sem Seção';
      if (!grouped[city]) grouped[city] = {};
      if (!grouped[city][section]) grouped[city][section] = { total: 0, completed: 0 };
      grouped[city][section].total++;
      if (card.id && cardLastStatusMap.get(card.id) === 'Completo') {
        grouped[city][section].completed++;
      }
    });

    // 3. Formata para SectionList
    const formattedData: CityProgress[] = Object.entries(grouped).map(([city, sections]) => {
        let cityTotal = 0; let cityCompleted = 0;
        const sectionData = Object.entries(sections).map(([section, counts]) => {
            cityTotal += counts.total; cityCompleted += counts.completed;
            const percentage = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
            return { section, totalCards: counts.total, completedCards: counts.completed, percentage };
        }).sort((a, b) => a.section.localeCompare(b.section));
        const cityPercentage = cityTotal > 0 ? Math.round((cityCompleted / cityTotal) * 100) : 0;
        return { title: city, data: sectionData, cityTotalCards: cityTotal, cityCompletedCards: cityCompleted, cityPercentage: cityPercentage };
    }).sort((a, b) => a.title.localeCompare(b.title));

    return formattedData;
  }, [allCards, allRecords, loadingCards, loadingRecords]);

  // --- Callbacks para Modal ---
  const handlePresentCardViewer = useCallback((city: string, section: string) => {
    setSelectedLocationData({ city, section });
    setIsCardViewerVisible(true);
  }, []);

  const handleDismissCardViewer = useCallback(() => {
    setIsCardViewerVisible(false);
    setSelectedLocationData(null);
  }, []);

  // --- Renderização ---
  const styles = createStyles(colors);
  const isLoading = loadingCards || loadingRecords;

  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />;
  }

  if (progressData.length === 0 && !isLoading) {
    return <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum território encontrado para exibir progresso.</Text>;
  }

  const renderSectionItem = ({ item, section }: { item: SectionProgress; section: CityProgress }) => (
    <TouchableOpacity
      style={styles.sectionItem}
      onPress={() => handlePresentCardViewer(section.title, item.section)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionInfo}>
        <Text style={[styles.sectionName, { color: colors.textPrimary }]}>{item.section}</Text>
        <Text style={[styles.cardCount, { color: colors.textSecondary }]}>
          {item.completedCards} de {item.totalCards} concluídos
        </Text>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${item.percentage}%`,
                backgroundColor: colors.primary
              }
            ]}
          />
        </View>
        <Text style={[styles.percentageText, { color: colors.primary }]}>
          {item.percentage}%
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward-outline" 
        size={18} 
        color={colors.textMuted} 
      />
    </TouchableOpacity>
  );

  // Função para renderizar o cabeçalho da cidade
  const renderCityHeader = ({ section }: { section: CityProgress }) => (
    <View style={styles.cityHeader}>
      <View style={styles.cityHeaderContent}>
        <Text style={[styles.cityName, { color: colors.textPrimary }]}>🏙️ {section.title}</Text>
        <View style={styles.cityStats}>
          <Text style={[styles.cityPercentage, { color: colors.primary }]}>
            {section.cityPercentage}%
          </Text>
          <Text style={[styles.cityCount, { color: colors.textSecondary }]}>
            {section.cityCompletedCards}/{section.cityTotalCards}
          </Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill,
              { 
                width: `${section.cityPercentage}%`,
                backgroundColor: colors.primary
              }
            ]}
          />
        </View>
      </View>
    </View>
  );

  return (
    <>
        <SectionList
          sections={progressData}
          keyExtractor={(item, index) => item.section + index}
          renderItem={renderSectionItem}
          renderSectionHeader={renderCityHeader}
          stickySectionHeadersEnabled={false}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum progresso para exibir.</Text>}
        />

        {selectedLocationData && congregationId && (
            <SectionCardViewerModal
                isVisible={isCardViewerVisible}
                onClose={handleDismissCardViewer}
                congregationId={congregationId}
                city={selectedLocationData.city}
                section={selectedLocationData.section}
            />
        )}
    </>
  );
};
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  loading: {
    marginVertical: 24,
    flex: 1,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  cityHeader: {
    backgroundColor: colors.backgroundModalScrim,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cityHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cityPercentage: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  cityCount: {
    fontSize: 13,
  },
  sectionItem: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: 8,
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionInfo: {
    flex: 1,
    marginRight: 16,
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  cardCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  progressContainer: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
});

export default TerritoryProgress;