import { Ionicons } from "@expo/vector-icons";
import { useTheme } from '@/context/ThemeContext';
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from "react-native";

    interface PlanSelectionProps {
        onSelectPlan: (planType: string, config?: any) => void;
        onOpenCustomModal: () => void; // novo
        isLoading: boolean;
        onClose?: () => void;
    }


    interface ReadingPlanCardProps {
        title: string;
        description: string;
        iconName: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
    }
  
export const ReadingPlanCard: React.FC<ReadingPlanCardProps> = ({ 
        title, 
        description, 
        iconName, 
        onPress 
    }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    return (
        <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
            <Ionicons name={iconName} size={32} color={colors.primary} style={styles.cardIcon} />
            <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDescription}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
    );
};

export const PlanSelection: React.FC<PlanSelectionProps> = ({ 
    onSelectPlan, 
    isLoading, 
    onOpenCustomModal, // Destructure the new prop 
    }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const planOptions = [
        { id: 'chaptersPerDay_1', title: "1 Capítulo por Dia", description: "Leia a Bíblia sequencialmente.", icon: "book-outline", config: { type: 'chaptersPerDay', chapters: 1 } },
        { id: 'chaptersPerDay_2', title: "2 Capítulos por Dia", description: "Avance um pouco mais rápido.", icon: "bookmarks-outline", config: { type: 'chaptersPerDay', chapters: 2 } },
        { id: 'totalDuration_6m', title: "Ler em 6 Meses", description: "Plano intensivo sequencial.", icon: "speedometer-outline", config: { type: 'totalDuration', durationMonths: 6 } },
        { id: 'totalDuration_1y', title: "Ler em 1 Ano", description: "Complete sequencialmente em um ano.", icon: "calendar-outline", config: { type: 'totalDuration', durationMonths: 12 } },
        { id: 'totalDuration_2y', title: "Ler em 2 Anos", description: "Ritmo sequencial mais tranquilo.", icon: "calendar-number-outline", config: { type: 'totalDuration', durationMonths: 24 } },
        { id: 'chronological_1y', title: "Ordem Cronológica", description: "Leia os eventos como ocorreram.", icon: "time-outline", config: { type: 'chronological', durationYears: 1 } },
    ];

    const handlePlanPress = (planType: string, config?: any) => {
        onSelectPlan(planType, config);
    };

    const handleCustomPlanPress = () => {
        onOpenCustomModal(); // Call the new handler passed via props
    };

    if (isLoading) {
        return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />;
    }

    return (
        <View style={styles.bottomSheetInnerContent}>

            <View style={styles.modalHeader}>
                <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
            </View>

            <Text style={styles.bottomSheetTitle}>Iniciar Novo Plano</Text>
                <ReadingPlanCard
                    key="custom"
                    title="Personalizar Leitura"
                    description="Escolha capítulos/dia e livro inicial."
                    iconName="options-outline" // Example icon
                    onPress={handleCustomPlanPress} // Use the specific handler
                />
            {planOptions.map((plan) => (
                <ReadingPlanCard
                    key={plan.id}
                    title={plan.title}
                    description={plan.description}
                    iconName={plan.icon as keyof typeof Ionicons.glyphMap}
                    onPress={() => handlePlanPress(plan.config.type, plan.config)}
                />
            ))}
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    bottomSheetInnerContent: { paddingHorizontal: 5, paddingBottom: 10, },
    bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 15, textAlign: 'center', paddingTop: 5, },
    closeButton: { marginTop: 20, padding: 12, alignItems: 'center', },
    closeButtonText: { fontSize: 16, fontWeight: 'bold', },

    cardContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, },
    cardIcon: { marginRight: 15, },
    cardTextContainer: { flex: 1, marginRight: 10, },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 3, },
    cardDescription: { fontSize: 13, color: colors.textSecondary, },
   
    modalHeader: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalHandle: {
        width: 40,
        height: 5,
        borderRadius: 4,
    },
});