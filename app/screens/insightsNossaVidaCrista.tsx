// screens/insightsNossaVidaCrista.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, Unsubscribe, Timestamp, where, orderBy } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { VidaCristaSchedule, VidaCristaAssignment, PersonData } from '@/types'; // Importa tipos necessários
import { showMessage } from 'react-native-flash-message';
import TerritoryProgress from '@/components/pregacao/TerritoryProgress'; // Mantido, mas pode ser removido se não for usado aqui
import { Ionicons } from '@expo/vector-icons';
import TopBar from '@/components/Components/TopBar';

// --- Interfaces para Insights ---
interface ParticipantMonthlyStats { name: string; personId?: string; mainCount: number; assistantCount: number; }
interface RepetitionInfo { name: string; weeks: string[]; } // Semanas consecutivas
interface GapInfo { name: string; lastAssignmentWeekId: string; gapWeeks: number; }
interface PartFrequency { partNumber: string | number; count: number; }
interface ParticipantPartFrequency { name: string; personId?: string; parts: PartFrequency[]; } // Frequência por pessoa
interface PairFrequency { main: string; assistant: string; count: number; }

// --- Funções Auxiliares ---
const getMonday = (d: Date): Date => {
    const date = new Date(d); date.setHours(0, 0, 0, 0);
    const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};
