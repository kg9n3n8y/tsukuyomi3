// 状態保存用のキー
const STORAGE_KEY = 'tsukuyomi_state_v1';

function loadState() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('状態の読み込みに失敗しました。', error);
    return null;
  }
}

function persistState() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const payload = {
      currentIndex,
      yomifudalist: yomifudalist.map(({ no, kaminoku, shimonoku }) => ({
        no,
        kaminoku,
        shimonoku,
      })),
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
  } catch (error) {
    console.warn('状態の削除に失敗しました。', error);
  }
}

function isStateValid(state) {
  return (
    !!state &&
    Array.isArray(state.yomifudalist) &&
    state.yomifudalist.length === fudalist.length
  );
}

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

const savedState = loadState();
let yomifudalist = [];
let currentIndex = 0;

if (isStateValid(savedState)) {
  yomifudalist = savedState.yomifudalist.map(item => ({ ...item }));
  const candidateIndex =
    typeof savedState.currentIndex === 'number' ? savedState.currentIndex : 0;
  const lastIndexCandidate = Math.max(0, yomifudalist.length - 2);
  currentIndex = clamp(candidateIndex, 0, lastIndexCandidate);
} else {
  clearState();
  yomifudalist = addNumberTags(shuffleExceptFirstAndSecond(fudalist));
}

const lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
currentIndex = clamp(currentIndex, 0, lastPlayableIndex);

// 表示対象とする要素の参照を保持
const shimonokuElement = document.getElementById('shimonoku');
const kaminokuElement = document.getElementById('kaminoku');
const middleButton = document.getElementById('middle-button');

// 読み札の表示
function updateDisplay() {
  if (!shimonokuElement || !kaminokuElement) {
    return;
  }

  // innerHTMLを使用してHTMLタグを解釈して表示
  shimonokuElement.innerHTML = yomifudalist[currentIndex].shimonoku;
  const nextIndex = Math.min(currentIndex + 1, yomifudalist.length - 1);
  kaminokuElement.innerHTML = yomifudalist[nextIndex].kaminoku;
  persistState();
}

function showMiddleButton() {
  if (middleButton) {
    middleButton.style.display = 'block';
  }
}

// 上の句クリックで進む
if (kaminokuElement) {
  kaminokuElement.addEventListener('click', () => {
    if (currentIndex < lastPlayableIndex) {
      currentIndex++;
      updateDisplay();
      showMiddleButton();
    }
  });
}

// 下の句クリックで戻る
if (shimonokuElement) {
  shimonokuElement.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateDisplay();
      showMiddleButton();
    }
  });
}

// 初期表示
updateDisplay();

if (currentIndex > 0) {
  showMiddleButton();
}


// 配列の3〜102番目のシャッフル
function shuffleExceptFirstAndSecond(array) {
    const SHUFFLE_START_INDEX = 2;
    const SHUFFLE_END_INDEX = array.length - 1;

    const fixedHead = array.slice(0, SHUFFLE_START_INDEX);
    const fixedTail = array.slice(SHUFFLE_END_INDEX);
    const toShuffle = array.slice(SHUFFLE_START_INDEX, SHUFFLE_END_INDEX);

    for (let i = toShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }

    return [...fixedHead, ...toShuffle, ...fixedTail];
}


// 数字をつける
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


// ページのリロード
function reloadPage(){
  let flag = window.confirm("読み札をシャッフルしますが，いいですか？");
  if(flag) {
    clearState();
    location.reload();
  }
}


// タイマー
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.float-button');

  buttons.forEach(button => {
      button.addEventListener('click', () => {
          const circle = button.querySelector('circle') || button.querySelector('.main-circle');
          const quarterCircle = button.querySelector('.quarter-circle');
          
          switch(button.id) {
              case 'middle-button':
                  animateMiddleButton(circle, quarterCircle, button);
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
  circle.style.animation = `disappear ${duration}s linear forwards`;
  
  setTimeout(() => {
      circle.style.animation = '';
  }, duration * 1000);
}

function animateMiddleButton(mainCircle, quarterCircle, button) {
  mainCircle.style.animation = 'disappear-main 4s linear forwards';
  
  setTimeout(() => {
      quarterCircle.style.animation = 'disappear-quarter 1s linear forwards';
      
      setTimeout(() => {
          mainCircle.style.animation = '';
          quarterCircle.style.animation = '';
          button.style.display = 'none'; // ボタンを非表示にする
      }, 1000);
  }, 3000);
}
