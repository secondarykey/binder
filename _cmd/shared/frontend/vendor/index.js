// 同梱している marked / mermaid（Binder と Binder Lite で共通）。
// 実体はこのディレクトリの 1 組だけ。差し替えるときはファイルと下のバージョンを一緒に更新する
// （手順は _docs/marked-migration.md と _docs/mermaid12-migration.md）。
import markedVendorUrl from './marked.min.js?url'
import mermaidVendorUrl from './mermaid.min.js?url'

// 同梱した marked のバージョン
const MARKED_VENDOR_VERSION = '18.0.7'
// 同梱した mermaid のバージョン
const MERMAID_VENDOR_VERSION = '12.1.0'

export { markedVendorUrl, mermaidVendorUrl, MARKED_VENDOR_VERSION, MERMAID_VENDOR_VERSION }
