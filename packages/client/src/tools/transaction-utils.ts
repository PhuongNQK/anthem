import { COIN_DENOMS } from "constants/networks";
import {
  IBalance,
  ILogMessage,
  IMsgBeginRedelegate,
  IMsgDelegate,
  IMsgModifyWithdrawAddress,
  IMsgSend,
  IMsgSubmitProposal,
  IMsgVote,
  IMsgWithdrawDelegationReward,
  IMsgWithdrawValidatorCommission,
  ITransaction,
} from "graphql/types";
import { tFn, tFnString } from "tools/i18n-utils";
import { assertUnreachable, formatAddressString } from "./generic-utils";
import { bold } from "./i18n-utils";
import { addValuesInList } from "./math-utils";

/** ===========================================================================
 * Types & Config
 * ============================================================================
 */

export enum COSMOS_TRANSACTION_TYPES {
  SEND = "cosmos-sdk/MsgSend",
  RECEIVE = "custom-receive-transaction-type",
  VOTE = "cosmos-sdk/MsgVote",
  DELEGATE = "cosmos-sdk/MsgDelegate",
  UNDELEGATE = "cosmos-sdk/MsgUndelegate",
  SUBMIT_PROPOSAL = "cosmos-sdk/MsgSubmitProposal",
  BEGIN_REDELEGATE = "cosmos-sdk/MsgBeginRedelegate",
  CLAIM_REWARDS = "cosmos-sdk/MsgWithdrawDelegationReward",
  CLAIM_COMMISSION = "cosmos-sdk/MsgWithdrawValidatorCommission",
  CREATE_VALIDATOR = "cosmos-sdk/MsgCreateValidator",
  EDIT_VALIDATOR = "cosmos-sdk/MsgEditValidator",
  MODIFY_WITHDRAW_ADDRESS = "cosmos-sdk/MsgModifyWithdrawAddress",
}

export enum TRANSACTION_STAGES {
  "SETUP" = "SETUP",
  "SIGN" = "SIGN",
  "CONFIRM" = "CONFIRM",
  "PENDING" = "PENDING",
  "SUCCESS" = "SUCCESS",
}

export interface TransactionItemData {
  type: COSMOS_TRANSACTION_TYPES;
  timestamp: string;
  amount: Nullable<string>;
  fees: string;
  toAddress: string;
  fromAddress: string;
}

export interface GovernanceVoteMessageData {
  fees: string;
  option: string;
  proposal_id: string;
  timestamp: string;
  type: COSMOS_TRANSACTION_TYPES.VOTE;
}

export interface GovernanceSubmitProposalMessageData {
  fees: string;
  title: string;
  deposit: string;
  proposer: string;
  timestamp: string;
  description: string;
  type: COSMOS_TRANSACTION_TYPES.SUBMIT_PROPOSAL;
}

export interface ValidatorCreateOrEditMessageData {
  type: COSMOS_TRANSACTION_TYPES;
  timestamp: string;
  fees: string;
  delegatorAddress: string;
  validatorAddress: string;
}

export interface ValidatorModifyWithdrawAddressMessageData {
  type: COSMOS_TRANSACTION_TYPES;
  timestamp: string;
  fees: string;
  withdrawAddress: string;
  validatorAddress: string | null;
}

export interface TransactionItemProps {
  text: ReadonlyArray<JSX.Element> | string;
  data:
    | TransactionItemData
    | GovernanceVoteMessageData
    | GovernanceSubmitProposalMessageData
    | ValidatorCreateOrEditMessageData
    | ValidatorModifyWithdrawAddressMessageData;
}

/** ===========================================================================
 * Utils
 * ============================================================================
 */

// Get all failed logs in a log message.
const getFailedLogs = (logs: ReadonlyArray<ILogMessage>) => {
  return logs.filter(log => !log.success);
};

// Determine if a transaction failed and return the log message.
export const getTransactionFailedLogMessage = (
  transaction: ITransaction,
): Nullable<string> => {
  try {
    const { log } = transaction;
    if (Array.isArray(log)) {
      const failedLogs = getFailedLogs(log);
      if (failedLogs.length === 0) {
        return "";
      }

      const maybeLogMessage = JSON.parse(failedLogs[0].message || "");
      const { message } = maybeLogMessage;
      return message || null;
    }
  } catch (err) {
    /* Do nothing */
  }

  return null;
};

/**
 * Sum amount `IBalance` values in an array.
 */
const sumAmounts = (amounts: Maybe<ReadonlyArray<IBalance>>): string => {
  if (!amounts) {
    return "0";
  }

  return addValuesInList(amounts.map(a => a.amount));
};

