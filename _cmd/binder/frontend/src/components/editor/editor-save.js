import { SaveNote, SaveDiagram, SaveTemplate } from "../../../bindings/binder/api/app";
import { Mode } from "../../mode";

//指定秒数での実行処理
const debouncePromiss = (fn, delay) => {
  var timer = null;
  return function (...args) {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(fn.apply(this, args));
      }, delay);
    });
  }
}

//テキストの保存処理（デバウンス）
const writeFn = debouncePromiss((mode, id, txt) => {
  if (mode === Mode.note) {
    return SaveNote(id, txt);
  } else if (mode === Mode.diagram) {
    return SaveDiagram(id, txt);
  } else if (mode === Mode.template) {
    return SaveTemplate(id, txt);
  }
}, 1000);

export { writeFn };
