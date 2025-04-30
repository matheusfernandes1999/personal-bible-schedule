// app/(tabs)/pregacao/index.tsx
import React, { useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router"; // Para navegação
import MyActiveRecords from "@/components/pregacao/MyActiveRecords";
import { ADMIN_CATEGORY, TERRITORY_SERVANT_CATEGORY } from "@/types";
import IconeIcon from "@/assets/icons/icone";

export default function PregacaoScreen() {
  const { colors } = useTheme();
  const { loading: authLoading, userData, isAdmin, userCategories } = useAuth(); // Pega loading e dados do usuário
  const router = useRouter();
  const navigation = useNavigation();

  // Função de navegação para Gerenciar Territórios
  const navigateToTerritoryManagement = () => {
    router.push("/screens/pregacao/cartoes");
  };

  const navigateToRegisterWork = () => {
    router.push("/screens/pregacao/registro");
  };

  const navigateToInsights = () => {
    router.push("/screens/pregacao/insightsPregacao");
  };

  const styles = createStyles(colors);

  // Mostra loading enquanto o AuthContext carrega
  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  if (!userData?.congregationId) {
      return (
          <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
              <IconeIcon
                size={80}
                color={colors.textSecondary}
              />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Associe-se a uma congregação.
              </Text>
              <Text style={[styles.infoTextSmall, { color: colors.textMuted, marginTop: 5 }]}>
                  Use a aba 'Congregação' para encontrar ou criar uma.
              </Text>
          </View>
      );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}
      contentContainerStyle={styles.scrollContent}
    >
      <MyActiveRecords />
      {
  // Verifica se o usuário tem congregationId E (é Servo de Território OU é Admin)
  userData?.congregationId && (
    (userCategories?.includes(TERRITORY_SERVANT_CATEGORY) ?? false) ||
    (userCategories?.includes(ADMIN_CATEGORY) ?? false)
  )
  && ( // Se a condição acima for verdadeira, renderiza este bloco JSX
    <>
      <View style={styles.cardsContainer}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundSecondary,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={navigateToTerritoryManagement}
        activeOpacity={0.7}
      >
        <Ionicons name="map-outline" size={40} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Cartões de Territórios
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Visualize, adicione e edite os cartões de território.
        </Text>
        <Ionicons
          name="chevron-forward-outline"
          size={24}
          color={colors.textMuted}
          style={styles.cardChevron}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundSecondary,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={navigateToRegisterWork} // <<< Chama a nova função de navegação
        activeOpacity={0.7}
      >
        <Ionicons name="pencil-outline" size={40} color={colors.secondary} />
        {/* Ícone diferente e cor secundária */}
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Registros de Território
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Marque territórios como trabalhados ou devolva cartões.
        </Text>
        <Ionicons
          name="chevron-forward-outline"
          size={24}
          color={colors.textMuted}
          style={styles.cardChevron}
        />
      </TouchableOpacity>

      {isAdmin && 
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundSecondary,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={navigateToInsights} // <<< Chama a nova função de navegação
        activeOpacity={0.7}
      >
        <Ionicons name="flash" size={40} color={colors.secondary} />
        {/* Ícone diferente e cor secundária */}
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Insights do Território
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Veja informações relevantes sobre o trabalho no território.
        </Text>
        <Ionicons
          name="chevron-forward-outline"
          size={24}
          color={colors.textMuted}
          style={styles.cardChevron}
        />
      </TouchableOpacity>}
      </View>
      </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      alignItems: "center", // Centraliza os cards horizontalmente
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    infoText: {
      fontSize: 17,
      textAlign: "center",
      fontWeight: "500",
    },
    infoTextSmall: {
      fontSize: 14,
      textAlign: "center",
    },
    cardsContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 16
    },
    card: {
      width: '100%',
      maxWidth: 300,
      borderRadius: 12,
      padding: 15,
      paddingHorizontal: 25,
      alignItems: "center", // Centraliza ícone e textos
      // Sombras
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 4,
      position: "relative", // Para posicionar o chevron
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 15,
      marginBottom: 5,
    },
    cardDescription: {
      fontSize: 14,
      textAlign: "center",
      marginBottom: 10,
    },
    cardChevron: {
      position: "absolute",
      right: 15,
      top: "50%",
      transform: [{ translateY: -12 }], // Centraliza verticalmente
    },
  
  });