const getTxAmount = (
  transaction: ITransaction,
  msgIndex: number,
): Nullable<string> => {
  const txMsg = transaction.msgs[msgIndex].value as IMsgSend;

  if (txMsg && txMsg.amounts) {
    /* Sum all the amounts */
    const total = sumAmounts(txMsg.amounts);

    /* Format and return the result */
    return total;
    // @ts-ignore
  } else if (txMsg && txMsg.amount) {
    // @ts-ignore
    const amount = txMsg.amount.amount;
    return amount.replace(",", "");
  } else {
    return null;
  }
};

export const getTxFee = (transaction: ITransaction): string => {
  const { fees } = transaction;
  const { amount } = fees;

  if (amount) {
    return sumAmounts(amount);
  } else {
    return "0";
  }
};

// Send transaction type.
const getTransactionSendMessage = (
  transaction: ITransaction,
  address: string,
  msgIndex: number,
): TransactionItemData => {
  const { from_address, to_address } = transaction.msgs[msgIndex]
    .value as IMsgSend;
  const fees = getTxFee(transaction);
  const amount = getTxAmount(transaction, msgIndex);
  const toAddress = to_address || "";
  const fromAddress = from_address || "";

  const IS_SEND = fromAddress === address;

  return {
    fees,
    amount,
    toAddress,
    fromAddress,
    type: IS_SEND
      ? (transaction.msgs[0].type as COSMOS_TRANSACTION_TYPES)
      : COSMOS_TRANSACTION_TYPES.RECEIVE,
    timestamp: transaction.timestamp,
  };
};

// Delegate transaction type.
const getDelegationTransactionMessage = (
  transaction: ITransaction,
  msgIndex: number,
): TransactionItemData => {
  const msg = transaction.msgs[msgIndex];
  const fees = getTxFee(transaction);
  const vote = msg.value as IMsgDelegate;
  const { amount, delegator_address, validator_address } = vote;

  const delegationAmount = amount ? amount.amount : null;
  const toAddress = validator_address || "";
  const fromAddress = delegator_address || "";

  return {
    fees,
    toAddress,
    fromAddress,
    amount: delegationAmount,
    timestamp: transaction.timestamp,
    type: COSMOS_TRANSACTION_TYPES.DELEGATE,
  };
};

// Rewards claim transaction type.
const getClaimRewardsMessageData = (
  transaction: ITransaction,
  msgIndex: number,
  denom: COIN_DENOMS,
): TransactionItemData => {
  const { tags } = transaction;
  const msg = transaction.msgs[msgIndex];

  const { type, value } = msg;
  const {
    validator_address,
    delegator_address,
  } = value as IMsgWithdrawDelegationReward;

  let rewards: Nullable<string> = null;

  if (tags) {
    const rewardTags = tags.filter(tag => {
      return tag.key === "rewards";
    });

    /* Get the same tag as the msgIndex...¿ */
    const rewardTag = rewardTags[msgIndex];

    if (rewardTag && rewardTag.value) {
      rewards = rewardTag.value.replace(denom, "");
      rewards = rewards.replace(",", "");
    }
  }

  const fees = getTxFee(transaction);
  const validatorAddress = validator_address || "";
  const delegatorAddress = delegator_address || "";

  return {
    fees,
    amount: rewards,
    toAddress: delegatorAddress,
    fromAddress: validatorAddress,
    timestamp: transaction.timestamp,
    type: type as COSMOS_TRANSACTION_TYPES,
  };
};

// Commissions claim transaction type.
const getValidatorClaimRewardsMessageData = (
  transaction: ITransaction,
  msgIndex: number,
  denom: COIN_DENOMS,
): TransactionItemData => {
  const { tags } = transaction;
  const msg = transaction.msgs[msgIndex];

  const { type, value } = msg;
  const { validator_address } = value as IMsgWithdrawValidatorCommission;

  let commissions: Nullable<string> = null;

  if (tags) {
    const commissionsTag = tags.filter(
      tag => tag.key === "commission" && Boolean(tag.value),
    );

    if (commissionsTag.length && commissionsTag[0].value) {
      commissions = commissionsTag[0].value.replace(denom, "");
      commissions = commissions.replace(",", "");
    }
  }

  const fees = getTxFee(transaction);
  const validatorAddress = validator_address || "";

  return {
    fees,
    toAddress: "",
    amount: commissions,
    fromAddress: validatorAddress,
    timestamp: transaction.timestamp,
    type: type as COSMOS_TRANSACTION_TYPES,
  };
};

