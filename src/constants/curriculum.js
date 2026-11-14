import { isJhsClass } from './promotionMap.js';

export { isJhsClass };

export const SCHOOL_LEVELS = {
  KG: 'KG',
  PRIMARY: 'Primary',
  JHS: 'JHS',
};

export const KG_CLASSES = ['KG 1', 'KG 2'];

export const PRIMARY_CLASSES = [
  'BS. 1', 'BS. 1A', 'BS. 1B',
  'BS. 2', 'BS. 2A', 'BS. 2B',
  'BS. 3', 'BS. 3A', 'BS. 3B',
  'BS. 4', 'BS. 4A', 'BS. 4B',
  'BS. 5', 'BS. 5A', 'BS. 5B',
  'BS. 6', 'BS. 6A', 'BS. 6B',
];

export const JHS_CLASSES = [
  'BS. 7', 'BS. 7A', 'BS. 7B',
  'BS. 8', 'BS. 8A', 'BS. 8B',
  'BS. 9', 'BS. 9A', 'BS. 9B',
];

export const ALL_CLASSES_LIST = [
  ...KG_CLASSES,
  ...JHS_CLASSES,
  ...PRIMARY_CLASSES,
];

export const KG_LEARNING_AREAS = [
  { name: 'Language & Literacy', key: 'LANG. & LIT.' },
  { name: 'Numeracy', key: 'NUMERACY' },
  { name: 'Our World & Our People', key: 'OWOP' },
  { name: 'Creativity', key: 'CREATIVITY' },
];

export const PRIMARY_SUBJECTS_LIST = [
  { name: 'English Language', key: 'ENG. LANG.' },
  { name: 'Mathematics', key: 'MATHS' },
  { name: 'Science', key: 'SCIENCE' },
  { name: 'History', key: 'HISTORYY' },
  { name: 'Our World Our People', key: 'OWOP' },
  { name: 'Computing', key: 'COMPUTING' },
  { name: 'Religious and Moral Education', key: 'RME' },
  { name: 'Ghanaian Language', key: 'GH. LANG.' },
  { name: 'Creative Arts', key: 'C. ARTS' },
];

export const JHS_SUBJECTS_LIST = [
  { name: 'English Language', key: 'ENG. LANG.' },
  { name: 'Mathematics', key: 'MATHS' },
  { name: 'Science', key: 'SCIENCE' },
  { name: 'Career Technology', key: 'C. TECH' },
  { name: 'Social Studies', key: 'SOCIAL' },
  { name: 'Computing', key: 'COMPUTING' },
  { name: 'Religious and Moral Education', key: 'RME' },
  { name: 'Ghanaian Language', key: 'GH. LANG.' },
  { name: 'Creative Arts & Design', key: 'C. ARTS' },
  { name: 'French', key: 'FRENCH' },
  { name: 'Arabic', key: 'ARABIC' },
];

function toSubjectMap(list) {
  return list.reduce((acc, item) => {
    acc[item.name] = item.key;
    return acc;
  }, {});
}

export const DEFAULT_KG_SUBJECT_MAP = toSubjectMap(KG_LEARNING_AREAS);
export const DEFAULT_PRIMARY_SUBJECT_MAP = toSubjectMap(PRIMARY_SUBJECTS_LIST);
export const DEFAULT_JHS_SUBJECT_MAP = toSubjectMap(
  JHS_SUBJECTS_LIST.filter((s) => s.key !== 'FRENCH' && s.key !== 'ARABIC')
);

/**
 * Checks whether a class name belongs to Kindergarten (KG 1 or KG 2).
 * @param {string} className
 * @returns {boolean}
 */
export function isKgClass(className = '') {
  return /^(KG\.?\s*[12]|Kindergarten\s*[12])/i.test(String(className || '').trim());
}

/**
 * Checks whether a class name belongs to Primary school (BS. 1 through BS. 6 and streams).
 * @param {string} className
 * @returns {boolean}
 */
export function isPrimaryClass(className = '') {
  return /^(BS\.?\s*[1-6]|Basic\s*[1-6]|Primary\s*[1-6]|Class\s*[1-6]|P\.?\s*[1-6])(\b|[A-Z])/i.test(
    String(className || '').trim()
  );
}

/**
 * Resolves the authoritative school level ('KG', 'Primary', or 'JHS') from class name and/or profile level.
 * Class name always takes precedence over a potentially stale explicitLevel when className is a known KG, Primary, or JHS class.
 * @param {string} className
 * @param {string} [explicitLevel]
 * @returns {'KG'|'Primary'|'JHS'}
 */
