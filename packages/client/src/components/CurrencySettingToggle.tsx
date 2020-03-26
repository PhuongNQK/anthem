import { Radio, RadioGroup } from "@blueprintjs/core";
import { COLORS } from "constants/colors";
import { CURRENCY_SETTING } from "constants/fiat";
import Modules, { ReduxStoreState } from "modules/root";
import React from "react";
import { connect } from "react-redux";
import { composeWithProps } from "tools/context-utils";

/** ===========================================================================
 * Component
 * ============================================================================
 */

const CurrencySettingsToggle = (props: IProps) => {
  const { currencySetting, fiatCurrency } = props.settings;

  const handleSetCurrencyOption = (
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.value;
    props.updateSetting({
      currencySetting: value as CURRENCY_SETTING,
    });
  };

  return (
    <RadioGroup
      inline
      selectedValue={currencySetting}
      onChange={handleSetCurrencyOption}
    >
      <Radio
        value="fiat"
        color={COLORS.CHORUS}
        label={fiatCurrency.name}
        data-cy="fiat-currency-setting-radio"
      />
      <Radio
        value="crypto"
        color={COLORS.CHORUS}
        style={{ marginLeft: 8 }}
        label={props.network.descriptor}
        data-cy="crypto-currency-setting-radio"
      />
    </RadioGroup>
  );
};

/** ===========================================================================
 * Export
 * ============================================================================
 */

const mapStateToProps = (state: ReduxStoreState) => ({
  settings: Modules.selectors.settings(state),
  network: Modules.selectors.ledger.networkSelector(state),
});

const dispatchProps = {
  updateSetting: Modules.actions.settings.updateSetting,
};

type ConnectProps = ReturnType<typeof mapStateToProps> & typeof dispatchProps;

interface ComponentProps {}

interface IProps extends ConnectProps, ComponentProps {}

const withProps = connect(
  mapStateToProps,
  dispatchProps,
);

export default composeWithProps<ComponentProps>(withProps)(
  CurrencySettingsToggle,
);