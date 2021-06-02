import { AxiosStatic } from 'axios'

declare const axios : AxiosStatic;

export class AccountContext {

    private aauid : string;
    private accessToken : string;
    private client;

    constructor(aauid : string, accessToken : string) {
        this.aauid = aauid;
        this.accessToken = accessToken;
    }

    getClient() {
        if (!this.client)
            this.client = axios.create({
                baseURL : 'https://' + this.aauid + '.aauid.net/',
                headers : { 'Authorization' : 'Bearer ' + this.accessToken }
            });

        return this.client;
    }

    getAAUID() {
        return this.aauid;
    }

    getAccessToken() {
        return this.accessToken;
    }

}