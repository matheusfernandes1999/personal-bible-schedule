// components/pregacao/TerritoriosList.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SectionList } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, onSnapshot, Unsubscribe, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TerritoryCardData } from '@/types';
import { showMessage } from 'react-native-flash-message';
import { Ionicons } from '@expo/vector-icons';

interface TerritoriosListProps {
  congregationId: string;
  // Callback unificado para ações de edição/exclusão
  onAction: (action: 'rename-city' | 'delete-city' | 'rename-section' | 'delete-section', city: string, section?: string) => void;
  // Callback para ver detalhes de uma seção
  onViewSectionDetails: (city: string, section: string) => void;
  // Opcional: para desabilitar botões enquanto outra ação está em progresso
  disabled?: boolean;
}

// Interface para os dados formatados para SectionList
interface SectionData {
  title: string; // Nome da Cidade
  data: { section: string; cardCount: number }[]; // Array de seções com contagem
}

const TerritoriosList: React.FC<TerritoriosListProps> = ({ congregationId, onAction, onViewSectionDetails, disabled = false }) => {
  const { colors } = useTheme();
  const [sectionsData, setSectionsData] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!congregationId) {
        setLoading(false);
        setSectionsData([]);
        console.warn("TerritoriosList: congregationId é nulo ou indefinido.");
        return;
    }
    console.log("TerritoriosList: Montando listener para congregationId:", congregationId);
    setLoading(true);
    const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
    const q = query(cardsRef, orderBy("city"), orderBy("section")); // Ordena para agrupamento

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const grouped: { [city: string]: { [section: string]: number } } = {};
      snapshot.forEach((doc) => {
        const card = doc.data() as TerritoryCardData;
        // Verifica se city e section existem antes de agrupar
        const city = card.city || 'Sem Cidade';
        const section = card.section || 'Sem Seção';

        if (!grouped[city]) grouped[city] = {};
        if (!grouped[city][section]) grouped[city][section] = 0;
        grouped[city][section]++;
      });

      // Formata para SectionList
      const formattedData: SectionData[] = Object.entries(grouped).map(([city, sections]) => ({
        title: city,
        data: Object.entries(sections).map(([section, count]) => ({
          section: section,
          cardCount: count,
        })).sort((a, b) => a.section.localeCompare(b.section)), // Ordena seções
      })).sort((a,b) => a.title.localeCompare(b.title)); // Ordena cidades

      console.log("TerritoriosList: Dados formatados:", formattedData.length, "cidades");
      setSectionsData(formattedData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar cartões para lista:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar a lista de territórios.", type: "danger" });
      setLoading(false);
    });

    return () => {
        console.log("TerritoriosList: Limpando listener.");
        unsubscribe();
    };
  }, [congregationId]); // Reexecuta se congregationId mudar

  const styles = createStyles(colors);

  if (loading) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />;
  }

  if (sectionsData.length === 0) {
    return <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum território cadastrado.</Text>;
  }

  return (
    <SectionList
      sections={sectionsData}
      keyExtractor={(item, index) => item.section + index} // Chave para itens da seção
      renderItem={({ item, section }) => (
        // --- Item da Seção ---
        <TouchableOpacity
            style={styles.sectionItemContainer}
            onPress={() => onViewSectionDetails(section.title, item.section)} // <<< Abre detalhes da seção
            activeOpacity={0.7}
            disabled={disabled} // Desabilita clique durante outra ação
        >
          <View style={styles.sectionInfo}>
            <Text style={[styles.sectionName, { color: colors.textPrimary }]}>{item.section}</Text>
            <Text style={[styles.cardCount, { color: colors.textSecondary }]}>{item.cardCount} cartão(s)</Text>
          </View>
        </TouchableOpacity>
      )}
      renderSectionHeader={({ section: { title } }) => (
        // --- Cabeçalho da Cidade ---
        <View style={styles.cityHeaderContainer}>
            <Text style={[styles.cityName, { color: colors.textPrimary }]}>{title}</Text>
            {/* Botões de Ação da Cidade */}
            <View style={styles.actionButtonsContainer}>
                {/* Botão Excluir Cidade (Desabilitado por enquanto) */}
                 <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onAction('delete-city', title)} // Chama onAction, mas a lógica pai vai tratar
                    disabled={disabled}
                 >
                    <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                 </TouchableOpacity>
            </View>
        </View>
      )}
      stickySectionHeadersEnabled={false} // Evita que headers fiquem fixos (opcional)
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum território encontrado.</Text>} // Mensagem se sectionsData for vazio após carregar
    />
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  loading: {
    marginTop: 40,
    flex: 1, // Para ocupar espaço se for a única coisa na tela
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    paddingHorizontal: 20, // Adiciona padding para centralizar melhor
    flex: 1, // Para ocupar espaço
  },
  list: {
    flex: 1, // Ocupa espaço disponível
  },
  listContent: {
      paddingBottom: 30, // Espaço no final
      flexGrow: 1, // Permite que o container cresça mesmo com poucos itens
  },
  cityHeaderContainer: { // Container para o header da cidade
    backgroundColor: colors.backgroundPrimary, // Fundo ligeiramente diferente
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginTop: 5, // Reduzido espaço entre cidades
    borderTopWidth: StyleSheet.hairlineWidth, // Borda superior para separar
    borderTopColor: colors.border,
    flexDirection: 'row', // <<< Alinha nome e botões
    justifyContent: 'space-between', // <<< Espaça nome e botões
    alignItems: 'center',
  },
  cityName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1, // <<< Permite que o nome ocupe espaço
    marginRight: 10, // <<< Espaço antes dos botões
  },
  sectionItemContainer: { // Container para o item da seção
    backgroundColor: colors.backgroundSecondary, // Fundo dos itens
    paddingVertical: 10, // <<< Reduzido padding vertical
    paddingLeft: 25, // Maior indentação
    paddingRight: 15, // Padding direito
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionInfo: { // Container para nome e contagem
    flex: 1, // Ocupa espaço disponível
    marginRight: 10, // Espaço antes dos botões
  },
  sectionName: {
    fontSize: 16,
    marginBottom: 2, // Pequeno espaço abaixo do nome
  },
  cardCount: {
    fontSize: 13, // Menor
  },
  actionButtonsContainer: { // Container para os botões de ação
      flexDirection: 'row',
      alignItems: 'center',
  },
  actionButton: {
      padding: 8, // Área de toque maior
      marginLeft: 8, // Espaço entre botões de ação
  },
});

export default TerritoriosList;
