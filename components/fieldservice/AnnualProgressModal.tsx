// src/components/fieldservice/AnnualProgressModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'; // Adicionar Platform
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { differenceInCalendarDays, getYear, getMonth, startOfDay, endOfMonth } from 'date-fns'; // Simplificado imports se não usar todos
import { SafeAreaView } from 'react-native-safe-area-context'; // <--- IMPORTAR SafeAreaView
import { Bar as ProgressBar } from 'react-native-progress';

interface AnnualProgressModalProps {
    isVisible: boolean;
    onClose: () => void;
    userId: any | null;
    monthlyReport: any;
    currentMonth: any
}

interface ReportSummary {
    year: number;
    month: number;
    hours: number;
}

const getCurrentServiceYearInfo = () => {
    const today = new Date();
    const currentMonth = getMonth(today); // 0-11
    const currentYear = getYear(today);
    const serviceYearStartYear = currentMonth >= 8 ? currentYear : currentYear - 1;
    const serviceYearEndYear = serviceYearStartYear + 1;
    const serviceYearStartDate = new Date(serviceYearStartYear, 8, 1); // 1 de Setembro
    const serviceYearEndDate = new Date(serviceYearEndYear, 7, 31); // 31 de Agosto
    return { serviceYearStartYear, serviceYearEndYear, serviceYearStartDate, serviceYearEndDate };
};

const getServiceYearInfo = () => {
  const today = new Date();
  const month = getMonth(today);
  const year = getYear(today);
  const startYear = month >= 8 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    startDate: new Date(startYear, 8, 1),
    endDate: new Date(endYear, 7, 31),
    startYear,
    endYear,
  };
};


