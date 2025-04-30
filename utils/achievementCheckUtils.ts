// src/utils/achievementCheckUtils.ts
import { Timestamp } from 'firebase/firestore';
import { getBookInfo, sequentialChapterOrder } from './bibleUtils'; // Importar de bibleUtils

// --- Definições de Seções (Ajuste conforme sua definição teológica/estrutural preferida) ---
// Usaremos as abreviações normalizadas (lowercase) de bibleUtils
const PENTATEUCH_BOOKS = ['gn', 'ex', 'lv', 'nm', 'dt'];
const GOSPELS_BOOKS = ['mt', 'mk', 'lk', 'jn'];
const NT_BOOKS = [ // Mateus a Apocalipse
  'mt', 'mk', 'lk', 'jn', 'act', 'rm', '1co', '2co', 'gl', 'eph', 'php', 'cl',
  '1th', '2th', '1tm', '2tm', 'tt', 'phm', 'hb', 'jas', '1pe', '2pe', '1jn',
  '2jn', '3jn', 'jd', 'ap'
];
const OT_BOOKS = [ // Gênesis a Malaquias
  'gn', 'ex', 'lv', 'nm', 'dt', 'js', 'jz', 'rt', '1sm', '2sm', '1ki', '2ki',
  '1ch', '2ch', 'ezr', 'ne', 'et', 'job', 'ps', 'prv', 'ec', 'ct', 'is', 'jer',
  'lm', 'ezk', 'dn', 'ho', 'jl', 'am', 'ob', 'jn', 'mi', 'na', 'hk', 'zp',
  'hg', 'zc', 'ml'
];

// --- Definições de Feriados (Exemplo - Adicione/Remova conforme necessário) ---
// Formato: { day: DD, month: MM (0-11) }
const HOLIDAYS = [
  { day: 1, month: 0 },   // Ano Novo
  { day: 25, month: 11 }, // Natal
  // Adicione outros feriados fixos aqui. Páscoa é muito complexa para este exemplo.
];

// --- Funções Auxiliares ---

/**
 * Obtém a lista de referências de capítulos para um livro específico.
 * Ex: getChaptersForBook("gn") -> ["gn-1", "gn-2", ..., "gn-50"]
 */
export const getChaptersForBook = (bookAbbrev: string): string[] => {
    const info = getBookInfo(bookAbbrev); // Já normaliza internamente
    if (!info) return [];
    const refs: string[] = [];
    for (let i = 1; i <= info.chapterCount; i++) {
        refs.push(`${info.abbrev}-${i}`); // Usa abbrev normalizada do BookInfo
    }
    return refs;
};

/**
 * Obtém a lista de referências de capítulos para uma seção bíblica definida.
 */
export const getChaptersForSection = (sectionId: string): string[] => {
    let bookList: string[] = [];
    switch (sectionId.toLowerCase()) {
        case 'pentateuch':
            bookList = PENTATEUCH_BOOKS;
            break;
        case 'gospels':
            bookList = GOSPELS_BOOKS;
            break;
        case 'nt':
            bookList = NT_BOOKS;
            break;
        case 'ot':
            bookList = OT_BOOKS;
            break;
        default:
            console.warn(`[getChaptersForSection] Unknown sectionId: ${sectionId}`);
            return [];
    }

    const sectionChapters: string[] = [];
    bookList.forEach(bookAbbrev => {
        sectionChapters.push(...getChaptersForBook(bookAbbrev));
    });
    return sectionChapters;
};


/**
 * Verifica se todos os capítulos de um livro foram concluídos.
 */
export const didCompleteBook = (
    bookAbbrev: string,
    completedMap: { [key: string]: boolean } | undefined | null
): boolean => {
    if (!completedMap) return false;
    const chapters = getChaptersForBook(bookAbbrev);
    if (chapters.length === 0) return false; // Livro inválido ou sem capítulos?
    // Verifica se TODOS os capítulos da lista existem e são TRUE no mapa
    return chapters.every(chapterRef => completedMap[chapterRef] === true);
};

/**
 * Verifica se todos os capítulos de uma seção foram concluídos.
 */
export const didCompleteSection = (
    sectionId: string,
    completedMap: { [key: string]: boolean } | undefined | null
): boolean => {
    if (!completedMap) return false;
    const chapters = getChaptersForSection(sectionId);
    if (chapters.length === 0) return false; // Seção inválida ou vazia?
    // Verifica se TODOS os capítulos da lista existem e são TRUE no mapa
    return chapters.every(chapterRef => completedMap[chapterRef] === true);
};

/**
 * Calcula a sequência de dias consecutivos de leitura, terminando hoje ou ontem.
 * (Esta é a lógica adaptada do seu ReadingStreakCard - certifique-se que corresponde)
 */
export const calculateStreak = (timestamps: Timestamp[] | undefined | null): number => {
    if (!timestamps || timestamps.length === 0) {
        return 0;
    }

    const uniqueReadDates = [
        ...new Set(
            timestamps.map((ts) => {
                const date = ts.toDate();
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            })
        ),
    ].sort((a, b) => b.localeCompare(a)); // Ordena DESC (mais recente primeiro)

    if (uniqueReadDates.length === 0) {
        return 0;
    }

    let streak = 0;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    // A sequência só é válida se o último dia lido for hoje ou ontem
    if (uniqueReadDates[0] !== todayStr && uniqueReadDates[0] !== yesterdayStr) {
        return 0;
    }

    let currentDate = new Date(); // Começa a verificar a partir de hoje
     // Se a leitura mais recente foi ontem, começamos a checar a partir de ontem
     if(uniqueReadDates[0] === yesterdayStr){
         currentDate.setDate(currentDate.getDate() -1);
     }


    for (let i = 0; i < uniqueReadDates.length; i++) {
        const currentDateStr = formatDate(currentDate);

        if (uniqueReadDates.includes(currentDateStr)) {
            streak++;
            // Move para o dia anterior para a próxima verificação
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            // Encontrou uma lacuna, a sequência acaba
            break;
        }
    }

    return streak;
};

/**
 * Verifica se um Timestamp ocorreu em um horário específico ('late_night' ou 'early_morning').
 */
export const checkReadTime = (
    timestamp: Timestamp | undefined | null,
    timeOfDay: 'late_night' | 'early_morning' | string // Aceita outros valores mas só trata esses
): boolean => {
    if (!timestamp) return false;

    const date = timestamp.toDate();
    const hours = date.getHours();

    if (timeOfDay === 'late_night') {
        // Ex: Meia-noite até 3:59 da manhã
        return hours >= 0 && hours < 4;
    } else if (timeOfDay === 'early_morning') {
        // Ex: 4:00 até 5:59 da manhã
        return hours >= 4 && hours < 6;
    }

    return false;
};

/**
 * Verifica se um Timestamp ocorreu em um feriado definido.
 */
export const checkReadDate = (
    timestamp: Timestamp | undefined | null,
    dateCondition: 'holiday' | string // Aceita outros mas só trata 'holiday'
): boolean => {
    if (!timestamp || dateCondition !== 'holiday') return false;

    const date = timestamp.toDate();
    const day = date.getDate();
    const month = date.getMonth(); // 0-11

    return HOLIDAYS.some(holiday => holiday.day === day && holiday.month === month);
};