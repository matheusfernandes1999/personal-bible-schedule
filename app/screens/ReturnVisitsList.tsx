// screens/ReturnVisitsListScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native'; // Usar useFocusEffect é melhor para listas
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    Timestamp, // Importar Timestamp
    QuerySnapshot, // Importar QuerySnapshot
    DocumentData, // Importar DocumentData
} from 'firebase/firestore';
import { format } from 'date-fns'; // Para formatar data
import { ptBR } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import TopBar from '@/components/Components/TopBar';

// Interface para os dados de cada item da lista
interface ReturnVisitListItem {
    id: string; // ID do documento no Firestore
    name: string;
    lastVisitDate: Date | null; // Já convertido para Date para facilitar
    initialNotes?: string;
    // Adicione outros campos se quiser exibir na lista
}

export default function ReturnVisitsListScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user } = useAuth();

    const [visitsList, setVisitsList] = useState<ReturnVisitListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Usar useFocusEffect para buscar dados sempre que a tela ganhar foco
    useFocusEffect(
        useCallback(() => {
            if (!user?.uid) {
                setVisitsList([]);
                setIsLoading(false);
                setError("Usuário não autenticado.");
                return;
            }

            console.log("Setting up listener for return visits...");
            setIsLoading(true);
            setError(null);

            const visitsRef = collection(db, 'users', user.uid, 'returnVisits');
            // Ordenar pela data da última visita, mais recente primeiro
            const q = query(visitsRef, orderBy('lastVisitDate', 'desc'));

            const unsubscribe = onSnapshot(q,
                (querySnapshot: QuerySnapshot<DocumentData>) => {
                    console.log(`Received ${querySnapshot.size} return visit documents.`);
                    const fetchedVisits: ReturnVisitListItem[] = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        // Converte Timestamp do Firestore para objeto Date do JS
                        const lastVisitTs = data.lastVisitDate as Timestamp | undefined;
                        fetchedVisits.push({
                            id: doc.id,
                            name: data.name || 'Nome não definido',
                            lastVisitDate: lastVisitTs ? lastVisitTs.toDate() : null,
                            initialNotes: data.initialNotes,
                        });
                    });
                    setVisitsList(fetchedVisits);
                    setIsLoading(false);
                },
                (err) => {
                    console.error("Erro ao buscar revisitas:", err);
                    setError("Não foi possível carregar as revisitas.");
                    setIsLoading(false);
                });

            // Função de limpeza que será chamada quando a tela perder o foco
            return () => {
                 console.log("Cleaning up listener for return visits.");
                 unsubscribe();
            };
        }, [user?.uid]) // Dependência no ID do usuário
    );

    const handleNavigateToAdd = () => {
        router.push('/screens/AddReturnVisitScreen')
    };

    const handleNavigateToDetail = (visitId: string) => {
        router.push({
            pathname: '/screens/ReturnVisitDetailScreen', // Path to your screen file
            params: { visitId: visitId }, // Pass data as query params
        });
    };
    const renderVisitItem = ({ item }: { item: ReturnVisitListItem }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => handleNavigateToDetail(item.id)}
        >
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.lastVisitDate && (
                    <Text style={styles.itemDate}>
                        Última visita: {format(item.lastVisitDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </Text>
                )}
                 {item.initialNotes && (
                    <Text style={styles.itemNotes} numberOfLines={1}>
                         {item.initialNotes}
                    </Text>
                 )}
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
    );

    const ListEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="person-add-outline" size={60} color={colors.textPrimary} style={{marginBottom: 15}}/>
            <Text style={styles.emptyText}>Nenhuma revisita registrada ainda.</Text>
            <Text style={styles.emptySubText}>Clique em '+' para adicionar a primeira.</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <TopBar title='Minhas Revisitas' />
            
            <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleNavigateToAdd}
            >
                <Ionicons name="person-add" size={24} color={colors.white} />
                <Text style={styles.addButtonText}>Nova Revisita</Text>
            </TouchableOpacity>


            {isLoading ? (
                <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
            ) : error ? (
                <View style={styles.emptyContainer}>
                     <Ionicons name="cloud-offline-outline" size={60} color={colors.error} style={{marginBottom: 15}}/>
                     <Text style={[styles.emptyText, {color: colors.error}]}>{error}</Text>
                 </View>
            ) : (
                <FlatList
                    data={visitsList}
                    renderItem={renderVisitItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={ListEmptyComponent} // Componente para lista vazia
                />
            )}
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
    },
    addButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 10,
      },
      addButtonText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
      },
     headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Alinha título à esquerda e botão à direita
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.backgroundSecondary, // Cor de fundo opcional para header
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    listContentContainer: {
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 80, // Espaço para o botão flutuante não cobrir o último item
    },
    itemContainer: {
        backgroundColor: colors.backgroundSecondary,
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
         elevation: 1,
    },
    itemTextContainer: {
        flex: 1, // Ocupa o espaço disponível, empurrando o ícone para a direita
        marginRight: 10,
    },
    itemName: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 13,
        color: colors.textSecondary,
    },
     itemNotes: { // Estilo opcional para notas
        fontSize: 13,
        color: colors.textPrimary,
        fontStyle: 'italic',
        marginTop: 3,
     },
    loader: {
        marginTop: 50,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: 50,
    },
    emptyText: {
        fontSize: 17,
        color: colors.textSecondary,
        textAlign: 'center',
        fontWeight: 'bold',
    },
     emptySubText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
     },
    fab: {
        // Posicionamento absoluto no canto inferior direito (se preferir)
        // position: 'absolute',
        // bottom: 25,
        // right: 25,
        // --- Posicionamento relativo no header ---
        backgroundColor: colors.primary,
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: 2 },
         shadowOpacity: 0.3,
         shadowRadius: 3,
    },
});