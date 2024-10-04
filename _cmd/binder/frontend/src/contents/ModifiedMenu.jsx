import { useNavigate } from 'react-router-dom';

import {
  Accordion, AccordionDetails, AccordionSummary,
  ListItemIcon, ListItemText, MenuItem,
  FormControlLabel, Checkbox
} from '@mui/material';

import { SelectDirectory, LoadBinder, GetModifiedTree } from '../../wailsjs/go/api/App';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import Event from '../Event';
import Message from '../Message';

import { useEffect, useState } from 'react';
import { ArrowDropDown, CheckBox } from '@mui/icons-material';

/**
 * 変更一覧
 * @param {*} props 
 * @returns 
 */
function ModifiedMenu(props) {

  const nav = useNavigate();

  const [notes, setNotes] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {

    Event.changeTitle("Modified Files");
    GetModifiedTree().then((tree) => {
      var data = tree.data;
      data.map((leaf) => {
        if (!leaf.children) {
          return;
        }
        if (leaf.id === "DIR_Note") {
          setNotes(leaf.children)
        } else if (leaf.id === "DIR_Diagram") {
          setDiagrams(leaf.children)
        } else if (leaf.id === "DIR_Asset") {
          setAssets(leaf.children)
        } else if (leaf.id === "DIR_Template") {
          setTemplates(leaf.children)
        }
      })
    }).catch((err) => {
      Message.showError(err);
    })
  }, [])

  const handleOpen = (e,leaf) => {
    Event.changeTitle(leaf.name);
    nav("/status/modified/" + leaf.type + "/" + leaf.id);
  }

  const handleCommit = () => {
  }

  return (<>
    <ModifiedList name="Note" data={notes} onClick={handleOpen}/>
    <ModifiedList name="Diagram" data={diagrams} onClick={handleOpen}/>
    <ModifiedList name="Asset" data={assets} onClick={handleOpen}/>
    <ModifiedList name="Template" data={templates} onClick={handleOpen}/>
  </>);
}

/**
 * 一覧処理
 * @param {*} props 
 * @returns 
 */
const ModifiedList = (props) => {

  const [expand,setExpand] = useState(true);
  const [all,setAll] = useState(false);
  const [data,setData] = useState([]);

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
    props.data.forEach( (leaf) => {
      leaf.checked = true;
      wk.push(leaf);
    })

    setAll(props.data.length > 0 )
    setData(wk);
  },[props.data]);

  const handleChecked = (e,l) => {

    e.stopPropagation()
    e.preventDefault();

    var rtn = data.map((leaf) => {
      if ( l.id === leaf.id) {
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
    <Accordion expanded={expand}>
      <AccordionSummary style={summaryStyle} expandIcon={<ArrowDropDownIcon />} onClick={handleExpand}>
        <FormControlLabel style={controlStyle}
          control={
            <Checkbox checked={all} disabled={disabled} onClick={handleCheckedAll}/>
          }
          label={props.name} />
      </AccordionSummary>

      <AccordionDetails style={detailsStyle}>
        {data.map((leaf) => {
          return (
            <MenuItem style={rowStyle} key={leaf.id} onClick={(e) => props.onClick(e,leaf)}>
              <ListItemIcon>
                <Checkbox checked={leaf.checked} onClick={(e) => handleChecked(e,leaf)}/>
              </ListItemIcon>
              <ListItemText>{leaf.name}</ListItemText>
            </MenuItem>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );

}

export default ModifiedMenu;