const formatDateForDocId = (d: Date): string => {
    const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`;
};
const getMonthBounds = (date: Date): { start: Date, end: Date } => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
const calculateDurationDays = (start: Timestamp | Date | null | undefined, end: Timestamp | Date | null | undefined): number | null => {
    if (!start || !end) return null;
    const startDate = (start instanceof Timestamp) ? start.toDate() : start;
    const endDate = (end instanceof Timestamp) ? end.toDate() : end;
    startDate.setHours(0, 0, 0, 0); endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime < 0) return null;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};
const calculateAverage = (numbers: number[]): number | undefined => {
    if (!numbers || numbers.length === 0) return undefined;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / numbers.length);
};
const formatDate = (date: Timestamp | Date | undefined | null): string => {
    if (!date) return 'N/A';
    const jsDate = (date instanceof Timestamp) ? date.toDate() : date;
    return jsDate.toLocaleDateString(); // Formato local padrão
};
const calculateWeekDifference = (date1: Date, date2: Date): number => {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const start1 = new Date(date1); start1.setHours(0,0,0,0);
    const start2 = new Date(date2); start2.setHours(0,0,0,0);
    // Arredonda para evitar problemas com horário de verão/pequenas diferenças
    return Math.round(Math.abs(start1.getTime() - start2.getTime()) / msPerWeek);
};
// --- Fim Funções Auxiliares ---


export default function InsightsNossaVidaCristaScreen() {
  const { colors } = useTheme();
  const { userData, loading: authLoading } = useAuth();
  const [schedules, setSchedules] = useState<VidaCristaSchedule[]>([]);
  const [people, setPeople] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date()); // Mês atual para análise mensal

  // Busca programações (últimos 3-4 meses para análise de gap/repetição) e pessoas
  useEffect(() => {
    if (authLoading || !userData?.congregationId) {
      setLoading(false); setSchedules([]); setPeople([]); return;
    }
    setLoading(true);
    const congregationId = userData.congregationId;
    let unsubSchedules: Unsubscribe | null = null;
    let unsubPeople: Unsubscribe | null = null;
    let schedulesLoaded = false; let peopleLoaded = false;

    const checkLoadingDone = () => { if (schedulesLoaded && peopleLoaded) setLoading(false); };

    // Listener para Programações (aumenta um pouco o período para análise de gap)
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4); // Pega 4 meses para garantir análise de gap de 3+ semanas
    const scheduleRef = collection(db, "congregations", congregationId, "nossaVidaCristaSchedule");
    const qSchedules = query(scheduleRef, where("weekStartDate", ">=", Timestamp.fromDate(getMonday(fourMonthsAgo))), orderBy("weekStartDate", "asc"));
    unsubSchedules = onSnapshot(qSchedules, (snapshot) => {
      const data: VidaCristaSchedule[] = [];
      snapshot.forEach(doc => data.push(doc.data() as VidaCristaSchedule));
      setSchedules(data);
      schedulesLoaded = true; checkLoadingDone();
      console.log(`InsightsVC: ${data.length} programações carregadas.`);
    }, (error) => { /* ... handle error ... */ setLoading(false); });

    // Listener para Pessoas
    const peopleRef = collection(db, "congregations", congregationId, "people");
    const qPeople = query(peopleRef, orderBy("name"));
    unsubPeople = onSnapshot(qPeople, (snapshot) => {
        const data: PersonData[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as PersonData));
        setPeople(data);
        peopleLoaded = true; checkLoadingDone();
        console.log(`InsightsVC: ${data.length} pessoas carregadas.`);
    }, (error) => { /* ... handle error ... */ setLoading(false); });

    return () => { if (unsubSchedules) unsubSchedules(); if (unsubPeople) unsubPeople(); };
  }, [userData?.congregationId, authLoading]);


  // --- Cálculos dos Insights ---

  // Participação Mensal
  const monthlyStats = useMemo<ParticipantMonthlyStats[]>(() => {
      if (loading || schedules.length === 0 || people.length === 0) return [];
      console.log("Calculando estatísticas mensais para:", selectedMonth.toLocaleDateString());
      const { start, end } = getMonthBounds(selectedMonth);
      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);
      const stats: { [name: string]: ParticipantMonthlyStats } = {};
      people.forEach(p => { stats[p.name] = { name: p.name, personId: p.id, mainCount: 0, assistantCount: 0 }; });
      schedules.forEach(schedule => {
          const weekStart = schedule.weekStartDate instanceof Timestamp ? schedule.weekStartDate : Timestamp.fromDate(schedule.weekStartDate);
          if (weekStart >= startTimestamp && weekStart <= endTimestamp) {
              schedule.assignments.forEach(assignment => {
                  if (stats[assignment.participantName]) stats[assignment.participantName].mainCount++;
                  else if (assignment.participantName) stats[assignment.participantName] = { name: assignment.participantName, mainCount: 1, assistantCount: 0 };
                  if (assignment.assistantName && stats[assignment.assistantName]) stats[assignment.assistantName].assistantCount++;
                  else if (assignment.assistantName) stats[assignment.assistantName] = { name: assignment.assistantName, mainCount: 0, assistantCount: 1 };
              });
          }
      });
      return Object.values(stats).filter(s => s.mainCount > 0 || s.assistantCount > 0).sort((a, b) => (b.mainCount + b.assistantCount) - (a.mainCount + a.assistantCount) || a.name.localeCompare(b.name));
  }, [schedules, people, selectedMonth, loading]);

  // Análise de Repetições e Gaps
  const repetitionAndGapAnalysis = useMemo(() => {
      if (loading || schedules.length < 2 || people.length === 0) return { repetitions: [], gaps: [] };
      console.log("Calculando Repetição/Gap...");
      const assignmentsByPerson: { [name: string]: { personId?: string, weeksData: { weekId: string, date: Date }[] } } = {};

      // 1. Agrupa semanas por pessoa
      schedules.forEach(schedule => {
          const weekStartDate = schedule.weekStartDate instanceof Timestamp ? schedule.weekStartDate.toDate() : schedule.weekStartDate;
          const weekId = formatDateForDocId(weekStartDate);
          const participants = new Set<string>(); // Usa Set para evitar duplicar nome na mesma semana
          schedule.assignments.forEach(assignment => {
              if(assignment.participantName) participants.add(assignment.participantName);
              if(assignment.assistantName) participants.add(assignment.assistantName);
          });
          participants.forEach(name => {
              if (!assignmentsByPerson[name]) {
                  const personDoc = people.find(p => p.name === name);
                  assignmentsByPerson[name] = { personId: personDoc?.id, weeksData: [] };
              }
              assignmentsByPerson[name].weeksData.push({ weekId, date: weekStartDate });
          });
      });

      const repetitions: RepetitionInfo[] = [];
      const gaps: GapInfo[] = [];

      // 2. Analisa cada pessoa
      Object.entries(assignmentsByPerson).forEach(([name, data]) => {
          if (data.weeksData.length < 2) return;
          const sortedWeeks = data.weeksData.sort((a, b) => a.date.getTime() - b.date.getTime());
          let consecutiveStartWeekId: string | null = null;
          let consecutiveCount = 0;

          for (let i = 1; i < sortedWeeks.length; i++) {
              const weekDiff = calculateWeekDifference(sortedWeeks[i].date, sortedWeeks[i - 1].date);
              if (weekDiff === 1) { // Semana consecutiva
                  if (consecutiveCount === 0) consecutiveStartWeekId = sortedWeeks[i - 1].weekId;
                  consecutiveCount++;
              } else { // Fim de sequência ou Gap
                  if (consecutiveCount > 0 && consecutiveStartWeekId) { // Se estava em sequência
                      repetitions.push({ name, weeks: [consecutiveStartWeekId, sortedWeeks[i - 1].weekId] });
                  }
                  consecutiveStartWeekId = null; consecutiveCount = 0; // Reseta sequência
                  if (weekDiff > 3) { // Verifica Gap
                      gaps.push({ name, lastAssignmentWeekId: sortedWeeks[i - 1].weekId, gapWeeks: weekDiff });
                  }
              }
          }
           if (consecutiveCount > 0 && consecutiveStartWeekId) { // Verifica sequência no final
                repetitions.push({ name, weeks: [consecutiveStartWeekId, sortedWeeks[sortedWeeks.length - 1].weekId] });
           }
      });

       gaps.sort((a, b) => b.gapWeeks - a.gapWeeks); // Ordena gaps
      console.log("Repetições:", repetitions.length, "Gaps > 3 semanas:", gaps.length);
      return { repetitions, gaps: gaps.slice(0, 10) }; // Limita gaps exibidos

  }, [schedules, people, loading]);

  // Frequência de Partes por Pessoa
  const partFrequency = useMemo<ParticipantPartFrequency[]>(() => {
      if (loading || schedules.length === 0 || people.length === 0) return [];
      console.log("Calculando Frequência de Parte...");
      const partsByUser: { [name: string]: { personId?: string, partsCount: { [partNum: string]: number } } } = {};

      schedules.forEach(schedule => {
          schedule.assignments.forEach(assignment => {
              const name = assignment.participantName;
              if (!name) return; // Pula se não houver participante principal
              const partNum = String(assignment.numero_parte);
              if (!partsByUser[name]) {
                   const personDoc = people.find(p => p.name === name);
                   partsByUser[name] = { personId: personDoc?.id, partsCount: {} };
              }
              partsByUser[name].partsCount[partNum] = (partsByUser[name].partsCount[partNum] || 0) + 1;
          });
      });

      return Object.entries(partsByUser).map(([name, data]) => ({
          name, personId: data.personId,
          parts: Object.entries(data.partsCount)
                      .map(([partNumber, count]) => ({ partNumber, count }))
                      .sort((a, b) => b.count - a.count) // Ordena partes por contagem desc
      }))
      .filter(p => p.parts.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)); // Ordena pessoas por nome

  }, [schedules, people, loading]);

  // Frequência de Pares
  const pairFrequency = useMemo<PairFrequency[]>(() => {
      if (loading || schedules.length === 0) return [];
      console.log("Calculando Frequência de Pares...");
      const pairCounts: { [pairKey: string]: number } = {};

      schedules.forEach(schedule => {
          schedule.assignments.forEach(assignment => {
              if (assignment.participantName && assignment.assistantName) {
                  const names = [assignment.participantName, assignment.assistantName].sort();
                  const pairKey = `${names[0]}|${names[1]}`;
                  pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
              }
          });
      });

      return Object.entries(pairCounts).map(([pairKey, count]) => {
                      const [main, assistant] = pairKey.split('|');
                      return { main, assistant, count };
                  })
                  .filter(p => p.count > 1) // Mostra apenas pares que repetiram
                  .sort((a, b) => b.count - a.count) // Ordena por contagem desc
                  .slice(0, 10); // Limita aos top 10
  }, [schedules, loading]);


  // --- Navegação de Mês ---
  const goToPreviousMonth = () => {
      setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
      setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };


  // --- Renderização ---
  const styles = createStyles(colors);

  if (authLoading) { return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View>; }
  if (!userData?.congregationId && !authLoading) { return <View style={[styles.container, styles.centered]}><Text style={styles.infoText}>Associe-se a uma congregação.</Text></View>; }

  
    return (
      <>
        <TopBar title='Insights Vida e Ministério' showBackButton={true} />
        <ScrollView 
          style={[styles.container, { backgroundColor: colors.backgroundPrimary }]} 
          contentContainerStyle={styles.scrollContent}
        >
          {/* Seletor de Mês */}
          <View style={styles.monthNavigator}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.monthText, { color: colors.textPrimary }]}>
              {selectedMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
  
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
          ) : (
            <>
              {/* Participação Mensal */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Participação em {selectedMonth.toLocaleString('pt-BR', { month: 'long' })}
                  </Text>
                </View>
                {monthlyStats.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma participação registrada</Text>
                ) : (
                  monthlyStats.map(stat => (
                    <View key={stat.personId || stat.name} style={styles.statsCard}>
                      <Text style={[styles.statsPrimary, { color: colors.textPrimary }]}>{stat.name}</Text>
                      <View style={styles.badgeContainer}>
                        <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {stat.mainCount} principal
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: colors.secondary + '15' }]}>
                          <Text style={[styles.badgeText, { color: colors.secondary }]}>
                            {stat.assistantCount} ajudante
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
  
              {/* Análise de Repetição/Gaps */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="repeat" size={20} color={colors.warning} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Repetições e Intervalos
                  </Text>
                </View>
                
                {repetitionAndGapAnalysis.repetitions.length > 0 && (
                  <>
                    <Text style={styles.subHeader}>Repetições consecutivas</Text>
                    {repetitionAndGapAnalysis.repetitions.map((info, index) => (
                      <View key={`rep-${index}`} style={styles.alertCard}>
                        <Ionicons name="warning" size={16} color={colors.warning} />
                        <Text style={[styles.alertText, { color: colors.textPrimary }]}>
                          {info.name} - {info.weeks[0]} a {info.weeks[1]}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
  
                {repetitionAndGapAnalysis.gaps.length > 0 && (
                  <>
                    <Text style={styles.subHeader}>Intervalos longos</Text>
                    {repetitionAndGapAnalysis.gaps.map((info, index) => (
                      <View key={`gap-${index}`} style={styles.alertCard}>
                        <Ionicons name="time-outline" size={16} color={colors.info} />
                        <Text style={[styles.alertText, { color: colors.textPrimary }]}>
                          {info.name} - {info.gapWeeks} semanas desde {info.lastAssignmentWeekId}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
  
                {(repetitionAndGapAnalysis.repetitions.length === 0 && 
                  repetitionAndGapAnalysis.gaps.length === 0) && (
                  <Text style={styles.emptyText}>Sem repetições ou intervalos longos</Text>
                )}
              </View>
  
              {/* Partes Mais Frequentes */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={20} color={colors.warning} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Partes Mais Realizadas
                  </Text>
                </View>
                
                {partFrequency.length === 0 ? (
                  <Text style={styles.emptyText}>Sem dados de frequência</Text>
                ) : (
                  partFrequency.map(personStats => (
                    <View key={personStats.personId || personStats.name} style={styles.listItem}>
                      <Text style={[styles.statsPrimaryBold, { color: colors.primary }]}>
                        {personStats.name}
                      </Text>
                      {personStats.parts.slice(0, 3).map(part => (
                        <View key={part.partNumber} style={styles.partItem}>
                          <Text style={[styles.partNumber, { color: colors.textSecondary }]}>
                            Parte {part.partNumber}
                          </Text>
                          <Text style={[styles.partCount, { color: colors.textPrimary }]}>
                            {part.count}x
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
  
              {/* Pares Mais Frequentes */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people" size={20} color={colors.success} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Pares Mais Frequentes
                  </Text>
                </View>
                
                {pairFrequency.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum par repetido</Text>
                ) : (
                  <View style={styles.pairGrid}>
                    {pairFrequency.map((pair, index) => (
                      <View key={`${pair.main}-${pair.assistant}`} style={styles.pairCard}>
                        <Text style={[styles.pairNames, { color: colors.textPrimary }]}>
                          {pair.main} + {pair.assistant}
                        </Text>
                        <Text style={[styles.pairCount, { color: colors.success }]}>
                          {pair.count}x
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </>
    );
  }
  
  // --- Estilos Atualizados ---
  const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    infoText: { fontSize: 16, textAlign: 'center', marginTop: 20, padding: 20 },
    loadingIndicator: { marginTop: 40, },
    statsItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: 16, },
    statsItemAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, }, // Sem borda inferior
    statsPrimary: { fontSize: 15, flex: 1, marginRight: 10, },
    statsPrimaryBold: { fontSize: 15, flex: 1, marginRight: 10, fontWeight: '500' },
    statsValue: { fontSize: 14, fontWeight: '500', },
    monthNavigator: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      ...shadowStyle(colors),
    },
    navButton: {
      padding: 8,
    },
    monthText: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    sectionContainer: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      marginBottom: 16,
      ...shadowStyle(colors),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      padding: 16,
    },
    statsCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    badgeContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    badge: {
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '500',
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 4,
      backgroundColor: colors.backgroundPrimary,
      borderRadius: 8,
      gap: 8,
    },
    alertText: {
      fontSize: 14,
      flex: 1,
    },
    listItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    partItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingLeft: 8,
    },
    partNumber: {
      fontSize: 14,
    },
    partCount: {
      fontSize: 14,
      fontWeight: '500',
    },
    pairGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 16,
    },
    pairCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundPrimary,
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    pairNames: {
      fontSize: 14,
      fontWeight: '500',
    },
    pairCount: {
      fontSize: 14,
      fontWeight: '700',
    },
    subHeader: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
  });
  
  const shadowStyle = (colors: any) => ({
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  });