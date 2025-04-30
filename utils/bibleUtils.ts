// utils/bibleUtils.ts
import nviBibleData from '@/assets/bible/nvi.json';
import chronologicalPlanData from '@/assets/bible/chronologicalOrderPlan.json';

// --- Interfaces ---
export interface BibleBook {
    abbrev: string; // e.g., "gn" or "Gn" - normalize case later if needed
    name: string;   // e.g., "Gênesis"
    chapters: string[][]; // Array of chapters, each chapter is array of verse strings
}

export interface BookInfo {
    abbrev: string;
    name: string;
    chapterCount: number;
}

interface ChronologicalPlanEntry {
    Dia: string; // "1", "2", ...
    Leitura: string; // "Gênesis 1,2", "Gênesis 3-5", "Jó 1-3" etc.
}

// --- Load Data ---
const bibleData: BibleBook[] = nviBibleData as BibleBook[];
const chronologicalPlan: ChronologicalPlanEntry[] = chronologicalPlanData as ChronologicalPlanEntry[];


// --- Pre-computation and Mappings (Run once on import) ---

// ========================================================================
// CRITICAL: Update this constant with the exact name from your nvi.json
const SONG_OF_SOLOMON_NAME = "Cânticos"; // <-- CHANGE THIS if needed
// ========================================================================

const normalizeAbbrev = (abbrev: string): string => abbrev.toLowerCase();

// Map: Book Name (lowercase) -> Abbreviation (normalized)
const bookNameToAbbrevMap = new Map<string, string>();
// Map: Abbreviation (normalized) -> Book Info
const bookAbbrevToInfoMap = new Map<string, BookInfo>();
// Array of canonical book names for regex matching
const knownBookNames: string[] = [];

console.log("Mapping Bible Books:");
bibleData.forEach(book => {
    const normalized = normalizeAbbrev(book.abbrev);
    const lowerCaseName = book.name.toLowerCase();

    // Populate maps
    bookNameToAbbrevMap.set(lowerCaseName, normalized);

    // Store BookInfo only once per unique normalized abbreviation
    if (!bookAbbrevToInfoMap.has(normalized)) {
         bookAbbrevToInfoMap.set(normalized, {
             abbrev: normalized,
             name: book.name, // Store canonical name from nvi.json
             chapterCount: book.chapters.length,
         });
         knownBookNames.push(book.name); // Add canonical name to list for regex
    } else {
         // This warning might appear if nvi.json has duplicate entries/abbreviations
        console.warn(`[Precompute] Duplicate normalized abbreviation detected: ${normalized} for ${book.name} and ${bookAbbrevToInfoMap.get(normalized)?.name}`);
    }
});

// Sort known names by length descending to match longer names first (e.g., "1 Crônicas" before "Crônicas")
knownBookNames.sort((a, b) => b.length - a.length);

