// 状態保存用のキー
const STORAGE_KEY = 'tsukuyomi_state_v3';
const LEGACY_STORAGE_KEY = 'tsukuyomi_state_v1';
const REQUIRED_DIGIT_COUNT = 5;
const INITIAL_CHARACTERS = [
  '1字',
  'う',
  'つ',
  'し',
  'も',
  'ゆ',
  'い',
  'ち',
  'ひ',
  'き',
  'は',
  'や',
  'よ',
  'か',
  'み',
  'た',
  'こ',
  'お',
  'わ',
  'な',
  'あ',
];

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function shuffleArray(source) {
  const array = [...source];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function addNumberTags(array) {
  return array.map((item, index) => {
    if (index < 2 || index >= array.length - 1) {
      return { ...item };
    }

    const tag = `<span class='num'>${index - 1}</span>`;
    return {
      ...item,
      kaminoku: tag + item.kaminoku,
      shimonoku: tag + item.shimonoku,
    };
  });
}

function loadState() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyState(JSON.parse(legacyRaw));
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
  } catch (error) {
    console.warn('状態の読み込みに失敗しました。', error);
  }
  return null;
}

function migrateLegacyState(state) {
  if (
    !state ||
    !Array.isArray(state.yomifudalist) ||
    typeof state.currentIndex !== 'number'
  ) {
    return null;
  }
  const order = state.yomifudalist
    .slice(2, Math.max(state.yomifudalist.length - 1, 0))
    .map(item => item.no)
    .filter(no => typeof no === 'number');
  return {
    version: 2,
    currentIndex: clamp(state.currentIndex, 0, order.length + 1),
    order,
    selectedCardNumbers: order,
    manualAdditionNumbers: [],
  };
}

function persistState() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const payload = {
      version: 2,
      currentIndex,
      order: currentPlayableOrder,
      selectedCardNumbers: Array.from(selectedCardNumbers),
      manualAdditionNumbers: Array.from(manualAdditionNumbers),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('状態の保存に失敗しました。', error);
  }
}

function clearState() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn('状態の削除に失敗しました。', error);
  }
}

function isStateValid(state) {
  if (
    !state ||
    !Array.isArray(state.order) ||
    !Array.isArray(state.selectedCardNumbers) ||
    !Array.isArray(state.manualAdditionNumbers)
  ) {
    return false;
  }
  const hasUnknownNumbers = state.order.some(no => !baseCardMap.has(no));
  if (hasUnknownNumbers) {
    return false;
  }
  return true;
}

const specialPrefixIndexes = [0, 1];
const specialSuffixIndex = fudalist.length - 1;
const baseCards = fudalist.filter(card => card.no > 0 && card.no < 101);
const baseCardMap = new Map(baseCards.map(card => [card.no, card]));
const allCardNumbers = baseCards.map(card => card.no);

let selectedCardNumbers = new Set(allCardNumbers);
let manualAdditionNumbers = new Set();
let currentPlayableOrder = [];
let yomifudalist = [];
let currentIndex = 0;
let lastPlayableIndex = 0;

let draftSelection = null;
let draftManualAdditions = null;
let isEmptyCardModeEnabled = false;

const shimonokuElement = document.getElementById('shimonoku');
const kaminokuElement = document.getElementById('kaminoku');
const middleButton = document.getElementById('middle-button');
const cardCounterElement = document.getElementById('card-counter');

const openSettingsButton = document.getElementById('open-settings-button');
const shuffleButton = document.getElementById('shuffle-button');
const selectionModal = document.getElementById('selection-modal');
const closeSettingsButton = document.getElementById('close-settings-button');
const cancelSettingsButton = document.getElementById('cancel-settings-button');
const applySettingsButton = document.getElementById('apply-settings-button');
const selectAllButton = document.getElementById('select-all-button');
const selectNoneButton = document.getElementById('select-none-button');
const openDigitSelectorButton = document.getElementById('open-digit-selector-button');
const openInitialSelectorButton = document.getElementById('open-initial-selector-button');
const cardListElement = document.getElementById('card-list');
const selectedCountIndicator = document.getElementById('selected-count-indicator');
const emptyCardModeCheckbox = document.getElementById('empty-card-mode-checkbox');

