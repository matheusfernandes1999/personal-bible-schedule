// types.ts
import { User as FirebaseUser } from "firebase/auth";
import { FieldValue, Timestamp } from "firebase/firestore"; // Importa Timestamp
import { GeoJsonObject, Feature, Geometry, FeatureCollection } from 'geojson'; // Import Feature type

/**
 * Representa os dados de um usuário armazenados no Firestore.
 */
export interface UserData {
  uid: string;
  name: string | null;
  email: string | null;
  congregationId: string | null;
  createdAt?: Timestamp | any; // Usar Timestamp do Firestore
}

/**
 * Estrutura para armazenar um horário de reunião.
 */
export interface MeetingTime {
  day: string | null;
  time: string | null;
}

/**
 * Representa os dados de uma congregação armazenados no Firestore.
 */
export interface CongregationData {
  id?: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp | any;
  cities?: string[]; // <<< ADICIONADO: Lista de nomes de cidades
  sectionsByCity?: {
    // <<< ADICIONADO: Mapa de cidade para lista de seções
    [city: string]: string[];
  };
  meetingTimes?: {
    midweek: MeetingTime;
    weekend: MeetingTime;
  };
}

/**
 * Representa os dados de uma pessoa (publicador, etc.) na congregação.
 * Armazenado como subcoleção em /congregations/{congregationId}/people/{personId}
 */
export interface PersonData {
  id?: string; // ID do documento Firestore (geralmente o UID do usuário vinculado)
  name: string;
  categories: string[]; // Array com as categorias/designações selecionadas
  linkedUserId: string | null; // UID do usuário do Firebase Auth, se vinculado
  createdBy: string; // UID do usuário que criou o registro
  createdAt: Timestamp | any;
  // Adicione outros campos relevantes
}

/**
 * Representa um cartão de território.
 * Armazenado como subcoleção em /congregations/{congregationId}/territoryCards/{cardId}
 */

export interface FeatureProperties { // Add this if not already present
  id?: number | string;
  section?: string;
  details?: string;
  color?: string;
  // Add other properties you expect in your GeoJSON features
}

export interface TerritoryCardData {
  id: string;
  city: string;
  section: string;
  cardNumber: string;
  notes?: any;
  imageUrl?: string | null; // <<< Optional
  mapId?: string | null;    // <<< Optional
  status: 'Disponível' | 'Em uso' | 'Não trabalhar';
  lastWorkedBy?: string | null;
  lastWorkedByName?: string | null;
  lastReturnDate?: Timestamp | null;
  createdAt: Timestamp | FieldValue;
  createdBy: string;
  // Add any other fields you might have
}

/**
 * Representa um registro de trabalho de território.
 * Armazenado como subcoleção em /congregations/{congregationId}/territoryRecords/{recordId}
 */

export interface TerritoryRecordData {
  id?: string;
  cardId: string;
  cardNumber: string;
  personId: string;
  personName: string;
  startDate: Timestamp | Date;
  endDate?: Timestamp | Date | null;
  status: "Ativo" | "Completo";
}

/**
 * Argumentos para as funções de login e signup.
 */

export interface AuthCredentials {
  email?: string;
  password?: string;
  name?: string;
}
export interface SignupCredentials extends AuthCredentials {
  congregationId?: string;
}
export interface LoginCredentials extends AuthCredentials {}

/**
 * Forma do valor fornecido pelo AuthContext.
 */
export interface AuthContextData {
  user: FirebaseUser | null;
  userData: UserData | null;
  isAdmin: boolean;
  userCategories: string[] | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
}


export interface VidaCristaAssignment {
  id: string; // ID único para esta designação
  numero_parte: number | string; // <<< RENOMEADO e mantido tipo flexível
  tema?: string | null;          // <<< ADICIONADO (Tema da parte)
  tempo?: string | null;         // <<< ADICIONADO (Tempo alocado, ex: "10 min")
  participantName: string;     // Nome do participante principal (era 'nome')
  assistantName?: string | null; // Nome do ajudante (era 'ajudante')
  language?: string;             // Idioma (era 'idioma')
}

export interface VidaCristaSchedule {
  weekStartDate: Timestamp | Date;
  assignments: VidaCristaAssignment[]; // <<< Usa a interface atualizada
  lastUpdatedAt?: Timestamp | Date;
  updatedBy?: string;
}

export interface PublicationItem {
  id?: string; // ID do documento (pode ser itemCode ou gerado)
  itemCode: string; // Codigo_Item do CSV
  description: string; // Descricao_Item do CSV
  category: string; // Categoria traduzida para português
  currentQuantity: number | null; // Quantidade_Atual
  categoryPT: string;
  monthlyMovement?: number | null; // Movimento_Medio_Mensal
  movementObservation?: string | null; // Observacao_Movimento
  lastUpdated?: Timestamp | Date; // Quando este registro específico foi atualizado/importado
}

