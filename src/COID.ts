export enum COID_TYPE { INVALID, ROOT, UNVERSIONED, VERSIONED }

export class COID {

    private type : COID_TYPE = COID_TYPE.INVALID;
    private namespace : string = null;
    private name : string = null;
    private version : string = null;

    constructor(value : string) {
        value = (value.substr(0, 7) == 'coid://')
            ? value : 'coid://' + value;
        let elements = value.split('/');
        if (elements[0] == 'coid:' && elements[1] == '') {
            switch (elements.length) {
                case 3:
                    this.namespace = elements[2];
                    this.type = COID_TYPE.ROOT;
                    break;
                case 4:
                    this.namespace = elements[2];
                    this.name = elements[3];
                    this.type = COID_TYPE.UNVERSIONED;
                    break;
                case 5:
                    this.namespace = elements[2];
                    this.name = elements[3];
                    this.version = elements[4];
                    this.type = COID_TYPE.VERSIONED;
                    break;
            }
        }
    }

    isValid() {
        return (this.type != COID_TYPE.INVALID);
    }

    getType() {
        return this.type;
    }

    getNamespace() {
        return this.namespace;
    }

    getName() {
        return this.name;
    }

    getVersion() {
        return this.version;
    }

    getNameSegment() {
        return (this.type == COID_TYPE.VERSIONED ? this.name + '/' + this.version
            : this.name);
    }
}