const digitSelector = document.getElementById('digit-selector');
const closeDigitSelectorButton = document.getElementById('close-digit-selector-button');
const applyDigitSelectionButton = document.getElementById('apply-digit-selection-button');
const cancelDigitSelectionButton = document.getElementById('cancel-digit-selection-button');
const digitButtonsContainer = document.getElementById('digit-buttons');
const digitRandomAddCountInput = document.getElementById('digit-random-add-count');

const initialSelector = document.getElementById('initial-selector');
const closeInitialSelectorButton = document.getElementById('close-initial-selector-button');
const applyInitialSelectionButton = document.getElementById('apply-initial-selection-button');
const cancelInitialSelectionButton = document.getElementById('cancel-initial-selection-button');
const initialButtonsContainer = document.getElementById('initial-buttons');
const initialRandomAddCountInput = document.getElementById('initial-random-add-count');

const cardListRefs = new Map();

const digitSelectedValues = new Set();
const initialSelectedValues = new Set();

initialize();

function initialize() {
  buildCardList();
  buildDigitButtons();
  buildInitialButtons();
  attachMainEventListeners();
  attachModalEventListeners();

  const savedState = loadState();
  if (isStateValid(savedState)) {
    restoreState(savedState);
  } else {
    clearState();
    resetToDefault();
  }

  updateDisplay();
  showMiddleButton(); // 起動時に常にmiddle-buttonを表示
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
  updateProgressIndicator();
  updateSelectedCountIndicator(selectedCardNumbers);
}

function restoreState(state) {
  selectedCardNumbers = new Set(
    state.selectedCardNumbers.filter(no => baseCardMap.has(no))
  );
  manualAdditionNumbers = new Set(
    state.manualAdditionNumbers.filter(no => selectedCardNumbers.has(no))
  );
  const order = state.order.filter(no => selectedCardNumbers.has(no));
  currentPlayableOrder =
    order.length > 0 ? order.slice() : Array.from(selectedCardNumbers).sort((a, b) => a - b);
  rebuildYomifudalistFromOrder(currentPlayableOrder);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
  currentIndex = clamp(
    typeof state.currentIndex === 'number' ? state.currentIndex : 0,
    0,
    lastPlayableIndex
  );
}

function resetToDefault() {
  selectedCardNumbers = new Set(allCardNumbers);
  manualAdditionNumbers = new Set();
  shuffleWithCurrentSelection();
}

function buildCardList() {
  if (!cardListElement) {
    return;
  }
  cardListElement.innerHTML = '';
  baseCards.forEach(card => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-item';
    button.dataset.no = String(card.no);

    const kimarijiSpan = document.createElement('span');
    kimarijiSpan.className = 'card-kimariji';
    kimarijiSpan.textContent = card.kimariji || '';

    const manualSpan = document.createElement('span');
    manualSpan.className = 'card-manual';
    manualSpan.textContent = '空';
    manualSpan.style.display = 'none';

    button.appendChild(kimarijiSpan);
    button.appendChild(manualSpan);

    button.addEventListener('click', () => {
      toggleCardSelection(Number(button.dataset.no));
    });

    cardListElement.appendChild(button);
    cardListRefs.set(card.no, { button, manualSpan });
  });
}

function buildDigitButtons() {
  if (!digitButtonsContainer) {
    return;
  }
  digitButtonsContainer.innerHTML = '';
  for (let i = 0; i <= 9; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'digit-button';
    button.dataset.value = String(i);
    button.textContent = String(i);
    button.addEventListener('click', () => {
      toggleDigitSelection(button, i);
    });
    digitButtonsContainer.appendChild(button);
  }
}

function buildInitialButtons() {
  if (!initialButtonsContainer) {
    return;
  }
  initialButtonsContainer.innerHTML = '';
  INITIAL_CHARACTERS.forEach(char => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'initial-button';
    button.dataset.value = char;
    button.textContent = char;
    button.addEventListener('click', () => {
      toggleInitialSelection(button, char);
    });
    initialButtonsContainer.appendChild(button);
  });
}

