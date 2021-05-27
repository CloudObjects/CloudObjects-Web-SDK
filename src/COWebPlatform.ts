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
        } else
        if (sessionStorage.getItem("COWebPlatformFlowState") !== null) {            
            // Parse query for returned parameters
            let query = {};
            let pairs = document.location.search.substr(1).split('&');
            for (var i = 0; i < pairs.length; i++) {
                let pair = pairs[i].split('=');
                query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            }

            query['state'] = sessionStorage.getItem("COWebPlatformFlowState"); 
                
            // Attempt to complete flow
            let webApp = this;
            this.platformClient.post('signInWithCode', query)
                .then(function(apiResponse) {
                    if (apiResponse.data.hasOwnProperty('type') && apiResponse.data.type == 'account') {
                        let content = apiResponse.data.content;
                        webApp.setSignedInWithAccountDetails(content.aauid, content.access_token);
                    }
                });
            sessionStorage.removeItem("COWebPlatformFlowState");
        }
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

    async signInWithRedirect(identityProviderCOID : COID, parameters : Object) : Promise<any> {
        this.signInPreCheck(identityProviderCOID);
        
        if (typeof(parameters) !== "object")
            parameters = {};
        if (!parameters.hasOwnProperty('redirect_uri'))
            parameters['redirect_uri'] = document.location.href;

        parameters['response_type'] = 'code';

        let apiResponse = await this.platformClient.post(
            'signInWith/' + identityProviderCOID.getNamespace(),
            parameters
        );

        if (apiResponse.data.hasOwnProperty('provider_response')
                && apiResponse.data.hasOwnProperty('state')
                && apiResponse.data.provider_response.hasOwnProperty('redirect_uri')) {
            // Save state
            sessionStorage.setItem("COWebPlatformFlowState", apiResponse.data.state);
            // Redirect to provider
            document.location.href = apiResponse.data.provider_response.redirect_uri;
        } else
            return apiResponse.data;
    }

    /*async signInWithPopup(identityProviderCOID : COID, credentials : Array<any>) {

    } */

    async signInWithCredentials(identityProviderCOID : COID, credentials : Object) : Promise<any> {
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