// Undelegate transaction type.
const getUndelegateMessage = (
  transaction: ITransaction,
  msgIndex: number,
): TransactionItemData => {
  const msg = transaction.msgs[msgIndex];
  let undelegateAmount = null;

  let delegatorAddress = "";
  let validatorAddress = "";

  if (msg) {
    const value = msg.value as IMsgDelegate;
    const { amount } = value as IMsgDelegate;
    undelegateAmount = amount.amount;

    delegatorAddress = value.delegator_address || "";
    validatorAddress = value.validator_address || "";
  }

  const fees = getTxFee(transaction);

  return {
    fees,
    amount: undelegateAmount,
    toAddress: formatAddressString(delegatorAddress, true),
    fromAddress: formatAddressString(validatorAddress, true),
    timestamp: transaction.timestamp,
    type: COSMOS_TRANSACTION_TYPES.UNDELEGATE,
  };
};

// Redelegate transaction type.
const getRedelegateMessageData = (
  transaction: ITransaction,
  msgIndex: number,
): TransactionItemData => {
  const msg = transaction.msgs[msgIndex];

  const fees = getTxFee(transaction);
  const { value } = msg;
  const {
    amount,
    validator_src_address,
    validator_dst_address,
  } = value as IMsgBeginRedelegate;

  let redelegateAmount = null;

  if (amount) {
    redelegateAmount = amount.amount;
  }

  return {
    fees,
    amount: redelegateAmount,
    timestamp: transaction.timestamp,
    fromAddress: validator_src_address,
    toAddress: validator_dst_address,
    type: COSMOS_TRANSACTION_TYPES.BEGIN_REDELEGATE,
  };
};

// Vote transaction type.
const getGovernanceVoteMessage = (
  transaction: ITransaction,
  msgIndex: number,
): GovernanceVoteMessageData => {
  const { timestamp } = transaction;
  const msg = transaction.msgs[msgIndex];

  const fees = getTxFee(transaction);
  const vote = msg.value as IMsgVote;
  const { option, proposal_id } = vote;

  return {
    option,
    fees,
    timestamp,
    proposal_id,
    type: COSMOS_TRANSACTION_TYPES.VOTE,
  };
};

// Submit Governance Proposal transaction type.
const getGovernanceSubmitProposalMessage = (
  transaction: ITransaction,
  msgIndex: number,
): GovernanceSubmitProposalMessageData => {
  const { timestamp } = transaction;
  const msg = transaction.msgs[msgIndex];

  const fees = getTxFee(transaction);
  const proposal = msg.value as IMsgSubmitProposal;
  const { title, description, proposer, initial_deposit } = proposal;
  const deposit = sumAmounts(initial_deposit);

  return {
    fees,
    title,
    deposit,
    proposer,
    timestamp,
    description,
    type: COSMOS_TRANSACTION_TYPES.SUBMIT_PROPOSAL,
  };
};

// Validator create or edit message.
const getValidatorCreateOrEditMessage = (
  transaction: ITransaction,
  msgIndex: number,
): ValidatorCreateOrEditMessageData => {
  const msg = transaction.msgs[msgIndex];
  const fees = getTxFee(transaction);
  const value = msg.value as IMsgWithdrawDelegationReward;
  const { delegator_address, validator_address } = value;

  const delegatorAddress = delegator_address || "";
  const validatorAddress = validator_address || "";

  return {
    fees,
    delegatorAddress,
    validatorAddress,
    timestamp: transaction.timestamp,
    type: COSMOS_TRANSACTION_TYPES.CREATE_VALIDATOR,
  };
};

// Validator modify withdraw address message.
const getChangeWithdrawAddressMessage = (
  transaction: ITransaction,
  msgIndex: number,
): ValidatorModifyWithdrawAddressMessageData => {
  const msg = transaction.msgs[msgIndex];
  const fees = getTxFee(transaction);
  const value = msg.value as IMsgModifyWithdrawAddress;
  const { withdraw_address, validator_address } = value;

  const withdrawAddress = withdraw_address || "";
  const validatorAddress = validator_address;

  return {
    fees,
    withdrawAddress,
    validatorAddress,
    timestamp: transaction.timestamp,
    type: COSMOS_TRANSACTION_TYPES.MODIFY_WITHDRAW_ADDRESS,
  };
};

/**
 * Primary method to handle converting a transaction to the relevant data
 * and text to render.
 *
 * @param  {ITransaction} transaction
 * @param  {string} address
 * @param  {tFn} t
 * @param  {tFnString} tString
 * @param  {boolean} isDesktop
 * @returns TransactionItemProps
 */
