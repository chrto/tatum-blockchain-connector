import { PinoLogger } from 'nestjs-pino';
import { TronService } from './TronService';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const NODES_URL: string = 'https://api.shasta.trongrid.io';

describe('Tron Service', () => {
    let pinoLogger: PinoLogger = {} as PinoLogger;
    let mockIsTestnet: jest.Mock<Promise<boolean>, []>;
    let mockGetNodesUrl: jest.Mock<Promise<string[]>, [boolean]>;
    let mockCompleteKMSTransaction: jest.Mock<Promise<void>, [string, string]>;

    beforeAll(() => {
        (TronService.prototype as any).isTestnet = jest.fn().mockImplementation(function (): Promise<boolean> {
            return Promise.resolve(true);
        });
        (TronService.prototype as any).getNodesUrl = jest.fn().mockImplementation((testnet: boolean): Promise<string[]> => {
            return Promise.resolve([NODES_URL]);
        });
        (TronService.prototype as any).completeKMSTransaction = jest.fn().mockImplementation(function (txId: string, signatureId: string): Promise<void> {
            return Promise.resolve();
        });

        pinoLogger.error = jest.fn().mockReturnValue(null);

        mockIsTestnet = (TronService.prototype as any).isTestnet;
        mockGetNodesUrl = (TronService.prototype as any).getNodesUrl;
        mockCompleteKMSTransaction = (TronService.prototype as any).completeKMSTransaction;
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
            const expected: any = {
                txId: axiosResponse.data.txid
            };

            describe('With signatureId', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should get nodes url`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(mockIsTestnet)
                        .toHaveBeenCalledWith();
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledWith(true);
                });

                it(`Should call axios post request to exact EP, after nodes url has been obtained`, () => {
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledWith(`${NODES_URL}/wallet/broadcasttransaction`, DATA);

                    (expect(axios.post) as any)
                        .toHaveBeenCalledAfter(mockGetNodesUrl);
                });

                it(`Should complete KMS transaction, after post request has been called successfully`, () => {
                    expect(mockCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(1);
                    expect(mockCompleteKMSTransaction)
                        .toHaveBeenCalledWith(axiosResponse.data.txid, SIGNATURE_ID);

                    (expect(mockCompleteKMSTransaction) as any)
                        .toHaveBeenCalledAfter(axios.post);
                });

                it(`Should resolve with exact result (??txID??)`, () => {
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

                    result = TronService.prototype.broadcast(TX_DATA);
                });

                it(`Should make exact calls`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(mockCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
                });

                it(`Should resolve with exact result (??txID??)`, () => {
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

                    originalBehavior = (TronService.prototype as any).isTestnet;
                    (TronService.prototype as any).isTestnet = jest.fn().mockRejectedValue(conError);
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TronService.prototype as any).isTestnet = originalBehavior;
                });

                it(`Should make exact calls`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(0);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(0);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(0);
                    expect(mockCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
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
                let originalBehavior;

                beforeAll(() => {
                    jest.clearAllMocks();
                    originalBehavior = (TronService.prototype as any).getNodesUrl;
                    (TronService.prototype as any).getNodesUrl = jest.fn().mockRejectedValue(urlError);
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                afterAll(() => {
                    (TronService.prototype as any).getNodesUrl = originalBehavior;
                });

                it(`Should make exact calls`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(0);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(0);
                    expect(mockCompleteKMSTransaction)
                        .toHaveBeenCalledTimes(0);
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
                    axios.post = jest.fn().mockRejectedValue(errorResp);

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should make exact calls`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(mockCompleteKMSTransaction)
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

                    originalBehavior = (TronService.prototype as any).completeKMSTransaction;
                    (TronService.prototype as any).completeKMSTransaction = jest.fn().mockRejectedValue(transactionError);
                    axios.post = jest.fn().mockResolvedValue(axiosResponse);

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
                    (TronService.prototype as any).completeKMSTransaction = originalBehavior;
                });

                it(`Should make exact calls`, () => {
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

                it(`Should resolve exact data, if KMS trasaction has been failed`, () => {
                    const expected: any = {
                        txId: axiosResponse.data.txid,
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

            describe('broadcast result', () => {
                beforeAll(() => {
                    jest.clearAllMocks();
                    axios.post = jest.fn().mockResolvedValue({ ...axiosResponse, data: { ...axiosResponse.data, result: false } });

                    result = TronService.prototype.broadcast(TX_DATA, SIGNATURE_ID);
                });

                it(`Should make exact calls`, () => {
                    expect(mockIsTestnet)
                        .toHaveBeenCalledTimes(1);
                    expect(mockGetNodesUrl)
                        .toHaveBeenCalledTimes(1);
                    expect(axios.post)
                        .toHaveBeenCalledTimes(1);
                    expect(mockCompleteKMSTransaction)
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
