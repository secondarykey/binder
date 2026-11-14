import { Alert, Box, Checkbox, FormControlLabel, Typography } from "@mui/material";

import "../../language";
import { useTranslation } from 'react-i18next';

/**
 * 下層を持つノートの削除確認に出す「階層データの削除」のチェック。
 * チェックを入れたときだけ、アセット等も消える旨の警告を出す。
 * 削除ボタンはチェックが入るまで押せないようにする（呼ぶ側で checked を見る）。
 * @param {{ checked: boolean, onChange: (checked: boolean) => void }} props
 */
function HierarchyDeleteOption({ checked, onChange }) {
  const {t} = useTranslation();
  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        label={<Typography variant="body2">{t("note.deleteWithChildren")}</Typography>}
      />
      {checked && (
        <Alert severity="warning" sx={{ fontSize: "13px", mt: 1 }}>
          {t("note.deleteWithChildrenWarning")}
        </Alert>
      )}
    </Box>
  );
}

export default HierarchyDeleteOption;