function attachMainEventListeners() {
  if (shuffleButton) {
    shuffleButton.addEventListener('click', handleShuffleClick);
  }

  if (openSettingsButton) {
    openSettingsButton.addEventListener('click', () => openSelectionModal());
  }

  if (kaminokuElement) {
    kaminokuElement.addEventListener('click', () => {
      if (currentIndex < lastPlayableIndex) {
        currentIndex += 1;
        updateDisplay();
        showMiddleButton();
      }
    });
  }

  if (shimonokuElement) {
    shimonokuElement.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex -= 1;
        updateDisplay();
        showMiddleButton();
      }
    });
  }
}

function attachModalEventListeners() {
  if (closeSettingsButton) {
    closeSettingsButton.addEventListener('click', () => closeSelectionModal());
  }
  if (cancelSettingsButton) {
    cancelSettingsButton.addEventListener('click', () => closeSelectionModal());
  }
  if (applySettingsButton) {
    applySettingsButton.addEventListener('click', handleApplySettings);
  }
  if (selectAllButton) {
    selectAllButton.addEventListener('click', () => {
      if (!draftSelection) {
        return;
      }
      draftSelection = new Set(allCardNumbers);
      draftManualAdditions = new Set();
      updateCardListSelectionState(draftSelection, draftManualAdditions);
    });
  }
  if (selectNoneButton) {
    selectNoneButton.addEventListener('click', () => {
      if (!draftSelection) {
        return;
      }
      draftSelection.clear();
      draftManualAdditions.clear();
      updateCardListSelectionState(draftSelection, draftManualAdditions);
    });
  }
  if (openDigitSelectorButton) {
    openDigitSelectorButton.addEventListener('click', () => openSubModal(digitSelector));
  }
  if (openInitialSelectorButton) {
    openInitialSelectorButton.addEventListener('click', () => openSubModal(initialSelector));
  }
  if (closeDigitSelectorButton) {
    closeDigitSelectorButton.addEventListener('click', () => closeSubModal(digitSelector, true));
  }
  if (cancelDigitSelectionButton) {
    cancelDigitSelectionButton.addEventListener('click', () => closeSubModal(digitSelector, true));
  }
  if (applyDigitSelectionButton) {
    applyDigitSelectionButton.addEventListener('click', handleApplyDigitSelection);
  }
  if (closeInitialSelectorButton) {
    closeInitialSelectorButton.addEventListener('click', () => closeSubModal(initialSelector, true));
  }
  if (cancelInitialSelectionButton) {
    cancelInitialSelectionButton.addEventListener('click', () => closeSubModal(initialSelector, true));
  }
  if (applyInitialSelectionButton) {
    applyInitialSelectionButton.addEventListener('click', handleApplyInitialSelection);
  }
  if (emptyCardModeCheckbox) {
    emptyCardModeCheckbox.addEventListener('change', () => {
      isEmptyCardModeEnabled = emptyCardModeCheckbox.checked;
    });
  }
}

function openSelectionModal() {
  draftSelection = new Set(selectedCardNumbers);
  draftManualAdditions = new Set(manualAdditionNumbers);
  if (emptyCardModeCheckbox) {
    emptyCardModeCheckbox.checked = isEmptyCardModeEnabled;
  }
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  showModal(selectionModal);
}

function closeSelectionModal() {
  hideModal(selectionModal);
  draftSelection = null;
  draftManualAdditions = null;
  digitSelectedValues.clear();
  initialSelectedValues.clear();
  resetSelectionButtons(digitButtonsContainer);
  resetSelectionButtons(initialButtonsContainer);
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
}

function showModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function openSubModal(modal) {
  if (!modal || !draftSelection) {
    return;
  }
  if (modal === digitSelector && digitRandomAddCountInput) {
    digitRandomAddCountInput.value = '35';
  } else if (modal === initialSelector && initialRandomAddCountInput) {
    initialRandomAddCountInput.value = '0';
  }
  showModal(modal);
}

function closeSubModal(modal, resetButtons = false) {
  if (!modal) {
    return;
  }
  hideModal(modal);
  if (resetButtons) {
    if (modal === digitSelector) {
      digitSelectedValues.clear();
      resetSelectionButtons(digitButtonsContainer);
      if (digitRandomAddCountInput) {
        digitRandomAddCountInput.value = '35';
      }
    } else if (modal === initialSelector) {
      initialSelectedValues.clear();
      resetSelectionButtons(initialButtonsContainer);
      if (initialRandomAddCountInput) {
        initialRandomAddCountInput.value = '0';
      }
    }
  }
}

