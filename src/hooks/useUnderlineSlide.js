import { useState, useCallback } from 'react';

/**
 * Underline Slide 애니메이션 훅
 *
 * 사용법:
 *   const { triggered, fire } = useUnderlineSlide();
 *
 *   <h1 className={`anim-underline-slide${triggered ? ' --triggered' : ''}`} onClick={fire}>
 *     텍스트
 *   </h1>
 *
 * - 엘리먼트에 `anim-underline-slide` 클래스 필수
 * - fire()를 원하는 이벤트(onClick, onMouseDown 등)에 연결
 * - duration은 CSS @keyframes underline-slide(0.45s)와 맞춰져 있음
 */
export function useUnderlineSlide(duration = 450) {
  const [triggered, setTriggered] = useState(false);

  const fire = useCallback(() => {
    setTriggered(true);
    setTimeout(() => setTriggered(false), duration);
  }, [duration]);

  return { triggered, fire };
}
