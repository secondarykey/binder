export namespace model {
	
	export class Datum {
	
	
	    static createFrom(source: any = {}) {
	        return new Datum(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

