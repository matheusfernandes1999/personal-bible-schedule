// constants/Colors.ts
import { ColorSchemeName } from 'react-native';

// Paleta para o tema CLARO (baseada na anterior)
const lightPalette = {
  // --- Cores Principais ---
  primary: '#512DA8', // Roxo escuro (Deep Purple 700)
  primaryDark: '#311B92', // Roxo mais escuro (Deep Purple 900)
  primaryLight: '#7E57C2', // Roxo mais claro (Deep Purple 400)

  // --- Cores Secundárias / Destaque ---
  secondary: '#FF9800', // Laranja (Orange 500)
  secondaryDark: '#F57C00', // Laranja mais escuro (Orange 700)
  secondaryLight: '#FFB74D', // Laranja mais claro (Orange 300)

  // --- Cores de Feedback (Toasts, Alertas) ---
  success: '#388E3C', // Verde (Green 700)
  error: '#D32F2F', // Vermelho (Red 700)
  warning: '#FFA000', // Âmbar (Amber 700)
  info: '#1976D2', // Azul (Blue 700)

  // --- Cores de Texto ---
  textPrimary: '#212121', // Preto/Cinza muito escuro
  textSecondary: '#757575', // Cinza médio
  textMuted: '#BDBDBD', // Cinza claro
  textOnPrimary: '#FFFFFF', // Branco
  textOnSecondary: '#000000', // Preto
  textLink: '#1976D2', // Azul

  // --- Cores de Fundo ---
  backgroundPrimary: '#F5F5F5', // Cinza muito claro
  backgroundSecondary: '#FFFFFF', // Branco (cards, modais, inputs)
  backgroundModalScrim: 'rgba(0, 0, 0, 0.5)',

  // --- Cores de UI ---
  border: '#E0E0E0', // Cinza claro
  borderFocus: '#512DA8', // Roxo primário
  inputBackground: '#FFFFFF', // Branco
  placeholder: '#BDBDBD', // Cinza claro
  iconDefault: '#757575', // Cinza médio
  iconActive: '#512DA8', // Roxo primário
  topBarBackground: '#512DA8', // Roxo primário
  topBarTint: '#FFFFFF', // Branco
  bottomSheetBackground: '#FFFFFF', // Branco
  buttonDisabledBackground: '#E0E0E0', // Cinza claro
  buttonDisabledText: '#BDBDBD', // Cinza claro
  shadow: 'rgba(0, 0, 0, 0.1)', // Sombra sutil

  // --- Outras Cores ---
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Paleta para o tema ESCURO
const darkPalette: typeof lightPalette = { // Garante que tem as mesmas chaves
  // --- Cores Principais ---
  primary: '#7E57C2', // Roxo mais claro para melhor contraste no escuro (Deep Purple 400)
  primaryDark: '#512DA8', // Roxo (Deep Purple 700)
  primaryLight: '#B39DDB', // Roxo ainda mais claro (Deep Purple 200)

  // --- Cores Secundárias / Destaque ---
  secondary: '#FFB74D', // Laranja mais claro (Orange 300)
  secondaryDark: '#FFA726', // Laranja (Orange 400)
  secondaryLight: '#FFCC80', // Laranja ainda mais claro (Orange 200)

  // --- Cores de Feedback (Toasts, Alertas) ---
  // Mantendo cores vibrantes, podem precisar de ajustes finos dependendo do fundo exato
  success: '#81C784', // Verde claro (Green 300)
  error: '#E57373', // Vermelho claro (Red 300)
  warning: '#FFB74D', // Laranja claro (Orange 300) - Usando o secundário
  info: '#64B5F6', // Azul claro (Blue 300)

  // --- Cores de Texto ---
  textPrimary: '#E0E0E0', // Branco/Cinza muito claro
  textSecondary: '#BDBDBD', // Cinza claro
  textMuted: '#757575', // Cinza médio
  textOnPrimary: '#000000', // Preto (para o primary mais claro)
  textOnSecondary: '#000000', // Preto (para o secondary mais claro)
  textLink: '#64B5F6', // Azul claro (info)

  // --- Cores de Fundo ---
  backgroundPrimary: '#121212', // Preto/Cinza muito escuro (padrão Material Design dark)
  backgroundSecondary: '#1E1E1E', // Cinza um pouco mais claro (cards, modais)
  backgroundModalScrim: 'rgba(0, 0, 0, 0.6)', // Um pouco mais escuro

  // --- Cores de UI ---
  border: '#424242', // Cinza escuro para bordas
  borderFocus: '#7E57C2', // Roxo primário (o mais claro)
  inputBackground: '#2C2C2C', // Cinza escuro para fundo de input
  placeholder: '#757575', // Cinza médio (textMuted)
  iconDefault: '#BDBDBD', // Cinza claro (textSecondary)
  iconActive: '#7E57C2', // Roxo primário (o mais claro)
  // Pode-se optar por um header escuro também: backgroundPrimary ou backgroundSecondary
  topBarBackground: '#1E1E1E', // Header escuro
  topBarTint: '#E0E0E0', // Texto/ícones claros no header
  bottomSheetBackground: '#1E1E1E', // Fundo escuro para Bottom Sheet
  buttonDisabledBackground: '#333333', // Cinza bem escuro
  buttonDisabledText: '#757575', // Cinza médio (textMuted)
  shadow: 'rgba(255, 255, 255, 0.05)', // Sombra quase inexistente ou brilho sutil no escuro

  // --- Outras Cores ---
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export type ColorPalette = typeof lightPalette;

// Exporta um objeto que contém ambas as paletas
export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};

// Função auxiliar para obter as cores do tema atual (opcional, mas pode ser útil)
export function getThemeColors(scheme: ColorSchemeName): ColorPalette {
  return scheme === 'dark' ? Colors.dark : Colors.light;
}