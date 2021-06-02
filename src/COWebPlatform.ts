import { AccountContext } from "./AccountContext";
import { COID, COID_TYPE } from "./COID";
import { AxiosStatic, AxiosInstance } from 'axios'

declare const axios : AxiosStatic;

export class COWebPlatform {

    private appCOID : COID = null;
    private accountContext : AccountContext = null;
    private platformClient : AxiosInstance = null;

    private blockPage() {
        let blocker = document.createElement('div');
        blocker.id = 'cowp-blocker';
        let s = blocker.style;
        s.position = 'fixed';
        s.left = '0px';
        s.right = '0px';
        s.top = '0px';
        s.bottom = '0px';
        s.backgroundColor = '#000';
        s.opacity = '0.5';
        var body = document.getElementsByTagName('body');
        if (body.length == 0)
            document.documentElement.appendChild(blocker);
        else
            body[0].appendChild(blocker);
    }

    private unblockPage() {
        document.getElementById('cowp-blocker').remove();
    }
    
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

    signInWithPopup(identityProviderCOID : COID, parameters : Object) : Promise<any> {
        let webApp = this;
        return new Promise((resolve, reject) => {
            webApp.signInPreCheck(identityProviderCOID);

            if (typeof(parameters) !== "object")
                parameters = {};
            if (!parameters.hasOwnProperty('redirect_uri'))
                parameters['redirect_uri'] = 'https://webplatform.co-n.net/'
                    + webApp.appCOID.getNamespace() + '/' + webApp.appCOID.getNameSegment()
                    + '/popupCallback';

            parameters['response_type'] = 'code';
            parameters['display'] = 'popup';

            webApp.blockPage();

            // Open empty popup first
            let authPopup = window.open('about:blank', 'cowp-auth-popup',
                'left=50,top=50,width=800,height=600');

            let eventListener;
            let state : string;

            // Prepare event listener
            eventListener = (event : MessageEvent<any>) => {
                let data = event.data.split(':');
                if (data.count < 2 || data[0] !== 'cowpAuthPopupReturn')
                    return;

                window.removeEventListener('message', eventListener);

                // Attempt to complete flow            
                this.platformClient.post('signInWithCode', {
                    'enc_return_data' : event.data.substr(20),
                    'state' : state
                }).then(apiResponse => {
                    if (apiResponse.data.hasOwnProperty('type') && apiResponse.data.type == 'account') {
                        let content = apiResponse.data.content;
                        webApp.setSignedInWithAccountDetails(content.aauid, content.access_token);
                        webApp.unblockPage();
                        resolve(true);
                    }
                }).catch(reason => {
                    webApp.unblockPage();
                    reject(reason);
                });
            };
            window.addEventListener('message', eventListener);

            webApp.platformClient.post(
                'signInWith/' + identityProviderCOID.getNamespace(),
                parameters
            ).then((apiResponse) => {
                if (apiResponse.data.hasOwnProperty('provider_response')
                        && apiResponse.data.hasOwnProperty('state')
                        && apiResponse.data.provider_response.hasOwnProperty('redirect_uri')) {
                    // Navigate to provider
                    authPopup.document.location.href = apiResponse.data.provider_response.redirect_uri;
                    state = apiResponse.data.state;
                } else {
                    webApp.unblockPage();
                    reject(apiResponse.data);
                }        
            }).catch(reason => {
                webApp.unblockPage();
                reject(reason);
            });
        });        
    }

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