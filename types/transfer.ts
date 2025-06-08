export interface TransferData {
  caipId: string;
  recipient: string;
  token: string;
  amount: string;
}

export interface SessionConfig {
  sessionPrivKey: string;
  sessionPubkey: string;
  userSWA: string;
}

export type Address = `0x${string}`;

export interface TransferTokenResponse {
  jobId: string;
  userOp?: any;
  signedUserOp?: any;
}

export interface TransferError extends Error {
  code?: string;
  details?: any;
}