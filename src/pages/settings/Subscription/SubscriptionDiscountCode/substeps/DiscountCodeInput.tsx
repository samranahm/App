import React, {useCallback} from 'react';
import {View} from 'react-native';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useAutoFocusInput from '@hooks/useAutoFocusInput';
import useLocalize from '@hooks/useLocalize';
import useStepFormSubmit from '@hooks/useStepFormSubmit';
import type {SubStepProps} from '@hooks/useSubStep/types';
import useThemeStyles from '@hooks/useThemeStyles';
import {getFieldRequiredErrors} from '@libs/ValidationUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/SubscriptionDiscountCodeForm';

type DiscountCodeInputProps = SubStepProps;

function DiscountCodeInput({onNext}: DiscountCodeInputProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const {inputCallbackRef} = useAutoFocusInput();

    const updateValuesAndNavigateToNextStep = useStepFormSubmit<typeof ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM>({
        formId: ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM,
        fieldIds: [INPUT_IDS.DISCOUNT_CODE],
        onNext,
        shouldSaveDraft: true,
    });

    const defaultValues = {
        [INPUT_IDS.DISCOUNT_CODE]: '',
    };

    const validate = useCallback(
        (values: FormOnyxValues<typeof ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM>): FormInputErrors<typeof ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM> => {
            const errors = getFieldRequiredErrors(values, [INPUT_IDS.DISCOUNT_CODE]);

            const discountCode = values.discountCode;

            // Add API call to validate discount code
            if (discountCode) {
                // Example: codes starting with 'INVALID' are considered invalid
                // This will be fixed in PR phase after BE implimenatation
                if (discountCode.startsWith('INVALID')) {
                    errors.discountCode = translate('subscription.discountCode.error.invalid');
                }
            }

            return errors;
        },
        [translate],
    );

    return (
        <FormProvider
            formID={ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM}
            submitButtonText={translate('subscription.discountCode.apply')}
            onSubmit={updateValuesAndNavigateToNextStep}
            validate={validate}
            style={[styles.mh5, styles.flexGrow1]}
            enabledWhenOffline
            shouldHideFixErrorsAlert
        >
            <View>
                <Text style={[styles.textNormalThemeText, styles.mb5]}>{translate('subscription.discountCode.enterCode')}</Text>
                <InputWrapper
                    InputComponent={TextInput}
                    ref={inputCallbackRef}
                    inputID={INPUT_IDS.DISCOUNT_CODE}
                    label={translate('subscription.discountCode.discountCode')}
                    aria-label={translate('subscription.discountCode.discountCode')}
                    role={CONST.ROLE.PRESENTATION}
                    defaultValue={defaultValues[INPUT_IDS.DISCOUNT_CODE]}
                    shouldSaveDraft
                    autoCapitalize="none"
                />
            </View>
        </FormProvider>
    );
}

export default DiscountCodeInput;