export const PUBLICATION_CATEGORY_TRANSLATIONS: { [key: string]: string } = {
  'Bibles': 'Bíblias',
  'Books': 'Livros',
  'Brochures and Booklets': 'Brochuras e Folhetos',
  'Forms and Supplies': 'Formulários e Materiais',
  'Tracts': 'Tratados',
  'Public Magazines': 'Revistas (Público)',
};

export const CATEGORIES_LIST = [
  "Administrador",
  "Limpeza",
  "Dirigente",
  "Leitor de Estudo",
  "Leitor de Sentinela",
  "Faça o Seu Melhor",
  "Nossa Vida Cristã",
  "Estudo Bíblico",
  "Sentinela",
  "Discurso Público",
  "Tesouros da Palavra de Deus",
  "Microfone",
  "Palco",
  "Som",
  "Indicador",
  "Servo de Território",
  "Servo de Contas",
  "Servo de Publicações",
  "Ajudante — Nossa Vida Cristã",
  "Ajudante — Designações Mecânicas",
  "Presidente — Reunião Vida e Ministério",
  "Presidente — Reunião de Fim de Semana",
  "Carrinho de Publicações",
];

export const ADMIN_CATEGORY = "Administrador";
export const TERRITORY_SERVANT_CATEGORY = "Servo de Território";
export const PUBLICATIONS_SERVANT_CATEGORY = 'Servo de Publicações'; 

type StyleConfig =
  | { chapters: number } // For chaptersPerDay
  | { durationMonths: number } // For totalDuration
  | { durationYears: number } // For chronological
  | { chapters: number; startBookAbbrev: string }; // For custom


export interface ReadingSchedule {
  id: string;
  styleType: 'chaptersPerDay' | 'totalDuration' | 'chronological' | 'custom'; // Add 'custom'
  styleConfig: StyleConfig;
  startDate: Timestamp; // Or Date if converted
  status: 'active' | 'paused' | 'completed' | 'error' | 'starting' | 'none'; // Include all possible derived statuses too if needed elsewhere
  totalChaptersInBible: number;
  chaptersReadCount: number;
  progressPercent: number;
  completedChaptersMap: { [chapterRef: string]: boolean };
  lastReadReference: string | null;
  readCompletionTimestamps?: Timestamp[]; // Array of completion dates for streak
  // Add other fields if necessary
}


export interface ActivePlanCardProps {
  schedule: ReadingSchedule;
  currentAssignment: string[];
  onMarkRead: (batch: string[]) => void;
  onPausePlan: (id: string) => void;
  onDeletePlan: (id: string) => void;
  onRevertLastReading: () => void;
  onResumePlan: (id: string) => void;
  canRevert: boolean;
  canResume: boolean; // This might need recalculation based on other active plans if resuming paused
  isUpdatingProgress: boolean;
  isProcessingAction: boolean; // General loading state for pause/delete/resume
  isReverting: boolean;
}

// Props for the new CustomPlanModal
export interface CustomPlanModalProps {
    visible: boolean;
    onClose: () => void;
    onCreatePlan: (chapters: number, startBookAbbrev: string) => void;
    isLoading: boolean;
}

export type AchievementCategory = 'Sequência' | 'Progresso' | 'Conclusão' | 'Engajamento';
export type AchievementTriggerType =  'read_date' | 'read_time' | 'section_completed' | 'plan_completed' | 'plan_started' | 'streak' | 'plan_status' | 'chapters_read' | 'book_completed' | 'custom'; // Adicione outros triggers

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  iconLocked: string; // Nome do ícone (e.g., Ionicons)
  iconUnlocked: string; // Nome do ícone
  category: AchievementCategory;
  triggerType: AchievementTriggerType;
  triggerValue: any; // Pode ser número, string, etc.
  points?: number;
  order?: number;
}

export interface UserAchievement {
  achievementId: string;
  unlocked: boolean;
  unlockedAt?: Timestamp;
  notified?: boolean; // Para controle de UI
  progress?: number; // Para conquistas com etapas (opcional)
}


//Map Types
// Interface for individual feature properties we care about
export interface FeatureProperties {
  id?: number | string; // Allow both number and string IDs
  section?: string;
  details?: string;
  color?: string; // Added optional color property
  // Add other properties you expect in your GeoJSON features
}

// Extend GeoJSON Feature type to use our specific properties interface
export type AppFeature = Feature<Geometry | null, FeatureProperties>;


// Interface for styling specific features (Example: storing color)
export interface FeatureStyle {
   fillColor?: string;
   strokeColor?: string;
   strokeWidth?: number;
}

// --- Firestore Map Data Type ---
// Define the structure for storing map data in Firestore
export interface MapDataFirestore {
  name: string;
  geojsonData: string; // <<< CHANGED: Store as string
  createdAt: FieldValue;
  createdBy: string;
}