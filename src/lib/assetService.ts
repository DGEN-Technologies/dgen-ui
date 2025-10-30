import * as walletService from './walletService';
import type * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { ASSET_IDS } from './assets';

// Prepare to receive an asset payment
export async function prepareReceiveAsset(params: {
  assetId: string;
  payerAmount?: number;
}): Promise<breezSdk.PrepareReceiveResponse> {
  const amount: breezSdk.ReceiveAmount = {
    type: 'asset',
    assetId: params.assetId,
    payerAmount: params.payerAmount
  };

  return await walletService.prepareReceivePayment({
    paymentMethod: 'liquidAddress',
    amount
  });
}

// Receive an asset payment
export async function receiveAsset(params: {
  prepareResponse: breezSdk.PrepareReceiveResponse;
  description?: string;
  useDescriptionHash?: boolean;
  payerNote?: string;
}): Promise<breezSdk.ReceivePaymentResponse> {
  return await walletService.receivePayment(params);
}

// Prepare to send an asset payment
export async function prepareSendAsset(params: {
  destination: string;
  toAsset: string;
  receiverAmount: number;
  estimateAssetFees?: boolean;
  fromAsset?: string;
}): Promise<breezSdk.PrepareSendResponse> {
  const amount: breezSdk.PayAmount = {
    type: 'asset',
    toAsset: params.toAsset,
    receiverAmount: params.receiverAmount,
    estimateAssetFees: params.estimateAssetFees,
    fromAsset: params.fromAsset
  };

  return await walletService.prepareSendPayment({
    destination: params.destination,
    amount
  });
}

// Send an asset payment
export async function sendAsset(params: {
  prepareResponse: breezSdk.PrepareSendResponse;
  useAssetFees?: boolean;
  payerNote?: string;
}): Promise<breezSdk.SendPaymentResponse> {
  return await walletService.sendPayment({
    prepareResponse: params.prepareResponse,
    useAssetFees: params.useAssetFees,
    payerNote: params.payerNote
  });
}

// Prepare to receive LBTC
export async function prepareReceiveLBTC(
  payerAmountSat?: number
): Promise<breezSdk.PrepareReceiveResponse> {
  return prepareReceiveAsset({
    assetId: ASSET_IDS.LBTC,
    payerAmount: payerAmountSat
  });
}

// Prepare to receive USDT
export async function prepareReceiveUSDT(
  payerAmount?: number
): Promise<breezSdk.PrepareReceiveResponse> {
  return prepareReceiveAsset({
    assetId: ASSET_IDS.USDT,
    payerAmount
  });
}

// Prepare to send LBTC
export async function prepareSendLBTC(params: {
  destination: string;
  receiverAmountSat: number;
  estimateAssetFees?: boolean;
}): Promise<breezSdk.PrepareSendResponse> {
  return prepareSendAsset({
    destination: params.destination,
    toAsset: ASSET_IDS.LBTC,
    receiverAmount: params.receiverAmountSat,
    estimateAssetFees: params.estimateAssetFees
  });
}

// Prepare to send USDT
export async function prepareSendUSDT(params: {
  destination: string;
  receiverAmount: number;
  estimateAssetFees?: boolean;
  fromAsset?: string;
}): Promise<breezSdk.PrepareSendResponse> {
  return prepareSendAsset({
    destination: params.destination,
    toAsset: ASSET_IDS.USDT,
    receiverAmount: params.receiverAmount,
    estimateAssetFees: params.estimateAssetFees,
    fromAsset: params.fromAsset
  });
}

// Exchange assets (self-payment)
export async function exchangeAssets(params: {
  fromAsset: string;
  toAsset: string;
  toAmount: number;
}): Promise<breezSdk.SendPaymentResponse> {
  // First, create a receive address for the target asset
  const receiveAmount: breezSdk.ReceiveAmount = {
    type: 'asset',
    assetId: params.toAsset
  };

  const prepareReceiveRes = await walletService.prepareReceivePayment({
    paymentMethod: 'liquidAddress',
    amount: receiveAmount
  });

  const receiveRes = await walletService.receivePayment({
    prepareResponse: prepareReceiveRes
  });

  // Now send to that address with asset swap
  const prepareSendRes = await prepareSendAsset({
    destination: receiveRes.destination,
    toAsset: params.toAsset,
    receiverAmount: params.toAmount,
    fromAsset: params.fromAsset
  });

  return await sendAsset({
    prepareResponse: prepareSendRes
  });
}