function resetSelectionButtons(container) {
  if (!container) {
    return;
  }
  container.querySelectorAll('button').forEach(button => {
    button.classList.remove('selected');
  });
}

function toggleCardSelection(cardNo) {
  if (!draftSelection || !draftManualAdditions) {
    return;
  }
  if (draftSelection.has(cardNo)) {
    draftSelection.delete(cardNo);
    draftManualAdditions.delete(cardNo);
  } else {
    draftSelection.add(cardNo);
    if (isEmptyCardModeEnabled) {
      draftManualAdditions.add(cardNo);
    }
  }
  updateCardListSelectionState(draftSelection, draftManualAdditions);
}

function markCardsAsManualAdditions(cardNumbers) {
  if (!draftManualAdditions || !isEmptyCardModeEnabled) {
    return;
  }
  cardNumbers.forEach(no => {
    draftManualAdditions.add(no);
  });
}

function updateCardListSelectionState(selectionSet, manualSet) {
  cardListRefs.forEach(({ button, manualSpan }, cardNo) => {
    const isSelected = selectionSet.has(cardNo);
    button.classList.toggle('selected', isSelected);
    if (manualSpan) {
      const isManual = manualSet.has(cardNo);
      manualSpan.style.display = isManual ? 'block' : 'none';
    }
  });
  updateSelectedCountIndicator(selectionSet);
}

function applyRandomAddition(count) {
  if (!draftSelection || !draftManualAdditions) {
    return;
  }
  if (!Number.isInteger(count) || count <= 0) {
    return;
  }
  draftManualAdditions.forEach(no => {
    draftSelection.delete(no);
  });
  draftManualAdditions.clear();

  const selectionInitials = new Set(
    [...draftSelection]
      .map(no => baseCardMap.get(no)?.initial)
      .filter(initial => typeof initial === 'string' && initial.length > 0)
  );

  const preferredCandidates = [];
  const fallbackCandidates = [];

  baseCards.forEach(card => {
    if (draftSelection.has(card.no)) {
      return;
    }
    if (selectionInitials.has(card.initial)) {
      preferredCandidates.push(card.no);
    } else {
      fallbackCandidates.push(card.no);
    }
  });

  const totalCandidates = preferredCandidates.length + fallbackCandidates.length;
  if (totalCandidates === 0) {
    window.alert('追加できる札がありません。');
    return;
  }

  const shuffledPreferred = shuffleArray(preferredCandidates);
  const shuffledFallback = shuffleArray(fallbackCandidates);
  const actualCount = Math.min(count, totalCandidates);
  const preferredTake = Math.min(actualCount, shuffledPreferred.length);
  const fallbackTake = Math.max(0, actualCount - preferredTake);
  const selectedNos = [
    ...shuffledPreferred.slice(0, preferredTake),
    ...shuffledFallback.slice(0, fallbackTake),
  ];

  selectedNos.forEach(no => {
    draftSelection.add(no);
    draftManualAdditions.add(no);
  });

  if (actualCount < count) {
    window.alert(`追加可能な札は${actualCount}枚のみでした。`);
  }
}

function toggleDigitSelection(button, value) {
  if (!button) {
    return;
  }
  if (digitSelectedValues.has(value)) {
    digitSelectedValues.delete(value);
    button.classList.remove('selected');
    return;
  }
  if (digitSelectedValues.size >= REQUIRED_DIGIT_COUNT) {
    window.alert(`選択できる数値は${REQUIRED_DIGIT_COUNT}つまでです。`);
    return;
  }
  digitSelectedValues.add(value);
  button.classList.add('selected');
}

