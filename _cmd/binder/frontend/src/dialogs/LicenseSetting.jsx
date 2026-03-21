import { useEffect, useState, useContext } from "react";

import { Box, Typography } from "@mui/material";

import { GetLicense, GetThirdPartyLicenses } from "../../bindings/binder/api/app";
import { EventContext } from "../Event";
import "../i18n/config";
import { useTranslation } from 'react-i18next';

/**
 * ライセンス表示
 */
function LicenseSetting() {

  const evt = useContext(EventContext);
  const {t} = useTranslation();

  const [license, setLicense] = useState("");
  const [thirdParty, setThirdParty] = useState("");

  useEffect(() => {
    GetLicense().then((text) => {
      setLicense(text);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
    GetThirdPartyLicenses().then((text) => {
      setThirdParty(text);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ margin: '20px 24px', flex: 1, overflowY: 'auto' }}>

        <Typography variant="subtitle2" sx={{ color: 'var(--text-primary)', mb: 1 }}>
          {t("setting.license")}
        </Typography>
        <Box sx={{
          whiteSpace: 'pre-wrap',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-overlay)',
          border: '1px solid var(--border-primary)',
          borderRadius: 1,
          p: 2,
          mb: 3,
        }}>
          {license}
        </Box>

        <Typography variant="subtitle2" sx={{ color: 'var(--text-primary)', mb: 1 }}>
          {t("setting.thirdPartyLicense")}
        </Typography>
        <Box sx={{
          whiteSpace: 'pre-wrap',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-overlay)',
          border: '1px solid var(--border-primary)',
          borderRadius: 1,
          p: 2,
        }}>
          {thirdParty}
        </Box>

      </Box>
    </Box>
  );
}
export default LicenseSetting;
