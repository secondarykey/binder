/**
 * 中身を Blob にしてファイルとして保存させる（プレビューの SVG / HTML）。
 */
export function downloadBlob(content, type, filename) {
  var data = new Blob([content], { type });
  var dataURL = window.URL.createObjectURL(data);
  var tempLink = document.createElement('a');
  tempLink.href = dataURL;
  tempLink.setAttribute('download', filename);
  tempLink.click();
}

/** Blob を生成してテキストファイルをダウンロードする */
export function triggerTextDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
}
