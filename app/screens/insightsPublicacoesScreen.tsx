// screens/InsightsPublicacoesScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, Unsubscribe, doc, getDoc, orderBy } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { PublicationItem } from '@/types'; // Importa tipo de Publicação
import TopBar from '@/components/Components/TopBar';
import { Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';

// --- Interfaces para Insights ---
interface PublicationInsightItem {
    id: string; // itemCode
    description: string;
    categoryPT?: string;
    currentQuantity: number | null;
    monthlyMovement: number | null;
    stockLevel?: 'zero' | 'low' | 'ok' | 'high'; // Para status de estoque
}

interface CategoryMovement {
    categoryPT: string;
    totalMovement: number;
    itemCount: number;
}

// --- Funções Auxiliares --- (Reutiliza formatMonthYear)
const formatMonthYear = (date: Date | null, format: 'display' | 'id'): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const monthIndex = date.getMonth(); // 0-11
    if (format === 'id') {
        return `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
    } else {
        try {
            return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        } catch (e) {
             const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
             return `${monthNames[monthIndex]} ${year}`;
        }
    }
};

const LOW_STOCK_MONTHS = 1; // Considera estoque baixo se for menor que X meses de movimento
const HIGH_STOCK_MONTHS = 4; // Considera estoque alto se for maior que X meses de movimento
const LOW_STOCK_ABSOLUTE_THRESHOLD = 5; // Limite absoluto baixo se não houver movimento

// --- Componente Principal da Tela ---
export default function InsightsPublicacoesScreen() {
    const { colors } = useTheme();
    const { userData, loading: authLoading } = useAuth();
    const [inventory, setInventory] = useState<PublicationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null);
    const [monthExists, setMonthExists] = useState<boolean | null>(null);

    // Define data inicial (mês atual) após autenticação
    useEffect(() => {
        if (!authLoading && userData?.congregationId && !selectedMonthDate) {
            setSelectedMonthDate(new Date());
        }
        if (!userData?.congregationId) {
            setSelectedMonthDate(null);
            setInventory([]);
            setMonthExists(null);
        }
    }, [authLoading, userData?.congregationId, selectedMonthDate]);

    // Busca inventário do mês selecionado
    useEffect(() => {
        if (authLoading || !userData?.congregationId || !selectedMonthDate) {
            setLoading(false);
            setInventory([]);
            setMonthExists(null);
            return;
        }

        setLoading(true);
        setInventory([]);
        setMonthExists(null);
        const congregationId = userData.congregationId;
        let unsubscribeListener: Unsubscribe | null = null;

        const monthId = formatMonthYear(selectedMonthDate, 'id');
        console.log(`[InsightsPubs] Fetching inventory for month ID: ${monthId}`);

        const monthItemsCollectionRef = collection(db, "congregations", congregationId, "publications", monthId, "items");
        const monthDocumentRef = doc(db, "congregations", congregationId, "publications", monthId);

        getDoc(monthDocumentRef).then(docSnapshot => {
            if (docSnapshot.exists()) {
                setMonthExists(true);
                // Ordena por descrição por padrão ao buscar
                const inventoryQuery = query(monthItemsCollectionRef, orderBy("description"));

                unsubscribeListener = onSnapshot(inventoryQuery, (snapshot) => {
                    const inventoryData: PublicationItem[] = [];
                    snapshot.forEach((itemDoc) => {
                        inventoryData.push({ id: itemDoc.id, ...itemDoc.data() } as PublicationItem);
                    });
                    setInventory(inventoryData);
                    setLoading(false);
                    console.log(`[InsightsPubs] ${inventoryData.length} items loaded for ${monthId}.`);
                }, (error) => {
                    console.error(`[InsightsPubs] Error fetching inventory for ${monthId}:`, error);
                    showMessage({ message: "Erro ao Carregar", description: "Não foi possível carregar o inventário.", type: "danger" });
                    setInventory([]);
                    setLoading(false);
                    setMonthExists(null);
                });

            } else {
                console.log(`[InsightsPubs] Document for month ${monthId} not found.`);
                setInventory([]);
                setMonthExists(false);
                setLoading(false);
            }
        }).catch(error => {
            console.error(`[InsightsPubs] Error checking month existence for ${monthId}:`, error);
            showMessage({ message: "Erro de Verificação", description: "Não foi possível verificar os dados do mês.", type: "danger" });
            setInventory([]);
            setMonthExists(null);
            setLoading(false);
        });

        return () => { if (unsubscribeListener) unsubscribeListener(); };
    }, [userData?.congregationId, authLoading, selectedMonthDate]);

    // --- Cálculos dos Insights ---

    // 1. Itens com Maior Movimento Mensal (Saída)
    const highestDemandItems = useMemo<PublicationInsightItem[]>(() => {
        if (loading || inventory.length === 0) return [];
        console.log("[InsightsPubs] Calculating highest demand...");
        return inventory
            .filter(item => item.monthlyMovement != null && item.monthlyMovement > 0) // Filtra itens com movimento > 0
            .sort((a, b) => (b.monthlyMovement ?? 0) - (a.monthlyMovement ?? 0)) // Ordena por movimento desc
            .slice(0, 10) // Pega os top 10
            .map(item => ({ // Mapeia para o tipo de insight
                id: item.id ?? item.itemCode,
                description: item.description,
                categoryPT: item.categoryPT,
                currentQuantity: item.currentQuantity,
                monthlyMovement: item.monthlyMovement ?? null, // Garantir que seja null em vez de undefined
            }));
    }, [inventory, loading]);

    // 2. Itens com Estoque Baixo ou Zerado
    const stockAlertItems = useMemo<PublicationInsightItem[]>(() => {
        if (loading || inventory.length === 0) return [];
        console.log("[InsightsPubs] Calculating low/zero stock...");
        return inventory
            .map(item => {
                let stockLevel: PublicationInsightItem['stockLevel'] = 'ok';
                const qty = item.currentQuantity ?? -1; // Trata null como -1 para simplificar
                const move = item.monthlyMovement ?? 0;

                if (qty <= 0) {
                    stockLevel = 'zero';
                } else if (move > 0 && qty < move * LOW_STOCK_MONTHS) {
                    stockLevel = 'low'; // Baixo relativo ao movimento
                } else if (move <= 0 && qty < LOW_STOCK_ABSOLUTE_THRESHOLD) {
                    stockLevel = 'low'; // Baixo absoluto (sem movimento)
                }
                // Poderia adicionar 'high' aqui também se quisesse juntar tudo
                // else if (move > 0 && qty > move * HIGH_STOCK_MONTHS) {
                //     stockLevel = 'high';
                // }

                return { // Mapeia para o tipo de insight
                    id: item.id ?? item.itemCode,
                    description: item.description,
                    categoryPT: item.categoryPT,
                    currentQuantity: item.currentQuantity,
                    monthlyMovement: item.monthlyMovement ?? null,
                    stockLevel: stockLevel
                };
            })
            .filter(item => item.stockLevel === 'low' || item.stockLevel === 'zero') // Filtra apenas baixos/zerados
            .sort((a, b) => (a.currentQuantity ?? -1) - (b.currentQuantity ?? -1)); // Ordena por quantidade atual asc (zerados primeiro)
    }, [inventory, loading]);

    // 3. Resumo do Movimento por Categoria
    const categoryMovementSummary = useMemo<CategoryMovement[]>(() => {
        if (loading || inventory.length === 0) return [];
        console.log("[InsightsPubs] Calculating category movement...");
        const summary: { [category: string]: { totalMovement: number; itemCount: number } } = {};

        inventory.forEach(item => {
            const category = item.categoryPT || item.category || 'Sem Categoria';
            const movement = item.monthlyMovement ?? 0;
            if (!summary[category]) {
                summary[category] = { totalMovement: 0, itemCount: 0 };
            }
            if (movement > 0) { // Soma apenas se houver movimento
                 summary[category].totalMovement += movement;
            }
            summary[category].itemCount++;
        });

        return Object.entries(summary)
            .map(([categoryPT, data]) => ({ categoryPT, ...data }))
            .filter(cat => cat.totalMovement > 0) // Mostra apenas categorias com algum movimento
            .sort((a, b) => b.totalMovement - a.totalMovement); // Ordena por movimento desc

    }, [inventory, loading]);

    // --- Navegação de Mês ---
    const goToPreviousMonth = () => {
        setSelectedMonthDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : new Date());
    };
    const goToNextMonth = () => {
        setSelectedMonthDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : new Date());
    };

    // --- Renderização ---
    const styles = useMemo(() => createStyles(colors), [colors]); // Memoiza estilos

    // Estado inicial de loading ou sem data selecionada
    if (authLoading || selectedMonthDate === null && userData?.congregationId) {
        return (
             <>
                <TopBar title='Insights Publicações' showBackButton={true} />
                <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></View>
             </>
        );
    }
    // Estado sem congregação
    if (!userData?.congregationId && !authLoading) {
        return (
             <>
                <TopBar title='Insights Publicações' showBackButton={true} />
                <View style={[styles.container, styles.centered]}><Text style={styles.infoText}>Associe-se a uma congregação.</Text></View>
             </>
        );
    }

    return (
        <>
            <TopBar title='Insights Publicações' showBackButton={true} />
            <ScrollView
                style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Seletor de Mês */}
                <View style={styles.monthNavigator}>
                    <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton} disabled={loading}>
                        <Ionicons name="chevron-back" size={24} color={loading ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.monthText, { color: colors.textPrimary }]}>
                        {formatMonthYear(selectedMonthDate, 'display').toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} disabled={loading}>
                        <Ionicons name="chevron-forward" size={24} color={loading ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Conteúdo Principal */}
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
                ) : monthExists === false ? (
                     <View style={styles.centered}>
                         <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 15 }} />
                         <Text style={styles.emptyText}>
                             Nenhum inventário encontrado para {formatMonthYear(selectedMonthDate, 'display')}.
                         </Text>
                         <Text style={[styles.emptyText, { fontSize: 14, color: colors.textMuted, marginTop: 5 }]}>
                             Importe o arquivo CSV na tela de Publicações.
                         </Text>
                     </View>
                ) : inventory.length === 0 && monthExists === true ? (
                     <View style={styles.centered}>
                        <Ionicons name="file-tray-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 15 }} />
                        <Text style={styles.emptyText}>
                            O inventário para {formatMonthYear(selectedMonthDate, 'display')} está vazio.
                        </Text>
                     </View>
                ) : (
                    <>
                        {/* 1. Maior Saída */}
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="trending-up-outline" size={20} color={colors.success} />
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                    Maior Saída (Movimento Mensal)
                                </Text>
                            </View>
                            {highestDemandItems.length === 0 ? (
                                <Text style={styles.emptyText}>Nenhum item com movimento registrado.</Text>
                            ) : (
                                highestDemandItems.map(item => (
                                    <View key={item.id} style={styles.listItem}>
                                        <View style={styles.itemInfo}>
                                            <Text style={[styles.itemDesc, { color: colors.textPrimary }]}>{item.description}</Text>
                                            <Text style={[styles.itemCat, { color: colors.textSecondary }]}>{item.categoryPT}</Text>
                                        </View>
                                        <View style={styles.itemValueContainer}>
                                             <Text style={[styles.itemValueBold, { color: colors.success }]}>
                                                 {item.monthlyMovement?.toFixed(1) ?? 'N/A'}
                                             </Text>
                                             <Text style={styles.itemValueLabel}>/mês</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* 2. Estoque Baixo/Zerado */}
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="warning-outline" size={20} color={colors.warning} />
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                    Alerta de Estoque (Baixo ou Zerado)
                                </Text>
                            </View>
                            {stockAlertItems.length === 0 ? (
                                <Text style={styles.emptyText}>Nenhum item com estoque baixo ou zerado.</Text>
                            ) : (
                                stockAlertItems.map(item => (
                                    <View key={item.id} style={[styles.listItem, item.stockLevel === 'zero' && { backgroundColor: colors.warning + '15' }]}>
                                        <View style={styles.itemInfo}>
                                            <Text style={[styles.itemDesc, { color: colors.textPrimary }]}>{item.description}</Text>
                                            <Text style={[styles.itemCat, { color: colors.textSecondary }]}>
                                                 {item.categoryPT}
                                                 {item.monthlyMovement != null && ` (Saída: ${item.monthlyMovement.toFixed(1)}/mês)`}
                                            </Text>
                                        </View>
                                         <View style={styles.itemValueContainer}>
                                             <Text style={[styles.itemValueBold, { color: item.stockLevel === 'zero' ? colors.warning : colors.warning }]}>
                                                 {item.currentQuantity ?? 'Erro'}
                                             </Text>
                                             <Text style={styles.itemValueLabel}>atual</Text>
                                         </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* 3. Movimento por Categoria */}
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="file-tray-stacked-outline" size={20} color={colors.primary} />
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                    Movimento Total por Categoria
                                </Text>
                            </View>
                            {categoryMovementSummary.length === 0 ? (
                                <Text style={styles.emptyText}>Nenhuma categoria com movimento registrado.</Text>
                            ) : (
                                categoryMovementSummary.map(cat => (
                                    <View key={cat.categoryPT} style={styles.listItem}>
                                        <View style={styles.itemInfo}>
                                            <Text style={[styles.itemDesc, { color: colors.textPrimary, fontWeight: '500' }]}>{cat.categoryPT}</Text>
                                            <Text style={[styles.itemCat, { color: colors.textSecondary }]}>{cat.itemCount} itens na categoria</Text>
                                        </View>
                                         <View style={styles.itemValueContainer}>
                                             <Text style={[styles.itemValueBold, { color: colors.primary }]}>
                                                 {cat.totalMovement.toFixed(1)}
                                            </Text>
                                            <Text style={styles.itemValueLabel}>saída/mês</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                         {/* Adicionar mais seções de insights aqui (ex: Estoque Alto) */}

                    </>
                )}
            </ScrollView>
        </>
    );
}

// --- Estilos --- (Adaptados da tela de Insights Vida Cristã)
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    infoText: { fontSize: 16, textAlign: 'center', color: colors.textSecondary, padding: 20 },
    loadingIndicator: { marginTop: 40, },
    monthNavigator: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        ...shadowStyle(colors), // Reusa shadowStyle se definido
    },
    navButton: {
        padding: 8,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
        color: colors.textPrimary,
    },
    sectionContainer: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        marginBottom: 16,
        ...shadowStyle(colors), // Reusa shadowStyle se definido
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
        marginLeft: 10, // Espaço após o ícone
        color: colors.textPrimary,
        flex: 1, // Permite que o texto quebre se necessário
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        padding: 20, // Aumenta padding
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth, // Linha mais fina
        borderBottomColor: colors.border,
    },
    itemInfo: {
        flex: 1, // Ocupa espaço disponível
        marginRight: 10,
    },
    itemDesc: {
        fontSize: 15,
        fontWeight: '500', // Normal weight unless specified
        marginBottom: 2,
    },
    itemCat: {
        fontSize: 12,
        // color set inline
    },
    itemValueContainer: {
         alignItems: 'flex-end', // Alinha valor e label à direita
    },
    itemValueBold: {
         fontSize: 16,
         fontWeight: '700',
         // color set inline
    },
    itemValueLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
});

// Helper para sombra (se não existir globalmente)
const shadowStyle = (colors: any) => ({
    shadowColor: colors.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, // Reduzido raio da sombra
    elevation: 3, // Ajustado elevation
});