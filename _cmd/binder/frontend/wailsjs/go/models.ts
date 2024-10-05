export namespace api {
	
	export class Templates {
	    layouts: model.Template[];
	    contents: model.Template[];
	
	    static createFrom(source: any = {}) {
	        return new Templates(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.layouts = this.convertValues(source["layouts"], model.Template);
	        this.contents = this.convertValues(source["contents"], model.Template);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace binder {
	
	export class Binder {
	
	
	    static createFrom(source: any = {}) {
	        return new Binder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class Leaf {
	    id: string;
	    parentId: string;
	    name: string;
	    type: string;
	    children: Leaf[];
	
	    static createFrom(source: any = {}) {
	        return new Leaf(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.children = this.convertValues(source["children"], Leaf);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Patch {
	    patch: string;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new Patch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.patch = source["patch"];
	        this.source = source["source"];
	    }
	}
	export class Tree {
	    data: Leaf[];
	
	    static createFrom(source: any = {}) {
	        return new Tree(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], Leaf);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace model {
	
	export class Template {
	    id: string;
	    type: string;
	    name: string;
	    detail: string;
	    // Go type: time
	    created: any;
	    createdUser: string;
	    // Go type: time
	    updated: any;
	    updatedUser: string;
	    updatedStatus: number;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.created = this.convertValues(source["created"], null);
	        this.createdUser = source["createdUser"];
	        this.updated = this.convertValues(source["updated"], null);
	        this.updatedUser = source["updatedUser"];
	        this.updatedStatus = source["updatedStatus"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Note {
	    id: string;
	    parentId: string;
	    alias: string;
	    name: string;
	    detail: string;
	    layoutTemplate: string;
	    contentTemplate: string;
	    // Go type: time
	    publish: any;
	    // Go type: time
	    created: any;
	    createdUser: string;
	    // Go type: time
	    updated: any;
	    updatedUser: string;
	    publishStatus: number;
	    updatedStatus: number;
	    layouts: Template[];
	    contents: Template[];
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.alias = source["alias"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.layoutTemplate = source["layoutTemplate"];
	        this.contentTemplate = source["contentTemplate"];
	        this.publish = this.convertValues(source["publish"], null);
	        this.created = this.convertValues(source["created"], null);
	        this.createdUser = source["createdUser"];
	        this.updated = this.convertValues(source["updated"], null);
	        this.updatedUser = source["updatedUser"];
	        this.publishStatus = source["publishStatus"];
	        this.updatedStatus = source["updatedStatus"];
	        this.layouts = this.convertValues(source["layouts"], Template);
	        this.contents = this.convertValues(source["contents"], Template);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Asset {
	    id: string;
	    parentId: string;
	    alias: string;
	    name: string;
	    detail: string;
	    binary: boolean;
	    // Go type: time
	    created: any;
	    createdUser: string;
	    // Go type: time
	    updated: any;
	    updatedUser: string;
	    note?: Note;
	    publishStatus: number;
	    updatedStatus: number;
	
	    static createFrom(source: any = {}) {
	        return new Asset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.alias = source["alias"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.binary = source["binary"];
	        this.created = this.convertValues(source["created"], null);
	        this.createdUser = source["createdUser"];
	        this.updated = this.convertValues(source["updated"], null);
	        this.updatedUser = source["updatedUser"];
	        this.note = this.convertValues(source["note"], Note);
	        this.publishStatus = source["publishStatus"];
	        this.updatedStatus = source["updatedStatus"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Config {
	    name: string;
	    detail: string;
	    remote: string;
	    markedUrl: string;
	    mermaidUrl: string;
	    // Go type: time
	    created: any;
	    createdUser: string;
	    // Go type: time
	    updated: any;
	    updatedUser: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.remote = source["remote"];
	        this.markedUrl = source["markedUrl"];
	        this.mermaidUrl = source["mermaidUrl"];
	        this.created = this.convertValues(source["created"], null);
	        this.createdUser = source["createdUser"];
	        this.updated = this.convertValues(source["updated"], null);
	        this.updatedUser = source["updatedUser"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Diagram {
	    id: string;
	    parentId: string;
	    alias: string;
	    name: string;
	    detail: string;
	    // Go type: time
	    publish: any;
	    // Go type: time
	    created: any;
	    createdUser: string;
	    // Go type: time
	    updated: any;
	    updatedUser: string;
	    note?: Note;
	    publishStatus: number;
	    updatedStatus: number;
	
	    static createFrom(source: any = {}) {
	        return new Diagram(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.alias = source["alias"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.publish = this.convertValues(source["publish"], null);
	        this.created = this.convertValues(source["created"], null);
	        this.createdUser = source["createdUser"];
	        this.updated = this.convertValues(source["updated"], null);
	        this.updatedUser = source["updatedUser"];
	        this.note = this.convertValues(source["note"], Note);
	        this.publishStatus = source["publishStatus"];
	        this.updatedStatus = source["updatedStatus"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace settings {
	
	export class Vim {
	    use: boolean;
	    openWith: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Vim(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.use = source["use"];
	        this.openWith = source["openWith"];
	    }
	}
	export class Font {
	    name: string;
	    color: string;
	    foreColor: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Font(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.color = source["color"];
	        this.foreColor = source["foreColor"];
	        this.size = source["size"];
	    }
	}
	export class Editor {
	    text: Font;
	    vim: Vim;
	
	    static createFrom(source: any = {}) {
	        return new Editor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = this.convertValues(source["text"], Font);
	        this.vim = this.convertValues(source["vim"], Vim);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Git {
	    branch: string;
	    name: string;
	    mail: string;
	    code: string;
	    File: string;
	
	    static createFrom(source: any = {}) {
	        return new Git(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.name = source["name"];
	        this.mail = source["mail"];
	        this.code = source["code"];
	        this.File = source["File"];
	    }
	}
	export class Look {
	    darkMode: boolean;
	    whole?: Font;
	    treeNoteNum: number;
	    editor?: Editor;
	
	    static createFrom(source: any = {}) {
	        return new Look(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.darkMode = source["darkMode"];
	        this.whole = this.convertValues(source["whole"], Font);
	        this.treeNoteNum = source["treeNoteNum"];
	        this.editor = this.convertValues(source["editor"], Editor);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Path {
	    default: string;
	    runWithOpen: boolean;
	    openWithItem: boolean;
	    histories: string[];
	    lastNoteId: string;
	    lastDataId: string;
	
	    static createFrom(source: any = {}) {
	        return new Path(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.default = source["default"];
	        this.runWithOpen = source["runWithOpen"];
	        this.openWithItem = source["openWithItem"];
	        this.histories = source["histories"];
	        this.lastNoteId = source["lastNoteId"];
	        this.lastDataId = source["lastDataId"];
	    }
	}
	export class Position {
	    top: number;
	    left: number;
	    width: number;
	    height: number;
	    menuWidth: number;
	    splitter: number;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.top = source["top"];
	        this.left = source["left"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.menuWidth = source["menuWidth"];
	        this.splitter = source["splitter"];
	    }
	}
	export class Setting {
	    position?: Position;
	    path?: Path;
	    lookAndFeel?: Look;
	    git?: Git;
	
	    static createFrom(source: any = {}) {
	        return new Setting(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.position = this.convertValues(source["position"], Position);
	        this.path = this.convertValues(source["path"], Path);
	        this.lookAndFeel = this.convertValues(source["lookAndFeel"], Look);
	        this.git = this.convertValues(source["git"], Git);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

