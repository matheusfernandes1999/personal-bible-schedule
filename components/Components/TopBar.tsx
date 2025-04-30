// components/TopBar.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Platform,
  StatusBar // Import StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // Usando Ionicons como exemplo
import { useRouter } from 'expo-router';

import { useTheme } from '@/context/ThemeContext';

// Define as propriedades que o componente TopBar aceitará
interface TopBarProps {
  title: string;
  showBackButton?: boolean; // Controla a exibição do botão voltar
  onBackPress?: () => void; // Função customizada para o botão voltar
  rightComponent?: React.ReactNode; // Componente a ser renderizado à direita
  style?: StyleProp<ViewStyle>; // Estilos customizados para o container
}

const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56; // Altura padrão do header

export const TopBar: React.FC<TopBarProps> = ({
  title,
  showBackButton = false, // Padrão é não mostrar
  onBackPress,
  rightComponent,
  style,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets(); // Obtém os espaçamentos seguros
  const router = useRouter(); // Hook de roteamento do Expo Router

  // Função padrão para voltar, se nenhuma `onBackPress` for fornecida
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  // Calcula a altura total incluindo a safe area do topo
  const totalHeaderHeight = HEADER_HEIGHT + insets.top;

  return (
    // O View container principal aplica a cor de fundo e a altura total
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundSecondary,
          height: totalHeaderHeight,
          paddingTop: insets.top, // Adiciona padding apenas na área segura
        },
        style, // Permite sobrescrever estilos
      ]}
    >
      {/* Container para os elementos dentro da altura padrão do header */}
      <View style={styles.contentContainer}>
        {/* Lado Esquerdo: Botão Voltar ou Espaço Vazio */}
        <View style={styles.sideContainer}>
          {showBackButton && (
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.topBarTint} // Cor do ícone vinda do tema
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Centro: Título */}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: colors.textPrimary }]} // Cor do texto vinda do tema
            numberOfLines={1} // Garante que o título não quebre linha
          >
            {title}
          </Text>
        </View>

        {/* Lado Direito: Componente customizado ou Espaço Vazio */}
        <View style={styles.sideContainer}>
          {rightComponent ? rightComponent : null /* Renderiza o componente ou nada */}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // A altura e o paddingTop são definidos dinamicamente no componente
  },
  contentContainer: {
    flex: 1, // Ocupa a altura restante após o paddingTop (HEADER_HEIGHT)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Espaça os 3 containers (left, center, right)
    paddingHorizontal: 8, // Padding horizontal para não colar nas bordas
  },
  sideContainer: {
    // Define uma largura mínima para ajudar no alinhamento do título central
    // Pode ajustar conforme necessário ou usar flex basis
    minWidth: 40,
    alignItems: 'center', // Centraliza o conteúdo (ícones) verticalmente
    justifyContent: 'center',
    // backgroundColor: 'rgba(0,255,0,0.2)', // DEBUG: para visualizar a área
  },
  titleContainer: {
    flex: 1, // Permite que o título ocupe o espaço central restante
    alignItems: 'center', // Centraliza o texto horizontalmente
    justifyContent: 'center',
    marginHorizontal: 8, // Espaçamento entre o título e os lados
    // backgroundColor: 'rgba(0,0,255,0.2)', // DEBUG: para visualizar a área
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    padding: 8, // Aumenta a área de toque
  },
});

export default TopBar; // Exportação padrão pode ser útil em alguns casos