import * as rp from 'request-promise';

export class HttpService {
    public post(url: string, body: any, authorization: string): void {
        rp.post(url, { body, json: true, headers: { Authorization: authorization } });
    }
}
