// screens/insightsPregacao.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, Unsubscribe, Timestamp, where } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { TerritoryRecordData, TerritoryCardData } from '@/types'; // Importa tipos necessários
import { showMessage } from 'react-native-flash-message';
import TerritoryProgress from '@/components/pregacao/TerritoryProgress';
import TopBar from '@/components/Components/TopBar';
import { Ionicons } from '@expo/vector-icons';

// Interface para armazenar estatísticas calculadas
interface TerritoryStats {
    cardId: string;
    cardNumber: string;
    city: string;
    section: string;
    timesWorked: number;
    durations: number[]; // Duração em dias para cada vez que foi trabalhado
    lastReturnDate?: Timestamp | Date | null;
}

interface LocationStats {
    name: string; // Nome da cidade ou seção
    totalCards: number;
    totalTimesWorked: number;
    averageDuration?: number; // Média de dias para cobrir um cartão na localidade
    sectionDurations?: { [section: string]: number[] }; // Para cálculo da média por seção
}

  const formatDate = (date: Timestamp | Date | undefined | null): string => {
      if (!date) return 'N/A';
      const jsDate = (date instanceof Timestamp) ? date.toDate() : date;
      return jsDate.toLocaleDateString();
  };

// Função auxiliar para calcular diferença em dias
const calculateDurationDays = (start: Timestamp | Date | null | undefined, end: Timestamp | Date | null | undefined): number | null => {
    if (!start || !end) return null;
    const startDate = (start instanceof Timestamp) ? start.toDate() : start;
    const endDate = (end instanceof Timestamp) ? end.toDate() : end;
    // Zera horas para comparar apenas dias completos
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime < 0) return null; // Data final antes da inicial
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays); // Retorna 0 se for no mesmo dia
};

// Função auxiliar para calcular média
const calculateAverage = (numbers: number[]): number | undefined => {
    if (!numbers || numbers.length === 0) return undefined;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / numbers.length); // Arredonda para dias inteiros
};

