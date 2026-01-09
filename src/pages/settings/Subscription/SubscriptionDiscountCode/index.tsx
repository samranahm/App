import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useSubStep from '@hooks/useSubStep';
import type {SubStepProps} from '@hooks/useSubStep/types';
import Navigation from '@navigation/Navigation';
import ROUTES from '@src/ROUTES';
import DiscountCodeInput from './substeps/DiscountCodeInput';

const bodyContent: Array<React.ComponentType<SubStepProps>> = [DiscountCodeInput];

function SubscriptionDiscountCode() {
    const {translate} = useLocalize();

    const submit = () => {
        // TODO: Implement discount code submission logic
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
