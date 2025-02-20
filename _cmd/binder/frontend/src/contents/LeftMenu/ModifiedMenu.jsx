import { useEffect, useRef, useState, forwardRef, useContext,useImperativeHandle } from 'react';
import { useNavigate , useParams } from 'react-router-dom';

import {
  Accordion, AccordionDetails, AccordionSummary,
  ListItemIcon, ListItemText, MenuItem,
  FormControlLabel, Checkbox,
} from '@mui/material';

import { GetModifiedTree, CommitFiles } from '../../../wailsjs/go/api/App';

import Event,{EventContext} from '../../Event';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

/**
 * 変更一覧
 * @param {*} props 
 * @returns 
 */
function ModifiedMenu(props) {

  const evt = useContext(EventContext)
  const {date} = useParams();

  const nav = useNavigate();

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);

  const noteRef = useRef(null);
  const diagramRef = useRef(null);
  const assetRef = useRef(null);
  const templateRef = useRef(null);

  useEffect(() => {

    //コミットの登録
    evt.register("ModifiedMenu",Event.ModifiedCommit, function(comment) {

      var files = [];
      files.push(...noteRef.current.checked());
      files.push(...diagramRef.current.checked());
      files.push(...assetRef.current.checked());
      files.push(...templateRef.current.checked());

      CommitFiles(files, comment).then(() => {
        evt.showSuccessMessage("Commit");
        setTimeout(function() {
          nav("/status/modified/" + (new Date()).toISOString);
        },1000);
      }).catch((err) => {
        evt.showErrorMessage(err);
      })
    });

    evt.changeTitle("Modified Files");

    //更新一覧を取得
    GetModifiedTree().then((tree) => {

      var data = tree.data;
      var comment = "Updated:";

      var writeComment = function (prefix, children) {
        if ( children.length === 0 ) return;
        comment += "\n  " + prefix + ":";
        children.forEach((l) => {
          comment += "\n    " + l.name;
        });
      }

      data.map((leaf) => {

        var leafs = leaf.children;
        if ( leafs === undefined || leafs === null ) {
          leafs = [];
        }

        if (leaf.id === "DIR_Note") {
          if ( leafs.length != notes.length ) {
            setNotes(leafs);
          }
          writeComment("Note", leafs)
        } else if (leaf.id === "DIR_Diagram") {
          if ( leafs.length != diagrams.length ) {
            setDiagrams(leafs)
          }
          writeComment("Diagram", leafs)
        } else if (leaf.id === "DIR_Asset") {
          if ( leafs.length != templates.length ) {
            setAssets(leafs)
          }
          writeComment("Asset", leafs)
        } else if (leaf.id === "DIR_Template") {
          if ( leafs.length != assets.length ) {
            setTemplates(leafs)
          }
          writeComment("Template", leafs)
        }
      })

      //コメント欄を更新
      evt.raise(Event.ModifiedComment, comment);

    }).catch((err) => {
      evt.showErrorMessage(err);
    })

  }, [date])

  const handleOpen = (e, leaf) => {
    evt.changeTitle(leaf.name);
    nav("/status/modified/" + leaf.type + "/" + leaf.id);
  }

  return (<>
    <ModifiedList name="Note" data={notes} onClick={handleOpen} ref={noteRef} />
    <ModifiedList name="Diagram" data={diagrams} onClick={handleOpen} ref={diagramRef} />
    <ModifiedList name="Asset" data={assets} onClick={handleOpen} ref={assetRef} />
    <ModifiedList name="Template" data={templates} onClick={handleOpen} ref={templateRef} />
  </>);
}

/**
 * 一覧処理
 * @param {*} props 
 * @returns 
 */
const ModifiedList = forwardRef((props, ref) => {

  const [data, setData] = useState([]);
  const [expand, setExpand] = useState(true);
  const [all, setAll] = useState(false);

  var summaryStyle = {}
  summaryStyle.margin = "0px";
  summaryStyle.padding = "0px 0px";
  summaryStyle.minHeight = "48px";
  summaryStyle.maxHeight = "48px";

  var controlStyle = {}
  controlStyle.margin = "0px";
  controlStyle.padding = "0px 0px";

  var detailsStyle = {}
  detailsStyle.margin = "0px 15px";
  detailsStyle.padding = "0px 10px 0px";

  var rowStyle = {}
  rowStyle.margin = "0px";
  rowStyle.padding = "0px";
  rowStyle.maxHeight = "30px";

  var disabled = false;
  if (data.length == 0) {
    disabled = true;
  }

  useEffect(() => {

    var wk = [];
    props.data.forEach((leaf) => {
      leaf.checked = true;
      wk.push(leaf);
    })

    setAll(props.data.length > 0)
    setData(wk);

  }, [props.data]);

  const checked = () => {
    var rtn = [];
    data.forEach((val) => {
      if (val.checked) {
        rtn.push(val)
      }
    })
    return rtn;
  }

  useImperativeHandle(ref, () => ({
    checked: checked,
  }),[data]);

  const handleChecked = (e, l) => {

    e.stopPropagation()
    e.preventDefault();

    var rtn = data.map((leaf) => {
      if (l.id === leaf.id) {
        leaf.checked = !leaf.checked;
      }
      return leaf;
    })

    setData(rtn);
  }

  const handleCheckedAll = (e) => {
    e.stopPropagation()
    e.preventDefault();

    var ans = !all;
    data.map((leaf) => {
      leaf.checked = ans;
    })

    setAll(ans);
    setData(data);
  }

  const handleExpand = (e) => {
    e.stopPropagation()
    e.preventDefault();
    setExpand(!expand)
  }

  return (
    <Accordion expanded={expand} ref={ref}>
      <AccordionSummary style={summaryStyle} expandIcon={<ArrowDropDownIcon />} onClick={handleExpand}>
        <FormControlLabel style={controlStyle}
          control={
            <Checkbox checked={all} disabled={disabled} onClick={handleCheckedAll} />
          }
          label={props.name} />
      </AccordionSummary>

      <AccordionDetails style={detailsStyle}>
        {data.map((leaf) => {
          return (
            <MenuItem style={rowStyle} key={leaf.id} onClick={(e) => props.onClick(e, leaf)}>
              <ListItemIcon>
                <Checkbox checked={leaf.checked} onClick={(e) => handleChecked(e, leaf)} />
              </ListItemIcon>
              <ListItemText>{leaf.name}</ListItemText>
            </MenuItem>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );

});

export default ModifiedMenu;