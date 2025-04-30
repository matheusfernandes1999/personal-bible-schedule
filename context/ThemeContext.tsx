// context/ThemeContext.tsx
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';
import { Colors, ColorPalette } from '@/constants/Colors'; // Importa as paletas light/dark

// Define a interface para o valor do contexto
interface ThemeContextData {
  colors: ColorPalette;
  colorScheme: 'light' | 'dark'; // Adiciona o esquema atual
}

// Cria o contexto. O valor padrão agora precisa de uma lógica inicial
// ou podemos apenas definir um tipo e deixar o Provider lidar com o valor inicial.
// Fornecer um valor padrão inicial pode ser complexo aqui, então deixamos indefinido
// e garantimos que o Provider sempre forneça um valor válido.
const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

// Define as props para o ThemeProvider
interface ThemeProviderProps {
  children: ReactNode;
}

// Componente Provedor do Tema
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Detecta o esquema de cores preferido do sistema
  const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null | undefined

  // Determina o esquema a ser usado (padrão: 'light' se indefinido)
  // Usamos useMemo para garantir que 'actualColorScheme' só mude quando 'systemColorScheme' mudar.
  const actualColorScheme = useMemo(() => {
      return systemColorScheme ?? 'light';
  }, [systemColorScheme]);


  // Seleciona a paleta de cores correspondente
  // Usamos useMemo para garantir que 'currentColors' só mude quando 'actualColorScheme' mudar.
  const currentColors = useMemo(() => {
    return Colors[actualColorScheme];
  }, [actualColorScheme]);

  // Monta o valor do contexto
  // Usamos useMemo para garantir que o objeto 'contextValue' só seja recriado
  // se 'currentColors' ou 'actualColorScheme' mudarem, otimizando re-renderizações.
  const contextValue = useMemo(() => ({
    colors: currentColors,
    colorScheme: actualColorScheme,
  }), [currentColors, actualColorScheme]);


  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook customizado para facilitar o uso do contexto
export const useTheme = (): ThemeContextData => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Garante que o hook está sendo usado dentro do Provider
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};