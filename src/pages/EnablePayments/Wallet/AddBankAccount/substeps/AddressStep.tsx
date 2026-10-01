/**
 * US address step for the wallet deposit-account flow.
 *
 * The shared personal-bank address step opens a country picker, and that route is not registered on Enable Payments.
 * With no saved country the state field becomes free text. This step keeps the country at US and uses the state picker registered on this route.
 */
import type {FormOnyxValues} from '@components/Form/types';
import CommonAddressStep from '@components/SubStepForms/AddressStep';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import type {SubPageProps} from '@hooks/useSubPage/types';

import {getCurrentAddress, getStreetLines} from '@libs/PersonalDetailsUtils';

import {setDraftValues} from '@userActions/FormActions';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/PersonalBankAccountForm';

import React from 'react';

const BANK_INFO_STEP_KEYS = INPUT_IDS.BANK_INFO_STEP;

const INPUT_KEYS = {
    street: BANK_INFO_STEP_KEYS.STREET,
    city: BANK_INFO_STEP_KEYS.CITY,
    state: BANK_INFO_STEP_KEYS.STATE,
    zipCode: BANK_INFO_STEP_KEYS.ZIP_CODE,
};

const STEP_FIELDS = [BANK_INFO_STEP_KEYS.STREET, BANK_INFO_STEP_KEYS.CITY, BANK_INFO_STEP_KEYS.STATE, BANK_INFO_STEP_KEYS.ZIP_CODE];

function AddressStep({onNext, onMove, isEditing}: SubPageProps) {
    const {translate} = useLocalize();
    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);
    const [personalBankAccountDraft] = useOnyx(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM_DRAFT);

    const currentAddress = getCurrentAddress(privatePersonalDetails);
    const [profileStreet, profileStreetFromLine] = getStreetLines(currentAddress?.street);
    const profileStreet2 = profileStreetFromLine ?? currentAddress?.street2 ?? currentAddress?.addressLine2;
    const profileStreetLine = [profileStreet, profileStreet2].filter((line) => !!line).join(' ');
    const draftStreetLine = personalBankAccountDraft?.addressStreet
        ? [personalBankAccountDraft.addressStreet, personalBankAccountDraft.addressStreet2].filter((line) => !!line).join(' ')
        : undefined;

    const defaultValues = {
        street: draftStreetLine ?? profileStreetLine,
        city: personalBankAccountDraft?.addressCity ?? currentAddress?.city ?? '',
        state: personalBankAccountDraft?.addressState ?? currentAddress?.state ?? '',
        zipCode: personalBankAccountDraft?.addressZipCode ?? currentAddress?.zip ?? '',
        country: CONST.COUNTRY.US,
    };

    const updateAddress = (values: FormOnyxValues<typeof ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM>) => {
        const submittedAddress = {
            [BANK_INFO_STEP_KEYS.STREET]: values.addressStreet?.trim() ?? '',
            [BANK_INFO_STEP_KEYS.STREET_SECOND]: '',
            [BANK_INFO_STEP_KEYS.CITY]: values.addressCity?.trim() ?? '',
            [BANK_INFO_STEP_KEYS.STATE]: values.addressState?.trim() ?? '',
            [BANK_INFO_STEP_KEYS.ZIP_CODE]: values.addressZipCode?.trim().toUpperCase() ?? '',
            [BANK_INFO_STEP_KEYS.COUNTRY]: CONST.COUNTRY.US,
        };
        setDraftValues(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM, submittedAddress);
        onNext(submittedAddress);
    };

    return (
        <CommonAddressStep<typeof ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM>
            isEditing={isEditing}
            onNext={onNext}
            onMove={onMove}
            formID={ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM}
            formTitle={translate('personalInfoStep.whatsYourAddress')}
            formPOBoxDisclaimer={translate('personalInfoStep.addressSubtitle')}
            onSubmit={updateAddress}
            stepFields={STEP_FIELDS}
            inputFieldsIDs={INPUT_KEYS}
            defaultValues={defaultValues}
            shouldAllowCountryChange={false}
            shouldShowHelpLinks
            shouldShowPatriotActLink
            forwardedFSClass={CONST.FULLSTORY.CLASS.MASK}
        />
    );
}

AddressStep.displayName = 'AddBankAccountAddressStep';

export default AddressStep;
