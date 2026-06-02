import { useEffect, useState, useContext } from "react";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import TerminalIcon from '@mui/icons-material/Terminal';

import { GetVersionInfo } from "../../bindings/binder/api/app";
import { GetLicense, GetThirdPartyLicenses } from "../../bindings/binder/api/shared/shared";
import { OpenSyslogWindow } from "../../bindings/main/window";
import { EventContext } from "../Event";
import { useDialogMessage } from './components/DialogError';
import "../language";
import { useTranslation } from 'react-i18next';

/**
 * ライセンス表示
 */
function LicenseSetting() {

  const evt = useContext(EventContext);
  const { showError } = useDialogMessage();
  const {t} = useTranslation();

  const [license, setLicense] = useState("");
  const [thirdParty, setThirdParty] = useState("");
  const [versionInfo, setVersionInfo] = useState(null);

  useEffect(() => {
    GetVersionInfo().then((info) => {
      setVersionInfo(info);
    }).catch((err) => {
      showError(err);
    });
    GetLicense().then((text) => {
      setLicense(text);
    }).catch((err) => {
      showError(err);
    });
    GetThirdPartyLicenses().then((text) => {
      setThirdParty(text);
    }).catch((err) => {
      showError(err);
    });
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ margin: '20px 24px', flex: 1, overflowY: 'auto' }}>

        {versionInfo && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
              Binder Version {versionInfo.version}{versionInfo.dev ? " (DEV)" : ""}
            </Typography>
            <Tooltip title={t("setting.openSystemLog")}>
              <IconButton
                size="small"
                onClick={() => OpenSyslogWindow().catch((err) => showError(err))}
                sx={{ color: 'var(--text-muted)' }}
              >
                <TerminalIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

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
