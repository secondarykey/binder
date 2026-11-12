/**
 * 各種モード（エディタで開くものの種類）。
 *
 * App.jsx に置くと、エディタの部品が App.jsx を import して循環する
 * （App → Content → エディタ → App）ので、ここに分けている。
 * App.jsx からも同じものを export している。
 */
export const Mode = Object.freeze({
    template: 'template',
    asset: 'asset',
    note: 'note',
    diagram: 'diagram',
})
