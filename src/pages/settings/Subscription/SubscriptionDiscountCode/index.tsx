import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useSubStep from '@hooks/useSubStep';
import type {SubStepProps} from '@hooks/useSubStep/types';
import Navigation from '@navigation/Navigation';
import {applyDiscountCode} from '@userActions/Subscription';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/SubscriptionDiscountCodeForm';
import DiscountCodeInput from './substeps/DiscountCodeInput';

const bodyContent: Array<React.ComponentType<SubStepProps>> = [DiscountCodeInput];

function SubscriptionDiscountCode() {
    const {translate} = useLocalize();
    const [discountCodeForm] = useOnyx(ONYXKEYS.FORMS.SUBSCRIPTION_DISCOUNT_CODE_FORM);

    const submit = () => {
        const discountCode = discountCodeForm?.[INPUT_IDS.DISCOUNT_CODE] ?? '';
        applyDiscountCode(discountCode);
        // Navigate back after submission
        Navigation.goBack();
    };

    const {
        componentToRender: SubStep,
        isEditing,
        screenIndex,
        nextScreen,
        moveTo,
    } = useSubStep({bodyContent, startFrom: 0, onFinished: submit});

    return (
        <ScreenWrapper
            testID={SubscriptionDiscountCode.displayName}
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={translate('subscription.discountCode.discountCode')}
                onBackButtonPress={() => {
                    Navigation.goBack();
                }}
            />
            <SubStep
                isEditing={isEditing}
                onNext={nextScreen}
                onMove={moveTo}
                screenIndex={screenIndex}
            />
        </ScreenWrapper>
    );
}

SubscriptionDiscountCode.displayName = 'SubscriptionDiscountCode';

export default SubscriptionDiscountCode;
