import { PinoLogger } from 'nestjs-pino';
import { TronService } from './TronService';
import axios, { AxiosError, AxiosResponse } from 'axios';

const NODES_URL: string = 'https://api.shasta.trongrid.io';
const DATA: any = { data: 'tx data..' };
const TX_DATA: string = JSON.stringify(DATA);
const SIGNATURE_ID: string = 'signature id..';
// Interface is not transparent for post request response, I use any..
const AXIOS_RESPONSE: AxiosResponse<any> = {
    data: {
        result: true,
        txid: 'txid..',
        message: 'response message..'
    }
} as AxiosResponse<any>;

const AXIOS_ERROR_RESPONSE: AxiosError = {
    response: {
        statusText: 'status',
        status: 500,
        data: {
            error_description: 'Some error desc..'
        }
    } as AxiosResponse<any>
} as AxiosError;

const EXPECTED_RESULT: any = {
    txId: AXIOS_RESPONSE.data.txid
};

describe('Tron Service', () => {
    let pinoLogger: PinoLogger = {} as PinoLogger;

    let mockIsTestnet: jest.Mock<Promise<boolean>, []>;
    let mockGetNodesUrl: jest.Mock<Promise<string[]>, [boolean]>;
    let mockCompleteKMSTransaction: jest.Mock<Promise<void>, [string, string]>;

    beforeAll(() => {
        axios.post = jest.fn().mockResolvedValue(AXIOS_RESPONSE);

        pinoLogger.error = jest.fn().mockReturnValue(null);

        (TronService.prototype as any).isTestnet = jest.fn().mockResolvedValue(true);
        (TronService.prototype as any).getNodesUrl = jest.fn().mockResolvedValue([NODES_URL]);
        (TronService.prototype as any).completeKMSTransaction = jest.fn().mockResolvedValue(null);

        mockIsTestnet = (TronService.prototype as any).isTestnet;
        mockGetNodesUrl = (TronService.prototype as any).getNodesUrl;
        mockCompleteKMSTransaction = (TronService.prototype as any).completeKMSTransaction;
    });

    describe('broadcast method', () => {
        let result: Promise<any>;

        describe('Happy path', () => {
            describe('With signatureId', () => {
                beforeAll(() => {
                    jest.clearAllMocks();

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should get nodes url`, () => {
                    result.finally(() => {
                        expect(mockIsTestnet)
                            .toHaveBeenCalledTimes(1);
                        expect(mockIsTestnet)
                            .toHaveBeenCalledWith();
                        expect(mockGetNodesUrl)
                            .toHaveBeenCalledTimes(1);
                        expect(mockGetNodesUrl)
                            .toHaveBeenCalledWith(true);
                    });
                });

                it(`Should call axios post request to exact EP, after nodes url has been obtained`, () => {
                    result.finally(() => {
                        expect(axios.post)
                            .toHaveBeenCalledTimes(1);
                        expect(axios.post)
                            .toHaveBeenCalledWith(`${NODES_URL}/wallet/broadcasttransaction`, DATA);

                        (expect(axios.post) as any)
                            .toHaveBeenCalledAfter(mockGetNodesUrl);
                    });
                });

                it(`Should complete KMS transaction, after post request has been called successfully`, () => {
                    result.finally(() => {
                        expect(mockCompleteKMSTransaction)
                            .toHaveBeenCalledTimes(1);
                        expect(mockCompleteKMSTransaction)
                            .toHaveBeenCalledWith(AXIOS_RESPONSE.data.txid, SIGNATURE_ID);

                        (expect(mockCompleteKMSTransaction) as any)
                            .toHaveBeenCalledAfter(axios.post);
                    });
                });

                it(`Should resolve with exact result (??txID??)`, () => {

                    result
                        .then((data: any) => {
                            expect(data)
                                .toStrictEqual(EXPECTED_RESULT);
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });

            describe('Without signatureId', () => {
                beforeAll(() => {
                    jest.clearAllMocks();

                    result = TronService.prototype.broadcast(TX_DATA);
                });

                it(`Should make exact calls`, () => {
                    result.finally(() => {
                        expect(mockIsTestnet)
                            .toHaveBeenCalledTimes(1);
                        expect(mockGetNodesUrl)
                            .toHaveBeenCalledTimes(1);
                        expect(axios.post)
                            .toHaveBeenCalledTimes(1);
                        expect(mockCompleteKMSTransaction)
                            .toHaveBeenCalledTimes(0);
                    });
                });

                it(`Should resolve with exact result (??txID??)`, () => {
                    result
                        .then((data: any) => {
                            expect(data)
                                .toStrictEqual(EXPECTED_RESULT);
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });
        });

        describe('Errpr path', () => {
            let originalMockBehavior;
            describe(`Test net error`, () => {
                const ERROR_MESSAGE: string = 'connection error..';
                const conError: Error = new Error(ERROR_MESSAGE);

                beforeAll(() => {
                    jest.clearAllMocks();

                    originalMockBehavior = (TronService.prototype as any).isTestnet;
                    (TronService.prototype as any).isTestnet = jest.fn().mockRejectedValue(conError);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TronService.prototype as any).isTestnet = originalMockBehavior;
                });

                it(`Should make exact calls`, () => {
                    result
                        .catch(() => null)
                        .finally(() => {
                            expect(mockIsTestnet)
                                .toHaveBeenCalledTimes(0);
                            expect(mockGetNodesUrl)
                                .toHaveBeenCalledTimes(0);
                            expect(axios.post)
                                .toHaveBeenCalledTimes(0);
                            expect(mockCompleteKMSTransaction)
                                .toHaveBeenCalledTimes(0);
                        });
                });
                it(`Should reject exact error, if net connection has been failed`, () => {
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

                beforeAll(() => {
                    jest.clearAllMocks();

                    originalMockBehavior = (TronService.prototype as any).getNodesUrl;
                    (TronService.prototype as any).getNodesUrl = jest.fn().mockRejectedValue(urlError);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TronService.prototype as any).getNodesUrl = originalMockBehavior;
                });

                it(`Should make exact calls`, () => {
                    result
                        .catch(() => null)
                        .finally(() => {
                            expect(mockIsTestnet)
                                .toHaveBeenCalledTimes(1);
                            expect(mockGetNodesUrl)
                                .toHaveBeenCalledTimes(0);
                            expect(axios.post)
                                .toHaveBeenCalledTimes(0);
                            expect(mockCompleteKMSTransaction)
                                .toHaveBeenCalledTimes(0);
                        });
                });
                it(`Should reject exact error, if net connection has been failed`, () => {
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

                    originalMockBehavior = axios.post;
                    axios.post = jest.fn().mockRejectedValue(AXIOS_ERROR_RESPONSE);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    axios.post = originalMockBehavior;
                });

                it(`Should make exact calls`, () => {
                    result
                        .catch(() => null)
                        .finally(() => {
                            expect(mockIsTestnet)
                                .toHaveBeenCalledTimes(1);
                            expect(mockGetNodesUrl)
                                .toHaveBeenCalledTimes(1);
                            expect(axios.post)
                                .toHaveBeenCalledTimes(1);
                            expect(mockCompleteKMSTransaction)
                                .toHaveBeenCalledTimes(0);
                        });
                });

                it(`Should reject exact error, if axios post request has been failed`, () => {
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: AxiosError): void => {
                            expect(error)
                                .toStrictEqual(AXIOS_ERROR_RESPONSE);
                        });
                });
            });

            describe('KMS transacton error', () => {
                const ERROR_MESSAGE: string = 'transaction error..';
                const transactionError: Error = new Error(ERROR_MESSAGE);

                beforeAll(() => {
                    jest.clearAllMocks();

                    originalMockBehavior = (TronService.prototype as any).completeKMSTransaction;
                    (TronService.prototype as any).completeKMSTransaction = jest.fn().mockRejectedValue(transactionError);

                    let instance = Object.create({
                        isTestnet: mockIsTestnet,
                        getNodesUrl: mockGetNodesUrl,
                        completeKMSTransaction: (TronService.prototype as any).completeKMSTransaction,
                        broadcast: TronService.prototype.broadcast
                    });
                    instance.logger = pinoLogger;
                    result = instance.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TronService.prototype as any).completeKMSTransaction = originalMockBehavior;
                });

                it(`Should make exact calls`, () => {
                    result
                        .catch(() => null)
                        .finally(() => {
                            expect(mockIsTestnet)
                                .toHaveBeenCalledTimes(1);
                            expect(mockGetNodesUrl)
                                .toHaveBeenCalledTimes(1);
                            expect(axios.post)
                                .toHaveBeenCalledTimes(1);
                            expect((TronService.prototype as any).completeKMSTransaction)
                                .toHaveBeenCalledTimes(1);
                            expect(pinoLogger.error)
                                .toHaveBeenCalledTimes(1);
                            expect(pinoLogger.error)
                                .toHaveBeenCalledWith(transactionError);
                        });
                });

                it(`Should resolve exact data, if KMS trasaction has been failed`, () => {
                    result
                        .then((data: any) => {
                            expect(data)
                                .toStrictEqual({ ...EXPECTED_RESULT, failed: true });
                        })
                        .catch((): void => fail(`Promise reject has not been expected`));
                });
            });

            describe('broadcast result', () => {
                beforeAll(() => {
                    jest.clearAllMocks();

                    originalMockBehavior = axios.post;
                    axios.post = jest.fn().mockResolvedValue({ ...AXIOS_RESPONSE, data: { ...AXIOS_RESPONSE.data, result: false } });

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    axios.post = originalMockBehavior;
                });

                it(`Should make exact calls`, () => {
                    result
                        .catch(() => null)
                        .finally(() => {
                            expect(mockIsTestnet)
                                .toHaveBeenCalledTimes(1);
                            expect(mockGetNodesUrl)
                                .toHaveBeenCalledTimes(1);
                            expect(axios.post)
                                .toHaveBeenCalledTimes(1);
                            expect(mockCompleteKMSTransaction)
                                .toHaveBeenCalledTimes(0);
                        });
                });

                it(`Should reject with exact error, if broadcast.result is not 'true'`, () => {
                    result
                        .then((): void => fail(`Promise resolve has not been expected`))
                        .catch((error: AxiosError): void => {
                            expect(error)
                                .toBeInstanceOf(Error);
                            expect(error.message)
                                .toEqual(`Broadcast failed due to ${AXIOS_RESPONSE.data.message}`);
                        });
                });
            });
        });
    });
});