export function resolveSchoolLevel(className = '', explicitLevel = '') {
  const cleanClass = String(className || '').trim();
  const cleanLevel = String(explicitLevel || '').trim().toUpperCase();

  if (isKgClass(cleanClass)) {
    return SCHOOL_LEVELS.KG;
  }
  if (isJhsClass(cleanClass)) {
    return SCHOOL_LEVELS.JHS;
  }
  if (isPrimaryClass(cleanClass)) {
    return SCHOOL_LEVELS.PRIMARY;
  }

  if (cleanLevel === 'KG' || cleanLevel === 'KINDERGARTEN') {
    return SCHOOL_LEVELS.KG;
  }
  if (cleanLevel === 'JHS') {
    return SCHOOL_LEVELS.JHS;
  }
  return SCHOOL_LEVELS.PRIMARY;
}

export function getDefaultSubjectsListForLevel(level) {
  if (level === SCHOOL_LEVELS.KG) return KG_LEARNING_AREAS;
  if (level === SCHOOL_LEVELS.PRIMARY) return PRIMARY_SUBJECTS_LIST;
  return JHS_SUBJECTS_LIST;
}

export function getInitialSelectedSubjectKeysForLevel(level) {
  if (level === SCHOOL_LEVELS.KG) return KG_LEARNING_AREAS.map((s) => s.key);
  if (level === SCHOOL_LEVELS.PRIMARY) return PRIMARY_SUBJECTS_LIST.map((s) => s.key);
  return JHS_SUBJECTS_LIST.filter((s) => s.key !== 'FRENCH' && s.key !== 'ARABIC').map((s) => s.key);
}

/**
 * NaCCA Standard-Based 4-tier Kindergarten Developmental Proficiency Scale.
 */
export const KG_PROFICIENCY_SCALE = [
  {
    code: 'IND',
    label: 'Independently',
    shortLabel: 'Consistent',
    description: 'Demonstrates skill consistently without adult prompting.',
    rankOrder: 4,
    tone: 'emerald',
  },
  {
    code: 'DEV',
    label: 'Developing',
    shortLabel: 'Developing',
    description: 'Applies skill accurately with occasional teacher prompting.',
    rankOrder: 3,
    tone: 'blue',
  },
  {
    code: 'EMG',
    label: 'Emerging',
    shortLabel: 'Emerging',
    description: 'Shows early awareness; needs consistent guided practice.',
    rankOrder: 2,
    tone: 'amber',
  },
  {
    code: 'NYS',
    label: 'Not Yet',
    shortLabel: 'Needs Support',
    description: 'Requires targeted foundational support and reinforcement.',
    rankOrder: 1,
    tone: 'rose',
  },
];

const KG_SCALE_MAP = KG_PROFICIENCY_SCALE.reduce((acc, item) => {
  acc[item.code] = item;
  return acc;
}, {});

export function normalizeKgRatingCode(rawCode = '') {
  const upper = String(rawCode || '').trim().toUpperCase();
  if (KG_SCALE_MAP[upper]) return upper;
  return '';
}

export function getKgProficiencyMeta(code = '') {
  const norm = normalizeKgRatingCode(code);
  if (norm && KG_SCALE_MAP[norm]) return KG_SCALE_MAP[norm];
  return {
    code: '',
    label: 'Not Assessed',
    shortLabel: 'Pending',
    description: 'Pending teacher observation for this term.',
    rankOrder: 0,
    tone: 'zinc',
  };
}

/**
 * Age-differentiated NaCCA KG Learning Area milestone indicators.
 */
