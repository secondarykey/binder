import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { GetLatestPatch } from "../../wailsjs/go/api/App";

import Message from "../Message";

function Patch(props) {
    const {type,currentId} = useParams();

    useEffect(() => {
        console.log(type)
        console.log(currentId)
        GetLatestPatch(type,currentId).then((txt) => {
            console.log(txt)
        }).catch( (err) => {
            Message.showError(err);
        })
    },[currentId])

    return (<>
    </>)
}

export default Patch;