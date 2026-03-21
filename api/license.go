package api

import "binder"

// GetLicense はアプリケーションのライセンス（MIT）を返す
func (a *App) GetLicense() (string, error) {
	return binder.LicenseText, nil
}

// GetThirdPartyLicenses はサードパーティライセンスを返す
func (a *App) GetThirdPartyLicenses() (string, error) {
	return binder.ThirdPartyLicensesText, nil
}