function handleApplyDigitSelection() {
  if (!draftSelection || !draftManualAdditions) {
    closeSubModal(digitSelector, true);
    return;
  }
  if (digitSelectedValues.size !== REQUIRED_DIGIT_COUNT) {
    window.alert(`${REQUIRED_DIGIT_COUNT}つの数値を選択してください。`);
    return;
  }
  const selectedDigits = Array.from(digitSelectedValues);
  const typeInput = document.querySelector('input[name="digit-type"]:checked');
  const type = typeInput?.value === 'ten' ? 'ten' : 'one';

  const matches = baseCards.filter(card => {
    const target = type === 'ten' ? card.tens_place : card.one_place;
    return selectedDigits.includes(target);
  });

  if (matches.length === 0) {
    window.alert('条件に合致する札がありませんでした。');
    return;
  }

  const matchNumbers = matches.map(card => card.no);
  draftSelection = new Set(matchNumbers);
  draftManualAdditions = new Set();
  const randomCount = Number(digitRandomAddCountInput?.value ?? 0);
  applyRandomAddition(randomCount);
  markCardsAsManualAdditions(matchNumbers);
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  closeSubModal(digitSelector, true);
}

function toggleInitialSelection(button, initialChar) {
  if (!button) {
    return;
  }
  if (initialSelectedValues.has(initialChar)) {
    initialSelectedValues.delete(initialChar);
    button.classList.remove('selected');
    return;
  }
  initialSelectedValues.add(initialChar);
  button.classList.add('selected');
}

function handleApplyInitialSelection() {
  if (!draftSelection || !draftManualAdditions) {
    closeSubModal(initialSelector, true);
    return;
  }
  if (initialSelectedValues.size === 0) {
    window.alert('一文字目を少なくとも1つ選択してください。');
    return;
  }
  const matches = baseCards.filter(card => initialSelectedValues.has(card.initial));
  if (matches.length === 0) {
    window.alert('条件に合致する札がありませんでした。');
    return;
  }
  const matchNumbers = matches.map(card => card.no);
  draftSelection = new Set(matchNumbers);
  draftManualAdditions = new Set();
  const randomCount = Number(initialRandomAddCountInput?.value ?? 0);
  applyRandomAddition(randomCount);
  markCardsAsManualAdditions(matchNumbers);
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  closeSubModal(initialSelector, true);
}

function handleApplySettings() {
  if (!draftSelection || !draftManualAdditions) {
    closeSelectionModal();
    return;
  }
  if (draftSelection.size === 0) {
    window.alert('少なくとも1枚以上の札を選択してください。');
    return;
  }
  if (!confirmShuffle()) {
    return;
  }

  selectedCardNumbers = new Set(draftSelection);
  manualAdditionNumbers = new Set(
    [...draftManualAdditions].filter(no => selectedCardNumbers.has(no))
  );
  closeSelectionModal();

  shuffleWithCurrentSelection();
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
  updateProgressIndicator();
  persistState();
}

function shuffleWithCurrentSelection() {
  if (selectedCardNumbers.size === 0) {
    return;
  }
  const selectionArray = Array.from(selectedCardNumbers);
  currentPlayableOrder = shuffleArray(selectionArray);
  rebuildYomifudalistFromOrder(currentPlayableOrder);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
  currentIndex = 0;
  hideMiddleButton();
  updateDisplay();
  updateSelectedCountIndicator(selectedCardNumbers);
}

function rebuildYomifudalistFromOrder(order) {
  const prefix = specialPrefixIndexes
    .map(index => ({ ...fudalist[index] }))
    .filter(Boolean);
  const suffix = [{ ...fudalist[specialSuffixIndex] }];

  const cards = order
    .map(no => {
      const base = baseCardMap.get(no);
      if (!base) {
        return null;
      }
      return {
        ...base,
        kaminoku: base.kaminoku,
        shimonoku: base.shimonoku,
        isManualAddition: manualAdditionNumbers.has(no),
      };
    })
    .filter(Boolean);

  yomifudalist = addNumberTags([...prefix, ...cards, ...suffix]);
  applyCardIndicators(yomifudalist);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
}

function applyCardIndicators(cards) {
  if (!Array.isArray(cards)) {
    return;
  }
  const seenNonEmptyInitials = new Set();

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    if (!card || typeof card.no !== 'number' || card.no <= 0 || card.no >= 101) {
      if (card) {
        card.indicatorType = null;
      }
      continue;
    }

    const initial = typeof card.initial === 'string' ? card.initial : '';
    const hasLaterNonEmpty = initial ? seenNonEmptyInitials.has(initial) : false;

    if (card.isManualAddition) {
      card.indicatorType = hasLaterNonEmpty ? null : 'noSameSound';
      continue;
    }

    card.indicatorType = hasLaterNonEmpty ? null : 'single';
    if (initial) {
      seenNonEmptyInitials.add(initial);
    }
  }
}

