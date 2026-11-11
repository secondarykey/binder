// ライセンス文。リポジトリのルートに置いた LICENSE / THIRD_PARTY_LICENSES を、
// フロントのビルド時にそのまま取り込む（Vite の ?raw）。
// 実体をルートから動かさないのは、GitHub がルートの LICENSE を見てライセンスを表示するため。
// Go 側で埋め込むとルートパッケージ（binder）を import することになり、
// Lite まで db / fs を抱え込むので、フロントで読む。
import license from '../../../LICENSE?raw';
import thirdPartyLicenses from '../../../THIRD_PARTY_LICENSES?raw';

export { license, thirdPartyLicenses };