// Build a regex to find any of the known canonical book names as whole words
const knownBookNamesRegex = new RegExp(`\\b(${knownBookNames.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');

console.log(`Mapped ${bookNameToAbbrevMap.size} unique names and ${bookAbbrevToInfoMap.size} unique abbreviations.`);
// Log checks for critical names to ensure they were found in nvi.json
console.log("Checking name 'salmos':", bookNameToAbbrevMap.get('salmos'));
console.log(`Checking name '${SONG_OF_SOLOMON_NAME.toLowerCase()}':`, bookNameToAbbrevMap.get(SONG_OF_SOLOMON_NAME.toLowerCase()));
console.log("Checking name 'lamentações de jeremias':", bookNameToAbbrevMap.get('lamentações de jeremias')); // Adjust if your canonical name differs
console.log("Checking name 'filemom':", bookNameToAbbrevMap.get('filemom'));
console.log("Checking name 'judas':", bookNameToAbbrevMap.get('judas'));


// Helper to get BookInfo case-insensitively using canonical maps
export const getBookInfo = (abbrevOrName: string): BookInfo | undefined => {
    const lowerCaseInput = abbrevOrName.toLowerCase().trim();
    // Check if it's a known canonical name (lowercase)
    let normalizedAbbrev = bookNameToAbbrevMap.get(lowerCaseInput);
    if (normalizedAbbrev) {
        return bookAbbrevToInfoMap.get(normalizedAbbrev);
    }
    // If not found by name, assume input *might* be an abbreviation already
    // and normalize it for the final lookup.
    return bookAbbrevToInfoMap.get(normalizeAbbrev(lowerCaseInput));
}

// --- Simplified Chapter String Parser ---
// Parses ONLY the chapter part (e.g., "1", "1-5", "1,3, 5-7") given Book context
const parseChapterString = (
    chapterStrRaw: string,
    bookInfo: BookInfo,
    originalSegmentDesc: string // For logging context
): string[] => {
    const resultRefs: string[] = [];
    const chapterStr = chapterStrRaw.trim();
    const bookAbbrev = bookInfo.abbrev;
    const maxChapter = bookInfo.chapterCount;
    const bookName = bookInfo.name;

    if (!chapterStr) {
        // This can be normal if a book name is at the very end of the Leitura string
        // console.warn(`[parseChapterString] Empty chapter string provided for ${bookName} from "${originalSegmentDesc}"`);
        return [];
    }
     // Validate characters - should only be digits, comma, hyphen, space
     if (/[^0-9,\-\s]/.test(chapterStr)) {
         console.warn(`[parseChapterString] Invalid characters found in chapter string "${chapterStr}" for ${bookName} from "${originalSegmentDesc}"`);
         return [];
     }

    const chapterSegments = chapterStr.split(',');

    for (const segment of chapterSegments) {
        const trimmedSegment = segment.trim();
        if (!trimmedSegment) continue; // Skip empty segments resulting from commas ",," or trailing ","

        if (trimmedSegment.includes('-')) {
            // Range like "5-7"
            const rangeParts = trimmedSegment.split('-');
            // Ensure exactly two parts and they are numeric
            if (rangeParts.length === 2) {
                const start = parseInt(rangeParts[0], 10);
                const end = parseInt(rangeParts[1], 10);
                if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
                    for (let i = start; i <= end; i++) {
                        if (i <= maxChapter) { // Validate chapter number against the book's total
                            resultRefs.push(`${bookAbbrev}-${i}`);
                        } else {
                            console.warn(`[parseChapterString] Invalid chapter ${i} (max ${maxChapter}) for ${bookName} in range "${trimmedSegment}" from "${originalSegmentDesc}"`);
                        }
                    }
                } else {
                    console.warn(`[parseChapterString] Invalid range values "${trimmedSegment}" (Start: ${start}, End: ${end}) for ${bookName} from "${originalSegmentDesc}"`);
                }
            } else {
                console.warn(`[parseChapterString] Invalid range format "${trimmedSegment}" for ${bookName} from "${originalSegmentDesc}"`);
            }
        } else {
            // Single chapter like "1" or "15"
            const chapterNum = parseInt(trimmedSegment, 10);
            if (!isNaN(chapterNum) && chapterNum > 0) {
                if (chapterNum <= maxChapter) { // Validate chapter number
                    resultRefs.push(`${bookAbbrev}-${chapterNum}`);
                } else {
                    console.warn(`[parseChapterString] Invalid chapter ${chapterNum} (max ${maxChapter}) for ${bookName} in "${trimmedSegment}" from "${originalSegmentDesc}"`);
                }
            } else {
                console.warn(`[parseChapterString] Invalid single chapter "${trimmedSegment}" for ${bookName} from "${originalSegmentDesc}"`);
            }
        }
    }
    return resultRefs;
}

// --- generateSequentialOrder (Generates gn-1, gn-2, ..., ap-22) ---
const generateSequentialOrder = (): string[] => {
    const order: string[] = [];
    // Iterate through books in the order they appear in nvi.json
    bibleData.forEach(book => {
        const bookInfo = getBookInfo(book.name); // Use canonical info
        if (bookInfo) {
            const bookAbbrev = bookInfo.abbrev;
             for (let i = 1; i <= bookInfo.chapterCount; i++) {
                 order.push(`${bookAbbrev}-${i}`);
             }
        } else {
             console.error(`[generateSequentialOrder] Could not find BookInfo for book "${book.name}" during sequential generation.`);
        }
    });
    if(order.length !== 1189) {
         console.warn(`[generateSequentialOrder] Generated ${order.length} sequential chapters, expected 1189. Check nvi.json data.`);
    }
    return order;
};
export const sequentialChapterOrder: string[] = generateSequentialOrder();


// --- generateChronologicalOrder (Attempt 3 - Iterative Parsing) ---
// --- generateChronologicalOrder (Attempt 3.1 - Fix Dangling Start) ---
const generateChronologicalOrder = (): string[] => {
    const order: string[] = [];
    const seenChapters = new Set<string>();

    // Pre-build a map of lower-case names/variations to BookInfo for quick lookup
    const lowerCaseNameToInfoMap = new Map<string, BookInfo>();
    knownBookNames.forEach(name => {
        const info = getBookInfo(name); // Assumes getBookInfo uses the canonical map
        if (info) {
             lowerCaseNameToInfoMap.set(name.toLowerCase(), info);
        }
    });
     // Add known variations found in the plan file manually, mapping them to the correct BookInfo
     const cantaresInfo = getBookInfo(SONG_OF_SOLOMON_NAME); // Get info using canonical name
     if (cantaresInfo) {
          lowerCaseNameToInfoMap.set('cantares', cantaresInfo);
          lowerCaseNameToInfoMap.set('cântico dos cânticos', cantaresInfo); // Map other potential variations
     } else {
          console.error(`[generateChronologicalOrder] Failed to get BookInfo for canonical name: ${SONG_OF_SOLOMON_NAME}`);
     }
     const salmoInfo = getBookInfo('Salmos');
     if (salmoInfo) lowerCaseNameToInfoMap.set('salmo', salmoInfo);
     const lamenInfo = getBookInfo('Lamentações de Jeremias'); // Adjust canonical name if different
     if (lamenInfo) lowerCaseNameToInfoMap.set('lamentações', lamenInfo);
     const filemInfo = getBookInfo('Filemom');
      if (filemInfo) lowerCaseNameToInfoMap.set('filemon', filemInfo);
     // Add mappings for "1 samuel" -> 1 Samuel info, "2 reis" -> 2 Reis info etc. if necessary

    chronologicalPlan.forEach((entry, index) => {
        const day = entry.Dia;
        const originalLeitura = entry.Leitura;
        const logPrefix = `Day ${day} ("${originalLeitura}"):`;

        // Pre-process: Clean up verses, 'a' ranges. Keep original separators for now.
        let remainingText = originalLeitura
            .replace(/:\d+(-\d+)?/g, '')
            .replace(/(\d+)\s+a\s+(\d+)/g, '$1-$2')
            // Let's NOT replace ';' with ',' here, handle separators later if needed
            .trim();

        let currentBookInfo: BookInfo | null = null; // Track context within the day's reading
        let lastIndexProcessed = 0; // Track position in remainingText

        // Find all identifiable *canonical* book names in the string
        const bookMatches = Array.from(remainingText.matchAll(knownBookNamesRegex));

        let currentParsePosition = 0; // Where are we in the remainingText string?

        // --- Handle segment *before* the first canonical match (if any) ---
        const firstMatchStart = bookMatches.length > 0 ? bookMatches[0].index! : remainingText.length;
        const initialSegment = remainingText.substring(0, firstMatchStart).trim().replace(/^[;,]|[,;]$/g, '').trim(); // Clean separators

        if (initialSegment) {
            // Try parsing this initial segment. It might be "Variation Chapters" or just "Variation"
            const potentialNamePart = initialSegment.replace(/[\s\d,-]+$/, ''); // Extract potential name
            const potentialInfo = lowerCaseNameToInfoMap.get(potentialNamePart.toLowerCase());

            if (potentialInfo) {
                // Found a known book (likely variation like Filemon)
                 const chapterStr = initialSegment.substring(potentialNamePart.length).trim();
                 if (chapterStr) {
                     // Format "Variation Chapters"
                     const refs = parseChapterString(chapterStr, potentialInfo, `${logPrefix} (Initial Segment: ${potentialInfo.name} ${chapterStr})`);
                     refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
                 } else {
                      // Format "Variation" (Book only) - Assume Ch 1 or All
                     if(potentialInfo.chapterCount === 1) {
                          const refs = parseChapterString("1", potentialInfo, `${logPrefix} (Initial Segment: ${potentialInfo.name} - Book only, Ch 1)`);
                          refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
                     } else {
                          console.warn(`[generateChronologicalOrder] ${logPrefix} Initial segment is Book "${potentialInfo.name}" with no chapters.`);
                          // Optionally parse all chapters:
                          // const refs = parseChapterString(`1-${potentialInfo.chapterCount}`, potentialInfo, `${logPrefix} (Initial Segment: ${potentialInfo.name} - Book only, All Ch)`);
                          // refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
                     }
                 }
                 currentBookInfo = potentialInfo; // Set context for potential following numbers
            } else {
                // Could not identify a book in the initial segment
                console.warn(`[generateChronologicalOrder] ${logPrefix} Could not parse initial segment "${initialSegment}"`);
            }
            currentParsePosition = firstMatchStart; // Move parse position to start of first canonical match
        }


        // --- Iterate through the canonical book matches ---
        bookMatches.forEach((match, matchIndex) => {
            const bookName = match[1]; // Matched canonical name
            const bookStartIndex = match.index!;
            const bookEndIndex = bookStartIndex + bookName.length;

            // --- Process text *between* the last processed point and this match ---
            // This text should primarily be numbers/commas/semicolons if context is set
            const precedingText = remainingText.substring(currentParsePosition, bookStartIndex).trim().replace(/^[;,]|[,;]$/g, '').trim();

            if (precedingText && currentBookInfo) {
                // Assume preceding text belongs to the previous book context
                const refs = parseChapterString(precedingText, currentBookInfo, `${logPrefix} (Chapters for ${currentBookInfo.name} before ${bookName})`);
                refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
            } else if (precedingText) {
                // Preceding text exists but no current book context - this indicates an error
                 console.warn(`[generateChronologicalOrder] ${logPrefix} Found unexpected dangling text "${precedingText}" before "${bookName}"`);
            }

            // --- Update context to the current canonical book found ---
            currentBookInfo = lowerCaseNameToInfoMap.get(bookName.toLowerCase())!;
            currentParsePosition = bookEndIndex; // Tentatively move position past the book name

            // --- Find the text segment belonging to this book ---
            // It's the text from end of book name until the start of the next book OR end of string
            const nextMatchStart = (matchIndex + 1 < bookMatches.length) ? bookMatches[matchIndex + 1].index! : remainingText.length;
            const chapterSegmentForThisBook = remainingText.substring(bookEndIndex, nextMatchStart).trim().replace(/^[;,]|[,;]$/g, '').trim();

            if (chapterSegmentForThisBook && currentBookInfo) {
                 const refs = parseChapterString(chapterSegmentForThisBook, currentBookInfo, `${logPrefix} (Chapters for ${bookName})`);
                 refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
                 currentParsePosition = bookEndIndex + remainingText.substring(bookEndIndex).indexOf(chapterSegmentForThisBook) + chapterSegmentForThisBook.length; // Update position past parsed chapters
            } else if (!chapterSegmentForThisBook && currentBookInfo) {
                 // Book name was found, but no text followed it (until next book or end)
                 // Handle book-only case (single chapter or warning)
                 if(currentBookInfo.chapterCount === 1) {
                      const refs = parseChapterString("1", currentBookInfo, `${logPrefix} (${bookName} - Book only, assumed Ch 1)`);
                      refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
                 } else {
                       console.warn(`[generateChronologicalOrder] ${logPrefix} Book "${bookName}" found with no chapters specified.`);
                       // Optionally parse all chapters here if desired
                 }
            }

            // Ensure parse position advances
            currentParsePosition = Math.max(currentParsePosition, bookEndIndex);


        }); // End loop through book matches


         // --- Process any remaining text *after* the last match's segment ---
         // This case should be covered by the loop finding the text segment until remainingText.length
         /*
         if (currentParsePosition < remainingText.length && currentBookInfo) {
             const trailingText = remainingText.substring(currentParsePosition).trim().replace(/^[;,]|[,;]$/g, '').trim();
             if (trailingText) {
                 const refs = parseChapterString(trailingText, currentBookInfo, `${logPrefix} (Trailing chapters for ${currentBookInfo.name})`);
                 refs.forEach(ref => { if (ref && !seenChapters.has(ref)) {order.push(ref); seenChapters.add(ref);} });
             }
         }
         */


    }); // End chronologicalPlan.forEach

    // --- Sanity Check ---
    const expectedMin = 1100;
    const expectedMax = 1200;
    const finalCount = order.length;
    if (finalCount < expectedMin || finalCount > expectedMax) {
        console.warn(`[generateChronologicalOrder] Generated order has ${finalCount} chapters, which might be significantly incorrect (expected ~1189). Review remaining warnings.`);
    } else {
        console.log(`[generateChronologicalOrder] Successfully generated ${finalCount} chronological chapter references.`);
    }
    return order;
};

// Generate the chronological order list on import
export const chronologicalChapterOrder: string[] = generateChronologicalOrder();


/**
 * Generates a sequential chapter order starting from a specific book and wrapping around.
 * @param startBookAbbrev The normalized abbreviation of the book to start with (e.g., "mt").
 * @returns An array of chapter references in the custom order.
 */
export const generateCustomSequentialOrder = (startBookAbbrev: string): string[] => {
    const normalizedStartAbbrev = normalizeAbbrev(startBookAbbrev);
    // Find the first chapter of the starting book (e.g., "mt-1")
    const startChapterRef = `${normalizedStartAbbrev}-1`;
    const startIndex = sequentialChapterOrder.indexOf(startChapterRef);

    if (startIndex === -1) {
        console.warn(`[generateCustomSequentialOrder] Could not find start chapter ref for ${startBookAbbrev}. Defaulting to sequential.`);
        return [...sequentialChapterOrder]; // Return default order if book not found
    }

    const partAfterStart = sequentialChapterOrder.slice(startIndex);
    const partBeforeStart = sequentialChapterOrder.slice(0, startIndex);

    return [...partAfterStart, ...partBeforeStart];
};

// --- Exported Utility Functions ---

/**
 * Calculates the total number of chapters in the loaded Bible data.
 */
export const getTotalChapters = (): number => {
    // Use the length of the pre-calculated sequential order for accuracy
    return sequentialChapterOrder.length;
};

/**
 * Returns a list of all books with their name, abbreviation, and chapter count.
 */
export const getBookList = (): BookInfo[] => {
    // Return the values from our pre-computed map
    return Array.from(bookAbbrevToInfoMap.values());
};


/**
 * Finds the next chapter reference in the standard sequential Bible order.
 * Returns null if the input is the last chapter of the Bible.
 * @param currentRef Format "bookAbbrev-chapterNum" (e.g., "gn-50")
 */
export const findNextSequentialChapterRef = (currentRef: string): string | null => {
    const currentIndex = sequentialChapterOrder.indexOf(currentRef);
    if (currentIndex === -1 || currentIndex >= sequentialChapterOrder.length - 1) {
        return null; // Not found or already the last chapter
    }
    return sequentialChapterOrder[currentIndex + 1];
};

/**
 * Gets the display name for a book from its abbreviation.
 * @param abbrev Normalized book abbreviation (e.g., "gn")
 * @returns Book name (e.g., "Gênesis") or undefined if not found.
 */
export const getBookNameFromAbbrev = (abbrev: string): string | undefined => {
     return bookAbbrevToInfoMap.get(normalizeAbbrev(abbrev))?.name;
}

/**
 * Formats a chapter reference (e.g., "gn-1") into a readable string (e.g., "Gênesis 1").
 */
export const formatReference = (chapterRef: string): string => {
     const parts = chapterRef.split('-');
     if (parts.length !== 2) return chapterRef; // Return original if format is wrong

     const bookName = getBookNameFromAbbrev(parts[0]);
     const chapterNum = parts[1];

     return bookName ? `${bookName} ${chapterNum}` : chapterRef;
}

// --- Console Logs For Verification ---
console.log("----------------------------------------");
console.log("Bible Utils Initialized (Attempt 3)");
console.log("Total Sequential Chapters:", getTotalChapters());
console.log("Chronological Order Length:", chronologicalChapterOrder.length); // Target: ~1189
console.log("First 10 Chrono Refs:", chronologicalChapterOrder.slice(0, 10));
console.log("Last 10 Chrono Refs:", chronologicalChapterOrder.slice(-10));
console.log("----------------------------------------");