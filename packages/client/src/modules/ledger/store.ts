import { combineReducers } from "redux";
import { createReducer } from "typesafe-actions";

import NETWORKS, { NETWORK_NAME, NetworkMetadata } from "constants/networks";
import StorageModule from "lib/storage-lib";
import LoadingActions, {
  ActionTypes as LoadingActionTypes,
} from "../app/actions";
import actions, {
  ActionTypes,
  LEDGER_ACCESS_TYPE,
  LEDGER_ACTION_TYPE,
  SIGNIN_TYPE,
} from "./actions";

/** ===========================================================================
 * Address Reducer
 * ============================================================================
 */

export interface LedgerState {
  address: string;
  addressError: string;
  network: NetworkMetadata;
  connected: boolean;
  cosmosAppVersionValid: boolean | undefined;
  recentAddresses: ReadonlyArray<string>;
}

export interface AddressReducerState {
  ledger: LedgerState;
}

const initialState: LedgerState = {
  address: "",
  addressError: "",
  connected: false,
  cosmosAppVersionValid: undefined,
  network: NETWORKS.KAVA,
  recentAddresses: StorageModule.getRecentAddresses(),
};

const ledger = createReducer<LedgerState, ActionTypes | LoadingActionTypes>(
  initialState,
)
  .handleAction(LoadingActions.initializeSuccess, (state, action) => ({
    ...initialState,
    network: action.payload.network,
    address: action.payload.address,
  }))
  .handleAction(actions.connectLedgerFailure, () => ({
    ...initialState,
    cosmosAppVersionValid: true /* Currently the only cause for failure */,
  }))
  .handleAction(actions.connectLedgerSuccess, (state, action) => ({
    ...state,
    addressError: "",
    connected: true,
    network: action.payload.network,
    address: action.payload.cosmosAddress,
    recentAddresses: StorageModule.getRecentAddresses(),
  }))
  .handleAction(actions.setAddressSuccess, (state, { payload }) => ({
    ...state,
    connected: false,
    network: payload.network,
    address: payload.address,
    recentAddresses: StorageModule.getRecentAddresses(),
  }))
  .handleAction(actions.setAddressFailure, (state, action) => ({
    ...state,
    addressError: action.payload,
  }))
  .handleAction(actions.clearAllRecentAddresses, (state, action) => ({
    ...state,
    recentAddresses: [],
  }))
  .handleAction(actions.logoutSuccess, () => ({
    ...initialState,
  }));

/** ===========================================================================
 * Ledger Dialog Reducer
 * ============================================================================
 */

interface LedgerDialogReducerState {
  ledgerDialog: LedgerDialogState;
}

interface LedgerDialogState {
  dialogOpen: boolean;
  signinType: Nullable<SIGNIN_TYPE>;
  ledgerActionType: Nullable<LEDGER_ACTION_TYPE>;
  ledgerAccessType: Nullable<LEDGER_ACCESS_TYPE>;
  showSelectNetworkOption: boolean;
  signinNetworkName: NETWORK_NAME;
}

const initialLedgerDialogState = {
  dialogOpen: false,
  signinType: null,
  ledgerActionType: null,
  ledgerAccessType: null,
  showSelectNetworkOption: false,
  signinNetworkName: "COSMOS" as NETWORK_NAME,
};

const ledgerDialog = createReducer<LedgerDialogState, ActionTypes>(
  initialLedgerDialogState,
)
  .handleAction(actions.openLedgerDialog, (state, action) => ({
    ...state,
    ...action.payload,
    dialogOpen: true,
  }))
  .handleAction(actions.setSigninNetworkName, (state, action) => ({
    ...state,
    showSelectNetworkOption: false,
    signinNetworkName: action.payload,
  }))
  .handleAction(actions.openSelectNetworkDialog, (state, action) => ({
    ...state,
    ...action.payload,
    dialogOpen: true,
    showSelectNetworkOption: true,
  }))
  .handleAction(actions.connectLedgerSuccess, (state, action) => {
    let dialogOpen = false;
    if (state.ledgerAccessType === "SIGNIN") {
      dialogOpen = false;
    } else if (state.ledgerAccessType === "PERFORM_ACTION") {
      dialogOpen = true;
    } else {
      dialogOpen = Boolean(state.ledgerAccessType);
    }

    return {
      ...state,
      dialogOpen,
    };
  })
  .handleAction(
    [actions.setAddressSuccess, actions.closeLedgerDialog],
    () => initialLedgerDialogState,
  );

/** ===========================================================================
 * Logout Reducer
 * ============================================================================
 */

interface LogoutReducerState {
  logoutMenuOpen: boolean;
}

const logoutMenuOpen = createReducer<boolean, ActionTypes>(false)
  .handleAction(actions.openLogoutMenu, s => true)
  .handleAction(
    [actions.closeLogoutMenu, actions.logoutSuccess, actions.logoutFailure],
    () => false,
  );

/** ===========================================================================
 * Export
 * ============================================================================
 */

export type State = AddressReducerState &
  LogoutReducerState &
  LedgerDialogReducerState;

export default combineReducers({
  ledger,
  ledgerDialog,
  logoutMenuOpen,
});