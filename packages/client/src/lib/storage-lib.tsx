import { deriveNetworkFromAddress } from "@anthem/utils";
import { BANNER_NOTIFICATIONS_KEYS } from "modules/app/store";
import { ParsedQuery } from "query-string";

/** ===========================================================================
 * Locale Storage Module.
 *
 * This file manages getting and setting values from the Browser localStorage.
 * ============================================================================
 */

enum KEYS {
  ADDRESS_KEY = "ADDRESS_KEY",
  RECENT_ADDRESSES = "RECENT_ADDRESSES",
  DISMISSED_NOTIFICATIONS = "DISMISSED_NOTIFICATIONS",
}

class StorageClass {
  /**
   * Primary getter/setter methods:
   */
  getItem = <T extends {}>(key: KEYS): Nullable<T> => {
    const maybeValue = localStorage.getItem(key);
    return maybeValue ? JSON.parse(maybeValue) : null;
  };

  setItem = (key: KEYS, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  removeItem = (key: KEYS) => {
    localStorage.removeItem(key);
  };

  /**
   * Default to the address derived from the routing params, if it exists,
   * to allow deep links to work correctly. Otherwise, use the stored
   * address.
   */
  getAddress = (params: ParsedQuery<string>): string => {
    const { address } = params;
    if (address && typeof address === "string") {
      return address;
    } else {
      const storedAddress = this.getItem(KEYS.ADDRESS_KEY);
      if (storedAddress) {
        if (typeof storedAddress === "string") {
          return storedAddress;
        }
      }
    }

    return "";
  };

  setAddress = (address: string) => {
    this.setItem(KEYS.ADDRESS_KEY, address);
  };

  logout = () => {
    /**
     * Only remove the stored address. The other options are not sensitive
     * and can remain here (in case the user logs back in).
     */
    this.removeItem(KEYS.ADDRESS_KEY);
  };

  getRecentAddresses = () => {
    const recentAddresses = this.getItem<ReadonlyArray<string>>(
      KEYS.RECENT_ADDRESSES,
    );
    if (Array.isArray(recentAddresses) && recentAddresses.length) {
      // Filter out any invalid addresses
      return recentAddresses.filter(address => {
        try {
          deriveNetworkFromAddress(address);
          return true;
        } catch (err) {
          return false;
        }
      });
    } else {
      return [];
    }
  };

  clearRecentAddresses = () => {
    this.setItem(KEYS.RECENT_ADDRESSES, []);
  };

  updateRecentAddress = (address: string) => {
    const updatedRecentAddresses: ReadonlyArray<string> = [
      address,
      ...this.getRecentAddresses().filter((a: string) => a !== address),
    ];

    this.setItem(KEYS.RECENT_ADDRESSES, updatedRecentAddresses);
  };

  getDismissedNotifications = (): Set<BANNER_NOTIFICATIONS_KEYS> => {
    const dismissed = this.getItem<ReadonlyArray<string>>(
      KEYS.DISMISSED_NOTIFICATIONS,
    );
    if (dismissed && dismissed.length) {
      return new Set(dismissed) as Set<BANNER_NOTIFICATIONS_KEYS>;
    } else {
      return new Set();
    }
  };

  handleDismissNotification = (banner: BANNER_NOTIFICATIONS_KEYS) => {
    const dismissed = this.getDismissedNotifications();
    const updated = dismissed.add(banner);
    this.setItem(KEYS.DISMISSED_NOTIFICATIONS, Array.from(updated));
  };
}

/** ===========================================================================
 * Export
 * ============================================================================
 */

const StorageModule = new StorageClass();

export default StorageModule;