export const getHumanReadableMessageFromTransaction = ({
  t,
  tString,
  address,
  transaction,
  msgIndex,
  denom,
}: {
  t: tFn;
  address: string;
  msgIndex: number;
  denom: COIN_DENOMS;
  tString: tFnString;
  transaction: ITransaction;
}): TransactionItemProps => {
  const TX_TYPE = transaction.msgs[msgIndex].type as COSMOS_TRANSACTION_TYPES;

  switch (TX_TYPE) {
    case COSMOS_TRANSACTION_TYPES.RECEIVE: /* NOTE: Receive is not a real type */
    case COSMOS_TRANSACTION_TYPES.SEND: {
      const data = getTransactionSendMessage(transaction, address, msgIndex);
      const text = t(
        "{{transactionType}} {{amount}} ATOM from {{recipient}} to {{sender}} with a fee of {{fee}} ATOM.",
        {
          transactionType:
            data.fromAddress === address
              ? tString("Sent")
              : tString("Received"),
          sender: bold(formatAddressString(data.fromAddress, true)),
          recipient: bold(formatAddressString(data.toAddress, true)),
          amount: bold(data.amount || "Undetermined"),
          fee: bold(data.fees),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.DELEGATE: {
      const data = getDelegationTransactionMessage(transaction, msgIndex);
      const text = t(
        "Delegated {{delegationAmount}} ATOM to validator {{validatorAddress}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          delegationAmount: bold(formatAddressString(data.fromAddress, true)),
          validatorAddress: bold(formatAddressString(data.toAddress, true)),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.VOTE: {
      const data = getGovernanceVoteMessage(transaction, msgIndex);
      const text = t(
        "Voted “{{option}}” on governance proposal {{proposalId}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          option: bold(data.option),
          proposalId: bold(data.proposal_id),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.UNDELEGATE: {
      const data = getUndelegateMessage(transaction, msgIndex);
      const text = t(
        "Unbonded {{amount}} ATOM from validator {{validatorAddress}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          amount: bold(data.amount || "Undetermined"),
          validatorAddress: bold(formatAddressString(data.fromAddress, true)),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.SUBMIT_PROPOSAL: {
      const data = getGovernanceSubmitProposalMessage(transaction, msgIndex);
      const text = t(
        "Governance proposal submitted by proposer {{proposer}} entitled {{title}} with a deposit of {{deposit}}",
        {
          proposer: bold(data.proposer),
          deposit: bold(data.deposit),
          title: bold(data.title),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.BEGIN_REDELEGATE: {
      const data = getRedelegateMessageData(transaction, msgIndex);
      const text = t(
        "Redelegated from validator {{sourceValidator}} to {{destinationValidator}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          sourceValidator: bold(formatAddressString(data.fromAddress, true)),
          destinationValidator: bold(formatAddressString(data.toAddress, true)),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.CLAIM_REWARDS: {
      const data = getClaimRewardsMessageData(transaction, msgIndex, denom);
      const text = t(
        "Withdrew {{rewards}} ATOM rewards from validator {{validatorAddress}}. Fees spent: {{fees}} ATOM",
        {
          fees: bold(data.fees),
          amount: bold(data.amount || "Undetermined"),
          validatorAddress: bold(formatAddressString(data.fromAddress, true)),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.CLAIM_COMMISSION: {
      const data = getValidatorClaimRewardsMessageData(
        transaction,
        msgIndex,
        denom,
      );
      const text = t(
        "Withdrew {{rewards}} ATOM rewards from validator {{validatorAddress}}. Fees spent: {{fees}} ATOM",
        {
          fees: bold(data.fees),
          amount: bold(data.amount || "Undetermined"),
          validatorAddress: bold(formatAddressString(data.fromAddress, true)),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.CREATE_VALIDATOR: {
      const data = getValidatorCreateOrEditMessage(transaction, msgIndex);
      const text = t(
        "Created validator with address {{validatorAddress}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          validatorAddress: bold(
            formatAddressString(data.validatorAddress, true),
          ),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.EDIT_VALIDATOR: {
      const data = getValidatorCreateOrEditMessage(transaction, msgIndex);
      const text = t(
        "Edited validator with address {{validatorAddress}}. Fees spent: {{fees}} ATOM.",
        {
          fees: bold(data.fees),
          validatorAddress: bold(
            formatAddressString(data.validatorAddress, true),
          ),
        },
      );
      return { text, data };
    }

    case COSMOS_TRANSACTION_TYPES.MODIFY_WITHDRAW_ADDRESS: {
      const data = getChangeWithdrawAddressMessage(transaction, msgIndex);
      const text =
        "Modified withdraw address for validator, new address: {{withdrawAddress}}. Fees spent: {{fees}} ATOM.";
      // const text = t(
      //   "Modified withdraw address for validator, new address: {{withdrawAddress}}. Fees spent: {{fees}} ATOM.",
      //   {
      //     fees: bold(data.fees),
      //     withdrawAddress: bold(
      //       formatAddressString(data.withdrawAddress, true),
      //     ),
      //   },
      // );
      return { text, data };
    }

    default:
      return assertUnreachable(TX_TYPE);
  }
};