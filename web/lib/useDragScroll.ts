'use client';

import { useEffect, useRef } from 'react';

/**
 * 데스크탑 마우스 드래그로 가로 스크롤을 가능하게 하는 hook.
 *
 * 원본: public/js/app.js `initDragSlider` (L2010~2044). 모바일은 CSS `touch-action: pan-x` 로
 * 네이티브 처리, 데스크탑만 mouse 이벤트로 보강.
 *
 * 사용:
 *   const ref = useDragScroll<HTMLDivElement>();
 *   return <div ref={ref} ...>...</div>;
 *
 * 동작:
 *   - mousedown: 드래그 시작 위치 기록 + `.dragging` 클래스 추가 (cursor 변경용)
 *   - mousemove: scrollLeft 직접 조작
 *   - mouseup/mouseleave: 드래그 종료
 *   - 드래그 중 자식 요소 click 막기 (드래그 임계 5px 넘으면 다음 click 차단)
 */
const DRAG_CLICK_SUPPRESS_THRESHOLD = 5;

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let totalMovement = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      el.classList.add('dragging');
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      totalMovement = 0;
    };
    const onMouseLeave = () => {
      isDown = false;
      el.classList.remove('dragging');
    };
    const onMouseUp = () => {
      isDown = false;
      el.classList.remove('dragging');
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const delta = x - startX;
      el.scrollLeft = scrollLeft - delta;
      totalMovement += Math.abs(delta);
    };
    // 드래그 중 자식 클릭 차단 (capture 단계에서 가로채기)
    const onClickCapture = (e: MouseEvent) => {
      if (totalMovement > DRAG_CLICK_SUPPRESS_THRESHOLD) {
        e.stopPropagation();
        e.preventDefault();
        totalMovement = 0; // 한 번만 막고 리셋
      }
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('click', onClickCapture, true); // capture

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return ref;
}
