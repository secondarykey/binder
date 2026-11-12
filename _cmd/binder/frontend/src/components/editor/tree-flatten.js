// ツリー（GetBinderTree の結果）を平らな一覧にする関数と、ID 一覧の並べ方。

/**
 * ツリーからノートのみを再帰的に抽出する
 */
export function flattenNotes(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.type === "note") {
      result.push({ id: node.id, name: node.name });
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenNotes(node.children));
    }
  }
  return result;
}

/**
 * ツリーからダイアグラムのみを再帰的に抽出する
 */
export function flattenDiagrams(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.type === "diagram") {
      result.push({ id: node.id, name: node.name });
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenDiagrams(node.children));
    }
  }
  return result;
}

/**
 * ツリーから全Structureをフラットに抽出する
 */
export function flattenStructures(nodes) {
  const result = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, type: node.type, mime: node.mime, parentId: node.parentId, updated: node.updated });
    if (node.children && node.children.length > 0) {
      result.push(...flattenStructures(node.children));
    }
  }
  return result;
}

/**
 * ID一覧の並び順を作る。
 * 基本は更新日付の降順。currentId の子は上位グループとして先頭にまとめる。
 * 自分自身（currentId）は除外する。
 */
export function sortIdCandidates(list, currentId) {
  const byUpdated = (a, b) => {
    const ta = a.updated ? Date.parse(a.updated) : 0;
    const tb = b.updated ? Date.parse(b.updated) : 0;
    return (tb || 0) - (ta || 0);
  };
  const children = list.filter((s) => s.id !== currentId && s.parentId === currentId).sort(byUpdated);
  const others = list.filter((s) => s.id !== currentId && s.parentId !== currentId).sort(byUpdated);
  return [...children, ...others];
}
