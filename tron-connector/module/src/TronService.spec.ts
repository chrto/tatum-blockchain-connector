import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TronService } from './TronService';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const NODES_URL: string = 'https://api.shasta.trongrid.io';
class TestService extends TronService {
    constructor (@InjectPinoLogger(TestService.name) logger: PinoLogger) {
        super(logger);
    }
    protected getNodesUrl (testnet: boolean): Promise<string[]> {
        return Promise.resolve([NODES_URL]);
    }

    protected isTestnet (): Promise<boolean> {
        return Promise.resolve(true);
    }

    protected async storeKMSTransaction (
        txData: string,
        currency: string,
        signatureId: string[],
    ): Promise<string> {
        this.logger.info(txData);
        return txData;
    }

    protected completeKMSTransaction (
        txId: string,
        signatureId: string,
    ): Promise<void> {
        this.logger.info(txId);
        return Promise.resolve();
    }
}

describe('Tron Service', () => {
    let logger: PinoLogger = {} as PinoLogger;
    let service: TestService;

    let spiedIsTestnet;
    let spiedGetNodesUrl;
    let spiedCompleteKMSTransaction;

    beforeAll(() => {
        spiedIsTestnet = jest.spyOn(TestService.prototype as any, 'isTestnet');
        spiedGetNodesUrl = jest.spyOn(TestService.prototype as any, 'getNodesUrl');
        spiedCompleteKMSTransaction = jest.spyOn(TestService.prototype as any, 'completeKMSTransaction');

        logger.info = jest.fn().mockReturnValue(null);
        logger.error = jest.fn().mockReturnValue(null);
        service = new TestService(logger);
    });

    describe('broadcast method', () => {
        const DATA: any = { data: 'tx data..' };
        const TX_DATA: string = JSON.stringify(DATA);
        const SIGNATURE_ID: string = 'signature id..';
        // Interface is not transparent for post request response, I use any..
        const axiosResponse: AxiosResponse<any> = {
            data: {
                result: true,
                txid: 'txid..',
                message: 'response message..'
            }
        } as AxiosResponse<any>;

        const errorResp: AxiosError = {
            response: {
                statusText: 'status',
                status: 500,
                data: {
                    error_description: 'Some error desc..'
                }
            } as AxiosResponse<any>
        } as AxiosError;

        let result: Promise<any>;

        describe('Happy path', () => {
            describe('With signatureId', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should get nodes url`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledWith();
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledWith(true);
                });

                it(`Should call axios post request to exact EP, after nodes url has been obtained`, () => {
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledWith(`${NODES_URL}/wallet/broadcasttransaction`, DATA);

                    (expect(axios.post) as any)
                        .toHaveBeenCalledAfter(spiedGetNodesUrl);
                });

                it(`Should complete KMS transaction, after post request has been called successfully`, () => {
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledWith(axiosResponse.data.txid, SIGNATURE_ID);

                    expect(logger.info)
                        .toHaveBeenCalledTimes(1);
                    expect(logger.info)
                        .toHaveBeenCalledWith(axiosResponse.data.txid);

                    (expect(spiedCompleteKMSTransaction) as any)
                        .toHaveBeenCalledAfter(axios.post);
                });

                it(`Should resolve with exact result (??txID??)`, () => {
                    const expected: any = {
                        txId: axiosResponse.data.txid
                    };
                    result
                        .then((value: any) => {
                            expect(value)
                                .toStrictEqual(expected);
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });

            describe('Without signatureId', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);
                    result = service.broadcast(TX_DATA);
                });

                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });

                it(`Should resolve with exact result (??txID??)`, () => {
                    const expected: any = {
                        txId: axiosResponse.data.txid
                    };
                    result
                        .then((data: any) => {
                            expect(data)
                                .toStrictEqual(expected);
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });
        });

        describe('Errpr path', () => {
            describe(`Test net error`, () => {
                const ERROR_MESSAGE: string = 'connection error..';
                const conError: Error = new Error(ERROR_MESSAGE);
                let originalBehavior;

                beforeAll(() => {
                    jest.clearAllMocks();
                    originalBehavior = (TestService.prototype as any).isTestnet;
                    (TestService.prototype as any).isTestnet = jest.fn().mockRejectedValue(conError);
                    axios.post = jest.fn().mockResolvedValue({ ...axiosResponse, data: { ...axiosResponse.data, txid: null } });
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TestService.prototype as any).isTestnet = originalBehavior;
                });

                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(0);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(0);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(0);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });
                it(`Should reject exact error, if net connection has been failed`, () => {
                    const expected: any = {
                        txId: null,
                        failed: true
                    };
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: Error) => {
                            expect(error)
                                .toBeInstanceOf(Error);
                            expect(error.message)
                                .toEqual(ERROR_MESSAGE);
                        });
                });
            });

            describe(`Nodes url error`, () => {
                const ERROR_MESSAGE: string = 'nodes url error..';
                const urlError: Error = new Error(ERROR_MESSAGE);
                let originalBehavior;

                beforeAll(() => {
                    jest.clearAllMocks();
                    originalBehavior = (TestService.prototype as any).getNodesUrl;
                    (TestService.prototype as any).getNodesUrl = jest.fn().mockRejectedValue(urlError);
                    axios.post = jest.fn().mockResolvedValue({ ...axiosResponse, data: { ...axiosResponse.data, txid: null } });
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TestService.prototype as any).getNodesUrl = originalBehavior;
                });

                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(0);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(0);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });
                it(`Should reject exact error, if net connection has been failed`, () => {
                    const expected: any = {
                        txId: null,
                        failed: true
                    };
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: Error) => {
                            expect(error)
                                .toBeInstanceOf(Error);
                            expect(error.message)
                                .toEqual(ERROR_MESSAGE);
                        });
                });
            });

            describe('Axios request error', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockRejectedValue(errorResp);
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });

                it(`Should reject exact error, if axios post request has been failed`, () => {
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: AxiosError): void => {
                            expect(error)
                                .toStrictEqual(errorResp);
                        });
                });
            });

            describe('KMS transacton error', () => {
                const ERROR_MESSAGE: string = 'transaction error..';
                const transactionError: Error = new Error(ERROR_MESSAGE);
                let originalBehavior;

                beforeAll(() => {
                    jest.clearAllMocks();
                    originalBehavior = (TestService.prototype as any).completeKMSTransaction;
                    (TestService.prototype as any).completeKMSTransaction = jest.fn().mockRejectedValue(transactionError);
                    axios.post = jest.fn().mockResolvedValue({ ...axiosResponse, data: { ...axiosResponse.data, txid: null } });
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TestService.prototype as any).completeKMSTransaction = originalBehavior;
                });
                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect((service as any).completeKMSTransaction)
                        .toHaveBeenCalledTimes(1);

                });

                it(`Should resolve exact data, if KMS trasaction has been failed`, () => {
                    const expected: any = {
                        txId: null,
                        failed: true
                    };
                    result
                        .then((data: any) => {
                            expect(data)
                                .toStrictEqual(expected);
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });

            describe('broadcast.result', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockResolvedValue({ ...axiosResponse, data: { ...axiosResponse.data, result: false } });
                    result = service.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should make exact calls`, () => {
                    expect(spiedIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(spiedCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });

                it(`Should reject with exact error, if broadcast.result is not 'true'`, () => {
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: AxiosError): void => {
                            expect(error)
                                .toBeInstanceOf(Error);
                            expect(error.message)
                                .toEqual(`Broadcast failed due to ${axiosResponse.data.message}`);
                        });
                });
            });
        });
    });
});
