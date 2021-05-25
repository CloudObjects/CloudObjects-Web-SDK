import { AccountContext } from "./AccountContext";
import { COID, COID_TYPE } from "./COID";
import { AxiosStatic, AxiosInstance } from 'axios'

declare const axios : AxiosStatic;

export class COWebPlatform {

    private appCOID : COID = null;
    private accountContext : AccountContext = null;
    private platformClient : AxiosInstance = null;
    
    constructor(appCOID : COID) {
        if (appCOID.getType() == COID_TYPE.VERSIONED || appCOID.getType() == COID_TYPE.UNVERSIONED)
            this.appCOID = appCOID;
        else
            throw new Error("Tried to initialize CloudObjects web platform with invalid application COID.");

        this.platformClient = axios.create({
            baseURL : 'https://webplatform.co-n.net/'
                + appCOID.getNamespace() + '/' + this.appCOID.getNameSegment() + '/'
        });

        if (sessionStorage.getItem("COWebPlatformSessionData") !== null) {
            let session = JSON.parse(sessionStorage.getItem("COWebPlatformSessionData"));
            if (session.hasOwnProperty('aauid') && session.hasOwnProperty('accessToken'))
                this.setSignedInWithAccountDetails(session.aauid, session.accessToken);
        };
    }

    private signInPreCheck(identityProviderCOID? : COID) {
        if (this.appCOID == null || this.platformClient == null ||
                (this.appCOID.getType() != COID_TYPE.VERSIONED && this.appCOID.getType() != COID_TYPE.UNVERSIONED))
            throw new Error("CloudObjects web platform was not correctly initialized.");

        if (this.accountContext != null)
            throw new Error("Already signed in.");

        if (identityProviderCOID && identityProviderCOID.getType() != COID_TYPE.ROOT)
            throw new Error("Tried to sign in with invalid identity provider COID.");

    }

    signInWithRedirect(identityProviderCOID : COID) {
        this.signInPreCheck(identityProviderCOID);

        document.location.href = 'https://webplatform.co-n.net/'
            + this.appCOID.getNamespace() + '/' + this.appCOID.getNameSegment()
            + '/signInWith/' + identityProviderCOID.getNamespace()
            + '?response_type=code&redirect_uri=';
    }

    async signInWithCredentials(identityProviderCOID : COID, credentials : Array<any>) : Promise<any> {
        this.signInPreCheck(identityProviderCOID);

        let apiResponse = await this.platformClient.post(
            'signInWith/' + identityProviderCOID.getNamespace(),
            credentials);
            
        if (apiResponse.data.hasOwnProperty('type') && apiResponse.data.type == 'account') {
            let content = apiResponse.data.content;
            this.setSignedInWithAccountDetails(content.aauid, content.access_token);
            return {
                signedIn : true
            };
        }

        return {
            signedIn : false,
            details : apiResponse.data
        };
    }

    setSignedInWithAccountDetails(aauid : string, accessToken : string) {
        this.signInPreCheck();

        window.sessionStorage.setItem("COWebPlatformSessionData", JSON.stringify({
            aauid : aauid,
            accessToken : accessToken
        }));

        this.accountContext = new AccountContext(aauid, accessToken);
    }

    signOut() {
        this.accountContext = null;
        sessionStorage.removeItem("COWebPlatformSessionData");
    }

    isSignedIn() {
        return (this.accountContext !== null);
    }

    getAccountContext() {
        return this.accountContext;
    }

}