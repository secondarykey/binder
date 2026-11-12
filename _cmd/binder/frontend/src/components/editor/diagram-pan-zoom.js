/**
 * エディタのダイアグラムプレビュー（#mermaidViewer）に、移動と拡大の操作を付ける。
 * 描画し直すたびに SVG が入れ替わるので、そのつど呼ぶ。
 * @param {HTMLElement} elm #mermaidViewer
 */
export function attachDiagramPanZoom(elm) {
  var svg = document.querySelector('#mermaidViewer svg');
  var left = 0;
  var top = 0;
  var scale = 1.0;

  var transform = function () {
    var px = left + 'px';
    var py = top + 'px';
    svg.style.transform = `translate(${px},${py}) scale(${scale})`;
  }

  // ホイールクリック（中ボタン）でドラッグ移動。AssetViewer/LayerEditor と統一。
  svg.addEventListener("pointerdown", function (event) {
    if (event.button !== 1) return;
    event.preventDefault(); // ブラウザのオートスクロールモードを抑制
    elm.style.cursor = 'grabbing';
  });
  svg.addEventListener("pointermove", function (event) {
    if (!(event.buttons & 4)) return; // 中ボタン押下中のみ
    left = (left + event.movementX);
    top = (top + event.movementY);
    transform();
  });
  svg.addEventListener("pointerup", function (event) {
    if (event.button === 1) elm.style.cursor = '';
  });

  //Wheelによる拡大
  svg.addEventListener("wheel", function (event) {
    var dy = event.deltaY;
    var s = 0.1;
    if (dy > 0) {
      s *= -1;
    }
    scale += s;
    transform();
  });

  transform();
}
