import { useState, useRef, useCallback } from "react";
import { getCaretPosition } from "./caret-position";

/**
 * オートコンプリートのロジックを管理するカスタムフック
 *
 * @param {Object} options
 * @param {Array<{ trigger: string, candidates: string[] | ((filterText: string) => string[] | Promise<string[]>) }>} options.triggers
 * @param {string} [options.textareaSelector='#editor']
 * @param {React.RefObject<boolean>} options.composingRef
 * @param {(trigger: string, selected: string, replaceStart: number, replaceEnd: number) => void} options.onSelect
 */
export function useAutocomplete({ triggers = [], textareaSelector = '#editor', composingRef, onSelect }) {

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState(null);

  const triggerInfoRef = useRef(null);
  const justSelectedRef = useRef(false);

  const getTextarea = useCallback(() => {
    return document.querySelector(textareaSelector);
  }, [textareaSelector]);

  const computePosition = useCallback((textarea, itemCount) => {
    const caret = getCaretPosition(textarea);
    if (!caret) return null;
    const container = textarea.closest('#editorContent') || textarea.parentElement;
    if (!container) return caret;
    const containerRect = container.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
    const popupHeight = Math.min((itemCount || 8) * 28 + 8, 200);
    let top = caret.top - containerRect.top + lineHeight;
    if (top + popupHeight > containerRect.height) {
      // getCaretPositionはカーソルがtextarea下端付近だとrect.bottomにクランプするため、
      // フリップ時は実際のカーソル行上端を推定して被りを防ぐ
      const cursorTop = Math.min(caret.top, textareaRect.bottom - lineHeight);
      top = cursorTop - containerRect.top - popupHeight;
    }
    return {
      top: Math.max(0, top),
      left: caret.left - containerRect.left,
    };
  }, []);

  const filterCandidates = useCallback((candidates, filterText) => {
    if (!filterText) return [...candidates];
    const keyword = filterText.trim().toLowerCase();
    if (!keyword) return [...candidates];
    return candidates.filter(c => {
      const label = typeof c === 'string' ? c : c.label;
      return label.toLowerCase().startsWith(keyword);
    });
  }, []);

  const openPopup = useCallback((trigger, candidates, filterText, startPos, textarea) => {
    const filtered = filterCandidates(candidates, filterText);
    // 候補が0件、または入力が候補と完全一致（1件のみ）なら閉じる
    const keyword = (filterText || '').trim().toLowerCase();
    if (filtered.length === 0 || (filtered.length === 1 && keyword && (typeof filtered[0] === 'string' ? filtered[0] : filtered[0].label).toLowerCase() === keyword)) {
      setIsOpen(false);
      triggerInfoRef.current = null;
      return;
    }
    triggerInfoRef.current = { trigger: trigger.trigger, startPos, candidates };
    setItems(filtered);
    setSelectedIndex(0);
    setPosition(computePosition(textarea, filtered.length));
    setIsOpen(true);
  }, [filterCandidates, computePosition]);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    setItems([]);
    setSelectedIndex(0);
    setPosition(null);
    triggerInfoRef.current = null;
  }, []);

  const selectItem = useCallback((index) => {
    const textarea = getTextarea();
    if (!textarea || !triggerInfoRef.current) return;
    const info = triggerInfoRef.current;
    const item = items[index];
    if (item == null) return;
    const label = typeof item === 'string' ? item : item.label;
    const replaceStart = info.startPos;
    const replaceEnd = textarea.selectionStart;
    justSelectedRef.current = true;
    dismiss();
    if (onSelect) {
      onSelect(info.trigger, label, replaceStart, replaceEnd);
    }
  }, [items, getTextarea, dismiss, onSelect]);

  /**
   * キーダウンハンドラ。ポップアップが開いている時にキーを消費した場合 true を返す。
   */
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % items.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectItem(selectedIndex);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
      return true;
    }
    return false;
  }, [isOpen, items.length, selectedIndex, selectItem, dismiss]);

  /**
   * テキスト変更後に呼び出す。トリガー検出と絞り込みを行う。
   */
  const handleInput = useCallback(() => {
    // 選択直後の入力イベントはスキップ（再検出で再表示されるのを防止）
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (composingRef?.current) {
      if (isOpen) dismiss();
      return;
    }

    const textarea = getTextarea();
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    let bestMatch = null;

    for (const trigger of triggers) {
      const t = trigger.trigger;
      const searchStart = Math.max(0, cursorPos - t.length - 100);
      const searchText = textBeforeCursor.substring(searchStart);
      const triggerIdx = searchText.lastIndexOf(t);
      if (triggerIdx === -1) continue;

      const absoluteTriggerIdx = searchStart + triggerIdx;
      const filterText = textBeforeCursor.substring(absoluteTriggerIdx + t.length);

      if (/[\n\r]/.test(filterText)) continue;

      const candidates = typeof trigger.candidates === 'function'
        ? trigger.candidates(filterText)
        : trigger.candidates;

      if (candidates instanceof Promise) {
        candidates.then((resolved) => {
          if (justSelectedRef.current) return;
          const filtered = filterCandidates(resolved, filterText);
          if (filtered.length > 0) {
            triggerInfoRef.current = { trigger: t, startPos: absoluteTriggerIdx, candidates: resolved };
            setItems(filtered);
            setSelectedIndex(0);
            setPosition(computePosition(textarea, filtered.length));
            setIsOpen(true);
          } else if (isOpen && triggerInfoRef.current?.trigger === t) {
            dismiss();
          }
        });
        return;
      }

      if (!bestMatch || absoluteTriggerIdx > bestMatch.absoluteTriggerIdx) {
        bestMatch = { trigger, absoluteTriggerIdx, filterText, candidates };
      }
    }

    if (bestMatch) {
      openPopup(bestMatch.trigger, bestMatch.candidates, bestMatch.filterText, bestMatch.absoluteTriggerIdx, textarea);
    } else if (isOpen) {
      dismiss();
    }
  }, [triggers, getTextarea, composingRef, isOpen, dismiss, openPopup, filterCandidates, computePosition]);

  return {
    isOpen,
    items,
    selectedIndex,
    position,
    handleKeyDown,
    handleInput,
    dismiss,
    selectItem,
  };
}
