export namespace binder {
	
	
	export class Resource {
	    notes: model.Note[];
	    data: model.Datum[];
	
	    static createFrom(source: any = {}) {
	        return new Resource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.notes = this.convertValues(source["notes"], model.Note);
	        this.data = this.convertValues(source["data"], model.Datum);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice) {
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
	
	export class Config {
	    name: string;
	    detail: string;
	    listNum: number;
	    branch: string;
	    autoCommit: number;
	    // Go type: time
	    created: any;
	    // Go type: time
	    updated: any;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.listNum = source["listNum"];
	        this.branch = source["branch"];
	        this.autoCommit = source["autoCommit"];
	        this.created = this.convertValues(source["created"], null);
	        this.updated = this.convertValues(source["updated"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice) {
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
	export class Datum {
	    id: string;
	    noteId: string;
	    name: string;
	    detail: string;
	    pluginId: string;
	    // Go type: time
	    publish: any;
	    // Go type: time
	    created: any;
	    // Go type: time
	    updated: any;
	
	    static createFrom(source: any = {}) {
	        return new Datum(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.noteId = source["noteId"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.pluginId = source["pluginId"];
	        this.publish = this.convertValues(source["publish"], null);
	        this.created = this.convertValues(source["created"], null);
	        this.updated = this.convertValues(source["updated"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice) {
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
	    name: string;
	    detail: string;
	    // Go type: time
	    publish: any;
	    // Go type: time
	    created: any;
	    // Go type: time
	    updated: any;
	    data: Datum[];
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.publish = this.convertValues(source["publish"], null);
	        this.created = this.convertValues(source["created"], null);
	        this.updated = this.convertValues(source["updated"], null);
	        this.data = this.convertValues(source["data"], Datum);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice) {
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
		    if (a.slice) {
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
	
	    static createFrom(source: any = {}) {
	        return new Git(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.name = source["name"];
	        this.mail = source["mail"];
	        this.code = source["code"];
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
		    if (a.slice) {
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
		    if (a.slice) {
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