export const AnnualProgressModal: React.FC<AnnualProgressModalProps> = ({
    isVisible,
    onClose,
    userId,
    monthlyReport,
    currentMonth
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [isLoading, setIsLoading] = useState(false);
    const [totalHours, setTotalHours] = useState(0);
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    const ANNUAL_TARGET = 600;
    const MONTHLY_TARGET = ANNUAL_TARGET / 12; // Meta mensal implícita

    // useEffect e fetchAnnualData (sem alterações na lógica interna)
    useEffect(() => {
        if (isVisible && userId) {
            fetchAnnualData();
        } else {
            setTotalHours(0);
            setReports([]);
            setError(null);
            setIsLoading(false);
        }
    }, [isVisible, userId]);

    const fetchAnnualData = async () => {
         if (!userId) return;
         setIsLoading(true);
         setError(null);
         setReports([]);
         setTotalHours(0);
         const { serviceYearStartYear, serviceYearEndYear } = getCurrentServiceYearInfo();
         try {
             const reportsRef = collection(db, 'users', userId, 'fieldServiceReports');
             const q = query(reportsRef, where('year', 'in', [serviceYearStartYear, serviceYearEndYear]));
             const querySnapshot = await getDocs(q);
             let hoursSum = 0;
             const relevantReports: ReportSummary[] = [];
             querySnapshot.forEach((doc) => {
                 const data = doc.data();
                 const reportYear = data.year as number;
                 const reportMonth = data.month as number;
                 if (
                     (reportYear === serviceYearStartYear && reportMonth >= 9) ||
                     (reportYear === serviceYearEndYear && reportMonth <= 8)
                 ) {
                     relevantReports.push({
                         year: reportYear, month: reportMonth,
                         hours: (data.hours as number) || 0,
                     });
                     hoursSum += (data.hours as number) || 0;
                 }
             });
             setTotalHours(hoursSum);
             setReports(relevantReports.sort((a,b) => a.year === b.year ? a.month - b.month : a.year - b.year));
         } catch (err) {
             console.error("Erro ao buscar dados anuais:", err);
             setError("Não foi possível calcular o progresso anual.");
         } finally {
             setIsLoading(false);
         }
    };

    // Cálculos de Progresso (sem alterações na lógica)
    const { serviceYearStartDate, serviceYearEndDate } = getCurrentServiceYearInfo();
    const today = startOfDay(new Date());
    let remainingDays = 0;
    if (today <= serviceYearEndDate) {
        remainingDays = differenceInCalendarDays(serviceYearEndDate, today) + 1;
    }

    // Date calculations
    const { endDate } = getServiceYearInfo();
    const daysLeftYear = today <= endDate ? differenceInCalendarDays(endDate, today) + 1 : 0;
    const remainingHoursYear = Math.max(0, ANNUAL_TARGET - totalHours);
    const dailyNeededYear = daysLeftYear > 0 ? remainingHoursYear / daysLeftYear : 0;

    const endOfMonthDate = endOfMonth(today);
    const daysLeftMonth = today <= endOfMonthDate ? differenceInCalendarDays(endOfMonthDate, today) + 1 : 0;
    const remainingHoursMonth = Math.max(0, MONTHLY_TARGET - monthlyReport);
    const dailyNeededMonth = daysLeftMonth > 0 ? remainingHoursMonth / daysLeftMonth : 0;
    
    // Evita divisão por zero se não houver relatórios ainda
    const monthsReportedCount = reports.length > 0 ? reports.length : 1;
    const currentMonthAverage = totalHours / monthsReportedCount;

    return (
        <Modal
            transparent
            animationType="slide" 
            visible={isVisible}
            onRequestClose={onClose}
        >
            {/* Overlay agora alinha no final */}
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                 {/* SafeAreaView para o conteúdo */}
                 <SafeAreaView style={styles.safeAreaContainer} edges={['bottom']}>
                    
                            {/* Handle (Opcional) para indicar que pode ser arrastado (visual) */}
                            <View style={styles.handleBar} />
                     {/* TouchableOpacity interno para evitar fechar ao clicar no conteúdo */}
                     <TouchableOpacity activeOpacity={1} style={styles.contentContainer} onPress={() => {}}>
                         <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Progresso Anual</Text>

                         </View>

                         {isLoading ? (
                             <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                         ) : error ? (
                             <Text style={styles.errorText}>{error}</Text>
                         ) : (
                             // Usar ScrollView com altura limitada se o conteúdo puder ser grande
                             <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                                 <View style={styles.progressItem}>
                                     <Text style={styles.progressLabel}>Ano de Serviço:</Text>
                                     <Text style={styles.progressValue}>Set/{getYear(serviceYearStartDate)} - Ago/{getYear(serviceYearEndDate)}</Text>
                                 </View>
                                
                                 <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Progresso Anual</Text>
                                    <Text style={styles.value}>{totalHours.toFixed(1)} / {ANNUAL_TARGET} h</Text>
                                    <ProgressBar
                                        progress={totalHours / ANNUAL_TARGET}
                                        width={null}
                                        height={8}
                                        borderRadius={4}
                                        style={styles.progressBar}
                                        color={colors.primary}
                                        unfilledColor={colors.backgroundSecondary}
                                    />
                                    <Text style={styles.smallText}>
                                        Faltam {remainingHoursYear.toFixed(1)} h em {daysLeftYear} dias (~{dailyNeededYear.toFixed(2)} h/dia)
                                    </Text>
                                    </View>

                                    {/* Progresso Mês Atual */}
                                    <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Progresso de {currentMonth}</Text>
                                    <ProgressBar
                                        progress={monthlyReport / MONTHLY_TARGET}
                                        width={null}
                                        height={8}
                                        borderRadius={4}
                                        style={styles.progressBar}
                                        color={colors.primary}
                                        unfilledColor={colors.backgroundSecondary}
                                    />
                                    <Text style={styles.smallText}>
                                        Falta fazer {remainingHoursMonth.toFixed(1)} h em {daysLeftMonth} dias
                                    </Text>
                                    <Text style={styles.smallText}>
                                        Para fechar: {dailyNeededMonth.toFixed(2)} h/dia
                                    </Text>
                                    </View>
                                    <View style={styles.progressItem}>
                                     <Text style={styles.progressLabelSmall}>Sua Média Mensal (até agora):</Text>
                                     <Text style={styles.progressValueSmall}>{currentMonthAverage.toFixed(1)} h/mês</Text>
                                 </View>
                             </ScrollView>
                         )}
                     </TouchableOpacity>
                 </SafeAreaView>
            </TouchableOpacity>
        </Modal>
    );
};

// --- Estilos ATUALIZADOS para o Modal ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end', // <--- MUDADO para alinhar em baixo
        backgroundColor: colors.backgroundModalScrim + 'AA', // Mais opaco talvez
    },
    safeAreaContainer: { // Container para SafeAreaView
       width: '100%',
       backgroundColor: colors.backgroundSecondary, // Cor de fundo aqui para cobrir área segura
       borderTopLeftRadius: 20, // Mover radius para cá
       borderTopRightRadius: 20,
    },
    contentContainer: {
        // backgroundColor removido daqui, pois está no safeAreaContainer
        paddingTop: 10, // Reduzir padding superior para handle/header
        paddingHorizontal: 15,
        paddingBottom: 10, // Padding inferior antes da área segura
        // Remover width, maxWidth, maxHeight, borderRadius daqui
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 }, // Sombra para cima
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10, // Elevação para Android
    },
     handleBar: { // Barra cinza opcional no topo
        width: 50,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginTop: 15, // Espaço acima da barra
        marginBottom: 10, // Espaço abaixo da barra
     },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15, 
         // borderBottomWidth: 1, // Pode remover se preferir sem linha
         // borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        flex: 1, // Ocupa espaço para centralizar (considerando o botão)
        textAlign: 'center', // Centraliza o título
    },
    loader: {
        marginVertical: 40,
        height: 200, // Altura mínima enquanto carrega
    },
    errorText: {
        color: colors.error,
        textAlign: 'center',
        marginVertical: 20,
        fontSize: 16,
         height: 200, // Altura mínima no erro
    },
     scrollContainer: {
        maxHeight: 700, // Define uma altura máxima para o scroll interno
     },
     scrollContent: {
        paddingBottom: 10,
        padding: 22 // Espaço extra no final do scroll
     },
    progressItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9, // Leve ajuste
    },
    progressLabel: {
        fontSize: 15,
        color: colors.textSecondary,
        flexShrink: 1, // Permite quebrar linha
        marginRight: 10,
    },
    progressValue: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'right',

    }, progressValueSmall: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    progressLabelSmall: {
        fontSize: 13,
        color: colors.textSecondary, // Mais suave
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
      },
      content: {
        paddingBottom: 20,
      },
      section: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
      },
      sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 6,
        textTransform: 'capitalize',
      },
      sectionValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
      },
      value: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 6,
      },
      progressBar: {
        marginBottom: 6,
      },
      smallText: {
        fontSize: 13,
        color: colors.textSecondary,
      },
});