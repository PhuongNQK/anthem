import { createReducer } from "typesafe-actions";

import { TransactionData, TxPostBody } from "tools/cosmos-utils";
import { TRANSACTION_STAGES } from "tools/transaction-utils";
import LedgerActions, {
  ActionTypes as LedgerActionTypes,
} from "../ledger/actions";
import Actions, { ActionTypes } from "./actions";

/** ===========================================================================
 * Address Reducer
 * ============================================================================
 */

export interface TransactionState {
  transactionPostBody: Nullable<TxPostBody>;
  transactionData: Nullable<TransactionData>;
  transactionStage: TRANSACTION_STAGES;
  transactionHash: string;
  confirmedTransactionHeight: string;
  confirmTx: boolean;
  signPending: boolean;
  broadcastingTransaction: boolean;
}

const initialState: TransactionState = {
  transactionPostBody: null,
  transactionData: null,
  transactionStage: TRANSACTION_STAGES.SETUP,
  confirmedTransactionHeight: "",
  transactionHash: "",
  confirmTx: false,
  signPending: false,
  broadcastingTransaction: false,
};

const transaction = createReducer<
  TransactionState,
  ActionTypes | LedgerActionTypes
>(initialState)
  .handleAction(Actions.setTransactionStage, (state, action) => ({
    ...state,
    transactionStage: action.payload,
  }))
  .handleAction(Actions.setTransactionData, (state, action) => ({
    ...state,
    transactionData: action.payload,
    transactionStage: TRANSACTION_STAGES.SIGN,
  }))
  .handleAction(Actions.signTransaction, (state, action) => ({
    ...state,
    signPending: true,
  }))
  .handleAction(Actions.signTransactionSuccess, (state, action) => ({
    ...state,
    signPending: false,
    transactionPostBody: action.payload,
    transactionStage: TRANSACTION_STAGES.CONFIRM,
  }))
  .handleAction(Actions.signTransactionFailure, (state, action) => ({
    ...state,
    signPending: false,
  }))
  .handleAction(Actions.broadcastTransaction, (state, action) => ({
    ...state,
    broadcastingTransaction: true,
  }))
  .handleAction(Actions.broadcastTransactionSuccess, (state, action) => ({
    ...state,
    transactionHash: action.payload,
    broadcastingTransaction: false,
    transactionStage: TRANSACTION_STAGES.PENDING,
  }))
  .handleAction(
    Actions.broadcastTransactionFailure,
    (state, action) => initialState,
  )
  .handleAction(Actions.transactionConfirmed, (state, action) => ({
    ...state,
    confirmedTransactionHeight: action.payload,
    transactionStage: TRANSACTION_STAGES.SUCCESS,
  }))
  .handleAction(
    [Actions.transactionFailed, LedgerActions.closeLedgerDialog],
    () => initialState,
  );

/** ===========================================================================
 * Export
 * ============================================================================
 */

export type State = TransactionState;

export default transaction;