import { AccountContext } from "./AccountContext";
import { COID, COID_TYPE } from "./COID";

export class COWebPlatform {

    private appCOID : COID = null;
    private accountContext : AccountContext = null;
    
    constructor(appCOID : COID) {
        if (appCOID.getType() == COID_TYPE.VERSIONED || appCOID.getType() == COID_TYPE.UNVERSIONED)
            this.appCOID = appCOID;
        else
            throw new Error("Tried to initialize CloudObjects web platform with invalid application COID.");
    }

    private signInPreCheck(identityProviderCOID? : COID) {
        if (this.appCOID == null)
            throw new Error("CloudObjects web platform was not correctly initialized.");

        if (this.accountContext != null)
            throw new Error("Already signed in.");

        if (identityProviderCOID && identityProviderCOID.getType() != COID_TYPE.ROOT)
            throw new Error("Tried to sign in with invalid identity provider COID.");

    }

    signInWithRedirect(identityProviderCOID : COID) {
        this.signInPreCheck(identityProviderCOID);

        document.location.href = 'https://web.cloudobjects.io/'
            + this.appCOID.getNamespace() + '/' + this.appCOID.getNameSegment()
            + '/signInWith/' + identityProviderCOID.getNamespace()
            + '?response_type=code&redirect_uri=';
    }

    setSignedInWithAccountDetails(aauid : string, accessToken : string) {
        this.signInPreCheck();

        this.accountContext = new AccountContext(aauid, accessToken);
    }

    getAccountContext() {
        return this.accountContext;
    }

}