export default function InsightsPregacaoScreen() {
  const { colors } = useTheme();
  const { userData, loading: authLoading } = useAuth();
  const [allRecords, setAllRecords] = useState<TerritoryRecordData[]>([]);
  const [allCards, setAllCards] = useState<TerritoryCardData[]>([]); // <<< Necessário para agrupar por cidade/seção
  const [loading, setLoading] = useState(true);

  // Busca todos os registros e cartões
  useEffect(() => {
    if (authLoading || !userData?.congregationId) {
      setLoading(false);
      setAllRecords([]);
      setAllCards([]);
      return;
    }

    setLoading(true);
    const congregationId = userData.congregationId;
    let unsubRecords: Unsubscribe | null = null;
    let unsubCards: Unsubscribe | null = null;
    let recordsLoaded = false;
    let cardsLoaded = false;

    // Listener para Registros
    const recordsRef = collection(db, "congregations", congregationId, "territoryRecords");
    // Busca todos os registros (ativos e completos)
    const qRecords = query(recordsRef);
    unsubRecords = onSnapshot(qRecords, (snapshot) => {
      const recordsData: TerritoryRecordData[] = [];
      snapshot.forEach((doc) => recordsData.push({ id: doc.id, ...doc.data() } as TerritoryRecordData));
      setAllRecords(recordsData);
      recordsLoaded = true;
      if (cardsLoaded) setLoading(false); // Para loading se ambos carregaram
      console.log(`Insights: ${recordsData.length} registros carregados.`);
    }, (error) => {
      console.error("Erro ao buscar registros:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar o histórico.", type: "danger" });
      setLoading(false);
    });

    // Listener para Cartões
    const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
    const qCards = query(cardsRef);
    unsubCards = onSnapshot(qCards, (snapshot) => {
        const cardsData: TerritoryCardData[] = [];
        snapshot.forEach((doc) => cardsData.push({ id: doc.id, ...doc.data() } as TerritoryCardData));
        setAllCards(cardsData);
        cardsLoaded = true;
        if (recordsLoaded) setLoading(false); // Para loading se ambos carregaram
        console.log(`Insights: ${cardsData.length} cartões carregados.`);
    }, (error) => {
        console.error("Erro ao buscar cartões:", error);
        showMessage({ message: "Erro", description: "Não foi possível carregar os cartões.", type: "danger" });
        setLoading(false);
    });

    // Limpeza
    return () => {
      if (unsubRecords) unsubRecords();
      if (unsubCards) unsubCards();
    };
  }, [userData?.congregationId, authLoading]);

  // --- Cálculos dos Insights ---
  const insights = useMemo(() => {
    if (loading || allRecords.length === 0 || allCards.length === 0) {
      return null; // Retorna null se carregando ou sem dados
    }

    const cardStatsMap = new Map<string, TerritoryStats>();
    const cityStats: { [city: string]: LocationStats } = {};

    // Inicializa cardStatsMap com todos os cartões
    allCards.forEach(card => {
        if (card.id) {
            cardStatsMap.set(card.id, {
                cardId: card.id,
                cardNumber: card.cardNumber,
                city: card.city || 'N/A',
                section: card.section || 'N/A',
                timesWorked: 0,
                durations: [],
                lastReturnDate: card.lastReturnDate
            });
        }
    });

    // Processa os registros completos para calcular estatísticas
    allRecords.forEach(record => {
      if (record.status === 'Completo' && record.cardId && record.startDate && record.endDate) {
        const stats = cardStatsMap.get(record.cardId);
        if (stats) {
          stats.timesWorked++;
          const duration = calculateDurationDays(record.startDate, record.endDate);
          if (duration !== null) {
            stats.durations.push(duration);
          }
        }
      }
    });

    // Converte o Map para Array e ordena
    const cardStatsArray = Array.from(cardStatsMap.values());
    const sortedByTimesWorked = [...cardStatsArray].sort((a, b) => b.timesWorked - a.timesWorked);
    
    // Calcula estatísticas por cidade e seção
    cardStatsArray.forEach(stats => {
        const city = stats.city;
        const section = stats.section;

        // Inicializa cidade se não existir
        if (!cityStats[city]) {
            cityStats[city] = {
                name: city,
                totalCards: 0,
                totalTimesWorked: 0,
                sectionDurations: {}
            };
        }
        // Inicializa seção se não existir
        if (!cityStats[city].sectionDurations![section]) {
            cityStats[city].sectionDurations![section] = [];
        }

        cityStats[city].totalCards++;
        cityStats[city].totalTimesWorked += stats.timesWorked;
        cityStats[city].sectionDurations![section].push(...stats.durations); // Adiciona durações da seção
    });

    // Calcula médias por cidade e seção
    Object.values(cityStats).forEach(cityStat => {
        let cityTotalDurationSum = 0;
        let cityTotalCompletedRecords = 0;
        Object.values(cityStat.sectionDurations!).forEach(sectionDurations => {
            cityTotalDurationSum += sectionDurations.reduce((a, b) => a + b, 0);
            cityTotalCompletedRecords += sectionDurations.length;
        });
        cityStat.averageDuration = calculateAverage(Object.values(cityStat.sectionDurations!).flat()); // Média geral da cidade

    });

    // Ordena cidades por nome
    const sortedCities = Object.values(cityStats).sort((a, b) => a.name.localeCompare(b.name));

    return {
      mostWorked: sortedByTimesWorked.slice(0, 5), // Top 5 mais trabalhados
      leastWorked: sortedByTimesWorked.filter(s => s.timesWorked === 0).slice(0, 10), // Até 10 não trabalhados
      cityStats: sortedCities,
    };

  }, [allRecords, allCards, loading]); // Depende dos dados e do loading

  // --- Renderização ---
  const styles = createStyles(colors);

  if (authLoading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!userData?.congregationId) {
    return (
        <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
            <TopBar title='Insights da Pregação' showBackButton={true} />
            <Ionicons name="warning-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 15 }]}> Associe-se a uma congregação primeiro. </Text>
        </View>
    );
  }
  
    return (
      <>
      <TopBar title='Insights da Pregação' showBackButton={true} />

      <ScrollView style={[styles.container, { backgroundColor: colors.backgroundPrimary }]} contentContainerStyle={styles.scrollContent}>
        
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
        ) : !insights ? (
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Não há dados suficientes para gerar insights.</Text>
        ) : (
          <>
          <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📈 Progresso do Território</Text>
            <TerritoryProgress />
            </View>
  
            {/* Most Worked Cards Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🏆 Cartões Mais Trabalhados</Text>
              {insights.mostWorked.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum cartão trabalhado ainda.</Text>
              ) : (
                insights.mostWorked.map(card => (
                  <View key={card.cardId} style={styles.statsItem}>
                    <View style={styles.statsTextContainer}>
                      <Text style={[styles.statsPrimary, { color: colors.textPrimary }]}>
                        {card.cardNumber} 
                        <Text style={styles.statsSecondary}> ({card.section} de {card.city})</Text>
                      </Text>
                     
                      <Text style={[styles.statsValue, { color: colors.primary }]}>
                        {card.timesWorked} {card.timesWorked === 1 ? 'vez' : 'vezes'}
                      </Text>
                    </View>
                    <Text style={[styles.lastWorked, { color: colors.textSecondary }]}>
                        Último em: {formatDate(card.lastReturnDate)}
                    </Text>
                  </View>
                ))
              )}
            </View>
  
            {/* Average Time Card */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>⏱ Tempo Médio</Text>
              {insights.cityStats.length === 0 ? (
                <Text style={styles.emptyText}>Sem dados de tempo.</Text>
              ) : (
                insights.cityStats.map(cityStat => (
                  <View key={cityStat.name} style={styles.cityContainer}>
                    <View style={styles.cityHeader}>
                      <Text style={[styles.cityName, { color: colors.textPrimary }]}>{cityStat.name}</Text>
                      <Text style={[styles.cityAverage, { color: colors.textSecondary }]}>
                        Média: {cityStat.averageDuration ?? 'N/A'} dias
                      </Text>
                    </View>
                    
                    {Object.entries(cityStat.sectionDurations || {}).map(([sectionName, durations]) => {
                      const avg = calculateAverage(durations);
                      return (
                        <View key={sectionName} style={styles.statsItem}>
                          <View style={styles.statsTextContainer}>
                            <Text style={[styles.statsPrimary, { color: colors.textPrimary }]}>
                              {sectionName}
                            </Text>
                            <Text style={[styles.statsValue, { color: colors.textSecondary }]}>
                              {avg ?? 'N/A'} dias
                            </Text>
                          </View>
                          {avg && (
                            <View style={styles.progressContainer}>
                              <View style={[styles.progressBar, { 
                                width: `${Math.min(100, avg)}%`,
                                backgroundColor: colors.primary
                              }]} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
  
            {/* Never Worked Cards Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📭 Cartões Não Trabalhados</Text>
              {insights.leastWorked.length === 0 ? (
                <Text style={styles.emptyText}>Todos os cartões já foram trabalhados!</Text>
              ) : (
                insights.leastWorked.map(card => (
                  <View key={card.cardId} style={styles.statsItem}>
                    <Text style={[styles.statsPrimary, { color: colors.textPrimary }]}>
                      {card.cardNumber}
                      <Text style={styles.statsSecondary}> ({card.section} de {card.city})</Text>
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
      </>
    );
  }
  
  // --- Updated Styles ---
  const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    sectionContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statsItem: {
      backgroundColor: colors.backgroundPrimary,
      borderRadius: 8,
      padding: 12,
      marginVertical: 4,
    },
    statsTextContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    statsPrimary: {
      fontSize: 15,
      flex: 1,
    },
    statsSecondary: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statsValue: {
      fontSize: 15,
      fontWeight: '500',
      marginLeft: 8,
    },
    lastWorked: {
      fontSize: 8,
      fontWeight: '400',
    },
    cityContainer: {
      marginVertical: 8,
    },
    cityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cityName: {
      fontSize: 16,
      fontWeight: '500',
    },
    cityAverage: {
      fontSize: 14,
    },
    progressContainer: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: 2,
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 8,
    },
    loadingIndicator: {
      marginVertical: 24,
    },
    infoText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
      color: colors.textSecondary,
    },
  });