function updateDisplay() {
  if (!shimonokuElement || !kaminokuElement || yomifudalist.length === 0) {
    return;
  }

  const currentCard = yomifudalist[currentIndex];
  const nextCard = yomifudalist[Math.min(currentIndex + 1, yomifudalist.length - 1)];

  renderCard(shimonokuElement, currentCard, 'shimonoku');
  renderCard(kaminokuElement, nextCard, 'kaminoku');

  updateProgressIndicator();
  persistState();
}

function renderCard(element, card, type) {
  if (!element) {
    return;
  }
  if (!card) {
    element.innerHTML = '';
    element.classList.remove('manual-addition');
    return;
  }

  if (type === 'shimonoku') {
    element.innerHTML = card.shimonoku || '';
  } else {
    element.innerHTML = card.kaminoku || '';
    appendCardIndicator(element, card);
  }

  if (card.isManualAddition) {
    element.classList.add('manual-addition');
  } else {
    element.classList.remove('manual-addition');
  }
}

function appendCardIndicator(element, card) {
  const text = getIndicatorText(card);
  if (!text) {
    return;
  }
  const indicator = document.createElement('div');
  indicator.className = 'card-indicator';
  indicator.textContent = text;
  element.appendChild(indicator);
}

function getIndicatorText(card) {
  if (!card || !card.indicatorType) {
    return null;
  }
  if (card.indicatorType === 'single') {
    return '単独';
  }
  if (card.indicatorType === 'noSameSound') {
    return '同音なし';
  }
  return null;
}

function getPlayableCardCount() {
  return currentPlayableOrder.length;
}

function updateProgressIndicator() {
  if (!cardCounterElement) {
    return;
  }
  const total = getPlayableCardCount();
  cardCounterElement.textContent = `選択数: ${total}枚`;
}

function updateSelectedCountIndicator(selectionSet) {
  if (!selectedCountIndicator) {
    return;
  }
  const targetSet = selectionSet || selectedCardNumbers;
  selectedCountIndicator.textContent = `選択中: ${targetSet.size}枚`;
}

function confirmShuffle() {
  return window.confirm('読み札をシャッフルしますが，いいですか？');
}

function handleShuffleClick() {
  if (selectedCardNumbers.size === 0) {
    window.alert('使う札が選択されていません。設定から札を選択してください。');
    return;
  }
  if (!confirmShuffle()) {
    return;
  }
  shuffleWithCurrentSelection();
  updateProgressIndicator();
  persistState();
}

function showMiddleButton() {
  if (middleButton) {
    middleButton.style.display = 'block';
  }
}

function hideMiddleButton() {
  if (middleButton) {
    middleButton.style.display = 'none';
  }
}

// タイマー
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.float-button');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const circle = button.querySelector('circle') || button.querySelector('.main-circle');
      const quarterCircle = button.querySelector('.quarter-circle');

      switch (button.id) {
        case 'middle-button':
          animateMiddleButton(circle, quarterCircle, button);
          break;
        default:
          break;
      }
    });
  });

  const floatButtons = document.querySelector('.float-buttons');
  const toggleButton = document.getElementById('toggle-button');

  if (toggleButton && floatButtons) {
    toggleButton.addEventListener('click', () => {
      floatButtons.classList.toggle('visible');
    });
  }
});

function animateCircle(circle, duration) {
  if (!circle) {
    return;
  }
  circle.style.animation = `disappear ${duration}s linear forwards`;

  setTimeout(() => {
    circle.style.animation = '';
  }, duration * 1000);
}

function animateMiddleButton(mainCircle, quarterCircle, button) {
  if (!mainCircle || !quarterCircle || !button) {
    return;
  }
  mainCircle.style.animation = 'disappear-main 4s linear forwards';

  setTimeout(() => {
    quarterCircle.style.animation = 'disappear-quarter 1s linear forwards';

    setTimeout(() => {
      mainCircle.style.animation = '';
      quarterCircle.style.animation = '';
      button.style.display = 'none';
    }, 1000);
  }, 3000);
}
