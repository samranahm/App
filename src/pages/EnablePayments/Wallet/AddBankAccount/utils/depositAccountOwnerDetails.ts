/**
 * Owner name and address for the wallet deposit-account step.
 *
 * AddPersonalBankAccount runs before wallet KYC, so the account is created with whatever this step sends.
 * A saved address only counts when it is already a complete US address, because this route can only collect a US address.
 */
import {normalizeCountryCode} from '@libs/CountryUtils';
import {getCurrentAddress, getStreetLines} from '@libs/PersonalDetailsUtils';

import CONST from '@src/CONST';
import type {EnablePaymentsSubPageType} from '@src/CONST';
import type {PersonalBankAccountForm} from '@src/types/form/PersonalBankAccountForm';
import INPUT_IDS from '@src/types/form/WalletAdditionalDetailsForm';
import type {PrivatePersonalDetails} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';

const ADD_BANK_ACCOUNT_SUB_PAGES = CONST.ENABLE_PAYMENTS.ADD_BANK_ACCOUNT_STEP.SUB_PAGE_NAMES;
const PERSONAL_INFO_STEP_KEYS = INPUT_IDS.PERSONAL_INFO_STEP;

type DepositAccountOwnerDraft = Pick<PersonalBankAccountForm, 'legalFirstName' | 'legalLastName' | 'addressStreet' | 'addressStreet2' | 'addressCity' | 'addressState' | 'addressZipCode'>;

type DepositAccountOwnerDetails = {
    legalFirstName: string;
    legalLastName: string;
    addressStreet: string;
    addressStreet2: string;
    addressCity: string;
    addressState: string;
    addressZipCode: string;
    country: typeof CONST.COUNTRY.US;
};

function hasCompleteUsAddress(privatePersonalDetails: OnyxEntry<PrivatePersonalDetails>): boolean {
    const currentAddress = getCurrentAddress(privatePersonalDetails);
    if (!currentAddress?.street || !currentAddress.city || !currentAddress.state || !currentAddress.zip) {
        return false;
    }

    // Saved profiles sometimes store the country name instead of the code.
    return normalizeCountryCode(currentAddress)?.country === CONST.COUNTRY.US;
}

/**
 * Page names to skip when the profile already has the owner data this step would ask for.
 */
function getSkippedDepositAccountOwnerPages(privatePersonalDetails: OnyxEntry<PrivatePersonalDetails>): EnablePaymentsSubPageType[] {
    const skippedPages: EnablePaymentsSubPageType[] = [];

    if (privatePersonalDetails?.legalFirstName && privatePersonalDetails?.legalLastName) {
        skippedPages.push(ADD_BANK_ACCOUNT_SUB_PAGES.LEGAL_NAME);
    }

    if (hasCompleteUsAddress(privatePersonalDetails)) {
        skippedPages.push(ADD_BANK_ACCOUNT_SUB_PAGES.ADDRESS);
    }

    return skippedPages;
}

/**
 * Draft values win. When a page was skipped, fall back to the saved profile so the request is still complete.
 */
function getDepositAccountOwnerDetails(draft: Partial<DepositAccountOwnerDraft> | null | undefined, privatePersonalDetails: OnyxEntry<PrivatePersonalDetails>): DepositAccountOwnerDetails {
    const currentAddress = getCurrentAddress(privatePersonalDetails);
    const [profileStreet, profileStreetFromLine] = getStreetLines(currentAddress?.street);
    const profileStreet2 = profileStreetFromLine ?? currentAddress?.street2 ?? currentAddress?.addressLine2 ?? '';

    return {
        legalFirstName: draft?.legalFirstName ?? privatePersonalDetails?.legalFirstName ?? '',
        legalLastName: draft?.legalLastName ?? privatePersonalDetails?.legalLastName ?? '',
        addressStreet: draft?.addressStreet ?? profileStreet ?? '',
        addressStreet2: draft?.addressStreet2 ?? profileStreet2,
        addressCity: draft?.addressCity ?? currentAddress?.city ?? '',
        addressState: draft?.addressState ?? currentAddress?.state ?? '',
        addressZipCode: draft?.addressZipCode ?? currentAddress?.zip ?? '',
        country: CONST.COUNTRY.US,
    };
}

/**
 * Wallet KYC stores a single street field. Keep the unit on that field so skipping the KYC address page does not drop it.
 */
function getWalletAdditionalDetailsFromOwner(ownerDetails: DepositAccountOwnerDetails) {
    const addressStreet = ownerDetails.addressStreet2 ? `${ownerDetails.addressStreet}\n${ownerDetails.addressStreet2}` : ownerDetails.addressStreet;

    return {
        [PERSONAL_INFO_STEP_KEYS.FIRST_NAME]: ownerDetails.legalFirstName,
        [PERSONAL_INFO_STEP_KEYS.LAST_NAME]: ownerDetails.legalLastName,
        [PERSONAL_INFO_STEP_KEYS.STREET]: addressStreet,
        [PERSONAL_INFO_STEP_KEYS.CITY]: ownerDetails.addressCity,
        [PERSONAL_INFO_STEP_KEYS.STATE]: ownerDetails.addressState,
        [PERSONAL_INFO_STEP_KEYS.ZIP_CODE]: ownerDetails.addressZipCode,
    };
}

export {getDepositAccountOwnerDetails, getSkippedDepositAccountOwnerPages, getWalletAdditionalDetailsFromOwner};
export type {DepositAccountOwnerDetails};