export const KG_INDICATORS = {
  'KG 1': {
    'LANG. & LIT.': [
      { id: 'kg1_ll_listen', label: 'Listens attentively to short stories, songs, and classroom instructions' },
      { id: 'kg1_ll_speak', label: 'Expresses everyday ideas and answers simple questions orally' },
      { id: 'kg1_ll_print', label: 'Handles picture books properly and identifies familiar environmental print' },
      { id: 'kg1_ll_prewrite', label: 'Demonstrates scribbling, pattern tracing, and proper crayon grip' },
    ],
    NUMERACY: [
      { id: 'kg1_num_sort', label: 'Sorts, matches, and groups familiar objects by colour, size, or shape' },
      { id: 'kg1_num_count', label: 'Counts concrete objects aloud from 1 to 10 with one-to-one matching' },
      { id: 'kg1_num_shapes', label: 'Identifies basic 2D shapes (circle, square, triangle) in surroundings' },
      { id: 'kg1_num_compare', label: 'Compares objects using big/small, long/short, and more/less' },
    ],
    OWOP: [
      { id: 'kg1_owop_self', label: 'States own name, age, gender, and identifies family members' },
      { id: 'kg1_owop_hygiene', label: 'Practices basic hygiene habits (handwashing, keeping tidy, safe play)' },
      { id: 'kg1_owop_env', label: 'Identifies common animals, plants, and weather changes around school' },
      { id: 'kg1_owop_civic', label: 'Shows respect for peers, teachers, and Ghanaian greetings' },
    ],
    CREATIVITY: [
      { id: 'kg1_cr_draw', label: 'Draws and colours freehand shapes and familiar objects meaningfully' },
      { id: 'kg1_cr_craft', label: 'Moulds clay/playdough, tears/pastes paper, and builds simple models' },
      { id: 'kg1_cr_music', label: 'Joins joyfully in rhymes, action songs, clapping rhythms, and dance' },
      { id: 'kg1_cr_roleplay', label: 'Engages imaginatively in dramatic play and everyday storytelling roles' },
    ],
  },
  'KG 2': {
    'LANG. & LIT.': [
      { id: 'kg2_ll_phonics', label: 'Identifies letter names, sounds, and rhymes; blends simple CVC words' },
      { id: 'kg2_ll_retell', label: 'Retells familiar stories in sequence and participates in conversations' },
      { id: 'kg2_ll_sight', label: 'Reads high-frequency sight words and short simple picture sentences' },
      { id: 'kg2_ll_write', label: 'Copies own name and forms uppercase and lowercase letters neatly' },
    ],
    NUMERACY: [
      { id: 'kg2_num_count', label: 'Counts, recognizes, and orders numerals reliably from 1 to 20+' },
      { id: 'kg2_num_ops', label: 'Solves simple concrete addition and subtraction word stories up to 10' },
      { id: 'kg2_num_pattern', label: 'Creates and extends repeating patterns and identifies common shapes' },
      { id: 'kg2_num_measure', label: 'Compares length, weight, capacity, and identifies Ghana coins/notes' },
    ],
    OWOP: [
      { id: 'kg2_owop_community', label: 'Describes community helpers, school rules, and safe civic behaviour' },
      { id: 'kg2_owop_health', label: 'Demonstrates independent personal care, nutrition, and safety habits' },
      { id: 'kg2_owop_nature', label: 'Observes plants, living vs non-living things, and caring for the environment' },
      { id: 'kg2_owop_values', label: 'Exhibits empathy, truthfulness, teamwork, and respect for cultural heritage' },
    ],
    CREATIVITY: [
      { id: 'kg2_cr_draw', label: 'Creates detailed drawings, patterns (including Ghana flag), and neat colouring' },
      { id: 'kg2_cr_craft', label: 'Cuts, folds, weaves, and assembles creative craft projects with care' },
      { id: 'kg2_cr_music', label: 'Performs rhymes, percussion rhythms, and cultural songs confidently' },
      { id: 'kg2_cr_design', label: 'Demonstrates originality and confidence in dramatic play and visual expression' },
    ],
  },
};

export function getKgIndicatorsForArea(areaKey = '', classLevel = 'KG 1') {
  const gradeBucket = /2/.test(String(classLevel || '')) ? 'KG 2' : 'KG 1';
  const bucket = KG_INDICATORS[gradeBucket] || KG_INDICATORS['KG 1'];
  if (bucket[areaKey]) return bucket[areaKey];

  // Generic milestone fallback for custom school-added KG learning areas
  return [
    { id: `${areaKey}_comprehension`, label: 'Demonstrates understanding of core learning concepts' },
    { id: `${areaKey}_participation`, label: 'Participates actively during guided play and group tasks' },
    { id: `${areaKey}_application`, label: 'Applies learned skills independently in classroom activities' },
  ];
}

export const KG_SOCIAL_HABITS = [
  { id: 'sharing', label: 'Shares materials & takes turns willingly' },
  { id: 'routine', label: 'Follows classroom routines & instructions' },
  { id: 'hygiene', label: 'Practices neatness & handwashing habits' },
  { id: 'confidence', label: 'Expresses feelings & needs appropriately' },
  { id: 'care', label: 'Cares for books, crayons & play tools' },
  { id: 'curiosity', label: 'Shows curiosity & eagerness to learn' },
];

/**
 * Derives an overall learning area proficiency code ('IND'|'DEV'|'EMG'|'NYS') from indicator entries.
 * Returns '' if no indicators are rated.
 * @param {Record<string, string>} indicatorsMap
 * @returns {string}
 */
export function deriveKgAreaRatingFromIndicators(indicatorsMap = {}) {
  const entries = Object.values(indicatorsMap || {})
    .map((code) => normalizeKgRatingCode(code))
    .filter(Boolean);

  if (entries.length === 0) return '';

  const totalRank = entries.reduce((sum, code) => sum + (KG_SCALE_MAP[code]?.rankOrder || 0), 0);
  const avgRank = totalRank / entries.length;

  if (avgRank >= 3.5) return 'IND';
  if (avgRank >= 2.5) return 'DEV';
  if (avgRank >= 1.5) return 'EMG';
  return 'NYS';
}
